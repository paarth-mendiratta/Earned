/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Sparkles, 
  Loader2, 
  Activity, 
  Compass, 
  Calendar, 
  FileText, 
  User, 
  LogOut,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  Cpu,
  RefreshCw,
  Award,
  ShieldCheck,
  Zap,
  Clock,
  Info
} from 'lucide-react';
import { Task, TrustState, TrustLevel, ActivityLogEntry, DetectedEmailTask } from './types';
import { initAuth, googleSignIn, logout } from './utils/firebase';
import { createCalendarEvent, fetchCalendarEvents } from './utils/calendar';
import { getTrustChangeExplanation } from './utils/trust';
import AddTask from './components/AddTask';
import Dashboard from './components/Dashboard';
import Tree from './components/Tree';
import Log from './components/Log';
import DemoControls from './components/DemoControls';
import LandingPage from './components/LandingPage';

// Static subtasks for seed tasks
const STATIC_SEED_SUBTASKS: Record<string, { id: string; title: string; completed: boolean }[]> = {
  'seed-1': [
    { id: 'subtask-seed-1-1', title: 'Outline the slide deck sections in a text document.', completed: false },
    { id: 'subtask-seed-1-2', title: 'Draft Q3 goals, milestones, and resource projections.', completed: false },
    { id: 'subtask-seed-1-3', title: 'Format slide visuals using clean typographic hierarchy.', completed: false },
    { id: 'subtask-seed-1-4', title: 'Conduct a final proofread and timing practice run.', completed: false }
  ],
  'seed-2': [
    { id: 'subtask-seed-2-1', title: 'Draft a bulleted email outlining the counter-proposals.', completed: false },
    { id: 'subtask-seed-2-2', title: 'Check landlord reply for monthly rate discount approval.', completed: false },
    { id: 'subtask-seed-2-3', title: 'Finalize renewal agreement dates and submit.', completed: false }
  ],
  'seed-3': [
    { id: 'subtask-seed-3-1', title: 'Navigate to passport portal and check processing-time estimates.', completed: false },
    { id: 'subtask-seed-3-2', title: 'Complete online details form and upload high-res photo.', completed: false },
    { id: 'subtask-seed-3-3', title: 'Pay renewal application fee and save confirmation receipt.', completed: false }
  ]
};

// Helper functions to generate fresh dynamic initial tasks and logs
function getFreshInitialTasks(): Task[] {
  return [
    {
      id: 'seed-1',
      title: 'Prepare presentation slides for roadmap review',
      notes: 'Create slide deck for upcoming Q3 plan. Focus heavily on Google Ecosystem and Android capabilities.',
      deadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours from now
      estimatedEffort: '2 hours',
      firstStep: 'Outline the slide deck sections in a text document.',
      status: 'pending',
      completedOnTime: null,
      suggestedTimeSlot: {
        start: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      },
      subtasks: [...STATIC_SEED_SUBTASKS['seed-1']],
      subtasksCollapsed: true,
      subtasksRevealed: false
    },
    {
      id: 'seed-2',
      title: 'Reply to landlord regarding lease terms and renewal speed',
      notes: 'Verify processing speed of renewals and secure the 5% monthly rate discount.',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      estimatedEffort: '30 mins',
      firstStep: 'Draft a bulleted email outlining the counter-proposals.',
      status: 'pending',
      completedOnTime: null,
      suggestedTimeSlot: {
        start: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 25.5 * 60 * 60 * 1000).toISOString(),
      },
      subtasks: [...STATIC_SEED_SUBTASKS['seed-2']],
      subtasksCollapsed: true,
      subtasksRevealed: false
    },
    {
      id: 'seed-3',
      title: 'Renew passport online',
      notes: 'Requires checking state government processing timelines to make sure it arrives in time for the travel window.',
      deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      estimatedEffort: '45 mins',
      firstStep: 'Navigate to passport portal and check processing-time estimates.',
      status: 'pending',
      completedOnTime: null,
      subtasks: [...STATIC_SEED_SUBTASKS['seed-3']],
      subtasksCollapsed: true,
      subtasksRevealed: false
    }
  ];
}

function getFreshInitialLogs(): ActivityLogEntry[] {
  return [
    {
      id: 'log-seed-1',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      type: 'trust_change',
      title: 'System Bootstrapped in Level 3: Scheduler',
      content: 'Initial trust score set to 12/20. Proactive scheduling with Google Calendar is active with authorization.',
      details: 'Initial Score: 12\nStarting Tier: 3 (Scheduler)\nCapabilities: Priority Assessment, First-Step Breakdowns, Google Calendar Event Proposals.'
    },
    {
      id: 'log-seed-2',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      type: 'trust_review',
      title: 'Initialization Audit Successful',
      content: 'Completed first performance check. User has seeded pending items. Ready for scheduling.',
      details: 'Audit Outcome: Trust Core stabilized.\nObserved pending tasks: 3'
    }
  ];
}

function parseEmailFromNotes(notes: string) {
  if (!notes) return null;
  const senderMatch = notes.match(/Email Sender:\s*(.*)/i);
  const subjectMatch = notes.match(/Email Subject:\s*(.*)/i);
  const bodyMatch = notes.match(/Email Snippet:\s*([\s\S]*?)(?=\n\nReason Flagged:|$)/i) || notes.match(/Email Content:\s*([\s\S]*)/i);
  
  if (senderMatch && subjectMatch) {
    return {
      from: senderMatch[1].trim(),
      subject: subjectMatch[1].trim(),
      body: bodyMatch ? bodyMatch[1].trim() : notes
    };
  }
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tree' | 'logs'>('dashboard');
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    return !sessionStorage.getItem('earned_has_seen_landing');
  });
  
  const safeParse = <T,>(key: string, fallback: T): T => {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return fallback;
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(`Error parsing localStorage key "${key}":`, e);
      return fallback;
    }
  };

  // State variables with local storage persistence
  const [tasks, setTasks] = useState<Task[]>(() => {
    const loaded = safeParse('earned_tasks', getFreshInitialTasks());
    let pendingCount = 0;
    return loaded.map(task => {
      const updated = { ...task };
      const seedSubtasks = STATIC_SEED_SUBTASKS[task.id];
      if (seedSubtasks && (!updated.subtasks || updated.subtasks.length === 0)) {
        updated.subtasks = [...seedSubtasks];
      }
      if (updated.status === 'pending') {
        const currentPos = pendingCount++;
        if (updated.originalPosition === undefined) {
          updated.originalPosition = currentPos;
        }
        if (updated.originalAIRank === undefined) {
          updated.originalAIRank = currentPos;
        }
      }
      return updated;
    });
  });

  const resolvingTaskIdsRef = useRef<Set<string>>(new Set());
  
  // Clean up resolving task IDs that are no longer pending
  const pendingIds = new Set(tasks.filter(t => t.status === 'pending').map(t => t.id));
  for (const id of Array.from(resolvingTaskIdsRef.current)) {
    if (!pendingIds.has(id)) {
      resolvingTaskIdsRef.current.delete(id);
    }
  }

  const [trustState, setTrustState] = useState<TrustState>(() => {
    return safeParse('earned_trust', { level: 3, score: 12, history: [] });
  });

  const [logs, setLogs] = useState<ActivityLogEntry[]>(() => {
    return safeParse('earned_logs', getFreshInitialLogs());
  });

  const [drafts, setDrafts] = useState<Record<string, { type: string; content: string }>>(() => {
    return safeParse('earned_drafts', {});
  });

  // Gmail integrations states
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    return safeParse('earned_gmail_demomode', true);
  });
  const [detectedEmails, setDetectedEmails] = useState<DetectedEmailTask[]>([]);
  const [isScanningEmails, setIsScanningEmails] = useState<boolean>(false);
  const [emailScanError, setEmailScanError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);

  const [subtaskBonusMessage, setSubtaskBonusMessage] = useState<string | null>(null);
  const [breakingDownTaskIds, setBreakingDownTaskIds] = useState<Set<string>>(new Set());
  const [lateCompletionPromptTask, setLateCompletionPromptTask] = useState<Task | null>(null);
  const [dismissedLatePromptTaskIds, setDismissedLatePromptTaskIds] = useState<string[]>([]);

  const [dailyCheckin, setDailyCheckin] = useState<string>(() => {
    return localStorage.getItem('earned_checkin') || '';
  });

  // Auth/Google Calendar Sync Token
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthAttemptPending, setIsAuthAttemptPending] = useState<boolean>(false);
  const authSuccessRef = useRef<boolean>(false);
  const handleBypassCalendarRef = useRef<() => void>(() => {});

  // Instantly cancel pending auth when the user closes/abandons the Google popup and returns to the app
  useEffect(() => {
    let focusTimeout: NodeJS.Timeout;
    
    const handleWindowFocus = () => {
      if (isAuthAttemptPending) {
        // Wait 1.2 seconds to allow any successful Firebase callback to register first
        focusTimeout = setTimeout(() => {
          if (isAuthAttemptPending && !authSuccessRef.current) {
            setIsAuthAttemptPending(false);
            setAuthError('Connection was closed or blocked. Google restricts testing-mode apps (Error 403). Please use the Sandbox Bypass to proceed!');
            // Instantly trigger sandbox bypass
            handleBypassCalendarRef.current();
          }
        }, 1200);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (focusTimeout) clearTimeout(focusTimeout);
    };
  }, [isAuthAttemptPending]);

  // Loaders/Modals
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isReviewRunning, setIsReviewRunning] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // Modals for celebration or risk assessment
  const [activeNotification, setActiveNotification] = useState<{
    oldLevel: TrustLevel;
    newLevel: TrustLevel;
    message: string;
  } | null>(null);

  const [activeReflection, setActiveReflection] = useState<string | null>(null);

  // Reactive trigger to auto-complete parent tasks when all their subtasks are completed
  useEffect(() => {
    // Find any pending task that has subtasks and all subtasks are completed (completed: true)
    const taskToAutoComplete = tasks.find(t => 
      t.status === 'pending' && 
      t.subtasks && 
      t.subtasks.length > 0 && 
      t.subtasks.every(st => st.completed)
    );

    if (taskToAutoComplete) {
      const now = new Date();
      const deadlineDate = new Date(taskToAutoComplete.deadline);
      if (now < deadlineDate) {
        // Auto-complete on-time! Passing taskToAutoComplete as fallbackTask so it has the latest checked-off subtasks state.
        handleCompleteTask(taskToAutoComplete.id, true, taskToAutoComplete);
      } else {
        // Only trigger the choice modal if it isn't currently open for this task, and wasn't explicitly dismissed
        if (lateCompletionPromptTask?.id !== taskToAutoComplete.id && !dismissedLatePromptTaskIds.includes(taskToAutoComplete.id)) {
          setLateCompletionPromptTask(taskToAutoComplete);
        }
      }
    }
  }, [tasks, lateCompletionPromptTask, dismissedLatePromptTaskIds]);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('earned_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('earned_trust', JSON.stringify(trustState));
  }, [trustState]);

  useEffect(() => {
    localStorage.setItem('earned_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('earned_drafts', JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem('earned_checkin', dailyCheckin);
  }, [dailyCheckin]);

  useEffect(() => {
    localStorage.setItem('earned_gmail_demomode', JSON.stringify(demoMode));
  }, [demoMode]);

  useEffect(() => {
    if (subtaskBonusMessage) {
      const timer = setTimeout(() => {
        setSubtaskBonusMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [subtaskBonusMessage]);

  // Automatically regenerate stale proposed calendar event slots that are in the past
  useEffect(() => {
    const now = Date.now();
    let changed = false;
    
    // Check if any pending task has a suggested time slot that is in the past
    const updatedTasks = tasks.map(task => {
      if (task.status === 'pending' && task.suggestedTimeSlot) {
        const startVal = new Date(task.suggestedTimeSlot.start).getTime();
        // Check if start time is in the past (using a small margin of 5 seconds to avoid micro-flicker)
        if (startVal < now - 5000) {
          changed = true;
          const deadlineTime = new Date(task.deadline).getTime();
          let proposedStart = now + 4 * 60 * 60 * 1000; // 4 hrs from now
          
          if (proposedStart >= deadlineTime && deadlineTime > now) {
            proposedStart = now + 10 * 60 * 1000; // 10 mins from now if deadline is close but in future
          }
          const proposedEnd = proposedStart + 1.5 * 60 * 60 * 1000; // 1.5 hr duration
          
          return {
            ...task,
            suggestedTimeSlot: {
              start: new Date(proposedStart).toISOString(),
              end: new Date(proposedEnd).toISOString(),
            }
          };
        }
      }
      return task;
    });

    if (changed) {
      setTasks(updatedTasks);
      
      const autoLog: ActivityLogEntry = {
        id: `log-auto-schedule-refresh-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'schedule',
        title: 'Stale Calendar Slot(s) Regenerated',
        content: `The system detected and automatically regenerated stale past calendar slot suggestions into valid future slots.`,
      };
      setLogs(prev => [autoLog, ...prev]);
    }
  }, [tasks]);

  // Auth State Listener
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setCalendarToken(token);
      },
      () => {
        setUser(null);
        setCalendarToken(null);
      }
    );
  }, []);

  // Proactive checkin load
  useEffect(() => {
    if (!dailyCheckin) {
      handleRefreshCheckin();
    }
  }, [tasks, trustState.level]);

  // Scan emails and rescan calendar slots on calendarToken change
  useEffect(() => {
    if (calendarToken) {
      handleScanEmails(calendarToken);
      handleRescanCalendarSlots(calendarToken);
    } else {
      setDetectedEmails([]);
    }
  }, [calendarToken]);

  // Rescan calendar events and re-optimize slots to avoid overlaps
  const handleRescanCalendarSlots = async (token: string) => {
    try {
      console.log('[Rescan] Fetching calendar events to check for conflicting slot proposals...');
      const events = await fetchCalendarEvents(token);
      console.log('[Rescan] Fetched events:', events);
      
      const now = Date.now();
      
      setTasks(prevTasks => {
        let changed = false;
        const updated = prevTasks.map((task, index) => {
          if (task.status === 'pending') {
            // Find a slot of length 1.5 hours (90 minutes)
            // Start looking from 4 hours from now, and stagger subsequent tasks slightly
            let proposedStart = now + (4 + index * 2) * 60 * 60 * 1000;
            const deadlineTime = new Date(task.deadline).getTime();
            
            if (proposedStart >= deadlineTime && deadlineTime > now) {
              proposedStart = now + 15 * 60 * 1000; // 15 mins from now if deadline is close
            }
            
            const duration = 1.5 * 60 * 60 * 1000; // 1.5 hours
            let proposedEnd = proposedStart + duration;
            
            // Check for conflicts and find a free slot!
            let conflict = true;
            let iterations = 0;
            while (conflict && iterations < 100) {
              conflict = false;
              iterations++;
              
              for (const event of events) {
                if (event.start?.dateTime && event.end?.dateTime) {
                  const eventStart = new Date(event.start.dateTime).getTime();
                  const eventEnd = new Date(event.end.dateTime).getTime();
                  
                  // If there's an overlap
                  if (proposedStart < eventEnd && proposedEnd > eventStart) {
                    conflict = true;
                    // Shift proposed start to 30 minutes after this conflicting event ends
                    proposedStart = eventEnd + 30 * 60 * 1000;
                    proposedEnd = proposedStart + duration;
                    break; // Break loop to re-check against all events with new proposed times
                  }
                }
              }
            }
            
            const newStartIso = new Date(proposedStart).toISOString();
            const newEndIso = new Date(proposedEnd).toISOString();
            
            if (
              !task.suggestedTimeSlot || 
              task.suggestedTimeSlot.start !== newStartIso || 
              task.suggestedTimeSlot.end !== newEndIso
            ) {
              changed = true;
              return {
                ...task,
                suggestedTimeSlot: {
                  start: newStartIso,
                  end: newEndIso
                }
              };
            }
          }
          return task;
        });
        
        if (changed) {
          const rescanLog: ActivityLogEntry = {
            id: `log-rescan-slots-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'schedule',
            title: 'Proposed Slots Rescanned & Optimized',
            content: 'The companion rescanned your connected calendar, identified potential event overlaps, and reassigned non-conflicting proposed slots.',
            details: `Optimized scheduling for pending task(s) to avoid conflicts with your upcoming calendar events.`
          };
          setLogs(prevLogs => [rescanLog, ...prevLogs]);
          return updated;
        }
        return prevTasks;
      });
    } catch (err) {
      console.error('[handleRescanCalendarSlots] Error:', err);
    }
  };

  // Gmail Inbox Scanning API call
  const handleScanEmails = async (tokenToUse?: string) => {
    const token = tokenToUse || calendarToken;
    if (!token) return;
    setIsScanningEmails(true);
    setEmailScanError(null);
    try {
      const res = await fetch('/api/gmail/detect-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token })
      });
      if (!res.ok) {
        throw new Error(`Gmail scan failed: ${res.statusText}`);
      }
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const hasAnyFallback = data.some((item: any) => item && item.isFallback);
        if (hasAnyFallback) {
          const fallbackLog: ActivityLogEntry = {
            id: `log-gmail-fallback-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'fallback',
            title: 'Gmail Task Scanning: Offline Fallback',
            content: 'Gmail inbox scanning executed safely in offline/simulated fallback mode due to Gemini API limits.',
            details: `Scanned messages and automatically classified tasks using regex-based local text parsers.`
          };
          setLogs(prev => [fallbackLog, ...prev]);
        }
      }

      setDetectedEmails(prev => {
        const merged = [...prev];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (!merged.some(m => m.id === item.id)) {
              merged.push(item);
            }
          }
        }
        return merged;
      });
    } catch (err: any) {
      console.error('[handleScanEmails] Failed:', err);
      setEmailScanError(err.message || 'Failed to scan inbox.');
    } finally {
      setIsScanningEmails(false);
    }
  };

  // Convert detected email to a real task
  const handleAddEmailTask = async (emailTask: DetectedEmailTask) => {
    let firstStep = 'Break the task down into minor actions.';
    let estimatedEffort = '30 mins';
    let isStepFallback = !!emailTask.isFallback;
    let emailSubtasks: string[] | undefined = undefined;

    try {
      const resStep = await fetch('/api/gemini/first-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: emailTask.extractedTitle, 
          notes: `From Email (${emailTask.from}): ${emailTask.reason}` 
        })
      });
      
      if (resStep.ok) {
        const stepData = await resStep.json();
        firstStep = stepData.firstStep || firstStep;
        estimatedEffort = stepData.estimatedEffort || estimatedEffort;
        emailSubtasks = stepData.subtasks;
        if (stepData.isFallback) {
          isStepFallback = true;
        }
      } else {
        isStepFallback = true;
      }
    } catch (e) {
      console.warn('Failed to fetch customized first step from Gemini API, using defaults:', e);
      isStepFallback = true;
    }

    if (isStepFallback && !emailSubtasks) {
      emailSubtasks = [
        firstStep,
        "Review content and formulate a comprehensive response",
        "Perform necessary follow-ups and log completion"
      ];
    }

    try {
      // Parse deadline
      let deadlineStr = emailTask.extractedDeadline;
      let deadlineDate = new Date();
      deadlineDate.setDate(deadlineDate.getDate() + 2); // default 2 days if not mentioned
      
      if (deadlineStr && deadlineStr !== 'Not mentioned') {
        const parsed = Date.parse(deadlineStr);
        if (!isNaN(parsed)) {
          deadlineDate = new Date(parsed);
        } else {
          if (deadlineStr.toLowerCase().includes('today')) {
            deadlineDate = new Date();
            deadlineDate.setHours(18, 0, 0, 0);
          } else if (deadlineStr.toLowerCase().includes('tomorrow')) {
            deadlineDate = new Date();
            deadlineDate.setDate(deadlineDate.getDate() + 1);
            deadlineDate.setHours(18, 0, 0, 0);
          } else if (deadlineStr.toLowerCase().includes('friday')) {
            const today = new Date();
            const day = today.getDay();
            const daysUntilFriday = (5 - day + 7) % 7 || 7;
            deadlineDate.setDate(today.getDate() + daysUntilFriday);
            deadlineDate.setHours(18, 0, 0, 0);
          }
        }
      }

      handleAddTask({
        title: emailTask.extractedTitle,
        notes: `Email Sender: ${emailTask.from}\nEmail Subject: ${emailTask.subject}\n\nEmail Snippet: ${emailTask.bodySnippet}\n\nReason Flagged: ${emailTask.reason}`,
        deadline: deadlineDate.toISOString(),
        firstStep,
        estimatedEffort,
        gmailMessageId: emailTask.id,
        isFallback: isStepFallback,
        subtasks: emailSubtasks
      });

      // Remove from detected list
      setDetectedEmails(prev => prev.filter(e => e.id !== emailTask.id));
    } catch (e) {
      console.error('Failed to add task from email:', e);
    }
  };

  // Dispatch real email reply via Gmail API (Demo Safe)
  const handleSendEmailReply = async (task: Task, draftBody: string) => {
    const emailInfo = parseEmailFromNotes(task.notes);
    if (!emailInfo) {
      console.error('Cannot send email reply: Task has no email metadata.');
      return;
    }

    setIsSendingEmail(task.id);
    try {
      const response = await fetch('/api/gmail/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: calendarToken,
          threadId: task.id.replace('task-email-', ''),
          recipient: emailInfo.from,
          subject: emailInfo.subject,
          body: draftBody,
          demoMode: demoMode
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Remove draft
        setDrafts(prev => {
          const updated = { ...prev };
          delete updated[task.id];
          return updated;
        });

        // Complete the task on-time
        handleCompleteTask(task.id, true);

        // Add to log
        const logEntry: ActivityLogEntry = {
          id: `log-email-sent-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'autonomous_action',
          title: `Email ${data.demo ? '[DEMO SIMULATED]' : '[SENT]'} Reply Dispatched`,
          content: `Successfully sent reply to ${data.recipient} regarding "${emailInfo.subject}".`,
          details: `Message ID: ${data.messageId}\nRecipient: ${data.recipient}\nSubject: ${data.subject}\n\nDraft Body:\n${data.body}`
        };
        setLogs(prev => [logEntry, ...prev]);
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Gmail send failed');
      }
    } catch (err: any) {
      console.error('Failed to send email reply:', err);
      const failLog: ActivityLogEntry = {
        id: `log-email-fail-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'draft',
        title: `Failed to Dispatch Email Reply`,
        content: `Error: ${err.message || 'Gmail API failed'}.`,
        details: `Target: ${emailInfo.from}\nSubject: ${emailInfo.subject}`
      };
      setLogs(prev => [failLog, ...prev]);
    } finally {
      setIsSendingEmail(null);
    }
  };

  // Fetch / Refresh checkin briefing
  const handleRefreshCheckin = async () => {
    setIsCheckinLoading(true);
    try {
      const response = await fetch('/api/gemini/daily-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tasks, 
          level: trustState.level,
          currentTimestamp: new Date().toISOString()
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setDailyCheckin(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckinLoading(false);
    }
  };

  // Bypass Google Calendar authentication for sandbox testing
  const handleBypassCalendar = () => {
    const demoUser = {
      uid: 'demo-user-123',
      email: 'demo-hacker@gmail.com',
      displayName: 'Hackathon Tester',
      photoURL: ''
    };
    setUser(demoUser);
    setCalendarToken('demo-mock-access-token');
    setAuthError(null); // Clear any active auth error on bypass
    setIsAuthAttemptPending(false); // Clear pending status
    
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'schedule',
      title: 'Demo Sync Active (Bypassed)',
      content: 'Bypassed OAuth verification block. Sandbox simulation active with a mock Google Account.',
      details: 'Account: demo-hacker@gmail.com\nSimulated Scopes: calendar, gmail'
    };
    setLogs(prev => [newLog, ...prev]);
  };
  handleBypassCalendarRef.current = handleBypassCalendar;

  // Connect Google Calendar (Firebase Sign-In)
  const handleConnectCalendar = async () => {
    setIsAuthAttemptPending(true);
    setAuthError(null);
    authSuccessRef.current = false;
    try {
      const result = await googleSignIn();
      if (result) {
        authSuccessRef.current = true;
        setUser(result.user);
        setCalendarToken(result.accessToken);
        setAuthError(null); // Clear any active auth error on success
        
        // Log connection
        const newLog: ActivityLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'schedule',
          title: 'Google Calendar Connected',
          content: 'Real Google Calendar sync established. OAuth access token cached securely in memory.',
          details: `User email: ${result.user.email}\nScope granted: calendar`
        };
        setLogs(prev => [newLog, ...prev]);
      }
    } catch (err: any) {
      console.error(err);
      // Automatically register the auth failure state to render in-app alert cards
      setAuthError(err?.message || 'access_denied (Error 403)');
      // Instantly trigger sandbox bypass on failure or popup closure with zero delay
      handleBypassCalendar();
    } finally {
      setIsAuthAttemptPending(false);
    }
  };

  // Disconnect Google Calendar
  const handleDisconnectCalendar = async () => {
    await logout();
    setUser(null);
    setCalendarToken(null);
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'trust_change',
      title: 'Google Calendar Disconnected',
      content: 'Calendar connection severed. Returning to local mock agenda.',
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Re-order task priority order in the background using Gemini
  const handlePrioritizeTasks = async (currentTasks: Task[]) => {
    try {
      const response = await fetch('/api/gemini/prioritize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: currentTasks }),
      });
      if (response.ok) {
        const data = await response.json();
        const rankedIds: string[] = data.rankedTaskIds || [];
        
        // Sort tasks based on returned ranks, keeping pinned tasks in their exact positions
        setTasks(prev => {
          const pending = prev.filter(t => t.status === 'pending');
          const nonPending = prev.filter(t => t.status !== 'pending');

          const unpinned = pending.filter(t => !t.isPinned);

          // Sort unpinned tasks based on ranks
          const sortedUnpinned = [...unpinned].sort((a, b) => {
            const indexA = rankedIds.indexOf(a.id);
            const indexB = rankedIds.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });

          // Reconstruct pending tasks list keeping pinned tasks at their exact original indices
          const newPending = new Array(pending.length);
          pending.forEach((task, idx) => {
            if (task.isPinned) {
              newPending[idx] = task;
            }
          });

          let unpinnedIdx = 0;
          for (let i = 0; i < newPending.length; i++) {
            if (newPending[i] === undefined) {
              newPending[i] = sortedUnpinned[unpinnedIdx++];
            }
          }

          // Filter out any undefined just in case of mismatch
          const finalPending = newPending.filter(t => t !== undefined);

          // Update originalPosition and originalAIRank for all unpinned tasks based on their new AI-assigned positions
          const mappedPending = finalPending.map((task, idx) => {
            if (!task.isPinned) {
              return { 
                ...task, 
                originalPosition: idx,
                originalAIRank: idx
              };
            } else if (task.originalAIRank === undefined) {
              // Safeguard: set originalAIRank if a pinned task somehow doesn't have it
              return {
                ...task,
                originalAIRank: idx
              };
            }
            return task;
          });

          return [...mappedPending, ...nonPending];
        });

        // Add to log if prioritizations were made
        if (rankedIds.length > 0 && data.reasoning) {
          const logEntry: ActivityLogEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'agent_decision',
            title: 'Tasks Re-Prioritized by AI Core',
            content: data.reasoning,
            details: `Ranked Order:\n${rankedIds.map((id, idx) => `${idx + 1}. Task ID: ${id}`).join('\n')}`
          };
          setLogs(prev => [logEntry, ...prev]);
        }
      }
    } catch (err) {
      console.error('Failed background prioritization:', err);
    }
  };

  const handleBreakdownTask = async (taskId: string, title: string, notes: string, firstStep?: string) => {
    try {
      const response = await fetch('/api/gemini/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, firstStep }),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch breakdown');
      }
      const data = await response.json();
      if (data.subtasks && Array.isArray(data.subtasks)) {
        const generatedSubtasks = data.subtasks.map((st: string, idx: number) => ({
          id: `subtask-${taskId}-${idx}-${Date.now()}`,
          title: st,
          completed: false,
        }));
        
        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          subtasks: generatedSubtasks,
          subtasksCollapsed: false,
        } : t));
      }
    } catch (err) {
      console.error('Error in automatic subtask breakdown:', err);
    }
  };

  const handleManualBreakdown = async (taskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    // Use pre-loaded subtasks if they exist or if it is a seed task
    const staticSubtasks = STATIC_SEED_SUBTASKS[taskId];
    if (staticSubtasks || (targetTask.subtasks && targetTask.subtasks.length > 0)) {
      setTasks(prev => prev.map(t => t.id === taskId ? {
        ...t,
        subtasks: t.subtasks && t.subtasks.length > 0 ? t.subtasks : [...staticSubtasks],
        subtasksRevealed: true,
        subtasksCollapsed: false,
      } : t));
      return;
    }

    setBreakingDownTaskIds(prev => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });

    try {
      const response = await fetch('/api/gemini/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: targetTask.title, 
          notes: targetTask.notes, 
          firstStep: targetTask.firstStep 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch breakdown');
      }

      const data = await response.json();
      if (data.subtasks && Array.isArray(data.subtasks)) {
        const generatedSubtasks = data.subtasks.map((st: string, idx: number) => ({
          id: `subtask-${taskId}-${idx}-${Date.now()}`,
          title: st,
          completed: false,
        }));

        setTasks(prev => prev.map(t => t.id === taskId ? {
          ...t,
          subtasks: generatedSubtasks,
          subtasksCollapsed: false,
          subtasksRevealed: true,
        } : t));
      }
    } catch (err) {
      console.error('Failed to manually breakdown task:', err);
    } finally {
      setBreakingDownTaskIds(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask || !targetTask.subtasks) return;

    const wasAllDoneBefore = targetTask.subtasks.every(st => st.completed);
    const updatedSubtasks = targetTask.subtasks.map(st => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });
    const isAllDoneNow = updatedSubtasks.every(st => st.completed);

    const updatedTask = { ...targetTask, subtasks: updatedSubtasks };

    // Update tasks state
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

    if (!wasAllDoneBefore && isAllDoneNow && targetTask.status === 'pending') {
      const now = new Date();
      const deadlineDate = new Date(targetTask.deadline);
      if (now < deadlineDate) {
        // Auto-complete on-time! Pass updatedTask as fallbackTask so handleCompleteTask gets the completed subtasks state
        handleCompleteTask(taskId, true, updatedTask);
      } else {
        // Show choice modal
        setLateCompletionPromptTask(updatedTask);
      }
    }
  };

  const handleToggleSubtasksCollapse = (taskId: string) => {
    setTasks(prev => {
      return prev.map(t => t.id === taskId ? {
        ...t,
        subtasksCollapsed: !t.subtasksCollapsed
      } : t);
    });
  };

  // Add Task
  const handleAddTask = (newTaskInfo: Omit<Task, 'id' | 'status' | 'completedOnTime' | 'firstStep' | 'estimatedEffort' | 'subtasks'> & { 
    firstStep: string; 
    estimatedEffort: string; 
    isFallback?: boolean;
    subtasks?: string[];
  }) => {
    const { subtasks, ...rest } = newTaskInfo;
    const task: Task = {
      ...rest,
      id: `task-${Date.now()}`,
      status: 'pending',
      completedOnTime: null,
    };

    if (subtasks && subtasks.length > 0) {
      task.subtasks = subtasks.map((st, idx) => ({
        id: `subtask-${task.id}-${idx}-${Date.now()}`,
        title: st,
        completed: false,
      }));
      task.subtasksCollapsed = true;
      task.subtasksRevealed = false;
    }

    // Calculate a proposed schedule slot (Level 3+)
    if (trustState.level >= 3) {
      const proposedStart = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hrs from now
      const proposedEnd = new Date(proposedStart.getTime() + 1.5 * 60 * 60 * 1000); // 1.5 hr duration
      task.suggestedTimeSlot = {
        start: proposedStart.toISOString(),
        end: proposedEnd.toISOString(),
      };
    }

    const updatedTasks = [task, ...tasks];
    setTasks(updatedTasks);
    
    // Add to activity logs
    const isFallback = !!task.isFallback;
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: isFallback ? 'fallback' : 'agent_decision',
      title: isFallback ? 'Task Registered (Offline Fallback)' : 'Task Registered & Analyzed',
      content: isFallback 
        ? `Registered "${task.title}". Offline rule-based engine suggested micro first-step.` 
        : `Registered "${task.title}". AI calculated complexity: "${task.estimatedEffort}". Micro first-step suggested.`,
      details: `First step suggestion: ${task.firstStep}\nNotes: ${task.notes || 'none'}\nEngine Mode: ${isFallback ? 'Offline Local Fallback' : 'Gemini 3.5 Flash Core'}`
    };
    setLogs(prev => [newLog, ...prev]);

    // Async re-prioritize
    handlePrioritizeTasks(updatedTasks);
    handleRefreshCheckin();
  };

  // Complete task or fail deadline (simulated)
  const handleCompleteTask = async (taskId: string, onTime: boolean, fallbackTask?: Task) => {
    const targetTask = fallbackTask || tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    // Update task
    setTasks(prev => {
      const exists = prev.some(t => t.id === taskId);
      if (exists) {
        return prev.map(t => t.id === taskId ? { 
          ...t, 
          status: 'done', 
          completedOnTime: onTime 
        } : t);
      } else if (fallbackTask) {
        return [{
          ...fallbackTask,
          status: 'done',
          completedOnTime: onTime
        }, ...prev];
      }
      return prev;
    });

    // Check subtasks completion for XP bonus
    const hasSubtasks = targetTask.subtasks && targetTask.subtasks.length > 0;
    const allSubtasksDone = hasSubtasks && targetTask.subtasks!.every(st => st.completed);

    // Handle Trust calculation
    // Completed on time adds +1 to trust score, +1 bonus if all subtasks done
    // Late completions subtract a massive amount (-4)
    let scoreChange = 0;
    let bonusEarned = false;
    if (onTime) {
      if (allSubtasksDone) {
        scoreChange = 2; // +1 Base, +1 Bonus
        bonusEarned = true;
      } else {
        scoreChange = 1;
      }
    } else {
      scoreChange = -4;
    }

    const previousScore = trustState.score;
    const nextScore = Math.max(0, previousScore + scoreChange);

    // Show celebration/toast for the bonus XP
    if (bonusEarned) {
      setSubtaskBonusMessage(`All subtasks complete! +1 bonus XP earned for "${targetTask.title}" 🎉`);
    }

    // Determine level change based on thresholds
    // Level 1: score < 5
    // Level 2: score 5 to 9
    // Level 3: score 10 to 19 (starts here with score 12)
    // Level 4: score 20 to 34
    // Level 5: score >= 35
    const getLevelFromScore = (s: number): TrustLevel => {
      if (s < 5) return 1;
      if (s < 10) return 2;
      if (s < 20) return 3;
      if (s < 35) return 4;
      return 5;
    };

    const nextLevel = getLevelFromScore(nextScore);
    const hasLevelChanged = nextLevel !== trustState.level;
    const previousLevel = trustState.level;

    setTrustState(prev => ({
      level: nextLevel,
      score: nextScore,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          change: scoreChange,
          reason: `Task "${targetTask.title}" resolved ${onTime ? 'on-time' : 'late'}${bonusEarned ? ' (Subtask Breakdown Completion Bonus +1 XP)' : ''}`,
          previousLevel,
          newLevel: nextLevel
        },
        ...prev.history
      ]
    }));

    // Generate log entries
    const logsAdded: ActivityLogEntry[] = [];

    const actionLog: ActivityLogEntry = {
      id: `log-action-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: onTime ? 'draft' : 'trust_change',
      title: bonusEarned ? 'Task & All Subtasks Resolved (+2 XP)' : `Task Resolved: ${onTime ? 'On-Time' : 'Late'}`,
      content: bonusEarned
        ? `User resolved "${targetTask.title}" on-time with 100% of subtasks completed! Base +1 XP and Bonus +1 XP credited. Trust score: ${nextScore} XP (+2).`
        : `User resolved "${targetTask.title}" ${onTime ? 'on-time' : 'after the deadline'}. Trust score: ${nextScore} XP (${scoreChange > 0 ? '+' : ''}${scoreChange}).`,
      details: `Resolution status: ${onTime ? 'On-Time' : 'Late'}\nSubtasks Bonus: ${bonusEarned ? 'Applied (+1 XP)' : 'None'}\nPrevious score: ${previousScore}\nUpdated score: ${nextScore}`
    };
    logsAdded.push(actionLog);

    if (hasLevelChanged) {
      const explanationMessage = getTrustChangeExplanation(previousLevel, nextLevel);

      // Set the notification immediately to display instantly
      setActiveNotification({
        oldLevel: previousLevel,
        newLevel: nextLevel,
        message: explanationMessage
      });

      // Prepare trust change log instantly
      const logId = `log-change-${Date.now()}`;
      const changeLog: ActivityLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: 'trust_change',
        title: `AI Trust Core Capability ${nextLevel > previousLevel ? 'Elevated' : 'Regressed'}`,
        content: explanationMessage,
        details: `Previous Level: ${previousLevel}\nNew Level: ${nextLevel}\nScoring adjustment: ${scoreChange}`
      };
      logsAdded.push(changeLog);
    }

    setLogs(prev => [...logsAdded, ...prev]);
    handleRefreshCheckin();
  };

  // Mark task as missed entirely (simulated)
  const handleMissTask = async (taskId: string, fallbackTask?: Task) => {
    const targetTask = fallbackTask || tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    // Update task
    setTasks(prev => {
      const exists = prev.some(t => t.id === taskId);
      if (exists) {
        return prev.map(t => t.id === taskId ? { 
          ...t, 
          status: 'missed', 
          completedOnTime: false 
        } : t);
      } else if (fallbackTask) {
        return [{
          ...fallbackTask,
          status: 'missed',
          completedOnTime: false
        }, ...prev];
      }
      return prev;
    });

    // Handle Trust calculation
    // Missed deadline penalty is -5 XP
    const scoreChange = -5;
    const previousScore = trustState.score;
    const nextScore = Math.max(0, previousScore + scoreChange);

    const getLevelFromScore = (s: number): TrustLevel => {
      if (s < 5) return 1;
      if (s < 10) return 2;
      if (s < 20) return 3;
      if (s < 35) return 4;
      return 5;
    };

    const nextLevel = getLevelFromScore(nextScore);
    const hasLevelChanged = nextLevel !== trustState.level;
    const previousLevel = trustState.level;

    setTrustState(prev => ({
      level: nextLevel,
      score: nextScore,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          change: scoreChange,
          reason: `Task "${targetTask.title}" missed deadline entirely`,
          previousLevel,
          newLevel: nextLevel
        },
        ...prev.history
      ]
    }));

    // Generate log entries
    const logsAdded: ActivityLogEntry[] = [];

    const actionLog: ActivityLogEntry = {
      id: `log-action-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'trust_change',
      title: 'Deadline Missed Entirely',
      content: `User marked "${targetTask.title}" as missed. Trust score: ${nextScore} XP (-5).`,
      details: `Resolution status: Missed\nPrevious score: ${previousScore}\nUpdated score: ${nextScore}`
    };
    logsAdded.push(actionLog);

    if (hasLevelChanged) {
      const explanationMessage = getTrustChangeExplanation(previousLevel, nextLevel);

      // Set the notification immediately to display instantly
      setActiveNotification({
        oldLevel: previousLevel,
        newLevel: nextLevel,
        message: explanationMessage
      });

      // Prepare trust change log instantly
      const logId = `log-change-${Date.now()}`;
      const changeLog: ActivityLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: 'trust_change',
        title: `AI Trust Core Capability Regressed`,
        content: explanationMessage,
        details: `Previous Level: ${previousLevel}\nNew Level: ${nextLevel}\nScoring adjustment: ${scoreChange}`
      };
      logsAdded.push(changeLog);
    }

    setLogs(prev => [...logsAdded, ...prev]);
    handleRefreshCheckin();
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'agent_decision',
      title: 'Task Cleared',
      content: `User removed task from active agenda.`,
    };
    setLogs(prev => [newLog, ...prev]);
    handleRefreshCheckin();
  };

  // Reorder task priority manually (locking its priority via pinning)
  const handleReorderTask = (taskId: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      // Find the indices of pending tasks
      const pendingIndices = prev
        .map((t, idx) => ({ t, idx }))
        .filter(item => item.t.status === 'pending');

      const targetIdxInPending = pendingIndices.findIndex(item => item.t.id === taskId);
      if (targetIdxInPending === -1) return prev;

      let swapIdxInPending = -1;
      if (direction === 'up' && targetIdxInPending > 0) {
        swapIdxInPending = targetIdxInPending - 1;
      } else if (direction === 'down' && targetIdxInPending < pendingIndices.length - 1) {
        swapIdxInPending = targetIdxInPending + 1;
      }

      if (swapIdxInPending === -1) return prev;

      // Real indices in the main array
      const realIdx1 = pendingIndices[targetIdxInPending].idx;
      const realIdx2 = pendingIndices[swapIdxInPending].idx;

      const updated = [...prev];
      // BUG 1 Fix: Mark the explicitly moved task (task1) as manually pinned.
      // Do NOT mark task2 (the displaced task) as pinned unless it was already pinned!
      const task1 = { ...updated[realIdx1], isPinned: true };
      const task2 = { ...updated[realIdx2] };

      // Swap elements
      updated[realIdx1] = task2;
      updated[realIdx2] = task1;

      // Now construct the updated list of pending tasks to find their new indices
      const newPending = updated.filter(t => t.status === 'pending');

      // BUG 2 Fix: If any pinned task ends up at its original AI-assigned position (originalAIRank),
      // automatically remove the "Manually Pinned" badge and restore normal AI sorting.
      const finalTasks = updated.map(t => {
        if (t.status === 'pending') {
          const currentIdxInPending = newPending.findIndex(p => p.id === t.id);
          
          // EXACT COMPARISON LOGIC FOR AUTO-UNPIN (Requested in BUG 2)
          // Compare: current position vs original AI-assigned rank
          const hasOriginalRank = t.originalAIRank !== undefined;
          const isAtOriginalRank = hasOriginalRank && currentIdxInPending === t.originalAIRank;
          
          if (isAtOriginalRank) {
            console.log(`Auto-unpinning task "${t.title}": current position ${currentIdxInPending} matches originalAIRank ${t.originalAIRank}`);
            return { ...t, isPinned: false };
          } else if (t.id === task1.id) {
            // Only force pin on the explicitly moved task if it's NOT at its original rank
            return { ...t, isPinned: true };
          }
        }
        return t;
      });

      return finalTasks;
    });

    const newLog: ActivityLogEntry = {
      id: `log-reorder-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'agent_decision',
      title: 'Manual Priority Override Applied',
      content: 'Task position overridden by user. Priority order locked.',
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Move task position directly (via drag-and-drop)
  const handleMoveTask = (fromIdxInPending: number, toIdxInPending: number) => {
    if (fromIdxInPending === toIdxInPending) return;

    let targetTaskId = '';

    setTasks(prev => {
      // Find the indices of pending tasks
      const pendingIndices = prev
        .map((t, idx) => ({ t, idx }))
        .filter(item => item.t.status === 'pending');

      if (fromIdxInPending < 0 || fromIdxInPending >= pendingIndices.length ||
          toIdxInPending < 0 || toIdxInPending >= pendingIndices.length) {
        return prev;
      }

      // Real indices in the main array
      const realFromIdx = pendingIndices[fromIdxInPending].idx;
      const targetTask = prev[realFromIdx];
      targetTaskId = targetTask.id;

      // Construct list of all pending tasks
      const pendingTasks = pendingIndices.map(item => prev[item.idx]);
      
      // Move within pending list
      const movedPending = [...pendingTasks];
      const [removed] = movedPending.splice(fromIdxInPending, 1);
      
      // Mark explicitly moved task as manually pinned (provisional state)
      const pinnedRemoved = { ...removed, isPinned: true };
      movedPending.splice(toIdxInPending, 0, pinnedRemoved);

      // Now map back to the main tasks array, keeping non-pending tasks in their original places
      let pendingCount = 0;
      const updated = prev.map(t => {
        if (t.status === 'pending') {
          return movedPending[pendingCount++];
        }
        return t;
      });

      // Now construct the updated list of pending tasks to find their new indices
      const newPendingList = updated.filter(t => t.status === 'pending');
      
      // BUG 2 Fix: If any pinned task ends up at its original AI-assigned position,
      // automatically remove the "Manually Pinned" badge and restore normal AI sorting.
      const finalTasks = updated.map(t => {
        if (t.status === 'pending') {
          const currentIdxInPending = newPendingList.findIndex(p => p.id === t.id);
          
          // EXACT COMPARISON LOGIC FOR AUTO-UNPIN (Requested in BUG 2)
          // Compare: current position vs original AI-assigned rank
          const hasOriginalRank = t.originalAIRank !== undefined;
          const isAtOriginalRank = hasOriginalRank && currentIdxInPending === t.originalAIRank;
          
          if (isAtOriginalRank) {
            console.log(`Auto-unpinning task "${t.title}": current position ${currentIdxInPending} matches originalAIRank ${t.originalAIRank}`);
            return { ...t, isPinned: false };
          } else if (t.id === targetTaskId) {
            // Only force pin on the explicitly moved task if it's NOT at its original rank
            return { ...t, isPinned: true };
          }
        }
        return t;
      });

      return finalTasks;
    });

    const newLog: ActivityLogEntry = {
      id: `log-reorder-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'agent_decision',
      title: 'Manual Priority Override Applied',
      content: 'Task position overridden by user via drag-and-drop. Priority order locked.',
    };
    setLogs(prev => [newLog, ...prev]);
  };

  // Reset to automatic AI priority
  const handleResetPriority = () => {
    const updatedTasks = tasks.map(t => t.status === 'pending' ? { ...t, isPinned: false } : t);
    setTasks(updatedTasks);

    const newLog: ActivityLogEntry = {
      id: `log-reset-priority-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'agent_decision',
      title: 'Agenda Reset to AI Priority',
      content: 'Cleared all user-set priority pins. Full AI autonomous scheduling restored.',
    };
    setLogs(prev => [newLog, ...prev]);

    // Instantly trigger full AI re-sorting from scratch
    handlePrioritizeTasks(updatedTasks);
    handleRefreshCheckin();
  };

  // Proactive Draft Generation (Level 4+)
  const handleGenerateDraft = async (task: Task) => {
    try {
      const response = await fetch('/api/gemini/simulated-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskTitle: task.title, taskNotes: task.notes }),
      });

      if (response.ok) {
        const data = await response.json();
        setDrafts(prev => ({
          ...prev,
          [task.id]: { type: data.draftType, content: data.draftContent }
        }));

        const newLog: ActivityLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'draft',
          title: `Autonomous Draft Formulated for "${task.title}"`,
          content: `Proactive drafting core formulated a proposed "${data.draftType}" for speedier execution. Ready for user preview.`,
          details: `Draft Content:\n${data.draftContent}`
        };
        setLogs(prev => [newLog, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Approve Proposed Schedule & Create REAL Google Calendar Event (Level 3+)
  const handleApproveSchedule = async (task: Task, start: string, end: string) => {
    console.log("[handleApproveSchedule] Invoked with:", { task, start, end, calendarToken });
    if (!calendarToken) {
      console.warn("[handleApproveSchedule] Blocked: No calendarToken is active.");
      return;
    }

    setIsScheduling(true);
    try {
      console.log("[handleApproveSchedule] Calling createCalendarEvent API with token...");
      const result = await createCalendarEvent(
        calendarToken,
        task.title,
        task.notes || 'Scheduled automatically by Earned AI Companion',
        start,
        end
      );

      console.log("[handleApproveSchedule] createCalendarEvent API result received:", result);
      if (result && result.id) {
        // Clear proposal and attach event id
        setTasks(prev => prev.map(t => t.id === task.id ? { 
          ...t, 
          calendarEventId: result.id,
          suggestedTimeSlot: null 
        } : t));

        // Add log
        const newLog: ActivityLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'schedule',
          title: 'Google Calendar Event Inserted',
          content: `Real event successfully created on Google Calendar for "${task.title}".`,
          details: `Event Link: ${result.htmlLink || 'none'}\nEvent ID: ${result.id}\nDuration: ${new Date(start).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}`
        };
        setLogs(prev => [newLog, ...prev]);
        
        try {
          alert('Event successfully added to your real Google Calendar!');
        } catch (e) {
          console.warn("[handleApproveSchedule] window.alert was blocked or failed in this iframe environment.", e);
        }
      } else {
        console.warn("[handleApproveSchedule] API call completed but returned an invalid or empty result:", result);
      }
    } catch (err: any) {
      console.error("[handleApproveSchedule] Error creating Google Calendar event:", err);
      try {
        alert(`Sync failed: ${err.message}`);
      } catch (e) {
        console.warn("[handleApproveSchedule] window.alert failed during error messaging.", e);
      }
    } finally {
      setIsScheduling(false);
    }
  };

  // RUN AGENT LOOP (Observe -> Assess -> Decide -> Act -> Report)
  const handleRunAgentLoop = async () => {
    setIsAgentRunning(true);
    try {
      // Collect mock or real calendar summaries for the agent
      const calendarSummaries = calendarToken ? ['Real Google Calendar synced and loaded.'] : ['No Google Calendar connected (local simulation mode active).'];

      const response = await fetch('/api/gemini/agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          calendarEvents: calendarSummaries,
          trustLevel: trustState.level,
          currentTimestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Formulate reasoning log
        const logsToAdd: ActivityLogEntry[] = [];

        const traceDetails = `[1. OBSERVE]\n${data.observeLog}\n\n[2. ASSESS]\n${data.assessLog}\n\n[3. DECIDE]\n${data.decideLog}\n\n[4. ACT]\n${data.actLog}\n\n[5. REPORT]\n${data.reportLog}`;

        // Create the core decision log
        const mainLog: ActivityLogEntry = {
          id: `log-loop-core-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: data.isFallback ? 'fallback' : 'agent_decision',
          title: data.isFallback
            ? `Agent Check Loop [OFFLINE FALLBACK]: Chosen Action [${data.decision.toUpperCase()}]`
            : `Agent Check Loop: Chosen Action [${data.decision.toUpperCase()}]`,
          content: data.decisionReasoning || 'Core agent reasoning completed.',
          details: traceDetails
        };
        logsToAdd.push(mainLog);

        // Perform side-effects if decision matches capability level
        if (data.decision === 'schedule' && data.actionDetails?.suggestedTimeSlot && trustState.level >= 3) {
          const targetId = data.actionDetails.taskId || (tasks[0]?.id);
          const taskToSchedule = tasks.find(t => t.id === targetId);
          if (targetId && taskToSchedule) {
            if (calendarToken && trustState.level === 5) {
              // Level 5 - AUTONOMOUS REAL EVENT CREATION (no confirm required)
              try {
                const result = await createCalendarEvent(
                  calendarToken,
                  taskToSchedule.title,
                  taskToSchedule.notes || 'Scheduled autonomously by Earned AI Companion',
                  data.actionDetails.suggestedTimeSlot.start,
                  data.actionDetails.suggestedTimeSlot.end
                );
                
                if (result && result.id) {
                  setTasks(prev => prev.map(t => t.id === targetId ? {
                    ...t,
                    calendarEventId: result.id,
                    suggestedTimeSlot: null
                  } : t));

                  const actLog: ActivityLogEntry = {
                    id: `log-loop-act-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    type: 'schedule',
                    title: `Agent Action [AUTONOMOUS]: Real Event Created`,
                    content: `AI autonomously booked a block on your real Google Calendar for "${taskToSchedule.title}".`,
                    details: `Event Link: ${result.htmlLink || 'none'}\nEvent ID: ${result.id}\nDuration: ${new Date(data.actionDetails.suggestedTimeSlot.start).toLocaleString()} - ${new Date(data.actionDetails.suggestedTimeSlot.end).toLocaleTimeString()}`
                  };
                  logsToAdd.push(actLog);
                }
              } catch (err: any) {
                console.error("Autonomous event creation failed:", err);
                const failLog: ActivityLogEntry = {
                  id: `log-loop-fail-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  type: 'schedule',
                  title: `Agent Action [AUTONOMOUS]: Booking Failed`,
                  content: `Attempted to autonomously book "${taskToSchedule.title}", but the API returned an error: ${err.message}`,
                  details: `Error: ${err.message}`
                };
                logsToAdd.push(failLog);
              }
            } else if (calendarToken && (trustState.level === 3 || trustState.level === 4)) {
              // Level 3 or 4 - SUGGEST & TRIGGER SAME APPROVAL FLOW
              setTasks(prev => prev.map(t => t.id === targetId ? {
                ...t,
                suggestedTimeSlot: data.actionDetails.suggestedTimeSlot
              } : t));

              const actLog: ActivityLogEntry = {
                id: `log-loop-act-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'schedule',
                title: `Agent Action: Proposal Triggered`,
                content: `AI proposed a schedule block for "${taskToSchedule.title}" and triggered the Google Calendar approval flow.`,
                details: `Suggested Start: ${data.actionDetails.suggestedTimeSlot.start}\nSuggested End: ${data.actionDetails.suggestedTimeSlot.end}`
              };
              logsToAdd.push(actLog);

              // Trigger the existing handleApproveSchedule flow (with prompt) after states settle
              setTimeout(() => {
                handleApproveSchedule(taskToSchedule, data.actionDetails.suggestedTimeSlot.start, data.actionDetails.suggestedTimeSlot.end);
              }, 300);
            } else {
              // Level 3+ with NO calendarToken connected (Simulation)
              setTasks(prev => prev.map(t => t.id === targetId ? {
                ...t,
                suggestedTimeSlot: data.actionDetails.suggestedTimeSlot
              } : t));

              const actLog: ActivityLogEntry = {
                id: `log-loop-act-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'schedule',
                title: `Agent Proposal: Time Slot Allocated`,
                content: `AI evaluated conflicts and allocated a proposed block for "${taskToSchedule.title}" (Local simulation).`,
                details: `Suggested Start: ${data.actionDetails.suggestedTimeSlot.start}\nSuggested End: ${data.actionDetails.suggestedTimeSlot.end}\nConnect Google Calendar to synchronize autonomously.`
              };
              logsToAdd.push(actLog);
            }
          }
        } else if (data.decision === 'draft' && data.actionDetails?.draftText && trustState.level >= 4) {
          const targetId = data.actionDetails.taskId || (tasks[0]?.id);
          const taskToDraft = tasks.find(t => t.id === targetId);
          if (targetId && taskToDraft) {
            const emailInfo = parseEmailFromNotes(taskToDraft.notes);
            
            if (emailInfo && trustState.level === 5) {
              // Level 5: AUTONOMOUS GMAIL REPLY
              try {
                const response = await fetch('/api/gmail/send-reply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    accessToken: calendarToken,
                    threadId: taskToDraft.id.replace('task-email-', ''),
                    recipient: emailInfo.from,
                    subject: emailInfo.subject,
                    body: data.actionDetails.draftText,
                    demoMode: demoMode
                  })
                });
                
                if (response.ok) {
                  const sendData = await response.json();
                  
                  // Complete the task autonomously
                  setTasks(prev => prev.map(t => t.id === targetId ? {
                    ...t,
                    status: 'done',
                    completedOnTime: true
                  } : t));

                  const actLog: ActivityLogEntry = {
                    id: `log-loop-act-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    type: 'autonomous_action',
                    title: `Agent Action [AUTONOMOUS]: Real Email Reply Sent`,
                    content: `AI autonomously replied to ${sendData.recipient} regarding "${emailInfo.subject}".`,
                    details: `Message ID: ${sendData.messageId}\nRecipient: ${sendData.recipient}\nSubject: ${sendData.subject}\n\nSent Body:\n${sendData.body}`
                  };
                  logsToAdd.push(actLog);
                } else {
                  throw new Error('Gmail send failed');
                }
              } catch (err: any) {
                console.error('Autonomous Gmail reply dispatch failed:', err);
                const failLog: ActivityLogEntry = {
                  id: `log-loop-fail-${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  type: 'draft',
                  title: `Agent Action [AUTONOMOUS]: Email Reply Failed`,
                  content: `Attempted to autonomously send email reply for "${taskToDraft.title}", but the API returned an error: ${err.message}`,
                  details: `Recipient: ${emailInfo.from}`
                };
                logsToAdd.push(failLog);
              }
            } else {
              // Level 4 or non-email task: Create local draft structure
              setDrafts(prev => ({
                ...prev,
                [targetId]: { 
                  type: data.actionDetails.draftType || 'Email Draft', 
                  content: data.actionDetails.draftText 
                }
              }));

              const actLog: ActivityLogEntry = {
                id: `log-loop-act-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'draft',
                title: `Agent Action: Autonomous Draft Formed`,
                content: `AI pre-emptively compiled required "${data.actionDetails.draftType || 'Email Draft'}" draft for "${taskToDraft.title}".`,
                details: data.actionDetails.draftText
              };
              logsToAdd.push(actLog);
            }
          }
        } else if (data.decision === 'nudge' && data.actionDetails?.nudgeMessage) {
          const actLog: ActivityLogEntry = {
            id: `log-loop-act-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'nudge',
            title: 'Agent Action: Priority Nudge Dispatched',
            content: data.actionDetails.nudgeMessage
          };
          logsToAdd.push(actLog);
        }

        setLogs(prev => [...logsToAdd, ...prev]);
        handleRefreshCheckin();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // RUN WEEKLY TRUST REVIEW
  const handleRunTrustReview = async () => {
    setIsReviewRunning(true);
    try {
      const response = await fetch('/api/gemini/trust-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          trustLevel: trustState.level,
          score: trustState.score
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveReflection(data.reflection);

        // Log audit
        const auditLog: ActivityLogEntry = {
          id: `log-audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'trust_review',
          title: 'Weekly Trust Core Reflection Audit',
          content: data.reflection,
          details: `Evaluated Trust Score: ${trustState.score}\nActive Capabilities: Level ${trustState.level}`
        };
        setLogs(prev => [auditLog, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewRunning(false);
    }
  };

  // Demo buttons integrations
  const triggerOnTimeSim = () => {
    // Simulated throwaway task purely to trigger trust XP change & associated UI/logs
    const simTitle = "Simulated Demo Task (On-Time Completion)";
    const scoreChange = 1;
    const previousScore = trustState.score;
    const nextScore = Math.max(0, previousScore + scoreChange);
    const previousLevel = trustState.level;
    
    const getLevelFromScore = (s: number): TrustLevel => {
      if (s < 5) return 1;
      if (s < 10) return 2;
      if (s < 20) return 3;
      if (s < 35) return 4;
      return 5;
    };
    
    const nextLevel = getLevelFromScore(nextScore);
    const hasLevelChanged = nextLevel !== trustState.level;

    setTrustState(prev => ({
      level: nextLevel,
      score: nextScore,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          change: scoreChange,
          reason: `Simulated task "${simTitle}" resolved on-time`,
          previousLevel,
          newLevel: nextLevel
        },
        ...prev.history
      ]
    }));

    const logsAdded: ActivityLogEntry[] = [];
    const actionLog: ActivityLogEntry = {
      id: `log-action-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'draft',
      title: 'Task Resolved (Simulated On-Time)',
      content: `Simulated resolution of "${simTitle}" on-time. Trust score: ${nextScore} XP (+1).`,
      details: `Resolution status: On-Time\nPrevious score: ${previousScore}\nUpdated score: ${nextScore}`
    };
    logsAdded.push(actionLog);

    if (hasLevelChanged) {
      const explanationMessage = getTrustChangeExplanation(previousLevel, nextLevel);
      setActiveNotification({
        oldLevel: previousLevel,
        newLevel: nextLevel,
        message: explanationMessage
      });

      const logId = `log-change-${Date.now()}`;
      const changeLog: ActivityLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: 'trust_change',
        title: `AI Trust Core Capability ${nextLevel > previousLevel ? 'Elevated' : 'Regressed'}`,
        content: explanationMessage,
        details: `Previous Level: ${previousLevel}\nNew Level: ${nextLevel}\nScoring adjustment: ${scoreChange}`
      };
      logsAdded.push(changeLog);
    }

    setLogs(prev => [...logsAdded, ...prev]);
  };

  const triggerLateSim = () => {
    // Simulated throwaway task purely to trigger trust XP change & associated UI/logs
    const simTitle = "Simulated Demo Task (Late Completion)";
    const scoreChange = -4;
    const previousScore = trustState.score;
    const nextScore = Math.max(0, previousScore + scoreChange);
    const previousLevel = trustState.level;

    const getLevelFromScore = (s: number): TrustLevel => {
      if (s < 5) return 1;
      if (s < 10) return 2;
      if (s < 20) return 3;
      if (s < 35) return 4;
      return 5;
    };

    const nextLevel = getLevelFromScore(nextScore);
    const hasLevelChanged = nextLevel !== trustState.level;

    setTrustState(prev => ({
      level: nextLevel,
      score: nextScore,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          change: scoreChange,
          reason: `Simulated task "${simTitle}" resolved late`,
          previousLevel,
          newLevel: nextLevel
        },
        ...prev.history
      ]
    }));

    const logsAdded: ActivityLogEntry[] = [];
    const actionLog: ActivityLogEntry = {
      id: `log-action-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'trust_change',
      title: 'Task Resolved (Simulated Late)',
      content: `Simulated resolution of "${simTitle}" after the deadline. Trust score: ${nextScore} XP (-4).`,
      details: `Resolution status: Late\nPrevious score: ${previousScore}\nUpdated score: ${nextScore}`
    };
    logsAdded.push(actionLog);

    if (hasLevelChanged) {
      const explanationMessage = getTrustChangeExplanation(previousLevel, nextLevel);
      setActiveNotification({
        oldLevel: previousLevel,
        newLevel: nextLevel,
        message: explanationMessage
      });

      const logId = `log-change-${Date.now()}`;
      const changeLog: ActivityLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: 'trust_change',
        title: `AI Trust Core Capability ${nextLevel > previousLevel ? 'Elevated' : 'Regressed'}`,
        content: explanationMessage,
        details: `Previous Level: ${previousLevel}\nNew Level: ${nextLevel}\nScoring adjustment: ${scoreChange}`
      };
      logsAdded.push(changeLog);
    }

    setLogs(prev => [...logsAdded, ...prev]);
  };

  const triggerMissSim = () => {
    // Simulated throwaway task purely to trigger trust XP change & associated UI/logs
    const simTitle = "Simulated Demo Task (Missed Deadline Entirely)";
    const scoreChange = -5;
    const previousScore = trustState.score;
    const nextScore = Math.max(0, previousScore + scoreChange);
    const previousLevel = trustState.level;

    const getLevelFromScore = (s: number): TrustLevel => {
      if (s < 5) return 1;
      if (s < 10) return 2;
      if (s < 20) return 3;
      if (s < 35) return 4;
      return 5;
    };

    const nextLevel = getLevelFromScore(nextScore);
    const hasLevelChanged = nextLevel !== trustState.level;

    setTrustState(prev => ({
      level: nextLevel,
      score: nextScore,
      history: [
        {
          id: `hist-${Date.now()}`,
          date: new Date().toISOString(),
          change: scoreChange,
          reason: `Simulated task "${simTitle}" missed deadline entirely`,
          previousLevel,
          newLevel: nextLevel
        },
        ...prev.history
      ]
    }));

    const logsAdded: ActivityLogEntry[] = [];
    const missLog: ActivityLogEntry = {
      id: `log-miss-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'trust_change',
      title: 'Deadline Missed (Simulated)',
      content: `Simulated event: A task's deadline was missed entirely. Trust score: ${nextScore} XP (-5).`,
      details: `Resolution status: Missed\nPrevious score: ${previousScore}\nUpdated score: ${nextScore}`
    };
    logsAdded.push(missLog);

    if (hasLevelChanged) {
      const explanationMessage = getTrustChangeExplanation(previousLevel, nextLevel);
      setActiveNotification({
        oldLevel: previousLevel,
        newLevel: nextLevel,
        message: explanationMessage
      });

      const logId = `log-change-${Date.now()}`;
      const changeLog: ActivityLogEntry = {
        id: logId,
        timestamp: new Date().toISOString(),
        type: 'trust_change',
        title: `AI Trust Core Capability Regressed`,
        content: explanationMessage,
        details: `Previous Level: ${previousLevel}\nNew Level: ${nextLevel}\nScoring adjustment: ${scoreChange}`
      };
      logsAdded.push(changeLog);
    }

    setLogs(prev => [...logsAdded, ...prev]);
  };

  const handleResetDemo = () => {
    console.log("Resetting Demo: Clearing all current pending, active, completed, missed, email-derived and custom tasks, and recreating original 3 seeded baseline tasks.");
    
    // 1. Generate fresh initial tasks and logs
    const freshTasks = getFreshInitialTasks();
    const freshLogs = getFreshInitialLogs();
    
    // 2. Reset React state variables
    setTasks(freshTasks);
    setTrustState({ level: 3, score: 12, history: [] });
    setLogs(freshLogs);
    setDrafts({});
    setDetectedEmails([]);
    setDailyCheckin('');
    setActiveTab('dashboard');
    setShowLanding(true);
    
    // 3. Clear and set local storage & session storage
    localStorage.setItem('earned_tasks', JSON.stringify(freshTasks));
    localStorage.setItem('earned_trust', JSON.stringify({ level: 3, score: 12, history: [] }));
    localStorage.setItem('earned_logs', JSON.stringify(freshLogs));
    localStorage.setItem('earned_drafts', JSON.stringify({}));
    localStorage.removeItem('earned_checkin');
    sessionStorage.removeItem('earned_has_seen_landing');
    
    // Clear resolving task IDs ref
    resolvingTaskIdsRef.current.clear();
  };

  if (showLanding) {
    return (
      <LandingPage
        onGetStarted={() => {
          sessionStorage.setItem('earned_has_seen_landing', 'true');
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f4f5] font-sans selection:bg-indigo-500/20 selection:text-indigo-200">
      
      {/* GEOMETRIC NAVIGATION RAIL */}
      <nav id="app-nav" className="sticky top-0 z-40 bg-[#0c0d14]/85 backdrop-blur-md border-b border-[#1f2235] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-950/40 border border-indigo-500/20 rounded-xl shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Zap className="w-5 h-5 text-indigo-400 fill-indigo-500/10" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-white">Earned</span>
              <span className="text-[9px] font-mono text-indigo-400 font-bold block uppercase tracking-widest -mt-1">
                AI TRUST COMPANION
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#131420] border border-[#1f2235] p-1 rounded-xl">
            <button
              id="nav-tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-[#1c1d2e] text-white shadow-xs font-bold border border-indigo-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dashboard
            </button>
            <button
              id="nav-tab-tree"
              onClick={() => setActiveTab('tree')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'tree' 
                  ? 'bg-[#1c1d2e] text-white shadow-xs font-bold border border-indigo-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Capability Tree
            </button>
            <button
              id="nav-tab-logs"
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'logs' 
                  ? 'bg-[#1c1d2e] text-white shadow-xs font-bold border border-indigo-500/30' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activity Log
            </button>
          </div>

          {/* User Account / Sync info */}
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden md:flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>SECURELY SYNCED</span>
                </div>
                <div className="flex items-center gap-2 bg-[#131420] px-3.5 py-1.5 rounded-xl border border-[#1f2235]">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Google" className="w-4 h-4 rounded-full border border-indigo-500/20" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-[9px] font-bold text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-mono">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </span>
                  )}
                  <span className="text-xs text-slate-300 font-mono font-bold truncate max-w-32">{user.displayName || user.email}</span>
                  <button onClick={handleDisconnectCalendar} className="text-slate-400 hover:text-red-400 p-0.5 cursor-pointer transition-colors" title="Disconnect Google Workspace">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button 
                id="btn-nav-connect"
                onClick={handleConnectCalendar}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-[#131420] hover:bg-[#1a1b2c] text-slate-200 border border-[#1f2235] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs hover:border-indigo-500/30"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Connect Calendar</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* CORE WRAPPER */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* Hackathon Demo Panel (Collapsible, placed prominently on top) */}
        <DemoControls
          onSimulateCompleteOnTime={triggerOnTimeSim}
          onSimulateCompleteLate={triggerLateSim}
          onSimulateMissDeadline={triggerMissSim}
          onRunAgentLoop={handleRunAgentLoop}
          onRunTrustReview={handleRunTrustReview}
          isAgentRunning={isAgentRunning}
          isReviewRunning={isReviewRunning}
          score={trustState.score}
          level={trustState.level}
          demoMode={demoMode}
          onToggleDemoMode={() => setDemoMode(!demoMode)}
          onResetDemo={handleResetDemo}
        />

        {/* Task Creator Block */}
        {activeTab === 'dashboard' && (
          <AddTask onAddTask={handleAddTask} level={trustState.level} />
        )}

        {/* ACTIVE MODULE VIEW */}
        <div id="active-tab-container">
          {activeTab === 'dashboard' && (
            <Dashboard
              tasks={tasks}
              trustState={trustState}
              dailyCheckin={dailyCheckin}
              isCheckinLoading={isCheckinLoading}
              onCompleteTask={handleCompleteTask}
              onMissTask={handleMissTask}
              onDeleteTask={handleDeleteTask}
              onReorderTask={handleReorderTask}
              onMoveTask={handleMoveTask}
              onResetPriority={handleResetPriority}
              calendarToken={calendarToken}
              onConnectCalendar={handleConnectCalendar}
              onBypassCalendar={handleBypassCalendar}
              onApproveSchedule={handleApproveSchedule}
              isScheduling={isScheduling}
              onGenerateDraft={handleGenerateDraft}
              drafts={drafts}
              detectedEmails={detectedEmails}
              isScanningEmails={isScanningEmails}
              emailScanError={emailScanError}
              onScanEmails={() => handleScanEmails()}
              onAddEmailTask={handleAddEmailTask}
              onSendEmailReply={handleSendEmailReply}
              isSendingEmail={isSendingEmail}
              demoMode={demoMode}
              authError={authError}
              onClearAuthError={() => setAuthError(null)}
              isAuthAttemptPending={isAuthAttemptPending}
              onBreakdownTask={handleManualBreakdown}
              onToggleSubtask={handleToggleSubtask}
              onToggleSubtasksCollapse={handleToggleSubtasksCollapse}
              breakingDownTaskIds={breakingDownTaskIds}
            />
          )}

          {activeTab === 'tree' && (
            <Tree currentLevel={trustState.level} />
          )}

          {activeTab === 'logs' && (
            <Log entries={logs} />
          )}
        </div>
      </main>

      {/* 1. CELEBRATION / REGRESSION NOTIFICATION MODAL */}
      {activeNotification && (
        <div id="notification-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#12131a] border border-[#26293b] rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left">
            <button 
              id="btn-close-notification"
              onClick={() => setActiveNotification(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 rounded-lg p-0.5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4 pt-2">
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-indigo-950/50 border border-indigo-500/30">
                {activeNotification.newLevel > activeNotification.oldLevel ? (
                  <Award className="w-6 h-6 text-indigo-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-400 animate-pulse" />
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-widest block">
                  Trust Core Adjustment
                </span>
                <h3 className="font-display font-bold text-xl text-white">
                  {activeNotification.newLevel > activeNotification.oldLevel 
                    ? 'AI Capability Unlocked!' 
                    : 'AI Capability Restrained'
                  }
                </h3>
                <p className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 px-3 py-0.5 rounded-full inline-block">
                  Tier {activeNotification.oldLevel} → Tier {activeNotification.newLevel}
                </p>
              </div>

              <p className="text-sm text-slate-300 bg-[#171822] border border-[#26283c] p-4 rounded-xl italic leading-relaxed font-medium">
                "{activeNotification.message}"
              </p>

              <button
                id="btn-confirm-notification"
                onClick={() => setActiveNotification(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:ring-offset-2 focus:ring-offset-[#12131a]"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. WEEKLY TRUST AUDIT REFLECTION MODAL */}
      {activeReflection && (
        <div id="reflection-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#12131a] border border-[#26293b] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left">
            <button 
              id="btn-close-reflection"
              onClick={() => setActiveReflection(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 rounded-lg p-0.5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#212332] pb-3">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h3 className="font-display font-semibold text-lg text-white">
                  AI Trust Core Reflection Audit
                </h3>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed italic bg-purple-950/20 p-4 rounded-xl border border-purple-500/20 font-medium">
                "{activeReflection}"
              </p>

              <div className="text-xs text-slate-400 font-mono leading-normal font-semibold">
                This audit is a self-initiated performance log by the Earned agent. It registers trust-levels dynamically to protect companion agency and secure correct operation constraints.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="btn-confirm-reflection"
                  onClick={() => setActiveReflection(null)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:ring-offset-2 focus:ring-offset-[#12131a]"
                >
                  Close Audit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SUBTASK BONUS CELEBRATION TOAST */}
      {subtaskBonusMessage && (
        <div id="subtask-bonus-toast" className="fixed bottom-6 right-6 z-50 flex items-center gap-3.5 bg-gradient-to-r from-emerald-950 via-[#0e1713] to-[#0e1713] border border-emerald-500/30 rounded-2xl p-4 shadow-[0_8px_32px_rgba(16,185,129,0.15)] animate-in slide-in-from-bottom-5 duration-300 max-w-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 block mb-0.5">Bonus XP Credited</span>
            <p className="text-xs text-slate-200 font-medium leading-normal">
              {subtaskBonusMessage}
            </p>
          </div>
          <button
            onClick={() => setSubtaskBonusMessage(null)}
            className="text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. LATE SUBTASK COMPLETION CHOICE PROMPT */}
      {lateCompletionPromptTask && (
        <div id="late-completion-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#12131a] border border-[#26293b] rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-left">
            <button 
              id="btn-close-late-prompt"
              onClick={() => {
                setDismissedLatePromptTaskIds(prev => [...prev, lateCompletionPromptTask.id]);
                setLateCompletionPromptTask(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 rounded-lg p-0.5"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4 pt-2">
              <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-amber-950/50 border border-amber-500/30">
                <AlertCircle className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>

              <div className="text-center space-y-1">
                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold tracking-widest block">
                  Deadline Passed
                </span>
                <h3 className="font-display font-bold text-lg text-white">
                  Action Plan Finished Late
                </h3>
                <p className="text-xs text-slate-400">
                  You completed all subtasks for "{lateCompletionPromptTask.title}" after its deadline.
                </p>
              </div>

              <p className="text-xs text-slate-300 bg-[#171822] border border-[#26283c] p-3.5 rounded-xl text-center leading-normal">
                How would you like to log this task resolve?
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  id="btn-late-resolve-complete"
                  onClick={() => {
                    handleCompleteTask(lateCompletionPromptTask.id, false);
                    setLateCompletionPromptTask(null);
                  }}
                  className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/80"
                >
                  <span className="font-semibold">Complete Late</span>
                  <span className="text-[10px] font-normal text-indigo-200">-4 XP Penalty</span>
                </button>

                <button
                  id="btn-late-resolve-missed"
                  onClick={() => {
                    handleMissTask(lateCompletionPromptTask.id);
                    setLateCompletionPromptTask(null);
                  }}
                  className="py-2.5 px-4 bg-[#231518] hover:bg-[#341b20] text-red-400 border border-red-500/15 font-bold rounded-xl text-xs transition-all cursor-pointer flex flex-col items-center justify-center gap-1 focus:outline-none focus:ring-2 focus:ring-red-500/80"
                >
                  <span className="font-semibold">Mark as Missed</span>
                  <span className="text-[10px] font-normal text-red-300/70">-5 XP Penalty</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
