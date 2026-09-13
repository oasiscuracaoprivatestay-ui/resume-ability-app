/**
 * Long-Term Progression Engine — Super Diet-Ability
 *
 * Rules & Philosophy:
 * - Single source of truth for points is scoringEngine.ts (lifetime score).
 * - Progression evaluates accumulated points from Level 0 to Level 10.
 * - Active days are defined as days with at least one non-DAY_START and non-CONSISTENCY_BONUS event.
 * - Streaks and active days are derived directly from the scoring store event history.
 * - Missing a day resets current streak only; lifetime XP, longest streak, and levels are NEVER reduced.
 * - Consistency bonuses are awarded at most once per eligible day (streak tiers: 3d=+5, 7d=+10, 14d=+15, 30d=+20, 90d=+25)
 *   via the central scoring engine under activityType 'CONSISTENCY_BONUS'.
 * - Completely global across Structure Goal profiles.
 */

import { getLocalDateKey } from './dietStorage';
import {
  getLifetimeScore,
  loadScoreStore,
  recordScoreEvent,
  registerScoreAwardListener,
  AwardResult,
  ScoreStore,
} from './scoringEngine';

// ── Level Thresholds (Level 0 to 10) ─────────────────────────────────────────

export const LEVEL_THRESHOLDS: Record<number, number> = {
  0: 0,
  1: 700,
  2: 2500,
  3: 7500,
  4: 20000,
  5: 50000,
  6: 120000,
  7: 250000,
  8: 450000,
  9: 700000,
  10: 1000000,
};

export const MAX_LEVEL = 10;

// ── Level-Up Acknowledgment State ───────────────────────────────────────────

export const CELEBRATED_LEVEL_KEY = 'resume-ability-celebrated-level';

export function getCelebratedLevel(): number | null {
  try {
    const raw = localStorage.getItem(CELEBRATED_LEVEL_KEY);
    return raw !== null ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

export function setCelebratedLevel(level: number): void {
  try {
    localStorage.setItem(CELEBRATED_LEVEL_KEY, String(level));
  } catch {
    // ignore
  }
}

// ── Consistency Bonus Schedule ──────────────────────────────────────────────

export interface BonusTier {
  minDays: number;
  maxDays: number;
  points: number;
}

export const CONSISTENCY_BONUS_TIERS: BonusTier[] = [
  { minDays: 90, maxDays: Infinity, points: 25 },
  { minDays: 30, maxDays: 89, points: 20 },
  { minDays: 14, maxDays: 29, points: 15 },
  { minDays: 7, maxDays: 13, points: 10 },
  { minDays: 3, maxDays: 6, points: 5 },
  { minDays: 1, maxDays: 2, points: 0 },
];

export function getConsistencyBonusPoints(streak: number): number {
  if (streak <= 0) return 0;
  for (const tier of CONSISTENCY_BONUS_TIERS) {
    if (streak >= tier.minDays) {
      return tier.points;
    }
  }
  return 0;
}

// ── Date Arithmetic Helpers (UTC Midnight to avoid DST drift) ────────────────

export function parseDateKeyToUtc(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysDifference(dateKeyA: string, dateKeyB: string): number {
  const utcA = parseDateKeyToUtc(dateKeyA);
  const utcB = parseDateKeyToUtc(dateKeyB);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

// ── Active Days & Streak Derivation ──────────────────────────────────────────

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

/**
 * Returns sorted unique calendar dates (YYYY-MM-DD) that contain at least
 * one meaningful score event (excluding DAY_START and CONSISTENCY_BONUS).
 */
export function getActiveDates(store?: ScoreStore): string[] {
  const currentStore = store || loadScoreStore();
  const activeSet = new Set<string>();

  for (const event of currentStore.events) {
    if (
      event.activityType !== 'DAY_START' &&
      event.activityType !== 'CONSISTENCY_BONUS'
    ) {
      activeSet.add(event.dateKey);
    }
  }

  return Array.from(activeSet).sort();
}

/**
 * Calculate the active-day streak ending specifically on targetDateKey.
 * If targetDateKey is not active, returns 0.
 */
export function getActiveStreakEndingOnDate(
  targetDateKey: string,
  store?: ScoreStore
): number {
  const activeDates = getActiveDates(store);
  const activeSet = new Set(activeDates);

  if (!activeSet.has(targetDateKey)) {
    return 0;
  }

  let streak = 0;
  let checkKey = targetDateKey;

  while (activeSet.has(checkKey)) {
    streak++;
    checkKey = shiftDateKey(checkKey, -1);
  }

  return streak;
}

/**
 * Calculate full streak statistics relative to referenceDateKey (defaults to today).
 *
 * Current streak logic:
 * - If referenceDateKey is active: streak is the consecutive run ending on referenceDateKey.
 * - If referenceDateKey is not active, but yesterday was active: user is still eligible to continue
 *   the streak today, so current streak reflects the active chain ending yesterday.
 * - If neither today nor yesterday is active: streak is broken (0).
 */
export function getStreakStats(
  referenceDateKey: string = getLocalDateKey(),
  store?: ScoreStore
): StreakStats {
  const activeDates = getActiveDates(store);
  const activeSet = new Set(activeDates);
  const totalActiveDays = activeDates.length;
  const lastActiveDate = totalActiveDays > 0 ? activeDates[totalActiveDays - 1] : null;

  // 1. Longest streak across all historical active dates
  let longestStreak = 0;
  let currentRun = 0;
  let prevDateKey: string | null = null;

  for (const dateKey of activeDates) {
    if (prevDateKey === null) {
      currentRun = 1;
    } else {
      const diff = getDaysDifference(prevDateKey, dateKey);
      if (diff === 1) {
        currentRun++;
      } else if (diff > 1) {
        currentRun = 1;
      }
    }
    longestStreak = Math.max(longestStreak, currentRun);
    prevDateKey = dateKey;
  }

  // 2. Current streak relative to referenceDateKey
  let currentStreak = 0;

  if (activeSet.has(referenceDateKey)) {
    currentStreak = getActiveStreakEndingOnDate(referenceDateKey, store);
  } else {
    const yesterdayKey = shiftDateKey(referenceDateKey, -1);
    if (activeSet.has(yesterdayKey)) {
      currentStreak = getActiveStreakEndingOnDate(yesterdayKey, store);
    } else {
      currentStreak = 0;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalActiveDays,
    lastActiveDate,
  };
}

// ── Level & Progress Helpers ────────────────────────────────────────────────

export function getCurrentLifetimeScore(): number {
  return getLifetimeScore();
}

export function getCurrentLevel(lifetimeScore: number = getLifetimeScore()): number {
  for (let lvl = MAX_LEVEL; lvl >= 0; lvl--) {
    if (lifetimeScore >= LEVEL_THRESHOLDS[lvl]) {
      return lvl;
    }
  }
  return 0;
}

export function getCurrentLevelMinThreshold(level: number): number {
  return LEVEL_THRESHOLDS[level] ?? 0;
}

export function getNextLevelThreshold(level: number): number | null {
  if (level >= MAX_LEVEL) {
    return null;
  }
  return LEVEL_THRESHOLDS[level + 1] ?? null;
}

export function getPointsRemainingToNextLevel(
  lifetimeScore: number = getLifetimeScore()
): number {
  const level = getCurrentLevel(lifetimeScore);
  if (level >= MAX_LEVEL) {
    return 0;
  }
  const nextMin = LEVEL_THRESHOLDS[level + 1];
  return Math.max(0, nextMin - lifetimeScore);
}

export function getPercentageProgressWithinCurrentLevel(
  lifetimeScore: number = getLifetimeScore()
): number {
  const level = getCurrentLevel(lifetimeScore);
  if (level >= MAX_LEVEL) {
    return 100;
  }
  const currentMin = LEVEL_THRESHOLDS[level];
  const nextMin = LEVEL_THRESHOLDS[level + 1];
  const range = nextMin - currentMin;
  if (range <= 0) return 100;

  const progress = ((lifetimeScore - currentMin) / range) * 100;
  return Math.min(100, Math.max(0, Math.round(progress * 10) / 10));
}

export function hasReachedLevel10(lifetimeScore: number = getLifetimeScore()): boolean {
  return lifetimeScore >= LEVEL_THRESHOLDS[MAX_LEVEL];
}

// ── Unified Overview Model ──────────────────────────────────────────────────

export interface ProgressionOverview {
  currentLevel: number;
  currentLifetimeScore: number;
  lifetimeXp: number;
  currentLevelMinThreshold: number;
  nextLevel: number | null;
  nextLevelThreshold: number | null;
  pointsRemainingToNextLevel: number;
  xpRemaining: number;
  percentageProgressWithinCurrentLevel: number;
  progressPercentage: number;
  isLevel10: boolean;
  hasReachedLevel10: boolean;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

export function getProgressionOverview(
  referenceDateKey: string = getLocalDateKey()
): ProgressionOverview {
  const score = getLifetimeScore();
  const level = getCurrentLevel(score);
  const minThreshold = getCurrentLevelMinThreshold(level);
  const nextThreshold = getNextLevelThreshold(level);
  const pointsRemaining = getPointsRemainingToNextLevel(score);
  const percentage = getPercentageProgressWithinCurrentLevel(score);
  const isLvl10 = hasReachedLevel10(score);
  const streakStats = getStreakStats(referenceDateKey);

  return {
    currentLevel: level,
    currentLifetimeScore: score,
    lifetimeXp: score,
    currentLevelMinThreshold: minThreshold,
    nextLevel: level < MAX_LEVEL ? level + 1 : null,
    nextLevelThreshold: nextThreshold,
    pointsRemainingToNextLevel: pointsRemaining,
    xpRemaining: pointsRemaining,
    percentageProgressWithinCurrentLevel: percentage,
    progressPercentage: percentage,
    isLevel10: isLvl10,
    hasReachedLevel10: isLvl10,
    currentStreak: streakStats.currentStreak,
    longestStreak: streakStats.longestStreak,
    totalActiveDays: streakStats.totalActiveDays,
    lastActiveDate: streakStats.lastActiveDate,
  };
}

// ── Consistency Bonus Evaluation ────────────────────────────────────────────

/**
 * Check if the streak ending on dateKey qualifies for a consistency bonus,
 * and if so, award it via the centralized scoring engine.
 * Deduplication via `sourceId: consistency_bonus_${dateKey}` ensures it is awarded
 * at most once per eligible day.
 */
export function checkAndAwardConsistencyBonus(
  dateKey: string = getLocalDateKey(),
  profileId?: string,
  profileName?: string
): AwardResult {
  const streak = getActiveStreakEndingOnDate(dateKey);
  const bonusPoints = getConsistencyBonusPoints(streak);

  if (bonusPoints <= 0) {
    return {
      status: 'duplicate',
      pointsAwarded: 0,
      reason: `Streak of ${streak} on ${dateKey} does not qualify for consistency bonus (min 3 days required)`,
    };
  }

  return recordScoreEvent({
    activityType: 'CONSISTENCY_BONUS',
    overridePoints: bonusPoints,
    dateKey,
    sourceId: `consistency_bonus_${dateKey}`,
    profileId,
    profileName,
    metadata: {
      streak,
      bonusTier: bonusPoints,
    },
  });
}

// ── Automatic Score Award Hook ───────────────────────────────────────────────

let isListenerRegistered = false;

export function initializeProgressionEngine(): void {
  if (isListenerRegistered) return;
  isListenerRegistered = true;

  registerScoreAwardListener((event) => {
    // Only check consistency bonus on meaningful active score events
    if (
      event.activityType !== 'DAY_START' &&
      event.activityType !== 'CONSISTENCY_BONUS'
    ) {
      checkAndAwardConsistencyBonus(
        event.dateKey,
        event.profileId,
        event.profileName
      );
    }
  });
}

// Auto-initialize when progression engine module is loaded
initializeProgressionEngine();
