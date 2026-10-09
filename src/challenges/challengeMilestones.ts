/**
 * SDA Challenge Milestone Engine & Metadata (Phase 41H)
 *
 * Core Philosophy:
 * Celebrate meaningful practice, consistency, recovery and recommitment — never demand perfection.
 *
 * Invariants:
 * 1. ZERO XP awarded for evaluating, displaying, or dismissing milestones.
 * 2. Slips do not disqualify from practice milestones.
 * 3. Practice counting uses distinct calendar dates (dateKey), not raw elapsed calendar time.
 * 4. Recovery milestones require verified true slip + explicit recorded recovery, never inferred from check-ins alone.
 * 5. Cancelled challenges never celebrate completion.
 * 6. Milestone celebrations are completely idempotent per challenge instance.
 */

import type {
  ChallengeInstance,
  ChallengeMilestoneMetadata,
} from './types';
import { loadChallengeStore, saveChallengeStore } from './challengeStorage';

export const CHALLENGE_MILESTONE_DEFINITIONS: ChallengeMilestoneMetadata[] = [
  // ── 1. First Check-In (All Durations) ───────────────────────────────────────
  {
    id: 'first_checkin',
    category: 'first_checkin',
    presentation: 'modal',
    priority: 10,
    titleKey: 'challenge_milestone_first_checkin_title',
    descKey: 'challenge_milestone_first_checkin_desc',
    badgeKey: 'challenge_milestone_first_checkin_badge',
    feedbackType: 'win',
  },

  // ── 2. Verified First Recovery / Resume (All Durations) ─────────────────────
  {
    id: 'first_verified_resume',
    category: 'recovery',
    presentation: 'modal',
    priority: 40,
    titleKey: 'challenge_milestone_first_resume_title',
    descKey: 'challenge_milestone_first_resume_desc',
    badgeKey: 'challenge_milestone_first_resume_badge',
    feedbackType: 'recovery',
  },

  // ── 3. Practice Consistency Milestones ──────────────────────────────────────
  // 1-Day: Day 1 check-in practiced
  {
    id: 'practice_1d',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 20,
    titleKey: 'challenge_milestone_practice_1d_title',
    descKey: 'challenge_milestone_practice_1d_desc',
    badgeKey: 'challenge_milestone_practice_1d_badge',
    feedbackType: 'win',
    requiredDuration: 1,
    requiredPracticeDays: 1,
  },

  // 3-Day: 2 distinct checked-in days
  {
    id: 'practice_3d_2',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 20,
    titleKey: 'challenge_milestone_practice_3d_2_title',
    descKey: 'challenge_milestone_practice_3d_2_desc',
    badgeKey: 'challenge_milestone_practice_3d_2_badge',
    feedbackType: 'win',
    requiredDuration: 3,
    requiredPracticeDays: 2,
  },

  // 7-Day: 3 distinct checked-in days
  {
    id: 'practice_7d_3',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 20,
    titleKey: 'challenge_milestone_practice_7d_3_title',
    descKey: 'challenge_milestone_practice_7d_3_desc',
    badgeKey: 'challenge_milestone_practice_7d_3_badge',
    feedbackType: 'win',
    requiredDuration: 7,
    requiredPracticeDays: 3,
  },
  // 7-Day: 5 distinct checked-in days
  {
    id: 'practice_7d_5',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 25,
    titleKey: 'challenge_milestone_practice_7d_5_title',
    descKey: 'challenge_milestone_practice_7d_5_desc',
    badgeKey: 'challenge_milestone_practice_7d_5_badge',
    feedbackType: 'win',
    requiredDuration: 7,
    requiredPracticeDays: 5,
  },

  // 30-Day: 7 distinct checked-in days
  {
    id: 'practice_30d_7',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 20,
    titleKey: 'challenge_milestone_practice_30d_7_title',
    descKey: 'challenge_milestone_practice_30d_7_desc',
    badgeKey: 'challenge_milestone_practice_30d_7_badge',
    feedbackType: 'win',
    requiredDuration: 30,
    requiredPracticeDays: 7,
  },
  // 30-Day: 15 distinct checked-in days
  {
    id: 'practice_30d_15',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 25,
    titleKey: 'challenge_milestone_practice_30d_15_title',
    descKey: 'challenge_milestone_practice_30d_15_desc',
    badgeKey: 'challenge_milestone_practice_30d_15_badge',
    feedbackType: 'win',
    requiredDuration: 30,
    requiredPracticeDays: 15,
  },
  // 30-Day: 21 distinct checked-in days
  {
    id: 'practice_30d_21',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 30,
    titleKey: 'challenge_milestone_practice_30d_21_title',
    descKey: 'challenge_milestone_practice_30d_21_desc',
    badgeKey: 'challenge_milestone_practice_30d_21_badge',
    feedbackType: 'win',
    requiredDuration: 30,
    requiredPracticeDays: 21,
  },

  // 90-Day: 7 distinct checked-in days
  {
    id: 'practice_90d_7',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 20,
    titleKey: 'challenge_milestone_practice_90d_7_title',
    descKey: 'challenge_milestone_practice_90d_7_desc',
    badgeKey: 'challenge_milestone_practice_90d_7_badge',
    feedbackType: 'win',
    requiredDuration: 90,
    requiredPracticeDays: 7,
  },
  // 90-Day: 30 distinct checked-in days
  {
    id: 'practice_90d_30',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 25,
    titleKey: 'challenge_milestone_practice_90d_30_title',
    descKey: 'challenge_milestone_practice_90d_30_desc',
    badgeKey: 'challenge_milestone_practice_90d_30_badge',
    feedbackType: 'win',
    requiredDuration: 90,
    requiredPracticeDays: 30,
  },
  // 90-Day: 60 distinct checked-in days
  {
    id: 'practice_90d_60',
    category: 'practice_consistency',
    presentation: 'inline',
    priority: 30,
    titleKey: 'challenge_milestone_practice_90d_60_title',
    descKey: 'challenge_milestone_practice_90d_60_desc',
    badgeKey: 'challenge_milestone_practice_90d_60_badge',
    feedbackType: 'win',
    requiredDuration: 90,
    requiredPracticeDays: 60,
  },

  // ── 4. Challenge Completion Milestones ──────────────────────────────────────
  {
    id: 'completion_1d',
    category: 'completion',
    presentation: 'modal',
    priority: 50,
    titleKey: 'challenge_milestone_completion_1d_title',
    descKey: 'challenge_milestone_completion_1d_desc',
    badgeKey: 'challenge_milestone_completion_1d_badge',
    feedbackType: 'win',
    requiredDuration: 1,
  },
  {
    id: 'completion_3d',
    category: 'completion',
    presentation: 'modal',
    priority: 50,
    titleKey: 'challenge_milestone_completion_3d_title',
    descKey: 'challenge_milestone_completion_3d_desc',
    badgeKey: 'challenge_milestone_completion_3d_badge',
    feedbackType: 'win',
    requiredDuration: 3,
  },
  {
    id: 'completion_7d',
    category: 'completion',
    presentation: 'modal',
    priority: 50,
    titleKey: 'challenge_milestone_completion_7d_title',
    descKey: 'challenge_milestone_completion_7d_desc',
    badgeKey: 'challenge_milestone_completion_7d_badge',
    feedbackType: 'win',
    requiredDuration: 7,
  },
  {
    id: 'completion_30d',
    category: 'completion',
    presentation: 'modal',
    priority: 50,
    titleKey: 'challenge_milestone_completion_30d_title',
    descKey: 'challenge_milestone_completion_30d_desc',
    badgeKey: 'challenge_milestone_completion_30d_badge',
    feedbackType: 'win',
    requiredDuration: 30,
  },
  {
    id: 'completion_90d',
    category: 'completion',
    presentation: 'modal',
    priority: 50,
    titleKey: 'challenge_milestone_completion_90d_title',
    descKey: 'challenge_milestone_completion_90d_desc',
    badgeKey: 'challenge_milestone_completion_90d_badge',
    feedbackType: 'win',
    requiredDuration: 90,
  },
];

/**
 * Calculates the number of unique calendar days (dateKey) with recorded check-ins.
 * Pure and non-destructive.
 */
export function getDistinctPracticeDays(challenge: ChallengeInstance): number {
  if (!challenge || !Array.isArray(challenge.checkIns)) {
    return 0;
  }
  const uniqueDates = new Set<string>();
  for (const ci of challenge.checkIns) {
    if (ci && typeof ci.dateKey === 'string' && ci.dateKey.trim()) {
      uniqueDates.add(ci.dateKey.trim());
    }
  }
  return uniqueDates.size;
}

/**
 * Pure evaluator checking if a specific milestone is eligible for a challenge instance.
 */
export function isMilestoneEligible(
  milestone: ChallengeMilestoneMetadata,
  challenge: ChallengeInstance
): boolean {
  if (!challenge) return false;

  // 1. Cancelled challenges never trigger celebrations
  if (challenge.status === 'cancelled') {
    return false;
  }

  // 2. Category: First Check-In
  if (milestone.category === 'first_checkin') {
    return Array.isArray(challenge.checkIns) && challenge.checkIns.length >= 1;
  }

  // 3. Category: Verified First Recovery / Resume
  if (milestone.category === 'recovery') {
    // Requires genuine eligible true-slip and explicitly recorded recovery
    const counts = challenge.relevantEventCounts;
    if (!counts) return false;
    const eligibleSlips = counts.eligibleSlips ?? 0;
    const resumedSlips = counts.resumedSlips ?? 0;
    return eligibleSlips > 0 && resumedSlips > 0;
  }

  // 4. Category: Practice Consistency
  if (milestone.category === 'practice_consistency') {
    if (milestone.requiredDuration && challenge.durationDays !== milestone.requiredDuration) {
      return false;
    }
    const distinctDays = getDistinctPracticeDays(challenge);
    const requiredDays = milestone.requiredPracticeDays ?? 1;
    return distinctDays >= requiredDays;
  }

  // 5. Category: Challenge Completion
  if (milestone.category === 'completion') {
    if (challenge.status !== 'completed') {
      return false;
    }
    if (milestone.requiredDuration && challenge.durationDays !== milestone.requiredDuration) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Checks if a milestone has already been celebrated on the challenge instance.
 */
export function isChallengeMilestoneCelebrated(
  challenge: ChallengeInstance,
  milestoneId: string
): boolean {
  if (!challenge || !Array.isArray(challenge.celebratedMilestones)) {
    return false;
  }
  return challenge.celebratedMilestones.includes(milestoneId);
}

export interface ChallengeMilestoneEvaluation {
  eligible: ChallengeMilestoneMetadata[];
  uncelebrated: ChallengeMilestoneMetadata[];
  celebrated: ChallengeMilestoneMetadata[];
  pendingModal: ChallengeMilestoneMetadata | null;
}

/**
 * Evaluates all milestone definitions against the given challenge instance.
 * Returns categorized lists and the highest-priority pending modal milestone.
 * Pure and non-destructive.
 */
export function evaluateChallengeMilestones(
  challenge: ChallengeInstance | null
): ChallengeMilestoneEvaluation {
  if (!challenge) {
    return {
      eligible: [],
      uncelebrated: [],
      celebrated: [],
      pendingModal: null,
    };
  }

  const eligible: ChallengeMilestoneMetadata[] = [];
  const uncelebrated: ChallengeMilestoneMetadata[] = [];
  const celebrated: ChallengeMilestoneMetadata[] = [];

  for (const m of CHALLENGE_MILESTONE_DEFINITIONS) {
    if (isMilestoneEligible(m, challenge)) {
      eligible.push(m);
      if (isChallengeMilestoneCelebrated(challenge, m.id)) {
        celebrated.push(m);
      } else {
        uncelebrated.push(m);
      }
    }
  }

  // Find highest priority uncelebrated modal milestone
  // Phase 41H.5: Legacy concluded challenges suppress modal celebration spam without falsifying celebration records.
  const pendingModalCandidates = uncelebrated
    .filter((m) => m.presentation === 'modal' && !challenge.isLegacyConcluded)
    .sort((a, b) => b.priority - a.priority);

  const pendingModal = (!challenge.isLegacyConcluded && pendingModalCandidates.length > 0)
    ? pendingModalCandidates[0]
    : null;

  return {
    eligible,
    uncelebrated,
    celebrated,
    pendingModal,
  };
}

/**
 * Convenience helper returning the next uncelebrated modal milestone, or null.
 */
export function getNextUncelebratedModalMilestone(
  challenge: ChallengeInstance | null
): ChallengeMilestoneMetadata | null {
  return evaluateChallengeMilestones(challenge).pendingModal;
}

/**
 * Convenience helper returning all uncelebrated inline milestones.
 */
export function getUncelebratedInlineMilestones(
  challenge: ChallengeInstance | null
): ChallengeMilestoneMetadata[] {
  return evaluateChallengeMilestones(challenge).uncelebrated.filter(
    (m) => m.presentation === 'inline'
  );
}

/**
 * Atomically marks a milestone as celebrated on the active or archived challenge.
 * Safe against stale snapshots and returns true if saved successfully.
 */
export function markChallengeMilestoneCelebrated(
  challengeId: string,
  milestoneId: string
): boolean {
  if (!challengeId || !milestoneId) return false;

  const store = loadChallengeStore();
  let updated = false;

  // 1. Check active challenge
  if (store.activeChallenge && store.activeChallenge.id === challengeId) {
    const list = store.activeChallenge.celebratedMilestones || [];
    if (!list.includes(milestoneId)) {
      store.activeChallenge.celebratedMilestones = [...list, milestoneId];
      updated = true;
    } else {
      return true; // already celebrated
    }
  }

  // 2. Check history (completed or archived challenges)
  if (!updated && Array.isArray(store.history)) {
    const histIdx = store.history.findIndex((c) => c.id === challengeId);
    if (histIdx !== -1) {
      const histItem = store.history[histIdx];
      const list = histItem.celebratedMilestones || [];
      if (!list.includes(milestoneId)) {
        histItem.celebratedMilestones = [...list, milestoneId];
        updated = true;
      } else {
        return true; // already celebrated
      }
    }
  }

  if (updated) {
    return saveChallengeStore(store);
  }

  return false;
}
