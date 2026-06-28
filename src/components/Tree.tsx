/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { TrustLevel } from '../types';

interface TreeProps {
  currentLevel: TrustLevel;
}

interface CapabilityLevel {
  level: TrustLevel;
  name: string;
  badge: React.ReactNode;
  iconColor: string;
  borderColor: string;
  bgGlow: string;
  unlockedBg: string;
  textMuted: string;
  capability: string;
  description: string;
}

export default function Tree({ currentLevel }: TreeProps) {
  const levels: CapabilityLevel[] = [
    {
      level: 1,
      name: "Observer",
      badge: (
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#4b5563" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="50" cy="50" r="24" stroke="#9ca3af" strokeWidth="3" />
          <circle cx="50" cy="50" r="8" fill="#d1d5db" />
          <path d="M30 50H20M80 50H70M50 30V20M50 80V70" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      iconColor: "text-slate-400",
      borderColor: "border-[#212332]",
      bgGlow: "shadow-gray-500/5",
      unlockedBg: "bg-slate-900/50",
      textMuted: "text-slate-400",
      capability: "Monitoring & Basic Notifications",
      description: "Passive, clipped alerts. The AI can only monitor deadlines and output sparse reports. No action-taking or active advice."
    },
    {
      level: 2,
      name: "Planner",
      badge: (
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#1d4ed8" strokeWidth="2" strokeDasharray="6 3" />
          <rect x="35" y="32" width="30" height="36" rx="4" stroke="#3b82f6" strokeWidth="3" />
          <path d="M42 42H58M42 50H58M42 58H50" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ),
      iconColor: "text-blue-400",
      borderColor: "border-[#212332]",
      bgGlow: "shadow-blue-500/10",
      unlockedBg: "bg-blue-950/20",
      textMuted: "text-blue-300",
      capability: "Priority Assessment & Breakdown",
      description: "Smart ordering. The AI analyzes tasks, sorts them based on complexity, and generates doable, bite-sized starting points."
    },
    {
      level: 3,
      name: "Scheduler",
      badge: (
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#0f766e" strokeWidth="2" />
          <circle cx="50" cy="50" r="28" stroke="#14b8a6" strokeWidth="3" />
          <path d="M50 28V50H68" stroke="#2dd4bf" strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="#ffffff" />
        </svg>
      ),
      iconColor: "text-teal-400",
      borderColor: "border-[#212332]",
      bgGlow: "shadow-teal-500/10",
      unlockedBg: "bg-teal-950/20",
      textMuted: "text-teal-300",
      capability: "Google Calendar Coordination",
      description: "Direct Calendar sync (OAuth). The AI matches events, proposes optimal time slots, and creates actual entries on approval."
    },
    {
      level: 4,
      name: "Drafter",
      badge: (
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#15803d" strokeWidth="2" strokeDasharray="8 2" />
          <path d="M36 32H56L68 44V68C68 70.2 66.2 72 64 72H36C33.8 72 32 70.2 32 68V36C32 33.8 33.8 32 36 32Z" stroke="#22c55e" strokeWidth="3" />
          <path d="M52 32V44H64" stroke="#4ade80" strokeWidth="2.5" />
          <path d="M40 52H60M40 60H52" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      iconColor: "text-emerald-400",
      borderColor: "border-[#212332]",
      bgGlow: "shadow-emerald-500/10",
      unlockedBg: "bg-emerald-950/20",
      textMuted: "text-emerald-300",
      capability: "Unprompted Draft Preparation",
      description: "Speeding up action. The AI drafts communications (emails, proposals) and checklists automatically, ready for one-click approval."
    },
    {
      level: 5,
      name: "Autonomous",
      badge: (
        <svg className="w-16 h-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="40" stroke="#b45309" strokeWidth="2.5" />
          <polygon points="50,22 58,40 78,40 62,52 68,72 50,60 32,72 38,52 22,40 42,40" fill="#f59e0b" stroke="#fbbf24" strokeWidth="1" />
          <circle cx="50" cy="48" r="10" stroke="#ffffff" strokeWidth="2" />
          <path d="M50 43V48H55" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      iconColor: "text-amber-400",
      borderColor: "border-[#212332]",
      bgGlow: "shadow-amber-500/15",
      unlockedBg: "bg-amber-950/20",
      textMuted: "text-amber-300",
      capability: "Multi-Step Autonomous Chains",
      description: "Hands-off operation. AI runs complete cycles: queries schedules, re-prioritizes, creates real events, creates drafts, and logs actions independently."
    }
  ];

  return (
    <div id="tree-section" className="space-y-6">
      <div className="bg-gradient-to-b from-[#161722]/60 to-[#12131a]/60 border border-[#212332] rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ShieldCheck className="w-24 h-24 text-indigo-500" />
        </div>
        <div className="relative z-10 space-y-2 text-left">
          <span className="text-[10px] font-mono font-bold tracking-widest text-indigo-300 bg-indigo-950/55 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase">
            Protocol Autonomy Tree
          </span>
          <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">AI Capability Tree</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed font-medium">
            The stakes belong to the AI. Maintain your commitments to let the companion earn the right to take increasingly active, helpful, and autonomous actions. Falter on deadlines, and core privileges will regress.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 relative">
        {/* Connection line between levels */}
        <div className="absolute left-[44px] top-8 bottom-8 w-1 bg-[#212332] -z-10 hidden md:block" />

        {levels.map((lvl) => {
          const isCurrent = currentLevel === lvl.level;
          const isUnlocked = currentLevel >= lvl.level;

          return (
            <div
              key={lvl.level}
              id={`capability-level-${lvl.level}`}
              className={`flex flex-col md:flex-row items-start md:items-center gap-6 p-5 md:p-6 border rounded-2xl transition-all duration-300 relative ${
                isCurrent
                  ? `border-indigo-500 bg-[#161722] shadow-[0_8px_30px_rgba(99,102,241,0.06)] ring-1 ring-indigo-500/20`
                  : isUnlocked
                  ? `border-[#212332] bg-[#12131a] hover:bg-[#151722] hover:shadow-xs`
                  : `border-[#212332]/50 bg-[#12131a]/40 opacity-45`
              }`}
            >
              {/* Badge Visual */}
              <div className="flex-shrink-0 relative mx-auto md:mx-0">
                <div className={`p-2 rounded-2xl border transition-all ${isCurrent ? 'border-indigo-500 bg-[#161722] shadow-xs' : 'border-[#212332] bg-[#0c0d12]'}`}>
                  {lvl.badge}
                </div>
                {/* Level Tag Overlay */}
                <span className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 text-[9px] font-mono font-bold rounded-full border ${
                  isCurrent
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-[#181926] text-slate-400 border-[#2b2d3e]'
                }`}>
                  LVL {lvl.level}
                </span>
              </div>

              {/* Information */}
              <div className="flex-grow space-y-2 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                  <span className={`font-display font-extrabold text-lg tracking-tight ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                    {lvl.name}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 mx-auto md:mx-0 bg-indigo-950/60 text-indigo-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-indigo-500/20">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      Active Core Authorization
                    </span>
                  )}
                  {!isCurrent && isUnlocked && (
                    <span className="inline-flex items-center gap-1 mx-auto md:mx-0 text-emerald-300 text-[10px] font-bold bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Earned
                    </span>
                  )}
                  {!isUnlocked && (
                    <span className="inline-flex items-center gap-1 mx-auto md:mx-0 text-slate-500 text-xs font-medium font-mono uppercase tracking-wider">
                      <Lock className="w-3.5 h-3.5" />
                      Restricted
                    </span>
                  )}
                </div>

                <div className={`text-[11px] font-mono font-extrabold tracking-wider uppercase ${lvl.iconColor}`}>
                  {lvl.capability}
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {lvl.description}
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex-shrink-0 self-center md:self-auto w-full md:w-auto text-center md:text-right">
                <div className={`inline-block text-xs px-3.5 py-1.5 rounded-xl border font-mono font-bold transition-colors ${
                  isCurrent
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : isUnlocked
                    ? 'bg-[#181926] text-slate-300 border-[#2b2d3e] hover:bg-[#212334]'
                    : 'bg-[#12131a]/10 text-slate-600 border-[#212332]'
                }`}>
                  {isCurrent ? "Active" : isUnlocked ? "Unlocked" : "Locked"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

