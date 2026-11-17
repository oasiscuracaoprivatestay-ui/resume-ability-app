/**
 * SDA 90-Day Goal & Journey Progress Domain (Phase 5A & Phase 5B.1)
 *
 * Models the user's overarching 90-Day Goal & Journey separately from shorter
 * individual challenge durations (1, 3, 7, 30 days) while unifying seamlessly
 * when the active challenge is itself a 90-day challenge.
 *
 * Phase 5B.1 Milestone Review Rules:
 * - Supports milestone reviews at Days 3, 7, 14, 30, 60, and 90.
 * - Strictly distinguishes 4 milestone states:
 *   1. 'upcoming'          — journey inactive OR currentDay < day
 *   2. 'milestone_reached' — journey active, currentDay === day, review NOT yet completed
 *   3. 'review_pending'    — journey active, currentDay > day, review NOT yet completed
 *   4. 'review_completed'  — journey active, currentDay >= day, AND review explicitly saved
 * - NEVER awards milestone completion merely because the calendar day has arrived.
 */

import type { ChallengeInstance } from './types';
import { addDaysToDateKey, getCalendarDaysDiff } from './challengeEngine';
import { getLocalDateKey } from '../utils/dietVerificationStorage';

export const NINETY_DAY_JOURNEY_STORAGE_KEY = 'resume-ability-90day-journey';
export const NINETY_DAY_JOURNEY_UPDATED_EVENT = 'resume-ability:90day-journey-updated';

export const NINETY_DAY_MILESTONES = [3, 7, 14, 30, 60, 90] as const;
export type NinetyDayMilestoneDay = (typeof NINETY_DAY_MILESTONES)[number];

export type MilestoneStructureDecision = 'continue' | 'adjust';

export interface NinetyDayMilestoneReviewRecord {
  milestoneDay: NinetyDayMilestoneDay;
  journeyStartDate: string; // YYYY-MM-DD of the active 90-day journey cycle
  dateKey: string;          // YYYY-MM-DD when the review was recorded
  whatHelped: string;
  structureDecision: MilestoneStructureDecision;
  completedAt: number;
  updatedAt?: number;
}

export type NinetyDayMilestoneStatus =
  | 'upcoming'
  | 'milestone_reached'
  | 'review_pending'
  | 'review_completed';

export type NinetyDayMilestoneVisualState =
  | 'upcoming'
  | 'milestone-reached'
  | 'review-pending'
  | 'review-completed'
  | 'final-upcoming'
  | 'final-reached'
  | 'final-review-pending'
  | 'final-completed';

export interface NinetyDayMilestoneItem {
  day: NinetyDayMilestoneDay;
  status: NinetyDayMilestoneStatus;
  state: NinetyDayMilestoneVisualState;
  isReached: boolean;
  isReviewPending: boolean;
  isReviewCompleted: boolean;
  isFinal: boolean;
  reviewRecord?: NinetyDayMilestoneReviewRecord;
}

export interface NinetyDayJourneyStore {
  version: 1;
  goalText: string;
  standaloneStartDate: string | null; // YYYY-MM-DD local calendar date, null until explicitly started
  standaloneStartedAt: number | null;
  milestoneReviews: NinetyDayMilestoneReviewRecord[];
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
  pendingMilestoneReviews: NinetyDayMilestoneItem[];
  nextUpcomingMilestone: NinetyDayMilestoneItem | null;
}

function createDefaultJourneyStore(): NinetyDayJourneyStore {
  return {
    version: 1,
    goalText: '',
    standaloneStartDate: null,
    standaloneStartedAt: null,
    milestoneReviews: [],
  };
}

function isValidDateKey(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function normalizeMilestoneReviews(raw: unknown): NinetyDayMilestoneReviewRecord[] {
  if (!Array.isArray(raw)) return [];
  const validDays = new Set<number>(NINETY_DAY_MILESTONES);
  const result: NinetyDayMilestoneReviewRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const day = Number(rec.milestoneDay);
    if (!validDays.has(day)) continue;
    if (!isValidDateKey(rec.journeyStartDate)) continue;
    result.push({
      milestoneDay: day as NinetyDayMilestoneDay,
      journeyStartDate: rec.journeyStartDate,
      dateKey: isValidDateKey(rec.dateKey) ? rec.dateKey : rec.journeyStartDate,
      whatHelped: typeof rec.whatHelped === 'string' ? rec.whatHelped.slice(0, 500) : '',
      structureDecision: rec.structureDecision === 'adjust' ? 'adjust' : 'continue',
      completedAt:
        typeof rec.completedAt === 'number' && Number.isFinite(rec.completedAt)
          ? rec.completedAt
          : Date.now(),
      updatedAt:
        typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt)
          ? rec.updatedAt
          : undefined,
    });
  }
  return result;
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
      milestoneReviews: normalizeMilestoneReviews(parsed.milestoneReviews),
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
 * Records or updates a 90-Day Milestone Review idempotently for a specific journey cycle & milestone day.
 * Does NOT alter scoring/XP calculations or create duplicate records.
 */
export function saveNinetyDayMilestoneReview(params: {
  milestoneDay: NinetyDayMilestoneDay;
  journeyStartDate: string;
  whatHelped: string;
  structureDecision: MilestoneStructureDecision;
  dateKey?: string;
}): NinetyDayMilestoneReviewRecord | null {
  if (!isValidDateKey(params.journeyStartDate)) return null;
  if (!NINETY_DAY_MILESTONES.includes(params.milestoneDay)) return null;

  const store = loadNinetyDayJourneyStore();
  const now = Date.now();
  const dateKey = params.dateKey || getLocalDateKey();
  const cleanText = (params.whatHelped || '').trim().slice(0, 500);

  const existingIdx = store.milestoneReviews.findIndex(
    (r) =>
      r.journeyStartDate === params.journeyStartDate &&
      r.milestoneDay === params.milestoneDay
  );

  const record: NinetyDayMilestoneReviewRecord =
    existingIdx >= 0
      ? {
          ...store.milestoneReviews[existingIdx],
          dateKey,
          whatHelped: cleanText,
          structureDecision: params.structureDecision,
          updatedAt: now,
        }
      : {
          milestoneDay: params.milestoneDay,
          journeyStartDate: params.journeyStartDate,
          dateKey,
          whatHelped: cleanText,
          structureDecision: params.structureDecision,
          completedAt: now,
        };

  const nextReviews =
    existingIdx >= 0
      ? store.milestoneReviews.map((r, i) => (i === existingIdx ? record : r))
      : [...store.milestoneReviews, record];

  const saved = saveNinetyDayJourneyStore({
    ...store,
    milestoneReviews: nextReviews,
  });

  return saved ? record : null;
}

/**
 * Clears standalone 90-day journey progress and milestone reviews while preserving written `goalText`.
 */
export function resetNinetyDayJourneyProgress(): void {
  const store = loadNinetyDayJourneyStore();
  saveNinetyDayJourneyStore({
    ...store,
    standaloneStartDate: null,
    standaloneStartedAt: null,
    milestoneReviews: [],
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
 * Resolves the authoritative 90-Day Journey view state without fabricating progress,
 * conflicting with an active 90-day challenge, or auto-completing unreviewed milestones.
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
    const reviewRecord =
      isActive && startDate
        ? store.milestoneReviews.find(
            (r) => r.journeyStartDate === startDate && r.milestoneDay === day
          )
        : undefined;

    const isReviewCompleted = Boolean(isReached && reviewRecord);
    const isReviewPending = Boolean(isReached && !reviewRecord);

    let status: NinetyDayMilestoneStatus;
    if (!isReached) {
      status = 'upcoming';
    } else if (isReviewCompleted) {
      status = 'review_completed';
    } else if (currentDay === day) {
      status = 'milestone_reached';
    } else {
      status = 'review_pending';
    }

    let state: NinetyDayMilestoneVisualState;
    if (isFinal) {
      if (!isReached) state = 'final-upcoming';
      else if (isReviewCompleted) state = 'final-completed';
      else if (currentDay === day) state = 'final-reached';
      else state = 'final-review-pending';
    } else {
      if (!isReached) state = 'upcoming';
      else if (isReviewCompleted) state = 'review-completed';
      else if (currentDay === day) state = 'milestone-reached';
      else state = 'review-pending';
    }

    return {
      day,
      status,
      state,
      isReached,
      isReviewPending,
      isReviewCompleted,
      isFinal,
      reviewRecord,
    };
  });

  const pendingMilestoneReviews = milestones.filter((m) => m.isReviewPending);
  const nextUpcomingMilestone = milestones.find((m) => !m.isReached) || null;

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
    pendingMilestoneReviews,
    nextUpcomingMilestone,
  };
}
