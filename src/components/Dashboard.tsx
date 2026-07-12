/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Sparkles, 
  CheckCircle, 
  Calendar, 
  Trash2, 
  Clock, 
  UserCheck, 
  FileText, 
  Check, 
  Plus, 
  Eye, 
  Cpu, 
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
  Send,
  Inbox,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  GripVertical
} from 'lucide-react';
import { Task, TrustState, TrustLevel, CalendarEvent, DetectedEmailTask } from '../types';
import { fetchCalendarEvents, createCalendarEvent } from '../utils/calendar';
import DateTimePicker from './DateTimePicker';

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

function renderEventTime(evt: CalendarEvent) {
  const startStr = evt.start?.dateTime;
  const endStr = evt.end?.dateTime;
  if (!startStr) {
    return <span className="text-teal-400 font-bold">All Day</span>;
  }

  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;

  // Check if it's an all-day event
  const isAllDay = !startStr.includes('T');

  const dateFormatted = start.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (isAllDay) {
    return (
      <span className="text-slate-300 font-semibold">
        {dateFormatted} <span className="text-teal-400 font-bold">(All Day)</span>
      </span>
    );
  }

  const startTimeFormatted = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const endTimeFormatted = end
    ? end.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <span className="text-slate-300">
      {dateFormatted} at <span className="text-teal-400 font-bold">{startTimeFormatted}</span>
      {endTimeFormatted && (
        <>
          <span className="text-slate-500"> - </span>
          <span className="text-teal-400 font-bold">{endTimeFormatted}</span>
        </>
      )}
    </span>
  );
}

interface DashboardProps {
  tasks: Task[];
  trustState: TrustState;
  dailyCheckin: string;
  isCheckinLoading: boolean;
  onCompleteTask: (taskId: string, onTime: boolean) => void;
  onMissTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTask?: (taskId: string, direction: 'up' | 'down') => void;
  onMoveTask?: (fromIdx: number, toIdx: number) => void;
  onResetPriority?: () => void;
  calendarToken: string | null;
  onConnectCalendar: () => void;
  onApproveSchedule: (task: Task, start: string, end: string) => void;
  isScheduling: boolean;
  onGenerateDraft: (task: Task) => void;
  drafts: Record<string, { type: string; content: string }>;
  detectedEmails: DetectedEmailTask[];
  isScanningEmails: boolean;
  emailScanError: string | null;
  onScanEmails: () => void;
  onAddEmailTask: (emailTask: DetectedEmailTask) => void;
  onSendEmailReply: (task: Task, draftBody: string) => void;
  isSendingEmail: string | null;
  demoMode: boolean;
  onBypassCalendar?: () => void;
  authError?: string | null;
  onClearAuthError?: () => void;
  isAuthAttemptPending?: boolean;
  onBreakdownTask?: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onToggleSubtasksCollapse?: (taskId: string) => void;
  breakingDownTaskIds?: Set<string>;
}

export default function Dashboard({
  tasks,
  trustState,
  dailyCheckin,
  isCheckinLoading,
  onCompleteTask,
  onMissTask,
  onDeleteTask,
  onReorderTask,
  onMoveTask,
  onResetPriority,
  calendarToken,
  onConnectCalendar,
  onApproveSchedule,
  isScheduling,
  onGenerateDraft,
  drafts,
  detectedEmails,
  isScanningEmails,
  emailScanError,
  onScanEmails,
  onAddEmailTask,
  onSendEmailReply,
  isSendingEmail,
  demoMode,
  onBypassCalendar,
  authError,
  onClearAuthError,
  isAuthAttemptPending,
  onBreakdownTask,
  onToggleSubtask,
  onToggleSubtasksCollapse,
  breakingDownTaskIds
}: DashboardProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [confirmingScheduleTaskId, setConfirmingScheduleTaskId] = useState<string | null>(null);

  // Gmail drafting states
  const [editedDrafts, setEditedDrafts] = useState<Record<string, string>>({});
  const [confirmingSendTaskId, setConfirmingSendTaskId] = useState<string | null>(null);
  const [confirmingDeleteTaskId, setConfirmingDeleteTaskId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Editable proposed calendar slot states
  const [editedStartTimes, setEditedStartTimes] = useState<Record<string, string>>({});
  const [editedEndTimes, setEditedEndTimes] = useState<Record<string, string>>({});

  // Local animating tasks for smooth transition animations
  const [animatingTasks, setAnimatingTasks] = useState<Record<string, {
    type: 'complete' | 'late' | 'missed' | 'delete';
    phase: 'flash' | 'icon' | 'exit';
  }>>({});

  const [floatingXPs, setFloatingXPs] = useState<Array<{ id: string; text: string; colorClass: string }>>([]);
  const prevScoreRef = React.useRef(trustState.score);

  useEffect(() => {
    const diff = trustState.score - prevScoreRef.current;
    if (diff !== 0) {
      const text = diff > 0 ? `+${diff} XP` : `${diff} XP`;
      const colorClass = diff > 0 
        ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30' 
        : diff === -4 
          ? 'text-amber-400 bg-amber-950/40 border border-amber-500/30' 
          : 'text-rose-400 bg-rose-950/40 border border-rose-500/30';
      const id = `xp-${Date.now()}`;
      setFloatingXPs(prev => [...prev, { id, text, colorClass }]);
      setTimeout(() => {
        setFloatingXPs(prev => prev.filter(item => item.id !== id));
      }, 1000);
    }
    prevScoreRef.current = trustState.score;
  }, [trustState.score]);

  const triggerTaskAnimation = (
    taskId: string,
    type: 'complete' | 'late' | 'missed' | 'delete',
    actionFn: () => void
  ) => {
    // 1. Immediately (0ms) set phase to 'flash'
    setAnimatingTasks(prev => ({
      ...prev,
      [taskId]: { type, phase: 'flash' }
    }));

    // 2. At 200ms, transition to 'icon'
    setTimeout(() => {
      setAnimatingTasks(prev => {
        if (!prev[taskId]) return prev;
        return {
          ...prev,
          [taskId]: { ...prev[taskId], phase: 'icon' }
        };
      });
    }, 200);

    // 3. At 500ms, transition to 'exit'
    setTimeout(() => {
      setAnimatingTasks(prev => {
        if (!prev[taskId]) return prev;
        return {
          ...prev,
          [taskId]: { ...prev[taskId], phase: 'exit' }
        };
      });
    }, 500);

    // 4. At 900ms, complete animation and trigger parent action
    setTimeout(() => {
      setAnimatingTasks(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      actionFn();
    }, 900);
  };

  const handleAnimateCompleteOnTime = (taskId: string) => {
    triggerTaskAnimation(taskId, 'complete', () => onCompleteTask(taskId, true));
  };

  const handleAnimateCompleteLate = (taskId: string) => {
    triggerTaskAnimation(taskId, 'late', () => onCompleteTask(taskId, false));
  };

  const handleAnimateMiss = (taskId: string) => {
    triggerTaskAnimation(taskId, 'missed', () => onMissTask(taskId));
  };

  const handleAnimateDelete = (taskId: string) => {
    triggerTaskAnimation(taskId, 'delete', () => onDeleteTask(taskId));
  };

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const historyTasks = tasks
    .filter((t) => t.status === 'done' || t.status === 'missed')
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());

  // Sync incoming props drafts to edited drafts local state
  useEffect(() => {
    const updated = { ...editedDrafts };
    let changed = false;
    for (const taskId of Object.keys(drafts)) {
      if (editedDrafts[taskId] === undefined) {
        updated[taskId] = drafts[taskId].content;
        changed = true;
      }
    }
    if (changed) {
      setEditedDrafts(updated);
    }
  }, [drafts]);

  const handleRefreshCalendar = () => {
    if (!calendarToken) return;
    setIsCalendarLoading(true);
    setCalendarError(null);
    fetchCalendarEvents(calendarToken)
      .then((items) => {
        setEvents(items);
      })
      .catch((err) => {
        console.error('[Dashboard Sync Error]:', err);
        setCalendarError('Failed to sync Google Calendar. Please check connection.');
      })
      .finally(() => {
        setIsCalendarLoading(false);
      });
  };

  // Sync / fetch real calendar events when token is available
  useEffect(() => {
    if (calendarToken) {
      handleRefreshCalendar();
    }
  }, [calendarToken, tasks]); // Refresh on calendar connection or task change

  // Calculate Trust level visual mappings
  const getLevelColorClass = (level: TrustLevel) => {
    switch (level) {
      case 1: return 'text-slate-400 bg-slate-950/40 border-slate-500/20';
      case 2: return 'text-blue-400 bg-blue-950/40 border-blue-500/20';
      case 3: return 'text-teal-400 bg-teal-950/40 border-teal-500/20';
      case 4: return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20';
      case 5: return 'text-amber-400 bg-amber-950/40 border-amber-500/20';
    }
  };

  const getLevelBorder = (level: TrustLevel) => {
    switch (level) {
      case 1: return 'border-slate-800 bg-gradient-to-b from-slate-950/40 via-[#0c0d14] to-[#0c0d14]';
      case 2: return 'border-blue-950/80 bg-gradient-to-b from-blue-950/20 via-[#0c0d14] to-[#0c0d14] shadow-[0_0_25px_rgba(59,130,246,0.03)]';
      case 3: return 'border-teal-950/80 bg-gradient-to-b from-teal-950/20 via-[#0c0d14] to-[#0c0d14] shadow-[0_0_25px_rgba(20,184,166,0.03)]';
      case 4: return 'border-emerald-950/80 bg-gradient-to-b from-emerald-950/20 via-[#0c0d14] to-[#0c0d14] shadow-[0_0_25px_rgba(16,185,129,0.03)]';
      case 5: return 'border-amber-950/80 bg-gradient-to-b from-amber-950/25 via-[#0c0d14] to-[#0c0d14] shadow-[0_0_25px_rgba(245,158,11,0.04)]';
    }
  };

  const getLevelBadgeLabel = (level: TrustLevel) => {
    switch (level) {
      case 1: return 'Level 1: Passive Observer';
      case 2: return 'Level 2: Active Planner';
      case 3: return 'Level 3: Scheduler (Baseline)';
      case 4: return 'Level 4: Proactive Drafter';
      case 5: return 'Level 5: Fully Autonomous';
    }
  };

  const renderTaskCard = (task: Task, idx: number) => {
    const isOverdue = new Date(task.deadline) < new Date() && task.status === 'pending';
    const hasDraft = drafts[task.id];

    // Editable calendar proposed slot variables
    const startVal = editedStartTimes[task.id] || task.suggestedTimeSlot?.start || '';
    const endVal = editedEndTimes[task.id] || task.suggestedTimeSlot?.end || '';
    const isStartInPast = startVal ? new Date(startVal) < new Date() : false;
    const isEndInPast = endVal ? new Date(endVal) < new Date() : false;
    const isTimeInPast = isStartInPast || isEndInPast;
    const isEndBeforeStart = (startVal && endVal) ? new Date(endVal) <= new Date(startVal) : false;
    const isInvalidTime = isTimeInPast || isEndBeforeStart;

    const animation = animatingTasks[task.id];
    let borderClass = '';
    let animStyle: React.CSSProperties = {};

    if (animation) {
      const { type, phase } = animation;
      if (phase === 'flash' || phase === 'icon') {
        if (type === 'complete') {
          borderClass = 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/15 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
        } else if (type === 'late') {
          borderClass = 'ring-2 ring-amber-500 border-amber-500 bg-amber-950/15 shadow-[0_0_20px_rgba(245,158,11,0.3)]';
        } else if (type === 'missed' || type === 'delete') {
          borderClass = 'ring-2 ring-red-500 border-red-500 bg-red-950/15 shadow-[0_0_20px_rgba(239,68,68,0.3)]';
        }
      }
      if (phase === 'exit') {
        animStyle = {
          transform: 'translateY(-20px)',
          opacity: 0,
          transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out',
          pointerEvents: 'none',
        };
      } else {
        animStyle = {
          transition: 'all 200ms ease-out',
        };
      }
    }

    return (
      <div
        key={task.id}
        id={`task-card-${task.id}`}
        style={animStyle}
        className={`bg-[#12131a] border rounded-2xl p-5 md:p-6 transition-all relative overflow-hidden ${
          animation ? borderClass : (
            task.status !== 'pending' 
              ? 'opacity-55 border-[#212332] bg-[#12131a]/60 shadow-xs' : 
            isOverdue 
              ? 'border-red-950 border-l-4 border-l-red-500 bg-gradient-to-b from-red-950/10 to-[#12131a] shadow-[0_2px_12px_rgba(239,68,68,0.02)]' : 
              'border-[#212332] border-l-4 border-l-indigo-500 hover:border-[#31344a] hover:shadow-md'
          )
        }`}
      >
        {/* Priority & Top Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono font-bold bg-[#181926] text-indigo-300 border border-[#2b2d3e] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              PRIORITY #{idx + 1}
            </span>
            {task.isPinned && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-teal-300 bg-teal-950/40 border border-teal-500/20 px-2.5 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-teal-400 animate-pulse" /> Manually Pinned
              </span>
            )}
            {task.isFallback && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                <ShieldAlert className="w-3 h-3 text-amber-400" /> Offline Fallback
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-red-300 bg-red-950/50 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3 text-red-400" /> Overdue
              </span>
            )}
            {task.status === 'done' && task.completedOnTime && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-300 bg-emerald-950/50 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Completed On-Time
              </span>
            )}
            {task.status === 'done' && !task.completedOnTime && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-amber-300 bg-amber-950/50 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                Completed Late
              </span>
            )}
            {task.status === 'missed' && (
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-red-300 bg-red-950/50 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                Missed Entirely
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {task.status === 'pending' && onReorderTask && (
              <div className="flex items-center gap-1 bg-[#181926] border border-[#212332]/80 rounded-lg p-0.5 select-none">
                <button
                  id={`btn-reorder-up-${task.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorderTask(task.id, 'up');
                  }}
                  disabled={idx === 0}
                  title="Move priority up"
                  className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-[#1a1b26] disabled:opacity-15 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer transition-all active:scale-90"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  id={`btn-reorder-down-${task.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReorderTask(task.id, 'down');
                  }}
                  disabled={idx === pendingTasks.length - 1}
                  title="Move priority down"
                  className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-[#1a1b26] disabled:opacity-15 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer transition-all active:scale-90"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="text-xs font-mono text-slate-400 font-semibold whitespace-nowrap">
              Complexity: <span className="text-white font-bold bg-[#181926] px-1.5 py-0.5 rounded border border-[#2b2d3e]">{task.estimatedEffort}</span>
            </div>
          </div>
        </div>

        <h3 className={`font-display font-semibold text-base text-white text-left ${task.status !== 'pending' ? 'line-through text-slate-500' : ''}`}>
          {task.title}
        </h3>
        
        {task.notes && (
          <p className="text-sm text-slate-400 mt-1.5 leading-relaxed font-sans text-left">
            {task.notes}
          </p>
        )}

        {task.status === 'pending' && task.gmailMessageId && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-dashed border-[#2b2d3e]/50 text-left">
            <a
              href={`https://mail.google.com/mail/u/0/#inbox/${task.gmailMessageId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Email</span>
            </a>
            <span className="text-[10px] text-slate-500 font-mono">
              Opens directly in Gmail
            </span>
          </div>
        )}

        {/* AI Subtask Breakdown (Available at ALL trust levels) */}
        {task.status === 'pending' && (
          <div className="mt-3 text-left">
            {task.subtasks && task.subtasks.length > 0 && task.subtasksRevealed ? (
              <div className="border border-[#212332] bg-[#141520]/60 rounded-xl overflow-hidden">
                {/* Header Toggle */}
                <button
                  type="button"
                  onClick={() => onToggleSubtasksCollapse?.(task.id)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer bg-[#171824] border-none focus:outline-hidden"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI-Powered Action Plan ({task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} Done)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.subtasks.every(st => st.completed) && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/15 animate-pulse">
                        +1 XP Bonus Active!
                      </span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${!task.subtasksCollapsed ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Subtask Checklist Items */}
                {!task.subtasksCollapsed && (
                  <div className="p-3.5 space-y-2.5 border-t border-[#212332]/60 bg-[#0c0d15]/40">
                    {task.subtasks.map((subtask) => {
                      return (
                        <div key={subtask.id} className="flex items-start gap-2.5 group">
                          <button
                            type="button"
                            onClick={() => onToggleSubtask?.(task.id, subtask.id)}
                            className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 focus:outline-hidden ${
                              subtask.completed
                                ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-[0_0_8px_rgba(99,102,241,0.3)]'
                                : 'border-[#3a3c54] hover:border-indigo-400 text-transparent bg-transparent'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </button>
                          
                          <span
                            className={`text-xs font-medium transition-all duration-300 leading-relaxed ${
                              subtask.completed
                                ? 'text-slate-500 line-through decoration-slate-600 italic tracking-wide translate-x-0.5'
                                : 'text-slate-200 group-hover:text-white'
                            }`}
                          >
                            {subtask.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-start">
                <button
                  type="button"
                  id={`btn-break-it-down-${task.id}`}
                  disabled={breakingDownTaskIds?.has(task.id)}
                  onClick={() => onBreakdownTask?.(task.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:text-slate-650 font-mono font-bold cursor-pointer transition-colors bg-transparent border-none"
                >
                  {breakingDownTaskIds?.has(task.id) ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Breaking it down...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>✦ Break it down</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Calendar Sync Proposal Box (Level 3+) */}
        {task.status === 'pending' && trustState.level >= 3 && task.suggestedTimeSlot && (
          <div className="bg-teal-950/20 border border-teal-500/15 rounded-xl p-3.5 mt-3 text-left">
            <div className="flex items-center gap-1.5 text-teal-300 text-xs font-mono font-bold uppercase tracking-wide mb-2">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <span>Proposed Calendar Event Slot:</span>
            </div>

            {/* Editable Fields using DateTimePicker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor={`edit-schedule-start-${task.id}`} className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 pl-0.5">
                  Proposed Start
                </label>
                <DateTimePicker
                  id={`edit-schedule-start-${task.id}`}
                  value={startVal}
                  onChange={(val) => setEditedStartTimes(prev => ({ ...prev, [task.id]: val }))}
                  disabled={isScheduling}
                  level={trustState.level}
                  placeholder="Select event start"
                />
              </div>
              <div>
                <label htmlFor={`edit-schedule-end-${task.id}`} className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 pl-0.5">
                  Proposed End
                </label>
                <DateTimePicker
                  id={`edit-schedule-end-${task.id}`}
                  value={endVal}
                  onChange={(val) => setEditedEndTimes(prev => ({ ...prev, [task.id]: val }))}
                  disabled={isScheduling}
                  level={trustState.level}
                  placeholder="Select event end"
                />
              </div>
            </div>

            {/* Warning Messages */}
            {isTimeInPast && (
              <div className="flex items-start gap-1.5 p-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-[11px] text-red-300 font-medium mb-3 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <span>Selected event time is in the past. Please select a future date and time before adding to calendar.</span>
              </div>
            )}
            {!isTimeInPast && isEndBeforeStart && (
              <div className="flex items-start gap-1.5 p-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-[11px] text-red-300 font-medium mb-3 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <span>Proposed End must be strictly after the Proposed Start.</span>
              </div>
            )}

            {calendarToken ? (
              confirmingScheduleTaskId === task.id && trustState.level !== 5 ? (
                <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 mt-2">
                  <p className="text-[11px] text-amber-200 font-semibold mb-2.5 leading-snug">
                    Authorize 'Earned' to create an entry on your real Google Calendar for "{task.title}"?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      id={`btn-confirm-schedule-yes-${task.id}`}
                      onClick={() => {
                        onApproveSchedule(task, startVal, endVal);
                        setConfirmingScheduleTaskId(null);
                      }}
                      disabled={isScheduling || isInvalidTime}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isScheduling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Yes, Add It</span>
                    </button>
                    <button
                      id={`btn-confirm-schedule-cancel-${task.id}`}
                      onClick={() => setConfirmingScheduleTaskId(null)}
                      disabled={isScheduling}
                      className="inline-flex items-center px-3 py-1.5 bg-[#171822] hover:bg-[#1d1f2e] border border-[#2b2d3e] text-slate-300 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id={`btn-approve-schedule-${task.id}`}
                  onClick={() => {
                    if (trustState.level === 5) {
                      onApproveSchedule(task, startVal, endVal);
                    } else {
                      setConfirmingScheduleTaskId(task.id);
                    }
                  }}
                  disabled={isScheduling || isInvalidTime}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Approve & Add to Calendar</span>
                </button>
              )
            ) : (
              <div className="text-[11px] text-slate-400 italic">
                * Connect Google Calendar in the sidebar to schedule this event automatically.
              </div>
            )}
          </div>
        )}

        {/* Proactive Drafting Section (Level 4+) */}
        {task.status === 'pending' && trustState.level >= 4 && (
          <div className="mt-3 text-left">
            {hasDraft ? (
              <div className="bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono uppercase text-emerald-300 font-bold tracking-wide flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-400" />
                    {hasDraft.type} Ready
                  </span>
                  <span className="text-[10px] text-slate-500 italic font-semibold">
                    {parseEmailFromNotes(task.notes) ? '[Gmail Interactive Draft]' : '[Local Draft Outline]'}
                  </span>
                </div>
                
                <textarea
                  id={`textarea-draft-${task.id}`}
                  value={editedDrafts[task.id] !== undefined ? editedDrafts[task.id] : hasDraft.content}
                  onChange={(e) => setEditedDrafts(prev => ({ ...prev, [task.id]: e.target.value }))}
                  rows={5}
                  className="w-full text-xs font-sans text-slate-200 bg-[#161722] p-3 rounded-xl border border-[#2b2d3e] focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-y"
                  placeholder="Type or edit the generated reply here..."
                />

                {parseEmailFromNotes(task.notes) && (
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-400 font-mono">
                      {demoMode ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1 uppercase text-[9px]">
                          <AlertTriangle className="w-3 h-3 text-amber-500" /> Demo Mode
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 uppercase text-[9px]">
                          <Check className="w-3 h-3 text-emerald-500" /> Real Send Active
                        </span>
                      )}
                    </div>
                    
                    {confirmingSendTaskId === task.id ? (
                      <div className="flex items-center gap-1.5 bg-amber-950/40 p-2 rounded-xl border border-amber-500/20 animate-in fade-in zoom-in-95 duration-150">
                        <span className="text-[9px] font-mono font-bold text-amber-300 uppercase px-1">Confirm send?</span>
                        <button
                          id={`btn-confirm-send-yes-${task.id}`}
                          onClick={() => {
                            onSendEmailReply(task, editedDrafts[task.id] || hasDraft.content);
                            setConfirmingSendTaskId(null);
                          }}
                          disabled={isSendingEmail === task.id}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] rounded-lg transition-colors cursor-pointer"
                        >
                          {isSendingEmail === task.id ? 'Sending...' : 'Yes, Dispatch'}
                        </button>
                        <button
                          id={`btn-confirm-send-cancel-${task.id}`}
                          onClick={() => setConfirmingSendTaskId(null)}
                          className="px-2.5 py-1 bg-[#171822] hover:bg-[#1d1f2e] border border-[#2b2d3e] text-slate-300 font-semibold text-[10px] rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`btn-send-email-reply-${task.id}`}
                        onClick={() => setConfirmingSendTaskId(task.id)}
                        disabled={isSendingEmail === task.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                      >
                        {isSendingEmail === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                        <span>Send via Gmail</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                id={`btn-draft-${task.id}`}
                onClick={() => onGenerateDraft(task)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Prepare proactive draft structure...</span>
              </button>
            )}
          </div>
        )}

        {/* Inline Task Resolution Buttons */}
        {task.status === 'pending' && (() => {
          const now = new Date();
          const deadlineDate = new Date(task.deadline);
          const isDeadlineInFuture = deadlineDate > now;
          const isDeadlinePassed = deadlineDate <= now;
          
          // Grace window of 24 hours
          const graceWindowMs = 24 * 60 * 60 * 1000;
          const isWithinGraceWindow = isDeadlinePassed && (now.getTime() - deadlineDate.getTime() <= graceWindowMs);

          if (confirmingDeleteTaskId === task.id) {
            return (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 pt-3.5 border-t border-red-500/20 bg-red-950/10 p-3.5 rounded-xl animate-in fade-in duration-200 w-full">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>Delete this task? This action cannot be undone.</span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                  <button
                    id={`btn-confirm-delete-yes-${task.id}`}
                    onClick={() => {
                      setConfirmingDeleteTaskId(null);
                      handleAnimateDelete(task.id);
                    }}
                    className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Yes, delete
                  </button>
                  <button
                    id={`btn-confirm-delete-cancel-${task.id}`}
                    onClick={() => setConfirmingDeleteTaskId(null)}
                    className="inline-flex items-center px-3 py-1.5 bg-[#171822] hover:bg-[#1d1f2e] border border-[#2b2d3e] text-slate-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="flex items-center justify-between gap-4 mt-4 pt-3.5 border-t border-[#212332]">
              <div className="text-[11px] font-mono text-slate-400">
                Due: {deadlineDate.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                {isDeadlineInFuture && (
                  <button
                    id={`btn-complete-ontime-${task.id}`}
                    onClick={() => handleAnimateCompleteOnTime(task.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Complete On-Time</span>
                  </button>
                )}

                {isDeadlinePassed && (
                  <>
                    <button
                      id={`btn-complete-late-${task.id}`}
                      onClick={() => handleAnimateCompleteLate(task.id)}
                      className="px-2.5 py-1.5 text-xs text-amber-400 border border-amber-500/20 bg-amber-950/20 hover:bg-amber-950/40 rounded-xl transition-all cursor-pointer font-bold animate-in fade-in duration-200"
                    >
                      Mark Late
                    </button>
                    <button
                      id={`btn-mark-missed-${task.id}`}
                      onClick={() => handleAnimateMiss(task.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs animate-in fade-in duration-200"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Mark as Missed</span>
                    </button>
                  </>
                )}

                <button
                  id={`btn-delete-task-${task.id}`}
                  onClick={() => setConfirmingDeleteTaskId(task.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* Satisfying overlay icon entrance */}
        {animation && (animation.phase === 'icon' || animation.phase === 'exit') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-[#12131a]/90 backdrop-blur-xs z-50 pointer-events-none"
          >
            {animation.type === 'complete' && (
              <motion.div 
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 mt-2">Completed On-Time</span>
              </motion.div>
            )}
            {animation.type === 'late' && (
              <motion.div 
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 mt-2">Marked Late</span>
              </motion.div>
            )}
            {animation.type === 'missed' && (
              <motion.div 
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                  <span className="text-3xl font-bold font-mono select-none leading-none">✗</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 mt-2">Marked Missed</span>
              </motion.div>
            )}
            {animation.type === 'delete' && (
              <motion.div 
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center gap-1"
              >
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                  <Trash2 className="w-8 h-8" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400 mt-2">Deleted Task</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    );
  };

  const getThemeColorClass = (level: TrustLevel) => {
    switch (level) {
      case 1: return 'bg-slate-500 shadow-[0_0_15px_rgba(100,116,139,0.4)] text-slate-400';
      case 2: return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] text-blue-400';
      case 3: return 'bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.4)] text-teal-400';
      case 4: return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] text-emerald-400';
      case 5: return 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] text-amber-400';
    }
  };

  // Get Next Threshold Target
  const getNextThreshold = (level: TrustLevel) => {
    switch (level) {
      case 1: return { score: 5, label: "Level 2: Active Planner" };
      case 2: return { score: 10, label: "Level 3: Scheduler" };
      case 3: return { score: 20, label: "Level 4: Proactive Drafter" };
      case 4: return { score: 35, label: "Level 5: Fully Autonomous" };
      case 5: return { score: 50, label: "Max Trust Cap" };
    }
  };

  const nextTarget = getNextThreshold(trustState.level);
  const currentProgressPercent = Math.min(
    100,
    Math.max(0, (trustState.score / nextTarget.score) * 100)
  );

  return (
    <div id="dashboard-tab" className="space-y-6">
      {/* 1. Prominent Trust Score Header Card (Signature Visual Moment) */}
      <div 
        id="trust-indicator-card" 
        className={`p-6 rounded-2xl border ${getLevelBorder(trustState.level)} transition-all duration-300 relative`}
      >
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none rounded-2xl overflow-hidden" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 text-left">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase bg-[#181926]/60 px-2.5 py-0.5 rounded-full border border-slate-700/50">
                AI Companion Autonomy Core
              </span>
              <span className="text-[9px] font-mono font-bold tracking-wider text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-500/20">
                ACTIVE PRIVILEGE: {trustState.level * 20}%
              </span>
            </div>
            <h1 className="font-display font-bold text-2xl text-white tracking-tight flex items-center gap-2.5">
              <span>{getLevelBadgeLabel(trustState.level)}</span>
              {trustState.level === 5 && (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </h1>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            <div className="bg-[#12131a]/80 backdrop-blur-xs border border-slate-800 p-3 rounded-xl text-center md:text-right shadow-xs min-w-36 relative overflow-visible">
              <AnimatePresence>
                {floatingXPs.map(xp => (
                  <motion.div
                    key={xp.id}
                    initial={{ opacity: 0, y: 15, scale: 0.8 }}
                    animate={{ opacity: 1, y: -30, scale: 1 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`absolute right-4 top-0 font-mono font-extrabold text-sm pointer-events-none px-2 py-0.5 rounded-md shadow-lg ${xp.colorClass} z-50`}
                  >
                    {xp.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Reliability XP
              </span>
              <span className="text-2xl font-mono font-extrabold text-white tracking-tight">
                {trustState.score} <span className="text-xs font-medium text-slate-500">XP</span>
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative z-10 space-y-2.5 text-left">
          <div className="w-full bg-[#13141f] rounded-full h-3.5 overflow-hidden border border-slate-800 p-[2px]">
            <div 
              id="trust-progress-bar"
              className={`h-full rounded-full transition-all duration-750 ease-out relative ${getThemeColorClass(trustState.level).split(' ')[0]} ${getThemeColorClass(trustState.level).split(' ')[1]}`}
              style={{ width: `${currentProgressPercent}%` }}
            >
              {/* Sleek reflection bar inside progress bar */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-medium">
            <span className="flex items-center gap-1">
              Current: <strong className="text-slate-200 font-bold">{trustState.score} XP</strong>
            </span>
            <span className="flex items-center gap-1">
              Next Rank: <strong className="text-slate-200 font-bold">{nextTarget.score} XP</strong> ({nextTarget.label})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Morning AI Check-in Briefing */}
      <div 
        id="daily-checkin-container" 
        className="bg-[#0e1017] border border-indigo-500/15 rounded-2xl p-5 shadow-lg flex items-start gap-4"
      >
        <div className="p-2.5 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5 shadow-xs">
          <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
        </div>
        <div className="space-y-1 text-left">
          <h3 className="font-display font-semibold text-sm text-indigo-300 tracking-tight">Daily Proactive Companion Briefing</h3>
          {isCheckinLoading ? (
            <div className="flex items-center gap-2 py-1.5 text-xs font-mono text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Companion is evaluating outstanding schedules and risk profiles...</span>
            </div>
          ) : (
            <p className="text-sm text-slate-300 italic leading-relaxed font-medium">
              "{dailyCheckin || "Good morning. I am observing your pending tasks. Rebuild a steady task resolution cadence to unlock full autonomous action plans."}"
            </p>
          )}
        </div>
      </div>

      {/* Primary Google Integration Card (Shown only if not connected) */}
      {!calendarToken && (
        <div 
          id="primary-google-connect-card" 
          className="bg-gradient-to-r from-[#11131f] via-[#14162a] to-[#11131f] border border-indigo-500/20 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden animate-in fade-in duration-300"
        >
          {/* Background subtle glow */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-2.5 text-left max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-mono text-indigo-300 uppercase font-bold tracking-widest bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-500/15">
                Workspace Authorization Required
              </span>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono text-teal-300 bg-teal-950/30 px-2 py-0.5 rounded-full border border-teal-500/15">
                OAuth 2.0 Integration
              </span>
            </div>
            <h2 className="font-display font-bold text-base text-white tracking-tight">
              Synchronize Google Calendar & Gmail Integration
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Connect your account to allow your AI trust companion to propose active calendar schedule blocks, scan your Gmail inbox for outstanding commitments, and draft replies. The AI earns these privileges dynamically based on your reliability.
            </p>
            
            {/* Error or Loading Notice */}
            {isAuthAttemptPending ? (
              <div className="p-3 bg-indigo-950/25 border border-indigo-500/20 rounded-xl space-y-2 font-mono text-[10px] text-slate-305 leading-normal animate-pulse">
                <div className="flex items-center gap-2 text-indigo-300 font-bold">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                  <span>Google Connection Initialized...</span>
                </div>
                <p>We have opened Google's sign-in popup. If Google reports an <em>Access Blocked (Error 403)</em> notice, skip authentication and run the sandbox simulation:</p>
              </div>
            ) : authError ? (
              <div className="p-3 bg-rose-950/25 border border-rose-500/25 rounded-xl space-y-2.5 text-left">
                <div className="flex items-start gap-2">
                  <span className="text-rose-400 mt-0.5">⚠️</span>
                  <div className="space-y-0.5 font-mono text-[10px] text-slate-300">
                    <strong className="text-rose-300 block">Connection Blocked (Google Developer Sandbox Limit)</strong>
                    <span>Google restricts unapproved apps to test developers. If you see access_denied (Error 403), use the Sandbox Bypass to proceed with full features.</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onBypassCalendar && (
                    <button
                      onClick={onBypassCalendar}
                      className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[9px] transition-all cursor-pointer shadow-xs"
                    >
                      ⚡ Skip & Activate Sandbox Bypass
                    </button>
                  )}
                  {onClearAuthError && (
                    <button
                      onClick={onClearAuthError}
                      className="py-1 px-2.5 bg-slate-900 hover:bg-[#1a1b2c] text-slate-450 hover:text-slate-200 font-bold rounded-lg text-[9px] border border-slate-800 transition-colors"
                    >
                      Dismiss Error
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-amber-300/80 leading-normal font-mono">
                ⚠️ <strong>OAuth Tester Note:</strong> If your Google Account is not whitelisted, sign-in will report a 403 error. Clicking <strong>Sandbox Bypass Demo</strong> immediately triggers full workspace simulations!
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0 md:min-w-[220px]">
            <button
              id="primary-google-connect-btn"
              onClick={onConnectCalendar}
              className="flex items-center justify-center gap-2 px-4.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 active:scale-[0.98]"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Connect Google Account</span>
            </button>
            
            {onBypassCalendar && (
              <button
                id="primary-google-bypass-btn"
                onClick={onBypassCalendar}
                className="flex items-center justify-center gap-1.5 px-4.5 py-3 bg-slate-900 hover:bg-[#1a1b28] text-slate-300 hover:text-white font-bold rounded-xl text-xs border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
              >
                <span>Sandbox Bypass Demo</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Grid: Prioritized Tasks (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* FEATURE 1: Incoming Actionable Emails from Gmail */}
          <div id="gmail-scanning-section" className="bg-[#12131a] border border-[#212332] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between border-b border-[#212332] pb-2.5">
              <div className="flex items-center gap-2">
                <Mail className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
                <h2 className="font-display font-semibold text-base text-white">
                  Actionable Emails Detected
                </h2>
              </div>
              {calendarToken && (
                <button
                  id="btn-scan-gmail"
                  onClick={onScanEmails}
                  disabled={isScanningEmails}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningEmails ? 'animate-spin' : ''}`} />
                  <span>{isScanningEmails ? 'Scanning inbox...' : 'Scan Inbox'}</span>
                </button>
              )}
            </div>

            {!calendarToken ? (
              <div className="text-center py-8 px-4 space-y-2 bg-[#141523]/20 border border-dashed border-[#212332]/60 rounded-xl">
                <Lock className="w-4 h-4 text-slate-500 mx-auto" />
                <span className="text-xs text-slate-400 font-medium block">
                  Gmail Scanning Locked — Please connect your Google Account using the workspace sync card at the top.
                </span>
              </div>
            ) : emailScanError ? (
              <div className="p-3 bg-red-950/20 border border-red-500/20 text-xs text-red-400 rounded-xl flex items-start gap-2 animate-in fade-in duration-150 text-left">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div>
                  <span className="font-semibold block">Gmail Connection Issue</span>
                  <p className="mt-0.5">{emailScanError}</p>
                </div>
              </div>
            ) : isScanningEmails ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs font-mono text-slate-400 gap-2 animate-in fade-in duration-150">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span>Analyzing recent primary emails with Gemini AI...</span>
              </div>
            ) : detectedEmails.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-400 italic border border-dashed border-[#2b2e46] rounded-xl bg-[#181926]/30">
                "I have scanned your recent inbox logs and found no urgent action items or commitments. Your companion is keeping watch."
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                {detectedEmails.slice(0, 4).map((email) => (
                  <div
                    key={email.id}
                    id={`email-card-${email.id}`}
                    className="border border-[#232537] bg-gradient-to-b from-[#181a26]/40 to-[#12131a] hover:border-[#323652] rounded-2xl p-4.5 flex flex-col justify-between gap-3.5 transition-all duration-200 shadow-xs"
                  >
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-slate-400 truncate max-w-[140px] bg-[#161722] px-2 py-0.5 rounded border border-[#232537]" title={email.from}>
                          From: {email.from}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-semibold">
                          {new Date(email.date).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-sm text-white leading-snug tracking-tight">
                        {email.subject}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed italic">
                        "{email.bodySnippet}"
                      </p>
                      
                      <div className="bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/10 mt-1 text-left space-y-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[8px] font-mono text-indigo-300 font-bold uppercase tracking-widest block">
                            ✦ AI EXTRACTION INSIGHT
                          </span>
                          {email.isFallback && (
                            <span className="text-[8px] font-mono text-amber-400 font-bold tracking-wider uppercase bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/15">
                              Fallback
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white font-bold leading-normal mt-0.5">
                          "{email.extractedTitle}"
                        </p>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                          {email.reason}
                        </p>
                        <p className="text-[9px] font-mono text-indigo-300 font-bold mt-1 inline-block bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20">
                          Expected Deadline: {email.extractedDeadline}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#212332] flex items-center justify-between gap-2">
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Original Email</span>
                      </a>
                      <button
                        id={`btn-add-email-task-${email.id}`}
                        onClick={() => onAddEmailTask(email)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add as Task</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-b border-[#212332] pb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-lg text-white tracking-tight">
                AI-Prioritized Active Agenda
              </h2>
              {pendingTasks.some(t => t.isPinned) && (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/15 px-2 py-0.5 rounded-md uppercase font-semibold">
                  Manual Overrides Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingTasks.some(t => t.isPinned) && onResetPriority && (
                <button
                  id="btn-reset-ai-priority"
                  onClick={onResetPriority}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300 bg-[#181926] hover:bg-[#202235] border border-[#2b2d3e] hover:border-indigo-500/30 rounded-lg transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 text-indigo-400" />
                  <span>Reset to AI Priority</span>
                </button>
              )}
              <span className="text-xs font-mono text-indigo-300 font-bold bg-indigo-950/50 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                {pendingTasks.length} Action Items
              </span>
            </div>
          </div>

          <div id="pending-tasks-container" className="relative space-y-4">
            {pendingTasks.length === 0 ? (
              <div className="text-center py-12 border border-[#212332] rounded-2xl bg-[#12131a] shadow-xs px-6">
                <CheckCircle className="w-10 h-10 text-slate-500 mx-auto mb-3 animate-pulse" />
                <p className="text-sm font-medium text-slate-300 text-center">
                  "Your active agenda is pristinely resolved. I see no pending friction. Create an action item to continue building our trust progression."
                </p>
              </div>
            ) : (
              pendingTasks.map((task, idx) => (
                <div key={task.id}>
                  {renderTaskCard(task, idx)}
                </div>
              ))
            )}
          </div>

          {/* Task History Accordion Section */}
          {historyTasks.length > 0 && (
            <div className="border border-[#212332] rounded-2xl bg-[#12131a]/40 overflow-hidden mt-6 transition-all duration-205">
              <button
                id="btn-toggle-task-history"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="w-full px-5 py-4 flex items-center justify-between bg-[#12131a]/80 hover:bg-[#12131a] transition-colors duration-150 cursor-pointer text-left focus:outline-none"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4.5 h-4.5 text-slate-400" />
                  <span className="font-display font-semibold text-sm text-slate-200">
                    Task History
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-[#1b1c27] border border-[#2b2d3e] px-2 py-0.5 rounded-full">
                    {historyTasks.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isHistoryExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isHistoryExpanded && (
                <div className="p-5 border-t border-[#212332]/60 bg-[#0c0d14]/40 space-y-4 animate-in fade-in duration-150">
                  {historyTasks.map((task, idx) => renderTaskCard(task, idx))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Grid: Calendar / Sync Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#12131a] border border-[#212332] rounded-2xl p-5.5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
            <div className="flex items-center justify-between border-b border-[#212332] pb-3">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-display font-semibold text-sm text-white tracking-tight">
                  Google Workspace Sync
                </h3>
              </div>
              <div className="flex items-center gap-2.5">
                {calendarToken && (
                  <button
                    id="btn-refresh-calendar"
                    onClick={handleRefreshCalendar}
                    disabled={isCalendarLoading}
                    className="p-1 text-slate-400 hover:text-indigo-400 disabled:text-slate-650 rounded-lg transition-colors cursor-pointer"
                    title="Refresh Google Calendar events"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalendarLoading ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>
                )}
                <span className="relative flex h-2.5 w-2.5">
                  {calendarToken && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${calendarToken ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                </span>
              </div>
            </div>

            {/* Connection View / Prompt */}
            {!calendarToken ? (
              <div className="text-center py-5 px-3 space-y-2 bg-[#141523]/20 border border-dashed border-[#212332]/60 rounded-xl">
                <Lock className="w-4 h-4 text-slate-500 mx-auto" />
                <span className="text-xs text-slate-400 font-medium block">
                  Workspace Disconnected — Connect at the top of the dashboard.
                </span>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="text-[9px] font-mono text-emerald-300 font-bold bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center justify-between shadow-3xs">
                  <span>● SECURELY SYNCED</span>
                  <span>7-Day Active Horizon</span>
                </div>

                {isCalendarLoading ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400 mx-auto mb-2" />
                    <span className="text-xs text-slate-400 font-mono">Syncing agenda logs...</span>
                  </div>
                ) : calendarError ? (
                  <div className="p-2.5 bg-amber-950/30 border border-amber-500/20 rounded-lg text-xs text-amber-300 leading-normal font-mono text-left">
                    {calendarError}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {events.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4 px-2 leading-relaxed">
                        "Your synced calendar horizon is clear of structured events. Our next scheduled action blocks will appear here once approved."
                      </p>
                    ) : (
                      events.map((evt) => (
                        <div key={evt.id} className="bg-[#171822] border border-[#212332]/80 rounded-xl p-3 hover:bg-[#1d1f2e]/80 transition-colors text-left flex items-start gap-2.5">
                          <div className="p-1.5 rounded-lg bg-teal-950/40 border border-teal-500/20 text-teal-400 mt-0.5 shadow-3xs">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1 overflow-hidden flex-1">
                            <h4 className="text-xs font-bold text-white truncate" title={evt.summary}>
                              {evt.summary}
                            </h4>
                            <div className="text-[10px] font-mono text-slate-400">
                              {renderEventTime(evt)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Capability Tier Constraints Warnings */}
          <div className="bg-[#12131a] border border-[#212332] rounded-2xl p-5.5 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-4">
            <h3 className="font-display font-semibold text-sm text-white tracking-tight text-left">AI Capability Authorization</h3>
            <div className="space-y-3">
              {/* Level 1: Observer Mode */}
              <div className={`flex items-start gap-3.5 p-2 rounded-xl transition-all duration-300 ${
                trustState.level === 1 
                  ? 'bg-indigo-950/20 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                  : 'border border-transparent'
              } text-left`}>
                <div className={`p-1.5 rounded-lg border shadow-3xs ${
                  trustState.level >= 1 
                    ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-55'
                }`}>
                  <Eye className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold block ${trustState.level >= 1 ? 'text-slate-200' : 'text-slate-500'}`}>Observer Mode</span>
                    {trustState.level === 1 && (
                      <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                    {trustState.level > 1 && (
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-950/40 border border-teal-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${trustState.level >= 1 ? 'text-slate-400' : 'text-slate-500'}`}>
                    Passively trace overdue actions & logs.
                  </p>
                </div>
              </div>

              {/* Level 2: Planning Assistance */}
              <div className={`flex items-start gap-3.5 p-2 rounded-xl transition-all duration-300 ${
                trustState.level === 2 
                  ? 'bg-indigo-950/20 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                  : 'border border-transparent'
              } text-left`}>
                <div className={`p-1.5 rounded-lg border shadow-3xs ${
                  trustState.level >= 2 
                    ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-55'
                }`}>
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold block ${trustState.level >= 2 ? 'text-slate-200' : 'text-slate-500'}`}>Planning Assistance</span>
                    {trustState.level === 2 && (
                      <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                    {trustState.level > 2 && (
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-950/40 border border-teal-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${trustState.level >= 2 ? 'text-slate-400' : 'text-slate-500'}`}>
                    {trustState.level >= 2 ? 'Breakdown tasks instantly to bypass inertia.' : 'Locked until Level 2 (Planner).'}
                  </p>
                </div>
              </div>

              {/* Level 3: Google Calendar Sync */}
              <div className={`flex items-start gap-3.5 p-2 rounded-xl transition-all duration-300 ${
                trustState.level === 3 
                  ? 'bg-indigo-950/20 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                  : 'border border-transparent'
              } text-left`}>
                <div className={`p-1.5 rounded-lg border shadow-3xs ${
                  trustState.level >= 3 
                    ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-55'
                }`}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold block ${trustState.level >= 3 ? 'text-slate-200' : 'text-slate-500'}`}>Google Calendar Sync</span>
                    {trustState.level === 3 && (
                      <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                    {trustState.level > 3 && (
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-950/40 border border-teal-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${trustState.level >= 3 ? 'text-slate-400' : 'text-slate-500'}`}>
                    {trustState.level >= 3 ? 'Directly propose and block out goal windows.' : 'Locked until Level 3 (Scheduler).'}
                  </p>
                </div>
              </div>

              {/* Level 4: Communication Drafting */}
              <div className={`flex items-start gap-3.5 p-2 rounded-xl transition-all duration-300 ${
                trustState.level === 4 
                  ? 'bg-indigo-950/20 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                  : 'border border-transparent'
              } text-left`}>
                <div className={`p-1.5 rounded-lg border shadow-3xs ${
                  trustState.level >= 4 
                    ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-55'
                }`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold block ${trustState.level >= 4 ? 'text-slate-200' : 'text-slate-500'}`}>Communication Drafting</span>
                    {trustState.level === 4 && (
                      <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                    {trustState.level > 4 && (
                      <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-950/40 border border-teal-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${trustState.level >= 4 ? 'text-slate-400' : 'text-slate-500'}`}>
                    {trustState.level >= 4 ? 'Automatically formulate replies & checklist items.' : 'Locked until Level 4 (Drafter).'}
                  </p>
                </div>
              </div>

              {/* Level 5: Autonomous Operations */}
              <div className={`flex items-start gap-3.5 p-2 rounded-xl transition-all duration-300 ${
                trustState.level === 5 
                  ? 'bg-indigo-950/20 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.05)]' 
                  : 'border border-transparent'
              } text-left`}>
                <div className={`p-1.5 rounded-lg border shadow-3xs ${
                  trustState.level >= 5 
                    ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400' 
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 opacity-55'
                }`}>
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold block ${trustState.level >= 5 ? 'text-slate-200' : 'text-slate-500'}`}>Autonomous Operations</span>
                    {trustState.level === 5 && (
                      <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${trustState.level >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>
                    {trustState.level >= 5 ? 'Observe, formulate, schedule, and sync hands-off.' : 'Locked until Level 5 (Autonomous).'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
