/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Sparkles, Loader2, Calendar } from 'lucide-react';
import { Task } from '../types';
import DateTimePicker from './DateTimePicker';

interface AddTaskProps {
  onAddTask: (task: Omit<Task, 'id' | 'status' | 'completedOnTime' | 'firstStep' | 'estimatedEffort' | 'subtasks'> & { 
    firstStep: string; 
    estimatedEffort: string; 
    isFallback?: boolean;
    subtasks?: string[];
  }) => void;
  level?: number;
}

export default function AddTask({ onAddTask, level = 3 }: AddTaskProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadline) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/first-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI first-step breakdown.');
      }

      const data = await response.json();
      onAddTask({
        title: title.trim(),
        notes: notes.trim(),
        deadline: new Date(deadline).toISOString(),
        firstStep: data.firstStep || 'Break the task down into minor actions.',
        estimatedEffort: data.estimatedEffort || '30 mins',
        isFallback: !!data.isFallback,
        subtasks: data.subtasks,
      });

      // Reset form
      setTitle('');
      setNotes('');
      setDeadline('');
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      setError('AI broke down. Using fallback estimation.');
      // Fallback
      onAddTask({
        title: title.trim(),
        notes: notes.trim(),
        deadline: new Date(deadline).toISOString(),
        firstStep: 'Start by organizing your workplace and reading requirements.',
        estimatedEffort: '30 mins',
        isFallback: true,
        subtasks: [
          'Start by organizing your workplace and reading requirements.',
          'Formulate an execution plan',
          'Execute core work steps',
          'Review outcomes and proofread'
        ]
      });
      setTitle('');
      setNotes('');
      setDeadline('');
      setIsOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div id="add-task-module" className="mb-6">
      {!isOpen ? (
        <button
          id="btn-open-add-task"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-[#12131a] hover:bg-[#181a26] text-slate-200 font-bold rounded-2xl border border-[#212332] shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.06)] transition-all duration-250 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:ring-offset-2 focus:ring-offset-[#07080d]"
        >
          <Plus className="w-4.5 h-4.5 text-indigo-400" />
          <span>Add New Action Item</span>
        </button>
      ) : (
        <form
          id="add-task-form"
          onSubmit={handleSubmit}
          className="bg-[#12131a] border border-[#212332] rounded-2xl p-5.5 md:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#212332] pb-3">
            <h3 className="font-display font-bold text-white text-base flex items-center gap-2.5">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400 animate-pulse" />
              <span>Create Task with Autonomy Core</span>
            </h3>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-300 bg-indigo-950/50 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              AI Analysis Ready
            </span>
          </div>

          <div className="space-y-4">
            <div className="text-left">
              <label htmlFor="task-title" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 pl-0.5">
                Task Title / Command *
              </label>
              <input
                id="task-title"
                type="text"
                required
                placeholder="e.g. Draft feedback response for design team proposal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3.5 py-2.5 bg-[#171926] border border-[#26283d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-left">
                <label htmlFor="task-deadline" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 pl-0.5">
                  Target Deadline *
                </label>
                <DateTimePicker
                  id="task-deadline"
                  required
                  value={deadline}
                  onChange={setDeadline}
                  disabled={isGenerating}
                  level={level}
                  placeholder="Select deadline date & time"
                />
              </div>

              <div className="text-left">
                <label htmlFor="task-notes" className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-1.5 pl-0.5">
                  Contextual Context / Notes
                </label>
                <input
                  id="task-notes"
                  type="text"
                  placeholder="e.g. Include specific metrics from standard analytics PDF"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isGenerating}
                  className="w-full px-3.5 py-2.5 bg-[#171926] border border-[#26283d] rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 font-mono bg-red-950/20 p-2.5 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#212332]">
              <button
                id="btn-cancel-task"
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isGenerating}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/80 rounded-lg"
              >
                Cancel
              </button>
              <button
                id="btn-submit-task"
                type="submit"
                disabled={isGenerating || !title.trim() || !deadline}
                className="flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[#1b1c2b] disabled:text-slate-600 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-xs hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:ring-offset-2 focus:ring-offset-[#12131a]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Core Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Generate Action Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
