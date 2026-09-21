/**
 * Daily Milestone Storage & Deduplication Engine (Phase 29C)
 *
 * Tracks daily celebratory milestones reached on the current calendar day
 * based on Today's Score (attributable milestones: 25, 50, 100, 150 points).
 *
 * Invariants:
 * - Persistent deduplication per local calendar dateKey (YYYY-MM-DD).
 * - Celebrations trigger at most once per local calendar day per tier.
 * - ZERO extra score or XP is awarded (purely celebratory feedback).
 * - Never modifies or overwrites lifetime score, streaks, or existing records.
 */

import { getLocalDateKey } from './dietStorage';

export type DailyMilestoneTier = 25 | 50 | 100 | 150;

export const DAILY_MILESTONE_TIERS: DailyMilestoneTier[] = [25, 50, 100, 150];

export const DAILY_MILESTONES_STORAGE_KEY = 'resume-ability-daily-milestones';

export interface DailyMilestonesStore {
  // Map of dateKey (YYYY-MM-DD) -> array of celebrated tiers
  days: Record<string, DailyMilestoneTier[]>;
}

export function loadDailyMilestonesStore(): DailyMilestonesStore {
  if (typeof window === 'undefined') {
    return { days: {} };
  }
  try {
    const raw = localStorage.getItem(DAILY_MILESTONES_STORAGE_KEY);
    if (!raw) return { days: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.days && typeof parsed.days === 'object') {
      return parsed as DailyMilestonesStore;
    }
    return { days: {} };
  } catch {
    return { days: {} };
  }
}

export function saveDailyMilestonesStore(store: DailyMilestonesStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_MILESTONES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Graceful fallback on quota exceeded
  }
}

/**
 * Check if a specific milestone tier has already been celebrated on dateKey.
 */
export function isMilestoneCelebrated(
  tier: DailyMilestoneTier,
  dateKey: string = getLocalDateKey()
): boolean {
  const store = loadDailyMilestonesStore();
  const celebratedForDay = store.days[dateKey] || [];
  return celebratedForDay.includes(tier);
}

/**
 * Mark a milestone tier as celebrated on dateKey so it will not trigger again that day.
 */
export function markMilestoneCelebrated(
  tier: DailyMilestoneTier,
  dateKey: string = getLocalDateKey()
): void {
  const store = loadDailyMilestonesStore();
  if (!store.days[dateKey]) {
    store.days[dateKey] = [];
  }
  if (!store.days[dateKey].includes(tier)) {
    store.days[dateKey].push(tier);
    // Keep in numerical order
    store.days[dateKey].sort((a, b) => a - b);
    saveDailyMilestonesStore(store);
  }
}

/**
 * Get the next uncelebrated milestone tier for the given score and dateKey, or null if none.
 * Evaluates tiers in ascending order: 25 -> 50 -> 100 -> 150.
 */
export function getNextUncelebratedMilestone(
  currentTodayScore: number,
  dateKey: string = getLocalDateKey()
): DailyMilestoneTier | null {
  const store = loadDailyMilestonesStore();
  const celebratedForDay = store.days[dateKey] || [];

  for (const tier of DAILY_MILESTONE_TIERS) {
    if (currentTodayScore >= tier && !celebratedForDay.includes(tier)) {
      return tier;
    }
  }

  return null;
}

/**
 * Reset daily milestones store (for testing / account reset).
 */
export function resetDailyMilestonesStore(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DAILY_MILESTONES_STORAGE_KEY);
  } catch {
    // ignore
  }
}
