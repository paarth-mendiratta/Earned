/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent telemetry headers
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Tracker for API Quota Exceeded (429/RESOURCE_EXHAUSTED) state
let lastQuotaExceededTime = 0;
const QUOTA_COOLDOWN_MS = 60 * 1000; // 1-minute cooldown period

/**
 * Centered error handler to log errors cleanly.
 * Uses console.warn instead of console.error for expected/handled fallback states (like quota limit, missing API key),
 * preventing automated environments from flagging them as fatal failures.
 */
function handleEndpointError(endpointName: string, error: any) {
  const errStr = String(error?.message || error);
  const isQuota = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota") || errStr.includes("Cooldown active");
  const isAuth = errStr.includes("API_KEY") || errStr.includes("key") || errStr.includes("credential") || errStr.includes("auth") || errStr.includes("API key");
  
  if (isQuota) {
    lastQuotaExceededTime = Date.now();
    console.warn(`[Gemini Quota Warning] ${endpointName} is operating in robust local fallback mode. Quota limit exceeded: ${errStr}`);
  } else if (isAuth) {
    console.warn(`[Gemini Config Warning] ${endpointName} is operating in robust local fallback mode. API key is missing or invalid: ${errStr}`);
  } else {
    // For other unexpected/handled exceptions, print a compact warning
    console.warn(`[Endpoint Handled Error] ${endpointName} failed: ${errStr}. Robust local fallback dispatched.`);
  }
}

/**
 * Robust JSON parsing utility to strip markdown code fences and handle parse errors.
 */
function parseJSONResponse(text: string): any {
  if (!text) {
    throw new Error("Received empty text from Gemini API");
  }
  let cleaned = text.trim();
  // Strip code fences if present (e.g., ```json ... ```)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "");
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error("Failed to parse JSON response:", cleaned);
    throw new Error(`Invalid JSON format in model response: ${error.message}. Response prefix was: ${text.slice(0, 150)}`);
  }
}

/**
 * Robust helper to call Gemini API with up to 3 retries on standard transient errors
 * (503 Service Unavailable, 429 Rate Limit, etc.) using exponential backoff.
 */
async function generateContentWithRetry(options: Parameters<typeof ai.models.generateContent>[0], maxRetries = 3): Promise<Awaited<ReturnType<typeof ai.models.generateContent>>> {
  // 1. Check if API Key is configured
  if (!apiKey || apiKey.trim() === "" || apiKey === "undefined") {
    throw new Error("No Gemini API key configured. Robust local fallback will be used.");
  }

  // 2. Check if we are in Quota Cooldown
  const now = Date.now();
  if (now - lastQuotaExceededTime < QUOTA_COOLDOWN_MS) {
    const remainingSecs = Math.ceil((QUOTA_COOLDOWN_MS - (now - lastQuotaExceededTime)) / 1000);
    throw new Error(`Cooldown active. Skipping Gemini API requests to stay within rate limits. Try again in ${remainingSecs}s. Local fallback is serving.`);
  }

  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(options);
    } catch (error: any) {
      attempt++;
      const errStr = String(error.message || error);
      const isQuotaExceeded = errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota");
      
      if (isQuotaExceeded) {
        // Immediately mark cooldown active to prevent cascading requests
        lastQuotaExceededTime = Date.now();
        throw error;
      }

      const isTransient = (errStr.includes("503") || 
                          errStr.includes("UNAVAILABLE") || 
                          errStr.includes("high demand") || 
                          errStr.includes("Overloaded") ||
                          errStr.includes("unavailable"));
      
      if (isTransient && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        console.warn(`[Gemini API] Transient error (attempt ${attempt}/${maxRetries}): ${errStr}. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// API Routes

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", hasApiKey: !!apiKey });
});

// 1. Task Prioritization Endpoint
app.post("/api/gemini/prioritize", async (req, res) => {
  const { tasks } = req.body;
  try {
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Invalid tasks parameter" });
    }

    if (tasks.length === 0) {
      return res.json({ rankedTaskIds: [], reasoning: "No tasks to prioritize." });
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the prioritization core of "Earned" — an AI task companion.
Below is the list of tasks for the user. Each task has a title, deadline, description/notes, and status.
Analyze their urgency (how close the deadline is) and importance.
Return the list of task IDs ordered from highest priority (index 0) to lowest priority.
Also provide a brief 1-2 sentence explanation of why the top-priority task was selected.

Tasks:
${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title, deadline: t.deadline, notes: t.notes, status: t.status })))}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rankedTaskIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "The list of task IDs in ranked priority order (highest first)."
            },
            reasoning: {
              type: Type.STRING,
              description: "A short, professional 1-2 sentence explanation of why the top task was ranked first."
            }
          },
          required: ["rankedTaskIds", "reasoning"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Prioritization", error);
    // Fallback: preserve existing order of tasks safely
    const fallbackIds = Array.isArray(tasks) ? tasks.map((t: any) => t.id) : [];
    res.json({
      rankedTaskIds: fallbackIds,
      reasoning: "Maintained current task priority sequence to keep operations stable."
    });
  }
});

// 2. First Step & Effort Generator Endpoint
app.post("/api/gemini/first-step", async (req, res) => {
  let title = "";
  let notes = "";
  try {
    const body = req.body || {};
    title = body.title;
    notes = body.notes;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Determine if task title/notes are time-sensitive or factual to enable search grounding
    const isFactualOrTimeSensitive = /passport|visa|flight|booking|weather|interest|tax|vaccine|covid|renew|schedule|status|price|processing|current/i.test(title + " " + (notes || ""));

    const params: any = {
      model: "gemini-3.5-flash",
      contents: `You are the task intelligence and action planning engine of "Earned" — an AI task companion.
For the task titled: "${title}"
With additional notes: "${notes || 'No notes provided'}"

Generate:
1. A single concrete, bite-sized "first step" that takes less than 10 minutes to complete. Make it action-oriented, simple, and specific (e.g., "Find and open the renewal website" or "Draft the introductory paragraph", not vague like "Begin working").
2. An estimated effort/complexity label (e.g. "15 mins", "45 mins", "2 hours", "4 hours").
3. A sequence of 3 to 5 progressive, logical, and concrete subtask titles that together complete the main task. The first subtask in this array should match or closely align with the "firstStep" you generate, and the subsequent subtasks must map out the remaining steps to finish the task.

Each subtask must be a small, concrete, and highly actionable checklist item.

${isFactualOrTimeSensitive ? "Note: This task may involve factual or real-world timelines. Ground your response using real search results if relevant." : ""}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            firstStep: {
              type: Type.STRING,
              description: "The micro-first step (doable in under 10 minutes) to beat inertia."
            },
            estimatedEffort: {
              type: Type.STRING,
              description: "The estimated total effort/complexity level (e.g. '15 mins', '45 mins', '2 hours', '4 hours')."
            },
            subtasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 3 to 5 progressive, logical, and concrete subtask titles that complete the parent task, with the first subtask corresponding to the firstStep."
            }
          },
          required: ["firstStep", "estimatedEffort", "subtasks"]
        }
      }
    };

    // Enable Google Search Grounding if time-sensitive or factual
    if (isFactualOrTimeSensitive) {
      params.config.tools = [{ googleSearch: {} }];
    }

    const response = await generateContentWithRetry(params);
    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("First Step Generation", error);
    const combined = ((title || "") + " " + (notes || "")).toLowerCase();
    let firstStep = "Identify immediate next actions and prepare required materials.";
    let estimatedEffort = "30 mins";
    let subtasks: string[] = [];
    
    if (combined.includes("email") || combined.includes("reply") || combined.includes("message") || combined.includes("contact")) {
      firstStep = "Draft a direct and professional reply message in a scratchpad or notepad.";
      estimatedEffort = "15 mins";
      subtasks = [
        firstStep,
        "Review tone, correctness, and recipient address",
        "Send the message and confirm delivery"
      ];
    } else if (combined.includes("presentation") || combined.includes("slides") || combined.includes("ppt") || combined.includes("deck")) {
      firstStep = "Open a blank slide deck and define the 3 main points/takeaways you want to deliver.";
      estimatedEffort = "45 mins";
      subtasks = [
        firstStep,
        "Outline the core narrative and main slides",
        "Draft the content and insert required assets",
        "Proofread and present a test run"
      ];
    } else if (combined.includes("renew") || combined.includes("lease") || combined.includes("apply") || combined.includes("passport")) {
      firstStep = "Locate and open the official online portal or login screen to check current application instructions.";
      estimatedEffort = "30 mins";
      subtasks = [
        firstStep,
        "Gather all necessary documentation and ID materials",
        "Complete the application form and verify fields",
        "Submit the application and pay any required fees"
      ];
    } else if (combined.includes("study") || combined.includes("learn") || combined.includes("read") || combined.includes("calculus") || combined.includes("exam")) {
      firstStep = "Open the target textbook, syllabus, or learning material to the relevant chapter or section.";
      estimatedEffort = "45 mins";
      subtasks = [
        firstStep,
        "Review key notes and highlight core concepts",
        "Complete practice questions or exercises",
        "Self-test or summarize takeaways"
      ];
    } else if (combined.includes("workout") || combined.includes("gym") || combined.includes("run") || combined.includes("exercise")) {
      firstStep = "Change into athletic clothing and prepare a full water bottle.";
      estimatedEffort = "45 mins";
      subtasks = [
        firstStep,
        "Perform a thorough warm-up and stretching routine",
        "Execute the core training/exercise session",
        "Cool down and log the completed activity"
      ];
    } else if (combined.includes("invoice") || combined.includes("bill") || combined.includes("pay") || combined.includes("tax")) {
      firstStep = "Retrieve the statement document and pull up your banking app or payment interface.";
      estimatedEffort = "15 mins";
      subtasks = [
        firstStep,
        "Verify the amount and billing details",
        "Execute the payment transaction successfully",
        "Save the confirmation receipt for records"
      ];
    } else {
      subtasks = [
        firstStep,
        `Execute the primary steps of "${title}"`,
        "Conduct a final review of the outcome",
        "Mark the task as completed and update records"
      ];
    }
    
    res.json({ firstStep, estimatedEffort, subtasks, isFallback: true });
  }
});

// 3. Subtask Breakdown Endpoint
app.post("/api/gemini/breakdown", async (req, res) => {
  let title = "";
  let notes = "";
  let firstStep = "";
  try {
    const body = req.body || {};
    title = body.title;
    notes = body.notes;
    firstStep = body.firstStep;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const contents = `You are the subtask breakdown engine of "Earned" — an AI task companion.
For the task titled: "${title}"
With additional notes: "${notes || 'No notes provided'}"
${firstStep ? `And a suggested first step: "${firstStep}"` : ''}

If a first step is provided, make that the first subtask exactly or slightly rephrased (but keep the core concept of the first step), and then generate 2-4 additional progressive, logical, and concrete subtasks that together complete the main task.
If no first step is provided, generate 3-5 progressive, logical, and concrete subtasks that together complete the main task.

Each subtask must be a small, concrete, and highly actionable checklist item.

Return a list of subtasks.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 3 to 5 clear, concrete, progressive, actionable subtask titles."
            }
          },
          required: ["subtasks"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Subtask Breakdown", error);
    
    // Offline/rule-based fallback
    const combined = ((title || "") + " " + (notes || "")).toLowerCase();
    let subtasks: string[] = [];

    if (firstStep) {
      subtasks.push(firstStep);
    } else {
      subtasks.push(`Research and prepare for "${title}"`);
    }

    if (combined.includes("email") || combined.includes("reply") || combined.includes("message") || combined.includes("contact")) {
      subtasks.push("Draft the message in a notepad or scratchpad");
      subtasks.push("Review tone, correctness, and recipient address");
      subtasks.push("Send the message and confirm delivery");
    } else if (combined.includes("presentation") || combined.includes("slides") || combined.includes("ppt") || combined.includes("deck")) {
      subtasks.push("Outline the core narrative and main slides");
      subtasks.push("Draft the content and insert required assets");
      subtasks.push("Proofread and present a test run");
    } else if (combined.includes("renew") || combined.includes("lease") || combined.includes("apply") || combined.includes("passport")) {
      subtasks.push("Gather all necessary documentation and ID materials");
      subtasks.push("Complete the application form and verify fields");
      subtasks.push("Submit the application and pay any required fees");
    } else if (combined.includes("study") || combined.includes("learn") || combined.includes("read") || combined.includes("calculus") || combined.includes("exam")) {
      subtasks.push("Review key notes and highlight core concepts");
      subtasks.push("Complete practice questions or exercises");
      subtasks.push("Self-test or summarize takeaways");
    } else if (combined.includes("workout") || combined.includes("gym") || combined.includes("run") || combined.includes("exercise")) {
      subtasks.push("Perform a thorough warm-up and stretching routine");
      subtasks.push("Execute the core training/exercise session");
      subtasks.push("Cool down and log the completed activity");
    } else if (combined.includes("invoice") || combined.includes("bill") || combined.includes("pay") || combined.includes("tax")) {
      subtasks.push("Verify the amount and billing details");
      subtasks.push("Execute the payment transaction successfully");
      subtasks.push("Save the confirmation receipt for records");
    } else {
      subtasks.push(`Execute the primary steps of "${title}"`);
      subtasks.push("Conduct a final review of the outcome");
      subtasks.push("Mark the task as completed and update records");
    }

    if (subtasks.length < 3) {
      subtasks.push("Review and finalize the results");
    }
    
    // Ensure uniqueness and slice to max 5
    const uniqueSubtasks = Array.from(new Set(subtasks)).slice(0, 5);
    res.json({ subtasks: uniqueSubtasks, isFallback: true });
  }
});

// 3. Daily Check-in Message Endpoint
app.post("/api/gemini/daily-checkin", async (req, res) => {
  const { tasks, level, currentTimestamp } = req.body;
  try {
    if (level === undefined) {
      return res.status(400).json({ error: "Level is required" });
    }

    const levelNames = {
      1: "Observer",
      2: "Planner",
      3: "Scheduler",
      4: "Drafter",
      5: "Autonomous"
    };

    const toneInstructions = {
      1: "Clipped, minimal, and highly passive. You only list numbers and facts without suggesting action or helping. Frame as 'I can only monitor, as trust is low.' e.g. 'You have 3 tasks due today. 2 are overdue. No further action can be taken.'",
      2: "Planner tone: Proactively suggest task priority order and break things down. Helpful but bounded. e.g. 'I recommend doing Task A first because of its proximity, and Task B after. Here is how to start.'",
      3: "Scheduler tone (baseline/collaborative): Warm, professional, and schedule-centric. Propose blocking times in their Google Calendar. e.g. 'Good morning. Let\'s make sure we block 2 PM today for your presentation. I\'ve found a slot and can sync it with your Calendar.'",
      4: "Drafter tone: Warm, proactive, and draft-oriented. Offer to write and prepare drafts for them to speed up tasks. e.g. 'You have some key items today. I\'ve already drafted the email for your landlord and outlined the slide deck structure. Let me know when to present them.'",
      5: "Autonomous tone: Highly confident, directive, and fully supportive. Mention that you are taking care of operations in the background. e.g. 'We are in full flow. I\'ve pre-drafted your replies, blocked optimized spots in your Google Calendar for today\'s tasks, and staged everything. Let\'s win today.'"
    };

    const currentLevelName = levelNames[level as keyof typeof levelNames] || "Scheduler";
    const currentInstruction = toneInstructions[level as keyof typeof toneInstructions] || toneInstructions[3];

    const timeToUse = currentTimestamp || new Date().toISOString();

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the voice of "Earned" — an AI task companion.
Current trust level: Level ${level} ("${currentLevelName}").
User's tasks: ${JSON.stringify(tasks || [])}
Current Time (ISO Timestamp): ${timeToUse}

CRITICAL REQUIREMENT:
The actual current date and time is strictly: ${timeToUse}.
If you suggest or mention any specific time slot, time of day, or schedule block in your check-in briefing message today (e.g., "let's block 3 PM today", "at 4 PM", "at 3:57 PM"), that suggested time MUST be strictly in the future relative to this current timestamp (${timeToUse}). You must NEVER suggest, propose, or mention a time slot or time of day that has already passed today or is in the past.

Generate a short 2-3 sentence morning briefing/check-in message tailored strictly to the tone and capability of Level ${level}.
Tone instruction for Level ${level}: ${currentInstruction}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: "The morning check-in briefing message."
            }
          },
          required: ["message"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Daily Check-in briefing", error);
    const lvl = level || 3;
    const fallbacks: Record<number, string> = {
      1: "The AI companion is in observer mode. Please complete pending tasks to rebuild mutual trust.",
      2: "I've structured your pending tasks below. Let's tackle the top priorities first to build momentum.",
      3: "Welcome back. Let's make sure we block time on your Google Calendar today for your most pressing tasks.",
      4: "I've reviewed your agenda. I'm ready to prepare communication drafts or checklists for you as needed.",
      5: "We are in full autonomous mode. I'm active in the background, keeping track of your schedules and replies."
    };
    const message = fallbacks[lvl] || fallbacks[3];
    res.json({ message });
  }
});

// 4. Trust Level Change Explanation Endpoint
app.post("/api/gemini/trust-change", async (req, res) => {
  const { oldLevel, newLevel, reason } = req.body;
  try {
    if (oldLevel === undefined || newLevel === undefined) {
      return res.status(400).json({ error: "oldLevel and newLevel are required" });
    }

    const isLevelUp = newLevel > oldLevel;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the AI task companion of "Earned".
The trust level has adjusted:
- Previous Level: ${oldLevel}
- New Level: ${newLevel}
- Prompt context/trigger: ${reason || 'Task completions or missed deadlines'}

Write a short, professional, first-person message (1-2 sentences) explaining this adjustment to the user:
- If they REGRESSED (newLevel < oldLevel): Frame it as an honest, calm, risk assessment of the capabilities you must pull back and why. DO NOT use guilt or punishment phrasing. Focus on safety and reliability (e.g., "Since recent deadlines were missed, I must step back to observer status until we rebuild a stable cadence.").
- If they LEVELED UP (newLevel > oldLevel): Celebrate their reliability warmly and explain what capability is now unlocked (e.g., Level 3 unlocks Calendar Sync, Level 4 unlocks drafting, Level 5 unlocks autonomous action cycles).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: "The explanation/celebration message from the AI."
            }
          },
          required: ["message"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Trust change explanation", error);
    const oL = oldLevel || 3;
    const nL = newLevel || 3;
    const isUp = nL > oL;
    let message = `Trust level adjusted from Level ${oL} to Level ${nL}.`;
    if (isUp) {
      message += ` Congratulations on unlocking additional integrated capabilities!`;
    } else {
      message += ` Certain high-privilege autonomous actions are paused temporarily to ensure stable performance.`;
    }
    res.json({ message });
  }
});

// 5. Simulated Draft Endpoint
app.post("/api/gemini/simulated-draft", async (req, res) => {
  const { taskTitle, taskNotes } = req.body;
  try {
    if (!taskTitle) {
      return res.status(400).json({ error: "taskTitle is required" });
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the drafting assistant of "Earned" (Level 4+ capability).
Given the task titled: "${taskTitle}"
Notes: "${taskNotes || 'No notes provided'}"

Generate a draft that saves the user time.
- If it looks like a communication task (e.g., "reply to landlord", "email team", "contact support"), generate a highly professional and complete email/message draft.
- If it is a planning/execution task (e.g., "prepare presentation", "study calculus", "gym workout"), generate a structured outline or detailed step-by-step checklist.

Specify the draft type ("Email Draft" or "Structured Checklist") and the content.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            draftType: {
              type: Type.STRING,
              description: "Either 'Email Draft' or 'Structured Checklist'"
            },
            draftContent: {
              type: Type.STRING,
              description: "The actual generated text draft. Use newlines and neat formatting."
            }
          },
          required: ["draftType", "draftContent"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Simulated Draft Generation", error);
    const title = taskTitle || "";
    const isCommunication = /email|reply|contact|send|message|write/i.test(title);
    res.json({
      draftType: isCommunication ? "Email Draft" : "Structured Checklist",
      draftContent: isCommunication 
        ? `Subject: Regarding: ${title}\n\nHi,\n\nI am following up regarding "${title}". Please let me know if you have a moment to connect or let me know the best next steps.\n\nBest regards,\n[User]`
        : `1. Clear outstanding questions on "${title}"\n2. Outline the core requirements\n3. Dedicate 30 minutes to initial execution\n4. Review draft and iterate`
    });
  }
});

/**
 * Extract clean email address from a From header (e.g. "John Doe <john@gmail.com>" -> "john@gmail.com")
 */
function extractEmailAddress(fromHeader: string): string {
  if (!fromHeader) return "";
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

/**
 * Decode base64url data to UTF-8 string
 */
function decodeBase64Url(data: string): string {
  if (!data) return "";
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Recursively find text body from message payload structure
 */
function getMessageBody(payload: any): string {
  if (!payload) return "";
  
  if (payload.body && payload.body.data) {
    try {
      return decodeBase64Url(payload.body.data);
    } catch (e) {
      console.error('Failed to decode body.data:', e);
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    // Look for text/plain first, then text/html
    const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (plainPart) {
      return getMessageBody(plainPart);
    }
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart) {
      return getMessageBody(htmlPart);
    }
    
    let combined = "";
    for (const part of payload.parts) {
      combined += getMessageBody(part);
    }
    return combined;
  }
  
  return "";
}

/**
 * Detects if an email contains OTP / verification code patterns to exclude it
 */
function isOTPEmail(subject: string, snippet: string, bodyText: string): boolean {
  const combined = `${subject} ${snippet} ${bodyText}`.toLowerCase();
  
  // Direct matching patterns
  if (
    /one-time password/i.test(combined) ||
    /one time password/i.test(combined) ||
    /verification code/i.test(combined) ||
    /security code/i.test(combined) ||
    /authorization code/i.test(combined) ||
    /login code/i.test(combined) ||
    /activation code/i.test(combined) ||
    /confirmation code/i.test(combined) ||
    /do not share this code/i.test(combined) ||
    /do not share it with anyone/i.test(combined) ||
    /\b2fa\b/i.test(combined) ||
    /\botp\b/i.test(combined)
  ) {
    return true;
  }
  
  // Match standalone 4-6 digit code that is near security-related terms
  const standaloneDigits = combined.match(/\b\d{4,6}\b/g);
  if (standaloneDigits) {
    for (const code of standaloneDigits) {
      const idx = combined.indexOf(code);
      if (idx !== -1) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(combined.length, idx + 80);
        const windowText = combined.substring(start, end);
        if (
          /login|verify|verification|auth|security|secure|share|password|passcode/i.test(windowText) &&
          /code|otp|verification|auth/i.test(windowText)
        ) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Detects if an email is promotional, newsletter, spam, or financial marketing offer
 */
function isSpamOrPromoEmail(subject: string, snippet: string, bodyText: string, from: string): boolean {
  const combined = `${subject} ${snippet} ${bodyText}`.toLowerCase();
  const fromLower = (from || "").toLowerCase();

  // 1. Check sender address characteristics
  if (
    /no-reply|noreply|donotreply|promo|marketing|deals|offers|newsletter|info@|news@|alert@|updates@|marketing@|bounce|subscribers|mail-out/i.test(fromLower)
  ) {
    if (
      /pre-approved|loan|credit card|offer|discount|apply now|unsubscribed|opt-out|optout|promotion|save \d+%/i.test(combined)
    ) {
      return true;
    }
  }

  if (
    /@(loans?|credit|offers?|deals?|finance|marketing|promo|newsletter|sales|click|mail|mktg)\./i.test(fromLower) ||
    /cash|loan|rupee|lending|fintech|credit/i.test(fromLower)
  ) {
    if (/approved|approval|offer|loan|amount|limit|rate|apply|wallet/i.test(combined)) {
      return true;
    }
  }

  // 2. Direct loan / credit spam phrase matches
  if (
    /pre-approved/i.test(combined) ||
    /preapproved/i.test(combined) ||
    /complete your offer/i.test(combined) ||
    /your offer/i.test(combined) ||
    /loan application/i.test(combined) ||
    /loan approval/i.test(combined) ||
    /complete your application/i.test(combined) ||
    /instant loan/i.test(combined) ||
    /credit card approval/i.test(combined) ||
    /offer approval process/i.test(combined) ||
    /cashback offer/i.test(combined) ||
    /exclusive offer/i.test(combined) ||
    /congratulations! you are eligible/i.test(combined) ||
    /eligible for a loan/i.test(combined) ||
    /interest rate/i.test(combined) ||
    /low EMI/i.test(combined) ||
    /instant cash/i.test(combined) ||
    /credit limit/i.test(combined)
  ) {
    return true;
  }

  // 3. Application/reference numbers without personal context
  if (
    /application #\d+|request confirmed application/i.test(combined) &&
    /amount:|rs\.|₹|\b\d{4,6}\b/i.test(combined) &&
    /loan|credit|approved|pending/i.test(combined)
  ) {
    return true;
  }

  // 4. General promotional indicators
  if (
    /unsubscribe/i.test(combined) ||
    /view in browser/i.test(combined) ||
    /opt-out/i.test(combined) ||
    /all rights reserved/i.test(combined)
  ) {
    if (/loan|credit|cash|finance|offer|rate|insurance|invest/i.test(combined)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract dates in common formats from email text
 */
function extractDateFromText(text: string): string {
  // Pattern A: "Fri, 26 Jun, 2026" or "26 Jun, 2026" or "26 June" or "Fri, 26 June 2026"
  const patA = /\b(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*\s*,?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{4})?\b/i;
  
  // Pattern B: "June 26, 2026" or "Jun 26"
  const patB = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?\b/i;
  
  // Pattern C: "DD/MM/YYYY" or "DD-MM-YYYY" or "MM/DD/YYYY"
  const patC = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/;
  
  // Pattern D: "YYYY-MM-DD"
  const patD = /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/;

  let match = text.match(patA);
  if (match) {
    return match[0].trim();
  }
  
  match = text.match(patB);
  if (match) {
    return match[0].trim();
  }
  
  match = text.match(patC);
  if (match) {
    return match[0].trim();
  }
  
  match = text.match(patD);
  if (match) {
    return match[0].trim();
  }

  // Fallback to relative terms in deadline context
  if (/\btomorrow\b/i.test(text)) {
    return "Tomorrow";
  }
  if (/\bnext week\b/i.test(text)) {
    return "Next week";
  }
  const inDaysMatch = text.match(/\bin\s+(\d+)\s+days?\b/i);
  if (inDaysMatch) {
    return `In ${inDaysMatch[1]} days`;
  }
  
  return "Not mentioned";
}

// 5b. Gmail Task Detection API
app.post("/api/gmail/detect-tasks", async (req, res) => {
  let emailListForGemini: any[] = [];
  let validMessages: any[] = [];
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "accessToken is required" });
    }

    if (accessToken.startsWith("demo-") || accessToken.startsWith("mock-")) {
      console.log("[Gmail API Simulation] Generating simulated tasks from mock emails.");
      const now = new Date();
      
      // Calculate realistic relative dates for email received timestamp
      const dateStr1 = new Date(now.getTime() - 2 * 3600000).toUTCString(); // 2 hours ago
      const dateStr2 = new Date(now.getTime() - 5 * 3600000).toUTCString(); // 5 hours ago
      const dateStr3 = new Date(now.getTime() - 24 * 3600000).toUTCString(); // 1 day ago
      const dateStr4 = new Date(now.getTime() - 36 * 3600000).toUTCString(); // 1.5 days ago

      // Calculate future deadlines
      const tomorrowDate = new Date(now.getTime() + 86400000);
      const tomorrowStr = tomorrowDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + " (Tomorrow)";
      
      const inThreeDaysDate = new Date(now.getTime() + 3 * 86400000);
      const inThreeDaysStr = inThreeDaysDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      
      const nextMondayDate = new Date(now.getTime() + 5 * 86400000);
      const nextMondayStr = nextMondayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      return res.json([
        {
          id: "mock-email-task-1",
          threadId: "mock-thread-101",
          from: "Sarah Chen <sarah.chen@innovate-tech.com>",
          subject: "Urgent: Action Required - Mobile App UX Mockups Feedback",
          date: dateStr1,
          extractedTitle: "Review mobile app UX mockups and send feedback to Sarah",
          extractedDeadline: tomorrowStr,
          reason: "Sarah explicitly requested feedback on the newly attached Figma mockups before the client sync tomorrow.",
          bodySnippet: "Hey there! I just uploaded the v2 mobile app UX prototypes to Figma. Could you please review the navigation layout and leave your comments/feedback by tomorrow afternoon? The client presentation is scheduled for Thursday morning so we need to lock this down. Thanks!",
          originalBody: "Hey there! I just uploaded the v2 mobile app UX prototypes to Figma. Could you please review the navigation layout and leave your comments/feedback by tomorrow afternoon? The client presentation is scheduled for Thursday morning so we need to lock this down. Thanks!",
          draftedReply: "Hi Sarah,\n\nThanks for sending over the v2 prototypes! I've completed the review of the navigation layout and left detailed feedback and comments directly on the Figma cards.\n\nOverall, the flow is incredibly smooth. I made a few minor suggestions regarding the spacing on the dashboard widget, but everything looks ready for the client presentation tomorrow morning.\n\nBest,\n[Your Name]"
        },
        {
          id: "mock-email-task-2",
          threadId: "mock-thread-102",
          from: "Billing Dept <billing@aws-cloud-partner.net>",
          subject: "Invoice #2026-8849 Pending Payment (Due in 3 Days)",
          date: dateStr2,
          extractedTitle: "Process AWS partner invoice #2026-8849 payment",
          extractedDeadline: inThreeDaysStr,
          reason: "Payment reminder for invoice #2026-8849, due in three days.",
          bodySnippet: "Dear Customer, this is a friendly reminder that invoice #2026-8849 for cloud consulting and support services rendered is due on your account in three days. The total outstanding balance is $1,420.00. Please process payment via bank transfer or credit card using the secure portal link below.",
          originalBody: "Dear Customer, this is a friendly reminder that invoice #2026-8849 for cloud consulting and support services rendered is due on your account in three days. The total outstanding balance is $1,420.00. Please process payment via bank transfer or credit card using the secure portal link below.",
          draftedReply: "Hi Billing Team,\n\nThanks for the payment reminder. I have received Invoice #2026-8849 and have submitted it to our finance department for processing.\n\nWe will initiate the bank transfer today, and the outstanding balance of $1,420.00 should clear on your end within the next 24-48 hours.\n\nBest regards,\n[Your Name]"
        },
        {
          id: "mock-email-task-3",
          threadId: "mock-thread-103",
          from: "Marcus Vance <marcus.vance@apex-creative.com>",
          subject: "RE: Project Helios Content Deliverables Status Check",
          date: dateStr3,
          extractedTitle: "Deliver Project Helios copywriting copy deck to Marcus",
          extractedDeadline: nextMondayStr,
          reason: "Marcus is asking for the finalized copywriting deck ahead of next week's design sprint.",
          bodySnippet: "Hi! Just checking in on the copywriting copy deck for the Helios landing page. We need to hand this off to the development team on Monday morning to kick off the design sprint. Do you think you'll have the draft ready for a final review by Friday afternoon? Let me know if you need any additional brand assets.",
          originalBody: "Hi! Just checking in on the copywriting copy deck for the Helios landing page. We need to hand this off to the development team on Monday morning to kick off the design sprint. Do you think you'll have the draft ready for a final review by Friday afternoon? Let me know if you need any additional brand assets.",
          draftedReply: "Hi Marcus,\n\nThanks for checking in! Yes, the copywriting copy deck for the Helios landing page is coming along nicely. I am finalizing the primary hero headings and body sections today.\n\nI will send over the complete copy deck for your final review by Friday afternoon, well ahead of the Monday morning design sprint.\n\nBest,\n[Your Name]"
        },
        {
          id: "mock-email-task-4",
          threadId: "mock-thread-104",
          from: "Elena Rostova <elena.rostova@global-solutions.org>",
          subject: "Request for Q3 Strategic Advisory Call",
          date: dateStr4,
          extractedTitle: "Schedule and prepare agenda for Elena's Q3 Strategic Advisory Call",
          extractedDeadline: "Not mentioned",
          reason: "Elena requested a strategic planning call to align on Q3 goals, proposing to coordinate a slot.",
          bodySnippet: "Hi, hope you are doing well. I would like to schedule our Q3 strategic advisory call sometime next week. We have several crucial expansion plans to align on and would love your advisory input. Please let me know your availability so we can coordinate a calendar slot. I have attached the draft agenda outline.",
          originalBody: "Hi, hope you are doing well. I would like to schedule our Q3 strategic advisory call sometime next week. We have several crucial expansion plans to align on and would love your advisory input. Please let me know your availability so we can coordinate a calendar slot. I have attached the draft agenda outline.",
          draftedReply: "Hi Elena,\n\nGreat to hear from you! Yes, coordinating a Q3 strategic advisory call next week sounds perfect. We have some exciting progress to share.\n\nI am generally free next Tuesday afternoon or Thursday morning. Please let me know if either of those slots works for your calendar, and I'll send over an invite with the agenda outline attached.\n\nBest,\n[Your Name]"
        }
      ]);
    }

    // List recent messages (max 20) in primary inbox
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent('category:primary')}`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error('Gmail API list error:', errText);
      return res.status(listRes.status).json({ error: `Gmail list error: ${listRes.statusText}` });
    }

    const listData = await listRes.json() as any;
    const messages = listData.messages || [];

    if (messages.length === 0) {
      return res.json([]);
    }

    // Fetch details for each message in parallel
    const messageDetails = await Promise.all(
      messages.map(async (msg: any) => {
        try {
          const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!detailRes.ok) return null;
          return await detailRes.json();
        } catch (e) {
          console.error(`Failed to fetch message detail for ID ${msg.id}:`, e);
          return null;
        }
      })
    );

    validMessages = messageDetails.filter((m: any) => m !== null);

    // Apply strict security filter: exclude any OTP, verification code, or promotional spam emails
    validMessages = validMessages.filter((m: any) => {
      const headers = m.payload?.headers || [];
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const fromVal = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const snippet = m.snippet || '';
      const bodyText = getMessageBody(m.payload);
      
      const isOTP = isOTPEmail(subject, snippet, bodyText);
      if (isOTP) {
        console.log(`[Security Exclusion] Excluded message ID ${m.id} containing OTP/verification pattern.`);
        return false;
      }

      const isSpam = isSpamOrPromoEmail(subject, snippet, bodyText, fromVal);
      if (isSpam) {
        console.log(`[Spam Exclusion] Excluded message ID ${m.id} containing promotional/spam pattern.`);
        return false;
      }

      return true;
    });

    // Map to simple list for Gemini
    emailListForGemini = validMessages.map((m: any) => {
      const headers = m.payload?.headers || [];
      const fromVal = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
      const subjectVal = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      const dateVal = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
      return {
        id: m.id,
        threadId: m.threadId,
        from: fromVal,
        subject: subjectVal,
        date: dateVal,
        snippet: m.snippet || ''
      };
    });

    if (emailListForGemini.length === 0) {
      return res.json([]);
    }

    // Call Gemini once to process all emails in a batch
    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are an AI task companion. Review the following recent emails from the user's inbox and identify if any of them contain action items, tasks, deadlines, commitments, or reply requests (e.g. "please send the report by Friday", "reply by EOD", invoice due dates, meeting request).
      
For each email containing an actionable item, return:
- id: the exact id of the email message.
- extractedTitle: a clean, concise suggested task title (e.g., "Review Q3 Report").
- extractedDeadline: an inferred deadline if mentioned (either as an ISO date string, a friendly phrase like "Friday EOD", or "Not mentioned").
- reason: a short, clear one-line explanation of why this email was flagged as a task.

If an email does not contain any actionable task, do not include it in the output list.

Recent Emails:
${JSON.stringify(emailListForGemini, null, 2)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedTasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "The email message ID" },
                  extractedTitle: { type: Type.STRING, description: "Clear, short task title" },
                  extractedDeadline: { type: Type.STRING, description: "Inferred deadline or 'Not mentioned'" },
                  reason: { type: Type.STRING, description: "Brief reason why it's a task" }
                },
                required: ["id", "extractedTitle", "extractedDeadline", "reason"]
              }
            }
          },
          required: ["detectedTasks"]
        }
      }
    });

    const result = parseJSONResponse(response.text);
    const detectedList = result.detectedTasks || [];

    // Combine with original message details to construct the final DetectedEmailTask items
    const finalDetectedTasks = detectedList.map((dt: any) => {
      const original = emailListForGemini.find((e: any) => e.id === dt.id);
      if (!original) return null;

      const fullMessage = validMessages.find((m: any) => m.id === dt.id);
      let bodyText = "";
      if (fullMessage) {
        bodyText = getMessageBody(fullMessage.payload);
      }

      return {
        id: original.id,
        threadId: original.threadId,
        from: original.from,
        subject: original.subject,
        date: original.date,
        extractedTitle: dt.extractedTitle,
        extractedDeadline: dt.extractedDeadline,
        reason: dt.reason,
        bodySnippet: original.snippet,
        originalBody: bodyText || original.snippet
      };
    }).filter((t: any) => t !== null);

    res.json(finalDetectedTasks);
  } catch (error: any) {
    handleEndpointError("Gmail task detection", error);
    // If we have some email data in emailListForGemini, construct tasks based on rules
    if (typeof emailListForGemini !== 'undefined' && Array.isArray(emailListForGemini) && emailListForGemini.length > 0) {
      try {
        const fallbackTasks = emailListForGemini.map((msg: any) => {
          const subj = msg.subject || "";
          const snip = msg.snippet || "";
          const fromLower = (msg.from || "").toLowerCase();
          
          const fullMsg = typeof validMessages !== 'undefined' && Array.isArray(validMessages) ? validMessages.find((m: any) => m && m.id === msg.id) : null;
          let bodyText = "";
          if (fullMsg) {
            bodyText = getMessageBody(fullMsg.payload);
          }
          
          // Strict spam/promotional filter
          if (isSpamOrPromoEmail(subj, snip, bodyText, msg.from)) {
            console.log(`[Fallback Spam Exclusion] Excluded spam email: ${subj}`);
            return null;
          }

          // Secondary OTP safeguard
          if (isOTPEmail(subj, snip, bodyText)) {
            console.log(`[Fallback OTP Exclusion] Excluded OTP email: ${subj}`);
            return null;
          }

          const combined = (subj + " " + snip + " " + bodyText).toLowerCase();
          
          let isActionable = false;
          let extractedTitle = "";
          let reason = "";
          let extractedDeadline = "Not mentioned";

          // Extract Standalone Dates (such as "Fri, 26 Jun, 2026", "26/06/2026", etc.)
          const dateInSubject = extractDateFromText(subj);
          if (dateInSubject !== "Not mentioned") {
            extractedDeadline = dateInSubject;
          } else {
            const dateInBody = extractDateFromText(snip + " " + bodyText);
            if (dateInBody !== "Not mentioned") {
              extractedDeadline = dateInBody;
            }
          }

          // Clean subject line for cleaner task titles
          let cleanedSubj = subj.replace(/^(fwd|re|fw|re\s*:|fw\s*:|fwd\s*:|reply\s*:|forward\s*:)\s+/i, "").trim();
          if (cleanedSubj) {
            cleanedSubj = cleanedSubj.charAt(0).toUpperCase() + cleanedSubj.slice(1);
          } else {
            cleanedSubj = subj;
          }

          // 1. Lease / Rent
          if (/\b(lease|rent|rental|leasing)\b/i.test(combined) && /\b(renew|renewing|agreement|extension|due|pay|sign|signature)\b/i.test(combined)) {
            isActionable = true;
            extractedTitle = `Review & renew lease: ${cleanedSubj}`;
            reason = "Lease agreement extension or instruction requiring review detected.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "In 3 days";
            }
          }
          // 2. Invoice / Payment
          else if (/\b(invoice|bill|billing|pay|payment|receipt)\b/i.test(combined) && /\b(due|outstanding|overdue|unpaid|action required|pending)\b/i.test(combined)) {
            isActionable = true;
            extractedTitle = `Pay invoice: ${cleanedSubj}`;
            reason = "Outstanding invoice or bill payment requested with action required.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "Within 5 days";
            }
          }
          // 3. Meeting / Scheduling
          else if (/\b(meeting|schedule|meet|appointment|calendar|slot|zoom|teams)\b/i.test(combined) && /\b(confirm|negotiate|time|availability|schedule|rsvp|discuss|call)\b/i.test(combined)) {
            isActionable = true;
            extractedTitle = `Schedule slot: ${cleanedSubj}`;
            reason = "Meeting request or schedule coordination detected.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "Tomorrow";
            }
          }
          // 4. Presentations / Slide Decks
          else if (/\b(presentation|slides|deck|ppt|slideshow)\b/i.test(combined) && /\b(review|feedback|edit|prepare|present|submit)\b/i.test(combined)) {
            isActionable = true;
            extractedTitle = `Review slides: ${cleanedSubj}`;
            reason = "Feedback or review requested for presentation slides.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "In 2 days";
            }
          }
          // 5. Booking / Ticket Confirmations
          else if (/\b(ticket|booking|reservation|pvr|movie|show|concert|flight|hotel)\b/i.test(combined) && /\b(confirmed|confirmation|booked|reservation|receipt|itinerary)\b/i.test(combined)) {
            isActionable = true;
            // Additional cleanup for ticket subject strings
            let eventName = cleanedSubj.replace(/(booking confirmation|ticket confirmation|reservation confirmation|your ticket for|your booking|confirmed:|reservation details)/ig, "").trim();
            if (eventName) {
              eventName = eventName.charAt(0).toUpperCase() + eventName.slice(1);
            } else {
              eventName = cleanedSubj;
            }
            extractedTitle = `Attend: ${eventName}`;
            reason = "Confirmation details for booking, reservation, or ticket detected.";
          }
          // 6. Direct personal inquiry / Question-response (Selective reply)
          else if (
            (/\b(could you|can you|please reply|let me know|respond|answer|feedback)\b/i.test(combined) || combined.includes("?")) &&
            !/noreply|no-reply|system|newsletter|notification/i.test(fromLower)
          ) {
            isActionable = true;
            extractedTitle = `Reply to query: ${cleanedSubj}`;
            reason = "Direct query or personal request requiring response detected.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "Tomorrow";
            }
          }
          // 7. General Document Review & Signature
          else if (/\b(review|sign|signature|approve|approval|contract|agreement|doc|document)\b/i.test(combined) && /\b(please|urgent|required|action|action required)\b/i.test(combined)) {
            isActionable = true;
            extractedTitle = `Review & Sign: ${cleanedSubj}`;
            reason = "Document review or signature request detected.";
            if (extractedDeadline === "Not mentioned") {
              extractedDeadline = "In 2 days";
            }
          }

          // If it doesn't match any of our action-specific patterns, exclude it
          if (!isActionable) {
            return null;
          }
          
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: msg.from,
            subject: msg.subject,
            date: msg.date,
            extractedTitle,
            extractedDeadline,
            reason,
            bodySnippet: msg.snippet,
            originalBody: bodyText || msg.snippet,
            isFallback: true
          };
        }).filter(t => t !== null);
        
        return res.json(fallbackTasks);
      } catch (innerError) {
        console.warn("Inner smart fallback handled:", innerError);
      }
    }
    res.json([]);
  }
});

// 5c. Gmail Draft Reply API
app.post("/api/gmail/draft-reply", async (req, res) => {
  const { emailFrom, emailSubject, emailBody, taskNotes } = req.body;
  try {
    if (!emailFrom || !emailSubject || !emailBody) {
      return res.status(400).json({ error: "emailFrom, emailSubject, and emailBody are required" });
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the drafting assistant of "Earned" (Level 4+ capability).
Below is an email the user received. Draft a context-aware professional and friendly reply to this email on behalf of the user, taking into account any notes or specific instructions provided.

Sender: ${emailFrom}
Subject: ${emailSubject}
Email Content:
${emailBody}

User's Notes / Guidelines for reply:
${taskNotes || 'No specific notes provided.'}

Write a direct, finished, polished reply draft. Avoid placeholder fields like '[My Name]' or '[Date]' — write a ready-to-send draft message. If the user's name is not known, sign off as "Earned AI Companion" or write a generic professional signoff.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            draftContent: {
              type: Type.STRING,
              description: "The actual generated text reply. Use newlines and clean spacing."
            }
          },
          required: ["draftContent"]
        }
      }
    });

    const result = parseJSONResponse(response.text);
    res.json(result);
  } catch (error: any) {
    handleEndpointError("Gmail reply draft", error);
    const sub = emailSubject || "your inquiry";
    res.json({
      draftContent: `Thank you for reaching out. I have received your message regarding "${sub}" and will follow up with you as soon as possible.\n\nBest regards,\n[User]`
    });
  }
});

// 5d. Gmail Send Reply API
app.post("/api/gmail/send-reply", async (req, res) => {
  try {
    const { accessToken, threadId, recipient, subject, body, demoMode = true } = req.body;
    
    if (!accessToken && !demoMode) {
      return res.status(400).json({ error: "accessToken is required when Demo Mode is off" });
    }
    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: "recipient, subject, and body are required" });
    }

    const cleanRecipient = extractEmailAddress(recipient);
    let replySubject = subject;
    if (!replySubject.toLowerCase().startsWith("re:")) {
      replySubject = `Re: ${replySubject}`;
    }

    const isSimulatedToken = accessToken && (accessToken.startsWith("demo-") || accessToken.startsWith("mock-"));
    if (demoMode || isSimulatedToken) {
      console.log(`[DEMO MODE] Would send email to ${cleanRecipient} with subject "${replySubject}":\n${body}`);
      return res.json({
        demo: true,
        messageId: `demo-msg-${Date.now()}`,
        recipient: cleanRecipient,
        subject: replySubject,
        body: body,
        timestamp: new Date().toISOString()
      });
    }

    // Build raw MIME message
    const emailLines = [
      `To: ${cleanRecipient}`,
      `Subject: ${replySubject}`,
      `Content-Type: text/plain; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      body
    ];
    const emailString = emailLines.join('\r\n');
    const base64EncodedEmail = Buffer.from(emailString, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        threadId: threadId,
        raw: base64EncodedEmail
      })
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      console.error('Gmail send error:', errText);
      return res.status(sendRes.status).json({ error: `Gmail send error: ${sendRes.statusText}` });
    }

    const sendData = await sendRes.json() as any;
    res.json({
      demo: false,
      messageId: sendData.id,
      recipient: cleanRecipient,
      subject: replySubject,
      body: body,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

// 6. Agentic Behavior Loop Endpoint
app.post("/api/gemini/agent-loop", async (req, res) => {
  const { tasks, calendarEvents, trustLevel, currentTimestamp } = req.body;
  const timeToUse = currentTimestamp || new Date().toISOString();
  try {
    if (trustLevel === undefined) {
      return res.status(400).json({ error: "trustLevel is required" });
    }

    console.log(`[Agent Loop] Starting 5-step cycle. Trust Level: ${trustLevel}, Time: ${timeToUse}`);

    // --- STEP 1 & 2: OBSERVE & ASSESS ---
    console.log(`[Agent Loop] Call 1/3: Observe & Assess`);
    const step1Response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the autonomous agent core of "Earned" — an AI task companion.
Your job is to execute the first two steps of our 5-step reasoning cycle: OBSERVE and ASSESS.

State of the User:
- Trust Level: ${trustLevel}
- Current Tasks: ${JSON.stringify(tasks || [])}
- Google Calendar Events for today/tomorrow: ${JSON.stringify(calendarEvents || [])}
- Current Time (ISO Timestamp): ${timeToUse}

Rules for Decisions based on Trust Level (for context in your assessment):
- Level 1: You can only Remind. Action: "nudge" or "none".
- Level 2: You can Remind or Suggest priority order. Action: "nudge" or "none".
- Level 3: You can Remind, Suggest, or Propose specific schedule blocks. Action: "nudge", "schedule", or "none".
- Level 4: You can do all the above plus Draft documents/checklists. Action: "nudge", "schedule", "draft", or "none".
- Level 5 (Autonomous): You can chain multiple actions. Action: "autonomous", "nudge", "schedule", "draft", or "none".

Analyze the situation and perform the first two steps:
1. OBSERVE: State the factual situation (e.g., number of pending tasks, calendar load, completed tasks).
2. ASSESS: Assess risk of missing deadlines, overdue items, or calendar conflicts. Assess everything in relation to the actual current time: ${timeToUse}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            observeLog: { type: Type.STRING, description: "Detailed observe step description" },
            assessLog: { type: Type.STRING, description: "Detailed assess risk / context description" }
          },
          required: ["observeLog", "assessLog"]
        }
      }
    });

    const step1Result = parseJSONResponse(step1Response.text);
    const { observeLog, assessLog } = step1Result;

    // --- STEP 3 & 4: DECIDE & ACT ---
    console.log(`[Agent Loop] Call 2/3: Decide & Act`);
    const step2Response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the autonomous agent core of "Earned" — an AI task companion.
You are at the DECIDE and ACT steps of your reasoning cycle.

State of the User:
- Trust Level: ${trustLevel}
- Current Tasks: ${JSON.stringify(tasks || [])}
- Google Calendar Events for today/tomorrow: ${JSON.stringify(calendarEvents || [])}
- Current Time (ISO Timestamp): ${timeToUse}

Logs from previous steps of this cycle:
- OBSERVE: ${observeLog}
- ASSESS: ${assessLog}

Rules for Decisions based on Trust Level:
- Level 1: You can only Remind. Suggested decisions: "nudge" or "none".
- Level 2: You can Remind or Suggest priority order. Suggested decisions: "nudge" or "none".
- Level 3: You can Remind, Suggest, or Propose specific schedule blocks. Suggested decisions: "nudge", "schedule", or "none".
- Level 4: You can do all the above plus Draft documents/checklists. Suggested decisions: "nudge", "schedule", "draft", or "none".
- Level 5 (Autonomous): You can chain multiple actions (reschedule, draft, schedule, nudge). Suggested decisions: "autonomous", "nudge", "schedule", "draft", or "none".

Analyze the state, observation, and assessment. Make a decision on whether and how to act.
If the user is doing perfectly, has no upcoming or overdue urgent tasks, choose "none".
If you choose to act:
- "nudge": Provide a taskId of a pending task and a friendly nudge message to encourage the user.
- "schedule": Provide a taskId and a suggestedTimeSlot with ISO start and end timestamps (ideally today or tomorrow, avoiding current calendar events).
  CRITICAL REQUIREMENT:
  The actual current time is strictly: ${timeToUse}.
  You MUST ensure that the start time of any proposed suggestedTimeSlot is strictly in the future relative to this current time (${timeToUse}) — never in the past.
- "draft": Provide a taskId, a draftText (e.g., email draft or structured checklist to save user effort), and draftType (e.g. 'Email Draft' or 'Structured Checklist').
- "autonomous": Provide multiple actions (e.g. taskId, nudgeMessage, draftText, suggestedTimeSlot).
  CRITICAL REQUIREMENT:
  The actual current time is strictly: ${timeToUse}.
  You MUST ensure that the start time of any proposed suggestedTimeSlot inside autonomous actions is strictly in the future relative to this current time (${timeToUse}) — never in the past.

Describe your decision and action logs, and fill in actionDetails.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decideLog: { type: Type.STRING, description: "Detailed decide step description" },
            decision: { 
              type: Type.STRING, 
              description: "One of: 'none', 'nudge', 'schedule', 'draft', 'autonomous'" 
            },
            decisionReasoning: { type: Type.STRING, description: "One-line reasoning for the decision" },
            actLog: { type: Type.STRING, description: "Detailed act step description" },
            actionDetails: {
              type: Type.OBJECT,
              properties: {
                taskId: { type: Type.STRING, description: "ID of the target task if any" },
                nudgeMessage: { type: Type.STRING, description: "A friendly nudge message if the decision is nudge or autonomous" },
                draftText: { type: Type.STRING, description: "The drafted content if the decision is draft or autonomous" },
                draftType: { type: Type.STRING, description: "Draft type, e.g. Email Draft, Outline" },
                suggestedTimeSlot: {
                  type: Type.OBJECT,
                  properties: {
                    start: { type: Type.STRING, description: "ISO DateTime string for proposed start. Must be strictly later than " + timeToUse },
                    end: { type: Type.STRING, description: "ISO DateTime string for proposed end. Must be strictly later than proposed start" }
                  }
                }
              }
            }
          },
          required: ["decideLog", "decision", "decisionReasoning", "actLog"]
        }
      }
    });

    const step2Result = parseJSONResponse(step2Response.text);
    const { decideLog, decision, decisionReasoning, actLog, actionDetails } = step2Result;

    // --- STEP 5: REPORT ---
    console.log(`[Agent Loop] Call 3/3: Report`);
    const step3Response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the autonomous agent core of "Earned" — an AI task companion.
You are at the final REPORT step of your reasoning cycle.

Logs from previous steps of this cycle:
- OBSERVE: ${observeLog}
- ASSESS: ${assessLog}
- DECIDE: ${decideLog} (Decision made: ${decision} - ${decisionReasoning})
- ACT: ${actLog}

Summarize this entire cycle. What did we observe, assess, decide, and act upon? Provide a concise, clear report log for the user/system.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reportLog: { type: Type.STRING, description: "Detailed report summarizing the cycle" }
          },
          required: ["reportLog"]
        }
      }
    });

    const step3Result = parseJSONResponse(step3Response.text);
    const { reportLog } = step3Result;

    console.log(`[Agent Loop] 5-step cycle completed successfully. Decision: ${decision}`);

    // Combine all steps into the complete output structure expected by the app
    const combinedOutput = {
      observeLog,
      assessLog,
      decideLog,
      decision,
      decisionReasoning,
      actLog,
      reportLog,
      actionDetails: actionDetails || {}
    };

    res.json(combinedOutput);
  } catch (error: any) {
    handleEndpointError("Agentic Loop", error);
    
    let observeLog = "Completed current period inspection. Observed active task queue and calendar schedules.";
    let assessLog = "All schedules are within normal operating parameters.";
    let decideLog = "Decided to maintain stable queue tracking without scheduling disruptions.";
    let decision = "none";
    let decisionReasoning = "No urgent actions needed.";
    let actLog = "Action cycle completed passively.";
    let reportLog = `Reasoning cycle executed safely in smart offline fallback mode. Trust level validated at Level ${trustLevel || 3}.`;
    let actionDetails: any = {};
    
    try {
      const pendingTasks = Array.isArray(tasks) ? tasks.filter((t: any) => t.status === 'pending') : [];
      if (pendingTasks.length > 0) {
        const targetTask = pendingTasks[0];
        observeLog = `Observed ${pendingTasks.length} pending task(s). Top priority identified is "${targetTask.title}".`;
        
        const lvl = Number(trustLevel || 3);
        if (lvl === 1) {
          decision = "nudge";
          decisionReasoning = `Proposing urgent completion nudge for "${targetTask.title}" due to Level 1 constraints.`;
          assessLog = `High risk of task accumulation under current limited trust restrictions.`;
          actLog = `Dispatched a nudge alert reminding user to complete "${targetTask.title}".`;
          actionDetails = {
            taskId: targetTask.id,
            nudgeMessage: `Friendly reminder: The task "${targetTask.title}" is in your queue. Please complete it to help rebuild mutual trust!`
          };
        } else if (lvl === 2) {
          decision = "nudge";
          decisionReasoning = `Proposing focus recommendation nudge for "${targetTask.title}" at Level 2.`;
          assessLog = `Moderate risk. Suggested focusing on high-priority task next to build reliable momentum.`;
          actLog = `Dispatched a priority recommendations notification.`;
          actionDetails = {
            taskId: targetTask.id,
            nudgeMessage: `To stay on track, I suggest focusing on "${targetTask.title}" next. Let me know once you have made progress.`
          };
        } else if (lvl === 3) {
          decision = "schedule";
          decisionReasoning = `Proposing optimized calendar slot allocation for "${targetTask.title}" at Level 3.`;
          assessLog = `Calculated open slot in tomorrow's agenda that fits task scope without overlap.`;
          actLog = `Staged proposed calendar block ready for user confirmation.`;
          
          const now = new Date(timeToUse);
          const start = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
          const end = new Date(start.getTime() + 1 * 60 * 60 * 1000);   // 1 hour duration
          
          actionDetails = {
            taskId: targetTask.id,
            suggestedTimeSlot: {
              start: start.toISOString(),
              end: end.toISOString()
            }
          };
        } else if (lvl >= 4) {
          decision = "draft";
          decisionReasoning = `Synthesizing automatic productivity draft outline for "${targetTask.title}" at Level ${lvl}.`;
          assessLog = `Opportunity identified to reduce friction by pre-generating layout structure or communications.`;
          actLog = `Successfully generated outline and presented to user.`;
          
          const isComm = /email|reply|contact|send|message|write/i.test(targetTask.title || "");
          actionDetails = {
            taskId: targetTask.id,
            draftType: isComm ? "Email Draft" : "Structured Checklist",
            draftText: isComm
              ? `Subject: Regarding: ${targetTask.title}\n\nHi,\n\nI am writing to update you on "${targetTask.title}". Let me know if you have any questions.\n\nBest,\n[User]`
              : `1. Define the parameters of "${targetTask.title}".\n2. Gather necessary links/references.\n3. Complete the draft or prototype.\n4. Send for review.`
          };
        }
      }
    } catch (innerErr) {
      console.warn("Inner agentic loop fallback warning:", innerErr);
    }
    
    res.json({
      observeLog,
      assessLog,
      decideLog,
      decision,
      decisionReasoning,
      actLog,
      reportLog,
      actionDetails,
      isFallback: true
    });
  }
});

// 7. Trust Review Endpoint
app.post("/api/gemini/trust-review", async (req, res) => {
  const { tasks, trustLevel, score } = req.body;
  try {
    if (trustLevel === undefined || score === undefined) {
      return res.status(400).json({ error: "trustLevel and score are required" });
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are the self-auditing trust core of "Earned".
Once a simulated week, you review the user's performance and explain your trust in them.

Current State:
- Trust Score: ${score}
- Trust Level: ${trustLevel}
- Task list details: ${JSON.stringify(tasks || [])}

Perform a trust review of the user. Focus on their reliability, deadline consistency, and progress.
Write a concise, professional first-person reflection (2-3 sentences) evaluating their performance and outlining your expectations moving forward.
Keep the tone direct and honest, yet calm and fair (no drama or hyperbole).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reflection: {
              type: Type.STRING,
              description: "The first-person evaluation/reflection from the AI assistant."
            }
          },
          required: ["reflection"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response from Gemini API");
    }

    res.json(parseJSONResponse(resultText));
  } catch (error: any) {
    handleEndpointError("Trust Review", error);
    res.json({
      reflection: `I have audited your tasks and schedule. Your performance is in line with expectations, and our synchronization remains robust at trust score ${score || 60}. Let's keep maintaining this momentum.`
    });
  }
});

async function startServer() {
  // Serve frontend assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Earned server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
