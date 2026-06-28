import { TrustLevel } from '../types';

export function getTrustChangeExplanation(oldLevel: TrustLevel, newLevel: TrustLevel): string {
  const isUp = newLevel > oldLevel;

  if (isUp) {
    // Specific single-level transitions
    if (oldLevel === 1 && newLevel === 2) {
      return "Mutual rhythm established. I am now authorized to structure and prioritize your daily agenda to build execution momentum.";
    }
    if (oldLevel === 2 && newLevel === 3) {
      return "Execution rhythm verified! Full Google Calendar synchronization is now active to automatically block out dedicated execution windows for your pending goals.";
    }
    if (oldLevel === 3 && newLevel === 4) {
      return "High execution reliability achieved! Autonomous draft formulation is now active. I will proactively compose drafts and task checklists for you.";
    }
    if (oldLevel === 4 && newLevel === 5) {
      return "Full trust unlocked! We are now in autonomous mode. I am fully authorized to run background checks, schedule follow-ups, and keep track of your email replies.";
    }
    
    // Fallback for general upgrades
    return `Your reliability score has increased, upgrading your trust level to Tier ${newLevel}! High-privilege features are now active.`;
  } else {
    // Specific single-level transitions
    if (oldLevel === 2 && newLevel === 1) {
      return "Due to consecutive late resolutions, capability downgraded. I must step back to observer status until we can rebuild a stable cadence.";
    }
    if (oldLevel === 3 && newLevel === 2) {
      return "Calendar synchronization paused. I must scale back to basic task prioritization until we re-establish consistent completion speeds.";
    }
    if (oldLevel === 4 && newLevel === 3) {
      return "Autonomous draft formulation has been paused. I will focus strictly on keeping calendar execution slots synchronized with your goals.";
    }
    if (oldLevel === 5 && newLevel === 4) {
      return "Full autonomous privileges restricted. Autonomous background check and follow-up loops are paused until scheduling consistency returns.";
    }

    // Fallback for general downgrades
    return `Your reliability score has decreased, downgrading your trust level to Tier ${newLevel}. Certain integrated capabilities have been paused temporarily to ensure stable performance.`;
  }
}
