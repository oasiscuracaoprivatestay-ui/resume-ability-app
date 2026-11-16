/**
 * SDA 90-Day Goal & Journey Progress Domain (Phase 5A)
 *
 * Models the user's overarching 90-Day Goal & Journey separately from shorter
 * individual challenge durations (1, 3, 7, 30 days) while unifying seamlessly
 * when the active challenge is itself a 90-day challenge.
 *
 * Strict Data-Honesty & Non-Conflict Guarantees:
 * 1. Never silently starts a 90-day journey.
 * 2. Never converts shorter challenges (1, 3, 7, 30 days) into 90-day challenges
 *    or fabricates 90-day progress from shorter challenge day counts.
 * 3. When an active 90-day challenge exists, uses its actual `startDate`,
 *    `currentDay`, and progress directly — zero duplicate conflicting counter.
 * 4. When a shorter challenge is active and no standalone 90-day journey has
 *    been started by the user, resolves cleanly to `isActive: false` (`inactive`).
 * 5. Preserves user-authored `goalText` across statistics resets while allowing
 *    journey progress reset via `resetNinetyDayJourneyProgress()`.
 */

import type { ChallengeInstance } from './types';
import { addDaysToDateKey, getCalendarDaysDiff } from './challengeEngine';
import { getLocalDateKey } from '../utils/dietVerificationStorage';

export const NINETY_DAY_JOURNEY_STORAGE_KEY = 'resume-ability-90day-journey';
export const NINETY_DAY_JOURNEY_UPDATED_EVENT = 'resume-ability:90day-journey-updated';

export const NINETY_DAY_MILESTONES = [3, 7, 14, 30, 60, 90] as const;
export type NinetyDayMilestoneDay = (typeof NINETY_DAY_MILESTONES)[number];

export type NinetyDayMilestoneVisualState =
  | 'completed'
  | 'upcoming'
  | 'final-upcoming'
  | 'final-completed';

export interface NinetyDayMilestoneItem {
  day: NinetyDayMilestoneDay;
  state: NinetyDayMilestoneVisualState;
  isReached: boolean;
  isFinal: boolean;
}

export interface NinetyDayJourneyStore {
  version: 1;
  goalText: string;
  standaloneStartDate: string | null; // YYYY-MM-DD local calendar date, null until explicitly started
  standaloneStartedAt: number | null;
}

export type NinetyDayJourneySource =
  | 'active_90d_challenge'
  | 'standalone_journey'
  | 'inactive';

export interface NinetyDayJourneyView {
  isActive: boolean;
  isCompleted: boolean;
  source: NinetyDayJourneySource;
  goalText: string;
  startDate: string | null;
  endDate: string | null;
  currentDay: number;       // 0 when inactive, 1..90 when active
  completionPct: number;    // 0..100 integer percentage
  milestoneTrackPct: number; // 0..100 piecewise connector fill across the 6 milestone nodes
  milestones: NinetyDayMilestoneItem[];
}

function createDefaultJourneyStore(): NinetyDayJourneyStore {
  return {
    version: 1,
    goalText: '',
    standaloneStartDate: null,
    standaloneStartedAt: null,
  };
}

function isValidDateKey(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

export function loadNinetyDayJourneyStore(): NinetyDayJourneyStore {
  if (typeof localStorage === 'undefined') {
    return createDefaultJourneyStore();
  }

  try {
    const raw = localStorage.getItem(NINETY_DAY_JOURNEY_STORAGE_KEY);
    if (!raw) return createDefaultJourneyStore();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultJourneyStore();
    }

    return {
      version: 1,
      goalText: typeof parsed.goalText === 'string' ? parsed.goalText.slice(0, 120) : '',
      standaloneStartDate: isValidDateKey(parsed.standaloneStartDate)
        ? parsed.standaloneStartDate
        : null,
      standaloneStartedAt:
        typeof parsed.standaloneStartedAt === 'number' && Number.isFinite(parsed.standaloneStartedAt)
          ? parsed.standaloneStartedAt
          : null,
    };
  } catch {
    return createDefaultJourneyStore();
  }
}

export function saveNinetyDayJourneyStore(store: NinetyDayJourneyStore): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    localStorage.setItem(NINETY_DAY_JOURNEY_STORAGE_KEY, JSON.stringify(store));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NINETY_DAY_JOURNEY_UPDATED_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Updates only the user's personal 90-day goal text without starting or altering journey dates.
 */
export function saveNinetyDayGoalText(goalText: string): NinetyDayJourneyStore {
  const store = loadNinetyDayJourneyStore();
  const updated: NinetyDayJourneyStore = {
    ...store,
    goalText: goalText.trim().slice(0, 120),
  };
  saveNinetyDayJourneyStore(updated);
  return updated;
}

/**
 * Explicitly starts a standalone 90-day journey on the user's explicit action.
 * Never touches or overwrites `resume-ability-challenges`.
 */
export function startStandaloneNinetyDayJourney(
  startDateKey = getLocalDateKey()
): NinetyDayJourneyStore {
  const store = loadNinetyDayJourneyStore();
  const updated: NinetyDayJourneyStore = {
    ...store,
    standaloneStartDate: startDateKey,
    standaloneStartedAt: Date.now(),
  };
  saveNinetyDayJourneyStore(updated);
  return updated;
}

/**
 * Clears standalone 90-day journey progress while preserving the user's written `goalText`.
 */
export function resetNinetyDayJourneyProgress(): void {
  const store = loadNinetyDayJourneyStore();
  saveNinetyDayJourneyStore({
    ...store,
    standaloneStartDate: null,
    standaloneStartedAt: null,
  });
}

/**
 * Computes piecewise connector fill (0..100%) across the 6 milestone positions [3, 7, 14, 30, 60, 90]
 * so the horizontal line between milestone nodes matches actual day progression accurately.
 */
function computeMilestoneTrackPct(currentDay: number, isActive: boolean): number {
  if (!isActive || currentDay < NINETY_DAY_MILESTONES[0]) {
    return 0;
  }
  const lastIdx = NINETY_DAY_MILESTONES.length - 1; // 5
  if (currentDay >= NINETY_DAY_MILESTONES[lastIdx]) {
    return 100;
  }

  for (let i = 0; i < lastIdx; i++) {
    const startM = NINETY_DAY_MILESTONES[i];
    const endM = NINETY_DAY_MILESTONES[i + 1];
    if (currentDay >= startM && currentDay <= endM) {
      const segmentFraction = (currentDay - startM) / (endM - startM);
      return Math.min(100, Math.max(0, Math.round(((i + segmentFraction) / lastIdx) * 1000) / 10));
    }
  }
  return 0;
}

/**
 * Resolves the authoritative 90-Day Journey view state without fabricating progress
 * or conflicting with an active 90-day challenge.
 */
export function resolveNinetyDayJourneyView(
  activeChallenge: ChallengeInstance | null | undefined,
  referenceDateKey = getLocalDateKey()
): NinetyDayJourneyView {
  const store = loadNinetyDayJourneyStore();

  let isActive = false;
  let isCompleted = false;
  let source: NinetyDayJourneySource = 'inactive';
  let startDate: string | null = null;
  let endDate: string | null = null;
  let currentDay = 0;

  if (
    activeChallenge &&
    activeChallenge.status === 'active' &&
    activeChallenge.durationDays === 90
  ) {
    // Authoritative 90-day challenge in progress — reuse directly without duplicate counter
    isActive = true;
    source = 'active_90d_challenge';
    startDate = activeChallenge.startDate;
    endDate = activeChallenge.endDate;
    currentDay = Math.min(90, Math.max(1, activeChallenge.currentDay));
    isCompleted = referenceDateKey > activeChallenge.endDate;
  } else if (store.standaloneStartDate) {
    // User explicitly started a standalone 90-day journey alongside shorter challenges
    isActive = true;
    source = 'standalone_journey';
    startDate = store.standaloneStartDate;
    endDate = addDaysToDateKey(store.standaloneStartDate, 89);
    const daysElapsed = getCalendarDaysDiff(store.standaloneStartDate, referenceDateKey);
    currentDay = Math.min(90, Math.max(1, daysElapsed + 1));
    isCompleted = referenceDateKey > endDate;
  }

  const completionPct = isActive
    ? Math.min(100, Math.max(0, Math.round((currentDay / 90) * 100)))
    : 0;

  const milestoneTrackPct = computeMilestoneTrackPct(currentDay, isActive);

  const milestones: NinetyDayMilestoneItem[] = NINETY_DAY_MILESTONES.map((day) => {
    const isFinal = day === 90;
    const isReached = isActive && (currentDay >= day || isCompleted);
    let state: NinetyDayMilestoneVisualState;
    if (isFinal) {
      state = isReached ? 'final-completed' : 'final-upcoming';
    } else {
      state = isReached ? 'completed' : 'upcoming';
    }
    return {
      day,
      state,
      isReached,
      isFinal,
    };
  });

  return {
    isActive,
    isCompleted,
    source,
    goalText: store.goalText,
    startDate,
    endDate,
    currentDay,
    completionPct,
    milestoneTrackPct,
    milestones,
  };
}
