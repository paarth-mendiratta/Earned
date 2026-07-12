/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  Trash2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Info
} from 'lucide-react';

interface DemoControlsProps {
  onSimulateCompleteOnTime: () => void;
  onSimulateCompleteLate: () => void;
  onSimulateMissDeadline: () => void;
  onRunAgentLoop: () => void;
  onRunTrustReview: () => void;
  isAgentRunning: boolean;
  isReviewRunning: boolean;
  score: number;
  level: number;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  onResetDemo: () => void;
}

export default function DemoControls({
  onSimulateCompleteOnTime,
  onSimulateCompleteLate,
  onSimulateMissDeadline,
  onRunAgentLoop,
  onRunTrustReview,
  isAgentRunning,
  isReviewRunning,
  score,
  level,
  demoMode,
  onToggleDemoMode,
  onResetDemo
}: DemoControlsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  return (
    <div id="demo-controls-panel" className="bg-[#12131a] border border-[#212332] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)] mb-6">
      {/* Header Toggle */}
      <button
        id="btn-toggle-demo-controls"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5.5 py-4.5 bg-gradient-to-b from-[#181a26] to-[#12131a] hover:bg-[#181a26]/80 text-left transition-all cursor-pointer border-b border-[#212332]"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
          <span className="font-display font-bold text-xs text-slate-200 uppercase tracking-widest">
            HACKATHON LIVE PLAYGROUND CONTROLS
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-500/20 shadow-3xs">
            XP: {score} | LEVEL: {level}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Controls Container */}
      {isOpen && (
        <div className="p-5.5 space-y-5 bg-[#12131a]/95">
          {/* Quick Context Tip */}
          <div className="flex items-start gap-3 bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/10 text-xs text-slate-400">
            <Info className="w-4.5 h-4.5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-medium">
              <strong className="text-white font-bold">How to Demo:</strong> Complete tasks on-time to gain trust (+1). Miss deadlines or finish late to lose trust (-4 to -5). Watch the AI immediately react, explaining which capabilities it is unlocking or pulling back.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Task Simulations */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-widest block pl-0.5">
                Task Outcomes (Simulations)
              </span>
              <div className="flex flex-col gap-2">
                <button
                  id="btn-demo-complete-ontime"
                  onClick={onSimulateCompleteOnTime}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 text-left bg-emerald-950/15 hover:bg-emerald-950/30 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                >
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Complete Task On-Time
                  </span>
                  <span className="font-mono text-[9px] text-emerald-300 font-bold bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20">+1 Score</span>
                </button>

                <button
                  id="btn-demo-complete-late"
                  onClick={onSimulateCompleteLate}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 text-left bg-amber-950/15 hover:bg-amber-950/30 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Complete Late
                  </span>
                  <span className="font-mono text-[9px] text-amber-300 font-bold bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/20">-4 Score</span>
                </button>

                <button
                  id="btn-demo-miss-deadline"
                  onClick={onSimulateMissDeadline}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 text-left bg-red-950/15 hover:bg-red-950/30 text-red-300 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Missed Entirely
                  </span>
                  <span className="font-mono text-[9px] text-red-300 font-bold bg-red-900/30 px-2 py-0.5 rounded border border-red-500/20">-5 Score</span>
                </button>
              </div>
            </div>

            {/* Right: Agentic Decisions */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-widest block pl-0.5">
                Agentic Behaviors
              </span>
              <div className="flex flex-col gap-2">
                <button
                  id="btn-demo-run-agent"
                  onClick={onRunAgentLoop}
                  disabled={isAgentRunning}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 text-left bg-[#171926] hover:bg-[#202336] disabled:bg-[#151622] disabled:text-slate-600 text-slate-200 border border-[#26283d] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                >
                  <span className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-indigo-400" />
                    Run Agent Check Loop
                  </span>
                  <span className="font-mono text-[9px] text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20 font-bold">
                    {isAgentRunning ? 'Cycling...' : 'Observe -> Act'}
                  </span>
                </button>

                <button
                  id="btn-demo-run-review"
                  onClick={onRunTrustReview}
                  disabled={isReviewRunning}
                  className="w-[#100%] flex items-center justify-between py-2.5 px-3.5 text-left bg-[#171926] hover:bg-[#202336] disabled:bg-[#151622] disabled:text-slate-600 text-slate-200 border border-[#26283d] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                    Run Weekly Trust Review
                  </span>
                  <span className="font-mono text-[9px] text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                    {isReviewRunning ? 'Auditing...' : 'Self Audit'}
                  </span>
                </button>

                {/* Demo Mode Toggle */}
                <div className="flex items-center justify-between p-2.5 bg-amber-950/10 border border-amber-500/10 rounded-xl text-xs mt-1 shadow-3xs">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="font-extrabold text-amber-400 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Demo Mode
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-normal">
                      Simulate send actions instead of calling real APIs.
                    </span>
                  </div>
                  <button
                    id="btn-toggle-demo-mode"
                    onClick={onToggleDemoMode}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${demoMode ? 'bg-amber-600' : 'bg-slate-700'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${demoMode ? 'translate-x-4' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Demo Section */}
          <div className="pt-4 border-t border-[#212332]/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left flex-1">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-widest block pl-0.5">
                System Maintenance
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                Wipe current simulation history and restore pre-seeded baseline tasks.
              </p>
            </div>
            
            {isConfirmingReset ? (
              <div className="flex items-center gap-2 bg-amber-950/40 p-2 rounded-xl border border-amber-500/20 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-mono font-bold text-amber-300 uppercase px-1">
                  Are you sure? Clears demo progress.
                </span>
                <button
                  id="btn-confirm-reset-yes"
                  onClick={() => {
                    onResetDemo();
                    setIsConfirmingReset(false);
                    setResetSuccess(true);
                    setTimeout(() => setResetSuccess(false), 3000);
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer shadow-3xs"
                >
                  Yes, Reset
                </button>
                <button
                  id="btn-confirm-reset-cancel"
                  onClick={() => setIsConfirmingReset(false)}
                  className="px-3 py-1 bg-[#171926] hover:bg-[#202336] border border-[#26283d] text-slate-300 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {resetSuccess && (
                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 animate-in fade-in zoom-in-95 duration-150">
                    ✓ Demo state reset
                  </span>
                )}
                <button
                  id="btn-demo-reset"
                  onClick={() => setIsConfirmingReset(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#12131a] hover:bg-red-950/15 border border-[#26283d] hover:border-red-500/30 text-slate-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Demo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
