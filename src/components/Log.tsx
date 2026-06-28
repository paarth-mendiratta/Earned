/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActivityLogEntry } from '../types';
import { 
  Bell, 
  FileText, 
  Calendar, 
  ShieldAlert, 
  Cpu, 
  UserCheck, 
  Sparkles
} from 'lucide-react';

interface LogProps {
  entries: ActivityLogEntry[];
}

export default function Log({ entries }: LogProps) {
  const getIcon = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'nudge':
        return <Bell className="w-4 h-4 text-amber-400" />;
      case 'draft':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'schedule':
        return <Calendar className="w-4 h-4 text-teal-400" />;
      case 'trust_change':
        return <ShieldAlert className="w-4 h-4 text-indigo-400" />;
      case 'autonomous_action':
        return <Cpu className="w-4 h-4 text-amber-400" />;
      case 'agent_decision':
        return <Cpu className="w-4 h-4 text-blue-400" />;
      case 'trust_review':
        return <UserCheck className="w-4 h-4 text-purple-400" />;
      case 'fallback':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeStyle = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'nudge':
        return 'bg-amber-950/40 text-amber-300 border-amber-500/20';
      case 'draft':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20';
      case 'schedule':
        return 'bg-teal-950/40 text-teal-300 border-teal-500/20';
      case 'trust_change':
        return 'bg-indigo-950/40 text-indigo-300 border-indigo-500/20';
      case 'autonomous_action':
        return 'bg-amber-950/40 text-amber-300 border-amber-500/20';
      case 'agent_decision':
        return 'bg-blue-950/40 text-blue-300 border-blue-500/20';
      case 'trust_review':
        return 'bg-[#2a1b4e]/40 text-purple-300 border-purple-500/20';
      case 'fallback':
        return 'bg-amber-950/40 text-amber-300 border-amber-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border-[#212332]';
    }
  };

  const getTypeLabel = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'nudge': return 'AI Nudge';
      case 'draft': return 'Draft Prepared';
      case 'schedule': return 'Schedule Proposal';
      case 'trust_change': return 'Trust Core Update';
      case 'autonomous_action': return 'Autonomous Action';
      case 'agent_decision': return 'Agent Reasoning Loop';
      case 'trust_review': return 'Self Trust Audit';
      case 'fallback': return 'Offline Fallback';
      default: return 'AI Event';
    }
  };

  return (
    <div id="log-section" className="space-y-6">
      <div className="bg-gradient-to-b from-[#161722]/60 to-[#12131a]/60 border border-[#212332] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left">
          <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-300 bg-indigo-950/55 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase">
            Internal Operations Trace
          </span>
          <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">AI Activity & Reasoning Log</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
            A comprehensive, inspectable record of the companion's autonomous decisions, observations, drafts, scheduling blocks, and self-triggered checks.
          </p>
        </div>
        <div className="flex-shrink-0 bg-[#181926] border border-[#2b2d3e] text-[9px] font-mono text-slate-300 rounded-xl px-3.5 py-2 uppercase tracking-widest font-extrabold shadow-3xs">
          {entries.length} Total Logs
        </div>
      </div>

      <div className="space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-14 border border-[#212332] rounded-2xl bg-[#12131a] shadow-3xs px-6">
            <Cpu className="w-10 h-10 text-slate-500 mx-auto mb-3 animate-pulse" />
            <p className="text-sm font-medium text-slate-400 font-mono">
              "No operational traces detected in our historic cache. Act on commitments above to generate telemetry."
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            // Pick a matching border color for the card left edge
            const getLeftBorderColor = (type: ActivityLogEntry['type']) => {
              switch (type) {
                case 'nudge': return 'border-l-amber-500';
                case 'draft': return 'border-l-emerald-500';
                case 'schedule': return 'border-l-teal-500';
                case 'trust_change': return 'border-l-indigo-500';
                case 'autonomous_action': return 'border-l-amber-500';
                case 'agent_decision': return 'border-l-blue-500';
                case 'trust_review': return 'border-l-purple-500';
                case 'fallback': return 'border-l-amber-500';
                default: return 'border-l-slate-600';
              }
            };

            return (
              <div
                key={entry.id}
                id={`log-entry-${entry.id}`}
                className={`bg-[#12131a] border border-[#212332] border-l-4 ${getLeftBorderColor(entry.type)} rounded-2xl p-5 md:p-6 hover:border-[#31344a] transition-all duration-300`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#212332] pb-3.5 mb-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg border ${getTypeStyle(entry.type)}`}>
                      {getIcon(entry.type)}
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-extrabold block mr-2 sm:inline">
                        [{getTypeLabel(entry.type)}]
                      </span>
                      <span className="font-bold text-sm text-white tracking-tight">
                        {entry.title}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 font-semibold bg-[#181926] border border-[#2b2d3e] px-2 py-0.5 rounded-sm">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>

                {/* Content Body */}
                <div className="space-y-3 text-left">
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    {entry.content}
                  </p>

                  {/* Optional Collapsible Details */}
                  {entry.details && (
                    <div className="bg-[#171822] border border-[#212332] rounded-xl p-3.5 mt-2.5">
                      <span className="text-[9px] font-mono uppercase text-indigo-300 font-bold tracking-widest block mb-1.5">
                        ✦ Reasoning Trace & Metadata
                      </span>
                      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                        {entry.details}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

