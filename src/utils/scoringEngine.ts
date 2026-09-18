/**
 * Centralized Scoring Engine Foundation — Super Diet-Ability
 *
 * Rules & Philosophy:
 * - Single source of truth for all point awards across the entire application.
 * - Base score of +10 points starts every day (DAY_START: +10, once per day).
 * - Honest reporting (SLIP_REPORTED: +8) and recovery (RECOMMIT: +15) are actively rewarded.
 * - Points are never subtracted; lifetime score never decreases.
 * - Deduplication via deterministic sourceId prevents point farming on repeated clicks,
 *   reopening/editing completed activities, or switching block statuses.
 * - Global across Structure Goal profiles; switching profiles never resets or divides score.
 */

import { generateId } from '../utils';
import { getLocalDateKey } from './dietStorage';

// ── Activity Types & Rules ───────────────────────────────────────────────────

export type ScoreActivityType =
  | 'DAY_START'
  | 'DAILY_CHECK_IN'
  | 'DIET_ON_TRACK'
  | 'DIET_TWENTY_PERCENT_OFF_TRACK'
  | 'SLIP_REPORTED'
  | 'RECOMMIT'
  | 'DAILY_REVIEW_COMPLETE'
  | 'COMMITMENT_COMPLETE'
  | 'NON_NEGOTIABLES_REVIEW'
  | 'WHY_REVIEW'
  | 'STRUCTURED_DIET_REVIEW'
  | 'SLIPPERY_ZONES_REVIEW'
  | 'I_AM_IN_CONTROL'
  | 'MOTIVATION_CONSUMED'
  | 'TIMER_COMPLETED'
  | 'CONSISTENCY_BONUS';

export interface ActivityRule {
  points: number;
  maxPerDay: number;
  description: string;
}

export const ACTIVITY_RULES: Record<ScoreActivityType, ActivityRule> = {
  DAY_START: { points: 10, maxPerDay: 1, description: 'Daily base score' },
  DAILY_CHECK_IN: { points: 10, maxPerDay: 4, description: 'Daily check-in' },
  DIET_ON_TRACK: { points: 8, maxPerDay: 10, description: 'Diet block on track' },
  DIET_TWENTY_PERCENT_OFF_TRACK: { points: 5, maxPerDay: 10, description: 'Diet block 20% off track (acceptable flexibility)' },
  SLIP_REPORTED: { points: 8, maxPerDay: 5, description: 'Slip reported honestly' },
  RECOMMIT: { points: 15, maxPerDay: 2, description: 'Re-commit after slip' },
  DAILY_REVIEW_COMPLETE: { points: 40, maxPerDay: 1, description: 'Daily reflection review' },
  COMMITMENT_COMPLETE: { points: 20, maxPerDay: 1, description: 'Commitment made' },
  NON_NEGOTIABLES_REVIEW: { points: 15, maxPerDay: 1, description: 'Non-negotiables reviewed' },
  WHY_REVIEW: { points: 10, maxPerDay: 1, description: 'Why reasons reviewed' },
  STRUCTURED_DIET_REVIEW: { points: 10, maxPerDay: 1, description: 'Structured diet reviewed' },
  SLIPPERY_ZONES_REVIEW: { points: 15, maxPerDay: 1, description: 'Slippery zones reviewed' },
  I_AM_IN_CONTROL: { points: 10, maxPerDay: 2, description: 'I am in control win' },
  MOTIVATION_CONSUMED: { points: 5, maxPerDay: 2, description: 'Motivation text or audio' },
  TIMER_COMPLETED: { points: 10, maxPerDay: 2, description: 'Timer session completed' },
  CONSISTENCY_BONUS: { points: 0, maxPerDay: 1, description: 'Consistency streak bonus' },
};

// ── Event Model ──────────────────────────────────────────────────────────────

export interface ScoreEvent {
  id: string;
  activityType: ScoreActivityType;
  points: number;
  dateKey: string;           // YYYY-MM-DD
  timestamp: number;         // epoch ms
  profileId?: string;
  profileName?: string;
  sourceId?: string;         // deterministic deduplication key
  metadata?: Record<string, unknown>;
}

export interface ScoreStore {
  version: number;
  events: ScoreEvent[];
}

export type AwardStatus = 'awarded' | 'duplicate' | 'cap_reached';

export interface AwardResult {
  status: AwardStatus;
  pointsAwarded: number;
  event?: ScoreEvent;
  reason?: string;
}

export interface RecordScoreParams {
  activityType: ScoreActivityType;
  dateKey?: string;
  timestamp?: number;
  profileId?: string;
  profileName?: string;
  sourceId?: string;
  overridePoints?: number;
  metadata?: Record<string, unknown>;
}

// ── Storage Key & Persistence ────────────────────────────────────────────────

const SCORING_STORAGE_KEY = 'resume-ability-scoring';

export function loadScoreStore(): ScoreStore {
  try {
    const raw = localStorage.getItem(SCORING_STORAGE_KEY);
    if (!raw) {
      return { version: 1, events: [] };
    }
    const parsed = JSON.parse(raw) as ScoreStore;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) {
      return { version: 1, events: [] };
    }
    return parsed;
  } catch {
    return { version: 1, events: [] };
  }
}

export function saveScoreStore(store: ScoreStore): void {
  try {
    localStorage.setItem(SCORING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or private storage mode
  }
}

// ── Core Award Function ──────────────────────────────────────────────────────

/**
 * Record a scoring event through the centralized engine.
 *
 * Enforces:
 * 1. Duplicate protection via sourceId (exact match returns 'duplicate' with 0 pts).
 * 2. Daily caps per (activityType, dateKey) (exceeding returns 'cap_reached' with 0 pts).
 * 3. Exact point allocation as defined in ACTIVITY_RULES.
 */
export function recordScoreEvent(params: RecordScoreParams): AwardResult {
  const store = loadScoreStore();
  const rule = ACTIVITY_RULES[params.activityType];
  if (!rule) {
    return {
      status: 'duplicate',
      pointsAwarded: 0,
      reason: `Unknown activity type: ${params.activityType}`,
    };
  }

  const dateKey = params.dateKey || getLocalDateKey();
  const timestamp = params.timestamp || Date.now();

  // 1. Duplicate source check
  if (params.sourceId) {
    const isDuplicate = store.events.some(
      e => e.sourceId === params.sourceId
    );
    if (isDuplicate) {
      return {
        status: 'duplicate',
        pointsAwarded: 0,
        reason: `Event with sourceId "${params.sourceId}" already recorded`,
      };
    }
  }

  // 2. Daily cap check
  const eventsForDayAndType = store.events.filter(
    e => e.dateKey === dateKey && e.activityType === params.activityType
  );

  if (eventsForDayAndType.length >= rule.maxPerDay) {
    return {
      status: 'cap_reached',
      pointsAwarded: 0,
      reason: `Daily cap of ${rule.maxPerDay} reached for ${params.activityType} on ${dateKey}`,
    };
  }

  // 3. Create event
  const points = params.overridePoints !== undefined ? params.overridePoints : rule.points;
  const newEvent: ScoreEvent = {
    id: generateId(),
    activityType: params.activityType,
    points,
    dateKey,
    timestamp,
    profileId: params.profileId,
    profileName: params.profileName,
    sourceId: params.sourceId,
    metadata: params.metadata,
  };

  store.events.push(newEvent);
  saveScoreStore(store);

  // Notify listeners
  notifyScoreAwardListeners(newEvent);

  // Dispatch DOM event for reactive UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SCORE_UPDATED_EVENT, { detail: newEvent }));
  }

  return {
    status: 'awarded',
    pointsAwarded: newEvent.points,
    event: newEvent,
  };
}

export const SCORE_UPDATED_EVENT = 'sda-score-updated';

// ── Score Award Listener System ──────────────────────────────────────────────

export type ScoreAwardListener = (event: ScoreEvent) => void;
const scoreAwardListeners: ScoreAwardListener[] = [];

export function registerScoreAwardListener(listener: ScoreAwardListener): () => void {
  scoreAwardListeners.push(listener);
  return () => {
    const idx = scoreAwardListeners.indexOf(listener);
    if (idx !== -1) {
      scoreAwardListeners.splice(idx, 1);
    }
  };
}

function notifyScoreAwardListeners(event: ScoreEvent): void {
  for (const listener of [...scoreAwardListeners]) {
    try {
      listener(event);
    } catch (err) {
      console.error('Error in score award listener:', err);
    }
  }
}

// ── Day Start Guarantee (+10 pts) ───────────────────────────────────────────

/**
 * Guarantees that the base 10 points for DAY_START are recorded once for a given date.
 * Repeated calls on the same day return 'duplicate' with 0 extra points.
 */
export function ensureDayStartScore(
  dateKey: string = getLocalDateKey(),
  profileId?: string,
  profileName?: string
): AwardResult {
  return recordScoreEvent({
    activityType: 'DAY_START',
    dateKey,
    sourceId: `day_start_${dateKey}`,
    profileId,
    profileName,
  });
}

// ── Queries & Calculations ───────────────────────────────────────────────────

/**
 * Get all score events recorded for a specific dateKey.
 */
export function getScoreEventsForDate(dateKey: string = getLocalDateKey()): ScoreEvent[] {
  const store = loadScoreStore();
  return store.events.filter(e => e.dateKey === dateKey);
}

/**
 * Calculate total score for a specific date.
 * Guarantees DAY_START (+10) is initialized for the date.
 */
export function getDateScore(dateKey: string = getLocalDateKey()): number {
  ensureDayStartScore(dateKey);
  const events = getScoreEventsForDate(dateKey);
  return events.reduce((sum, e) => sum + e.points, 0);
}

/**
 * Calculate total score for today.
 */
export function getTodayScore(): number {
  return getDateScore(getLocalDateKey());
}

/**
 * Calculate breakdown of points by activity type for a given date.
 */
export function getDateScoreBreakdown(
  dateKey: string = getLocalDateKey()
): Record<ScoreActivityType, number> {
  ensureDayStartScore(dateKey);
  const events = getScoreEventsForDate(dateKey);
  const breakdown: Record<ScoreActivityType, number> = {
    DAY_START: 0,
    DAILY_CHECK_IN: 0,
    DIET_ON_TRACK: 0,
    DIET_TWENTY_PERCENT_OFF_TRACK: 0,
    SLIP_REPORTED: 0,
    RECOMMIT: 0,
    DAILY_REVIEW_COMPLETE: 0,
    COMMITMENT_COMPLETE: 0,
    NON_NEGOTIABLES_REVIEW: 0,
    WHY_REVIEW: 0,
    STRUCTURED_DIET_REVIEW: 0,
    SLIPPERY_ZONES_REVIEW: 0,
    I_AM_IN_CONTROL: 0,
    MOTIVATION_CONSUMED: 0,
    TIMER_COMPLETED: 0,
    CONSISTENCY_BONUS: 0,
  };

  for (const e of events) {
    if (e.activityType in breakdown) {
      breakdown[e.activityType] += e.points;
    }
  }

  return breakdown;
}

/**
 * Calculate the cumulative lifetime score across all recorded events.
 */
export function getLifetimeScore(): number {
  const store = loadScoreStore();
  return store.events.reduce((sum, e) => sum + e.points, 0);
}

/**
 * Reset scoring storage (for testing / user data reset).
 */
export function resetScoreStore(): void {
  try {
    localStorage.removeItem(SCORING_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SCORE_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
}
