/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Zap, Calendar, Mail, Compass, ArrowRight, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#07080d] text-[#f4f4f5] flex flex-col justify-center items-center px-6 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(#1f2235_1px,transparent_1px)] [background-size:32px_32px] opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full text-center space-y-10 relative z-10">
        
        {/* Elegant Animated Logo Badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-indigo-950/40 border border-indigo-500/20 px-3.5 py-1 rounded-full text-xs font-mono font-bold text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.05)]"
        >
          <Zap className="w-3.5 h-3.5 text-indigo-400 fill-indigo-500/10" />
          <span>Autonomous Task Companion</span>
        </motion.div>

        {/* Prominent Header & Tagline */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display font-black text-5xl sm:text-6xl text-white tracking-tight leading-none"
          >
            Earned
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base sm:text-lg font-mono font-bold uppercase tracking-wider text-indigo-400"
          >
            The AI that has to earn your trust.
          </motion.p>
        </div>

        {/* 2-3 Sentence Explanation */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg mx-auto font-medium"
        >
          Your AI starts with limited observing privileges. As you complete tasks on time and prove your reliability, it earns real integration capabilities like Calendar sync, Gmail reading, and autonomous actions. Fail deadlines, and those privileges are physically revoked.
        </motion.p>

        {/* Minimal 3-Feature Highlights / Pills */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#131420] border border-[#1f2235] rounded-xl text-xs font-semibold text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Real Google Calendar</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#131420] border border-[#1f2235] rounded-xl text-xs font-semibold text-slate-300">
            <Mail className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gmail Intelligence</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#131420] border border-[#1f2235] rounded-xl text-xs font-semibold text-slate-300">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span>Agentic Reasoning</span>
          </span>
        </motion.div>

        {/* ONE Clear CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="pt-4"
        >
          <button
            id="landing-get-started-btn"
            onClick={onGetStarted}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/30 cursor-pointer inline-flex items-center gap-2 group active:scale-[0.98]"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>

        {/* Secure Trust Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400 font-semibold"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Secured Sandbox Integration Loop Active</span>
        </motion.div>

      </div>
    </div>
  );
}
