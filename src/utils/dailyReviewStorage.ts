/**
 * Daily Review Storage — Phase 27
 *
 * Dedicated storage namespace: 'resume-ability-daily-reviews'
 * Complements detailed block verifications with holistic daily reflections.
 *
 * Each Daily Review is permanently linked to:
 *   - dateKey: "YYYY-MM-DD" (local deterministic calendar date)
 *   - profileId: Structure Goal profile ID that applied to that date
 *   - profileName: Human-readable / localized profile name
 *
 * Switching the active Structure Goal today NEVER alters the profile association
 * of a past date's Daily Review.
 */

import { loadDietStore, getActiveProfile, getLocalDateKey, dateKeyToDayKey, getDayPlan } from './dietStorage';
import { loadAllDietVerifications } from './dietVerificationStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReviewQuestionId =
  | 'q1_planned_eating'
  | 'q2_distinguish_structure'
  | 'q3_flexible_planned_reactive'
  | 'q4_preserve_non_eating'
  | 'q5_flexibility_replaced_added'
  | 'q6_stopped_at_boundary'
  | 'q7_slip_recognition_resumed'
  | 'q8_triggers'
  | 'q9_supported_goal'
  | 'q10_dominant_pattern';

export interface DailyReviewAnswer {
  questionId: ReviewQuestionId;
  value: string;
  note?: string;
  selectedOptions?: string[]; // multi-select (e.g. triggers)
}

export interface DailyReviewRecord {
  id: string; // `${dateKey}_${profileId}`
  dateKey: string; // "YYYY-MM-DD"
  profileId: string;
  profileName: string;
  answers: Record<string, DailyReviewAnswer>;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DailyReviewStore {
  version: 1;
  reviews: Record<string, DailyReviewRecord>; // keyed by `${dateKey}_${profileId}`
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-daily-reviews';

export const REVIEW_QUESTION_IDS: ReviewQuestionId[] = [
  'q1_planned_eating',
  'q2_distinguish_structure',
  'q3_flexible_planned_reactive',
  'q4_preserve_non_eating',
  'q5_flexibility_replaced_added',
  'q6_stopped_at_boundary',
  'q7_slip_recognition_resumed',
  'q8_triggers',
  'q9_supported_goal',
  'q10_dominant_pattern',
];

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Load all stored daily reviews from localStorage.
 * Never throws; returns safe fallback on error or missing data.
 */
export function loadDailyReviewStore(): DailyReviewStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, reviews: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || !parsed.reviews) {
      return { version: 1, reviews: {} };
    }
    return {
      version: 1,
      reviews: (parsed.reviews as Record<string, DailyReviewRecord>) || {},
    };
  } catch {
    return { version: 1, reviews: {} };
  }
}

/**
 * Persist the daily reviews store.
 */
export function saveDailyReviewStore(store: DailyReviewStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Fail silently on quota exceeded or private mode restriction
  }
}

// ── Profile Resolution for Date ──────────────────────────────────────────────

/**
 * Resolves which Structure Goal profile applies to a specific date.
 * Priority:
 * 1. An existing Daily Review for that date (freezes historical association forever).
 * 2. An existing DailyDietVerification for that date.
 * 3. The current active Structure Goal profile from diet store.
 */
export function resolveProfileForDate(dateKey: string): { profileId: string; profileName: string } {
  const store = loadDailyReviewStore();

  // 1. Check if an existing review exists for this dateKey
  for (const review of Object.values(store.reviews)) {
    if (review && review.dateKey === dateKey && review.profileId) {
      return {
        profileId: review.profileId,
        profileName: review.profileName || 'Structured Goal',
      };
    }
  }

  // 2. Check if a verification was saved for this dateKey
  const verifications = loadAllDietVerifications();
  const dailyVerif = verifications[dateKey];
  if (dailyVerif?.profileId) {
    return {
      profileId: dailyVerif.profileId,
      profileName: dailyVerif.profileName || dailyVerif.sourcePlanName || 'Structured Goal',
    };
  }

  // 3. Fallback to currently active profile
  const dietStore = loadDietStore();
  const active = getActiveProfile(dietStore);
  return {
    profileId: active.id,
    profileName: active.name,
  };
}

// ── CRUD Operations ───────────────────────────────────────────────────────────

/**
 * Build the stable unique review record key.
 */
export function buildReviewId(dateKey: string, profileId: string): string {
  return `${dateKey}_${profileId}`;
}

/**
 * Get a daily review for a specific date and optional profileId.
 * If profileId is omitted, finds any existing review for that date.
 */
export function getDailyReview(dateKey: string, profileId?: string): DailyReviewRecord | null {
  const store = loadDailyReviewStore();
  if (profileId) {
    const id = buildReviewId(dateKey, profileId);
    return store.reviews[id] ?? null;
  }

  // Find any review matching dateKey
  for (const review of Object.values(store.reviews)) {
    if (review && review.dateKey === dateKey) {
      return review;
    }
  }
  return null;
}

/**
 * Save or update a Daily Review record.
 * One review per date/profile combination, preventing accidental duplicates.
 */
export function saveDailyReview(params: {
  dateKey: string;
  profileId: string;
  profileName: string;
  answers: Record<string, DailyReviewAnswer>;
  completed?: boolean;
}): DailyReviewRecord {
  const store = loadDailyReviewStore();
  const id = buildReviewId(params.dateKey, params.profileId);
  const existing = store.reviews[id];
  const now = Date.now();

  const record: DailyReviewRecord = {
    id,
    dateKey: params.dateKey,
    profileId: params.profileId,
    profileName: params.profileName,
    answers: { ...(existing?.answers || {}), ...params.answers },
    completed: params.completed ?? existing?.completed ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store.reviews[id] = record;
  saveDailyReviewStore(store);
  return record;
}

/**
 * Check if a completed review exists for a date.
 */
export function hasCompletedDailyReview(dateKey: string, profileId?: string): boolean {
  const rev = getDailyReview(dateKey, profileId);
  return Boolean(rev && rev.completed);
}

/**
 * Delete a Daily Review record.
 */
export function deleteDailyReview(dateKey: string, profileId: string): boolean {
  const store = loadDailyReviewStore();
  const id = buildReviewId(dateKey, profileId);
  if (!store.reviews[id]) return false;
  delete store.reviews[id];
  saveDailyReviewStore(store);
  return true;
}

// ── Date Eligibility & Schedule Helpers ───────────────────────────────────────

/**
 * Checks if a date has an applicable Structured Diet schedule or history.
 */
export function isDateEligibleForReview(dateKey: string): boolean {
  const todayKey = getLocalDateKey();
  if (dateKey === todayKey) return true;

  // Has an existing review?
  const review = getDailyReview(dateKey);
  if (review) return true;

  // Has an existing verification?
  const verifications = loadAllDietVerifications();
  if (verifications[dateKey]) return true;

  // Check diet plan days
  const dietStore = loadDietStore();
  const profile = getActiveProfile(dietStore);
  if (profile.diet.dateOverrides && profile.diet.dateOverrides[dateKey]) return true;
  if (profile.diet.historySnapshots && profile.diet.historySnapshots[dateKey]) return true;

  // Normal weekday template check
  const dayKey = dateKeyToDayKey(dateKey);
  const dayPlan = getDayPlan(profile.diet, dayKey);
  return dayPlan.mode === 'structured' || dayPlan.blocks.length > 0;
}

export interface EligibleReviewDateItem {
  dateKey: string;
  isToday: boolean;
  hasReview: boolean;
  profileId: string;
  profileName: string;
}

/**
 * Returns recent eligible dates (defaults to 7 days: today and previous 6 days).
 */
export function getRecentReviewDates(daysCount = 7): EligibleReviewDateItem[] {
  const items: EligibleReviewDateItem[] = [];
  const today = new Date();
  const todayKey = getLocalDateKey(today);

  for (let i = 0; i < daysCount; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = getLocalDateKey(d);
    const resolved = resolveProfileForDate(dateKey);
    const hasReview = hasCompletedDailyReview(dateKey, resolved.profileId);

    items.push({
      dateKey,
      isToday: dateKey === todayKey,
      hasReview,
      profileId: resolved.profileId,
      profileName: resolved.profileName,
    });
  }

  return items;
}

/**
 * Reset all daily reviews (for testing / user data reset).
 */
export function clearAllDailyReviews(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
