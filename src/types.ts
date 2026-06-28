/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Task {
  id: string;
  title: string;
  notes: string;
  deadline: string; // ISO string format
  estimatedEffort: string; // e.g. "30 mins", "2 hours"
  firstStep: string;
  status: 'pending' | 'done' | 'missed';
  completedOnTime: boolean | null;
  calendarEventId?: string;
  suggestedTimeSlot?: {
    start: string;
    end: string;
  } | null;
  gmailMessageId?: string;
  isFallback?: boolean;
  isPinned?: boolean;
  originalPosition?: number;
  originalAIRank?: number;
}

export type TrustLevel = 1 | 2 | 3 | 4 | 5;

export interface TrustState {
  level: TrustLevel;
  score: number;
  history: {
    id: string;
    date: string;
    change: number;
    reason: string;
    previousLevel: TrustLevel;
    newLevel: TrustLevel;
  }[];
}

export type ActivityLogType = 
  | 'nudge' 
  | 'draft' 
  | 'schedule' 
  | 'trust_change' 
  | 'autonomous_action' 
  | 'agent_decision' 
  | 'trust_review'
  | 'fallback';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  type: ActivityLogType;
  title: string;
  content: string;
  details?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  description?: string;
}

export interface DetectedEmailTask {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  extractedTitle: string;
  extractedDeadline: string;
  reason: string;
  bodySnippet: string;
  originalBody?: string;
  draftedReply?: string;
  isFallback?: boolean;
}

