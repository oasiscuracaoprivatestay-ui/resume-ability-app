/**
 * Super Diet-Ability — Exercise & Activity Engine (Phase 43)
 *
 * Pure, deterministic calculation and validation helpers for physical activity records.
 *
 * Invariants:
 * - Pure calculations only (zero side effects, zero storage mutation).
 * - No calories burned calculations.
 * - No physiological, metabolic, or weight-loss claims.
 * - Validates duration strictly between 1 and 720 minutes.
 * - Enforces strict calendar date (YYYY-MM-DD) and 24h time (HH:mm) format.
 */

import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_INTENSITIES,
  type ActivityCategory,
  type ActivityIntensity,
  type ActivityRecord,
  type CreateActivityInput,
  type DailyActivitySummary,
  type UpdateActivityInput,
} from './types';

/**
 * Validates whether a category is one of the eight canonical options.
 */
export function isValidCategory(cat: unknown): cat is ActivityCategory {
  return typeof cat === 'string' && (ACTIVITY_CATEGORIES as readonly string[]).includes(cat);
}

/**
 * Validates whether duration is a valid finite integer between 1 and 720 minutes.
 */
export function isValidDuration(dur: unknown): dur is number {
  return typeof dur === 'number' && Number.isInteger(dur) && dur >= 1 && dur <= 720;
}

/**
 * Validates an optional perceived intensity.
 */
export function isValidIntensity(intensity: unknown): intensity is ActivityIntensity | undefined {
  if (intensity === undefined || intensity === null) return true;
  return typeof intensity === 'string' && (ACTIVITY_INTENSITIES as readonly string[]).includes(intensity);
}

/**
 * Validates a calendar date key string (strictly YYYY-MM-DD with valid calendar bounds).
 * Rejects non-existent calendar dates (e.g., 2026-02-30 or 2026-13-01).
 */
export function isValidDateKey(dateKey: unknown): dateKey is string {
  if (typeof dateKey !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;

  const [yStr, mStr, dStr] = dateKey.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (y < 1970 || y > 2100) return false;
  if (m < 1 || m > 12) return false;

  // Verify that date round-trips accurately for actual days in month
  const maxDays = new Date(y, m, 0).getDate();
  return d >= 1 && d <= maxDays;
}

/**
 * Validates local 24-hour time format (HH:mm).
 */
export function isValidTime(time: unknown): time is string {
  if (typeof time !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Generates local 24h time string (HH:mm) for a given date.
 */
export function formatCurrentLocalTime(date = new Date()): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Validates input fields for creating a new activity record.
 * Returns null if valid, or a descriptive error string if invalid.
 */
export function validateCreateActivityInput(input: CreateActivityInput): string | null {
  if (!isValidCategory(input.category)) {
    return `Invalid activity category. Must be one of: ${ACTIVITY_CATEGORIES.join(', ')}.`;
  }

  if (!isValidDuration(input.durationMinutes)) {
    return 'Duration must be a whole number between 1 and 720 minutes.';
  }

  if (input.customName !== undefined && input.customName !== null) {
    if (typeof input.customName !== 'string') {
      return 'Custom activity name must be a string.';
    }
    if (input.customName.trim().length > 50) {
      return 'Custom activity name must not exceed 50 characters.';
    }
  }

  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      return 'Notes must be a string.';
    }
    if (input.notes.trim().length > 300) {
      return 'Notes must not exceed 300 characters.';
    }
  }

  if (input.intensity !== undefined && input.intensity !== null && !isValidIntensity(input.intensity)) {
    return `Invalid intensity. Must be one of: ${ACTIVITY_INTENSITIES.join(', ')}.`;
  }

  if (input.dateKey !== undefined && !isValidDateKey(input.dateKey)) {
    return 'Invalid activity date. Expected YYYY-MM-DD calendar format.';
  }

  if (input.time !== undefined && !isValidTime(input.time)) {
    return 'Invalid activity time. Expected HH:mm 24-hour format.';
  }

  return null;
}

/**
 * Validates input fields for updating an existing activity record.
 */
export function validateUpdateActivityInput(updates: UpdateActivityInput): string | null {
  if (updates.category !== undefined && !isValidCategory(updates.category)) {
    return `Invalid activity category. Must be one of: ${ACTIVITY_CATEGORIES.join(', ')}.`;
  }

  if (updates.durationMinutes !== undefined && !isValidDuration(updates.durationMinutes)) {
    return 'Duration must be a whole number between 1 and 720 minutes.';
  }

  if (updates.customName !== undefined && updates.customName !== null) {
    if (typeof updates.customName !== 'string') {
      return 'Custom activity name must be a string.';
    }
    if (updates.customName.trim().length > 50) {
      return 'Custom activity name must not exceed 50 characters.';
    }
  }

  if (updates.notes !== undefined && updates.notes !== null) {
    if (typeof updates.notes !== 'string') {
      return 'Notes must be a string.';
    }
    if (updates.notes.trim().length > 300) {
      return 'Notes must not exceed 300 characters.';
    }
  }

  if (updates.intensity !== undefined && updates.intensity !== null && !isValidIntensity(updates.intensity)) {
    return `Invalid intensity. Must be one of: ${ACTIVITY_INTENSITIES.join(', ')}.`;
  }

  if (updates.dateKey !== undefined && !isValidDateKey(updates.dateKey)) {
    return 'Invalid activity date. Expected YYYY-MM-DD calendar format.';
  }

  if (updates.time !== undefined && !isValidTime(updates.time)) {
    return 'Invalid activity time. Expected HH:mm 24-hour format.';
  }

  return null;
}

/**
 * Deterministically sorts activities:
 * 1. dateKey descending (most recent date first)
 * 2. time descending (latest time first)
 * 3. createdAt descending
 * 4. id ascending (stable tie-breaker)
 */
export function sortActivities(activities: ActivityRecord[]): ActivityRecord[] {
  return [...activities].sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return b.dateKey.localeCompare(a.dateKey);
    }
    if (a.time !== b.time) {
      return b.time.localeCompare(a.time);
    }
    if (a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calculates factual daily activity summary (count and total logged minutes).
 */
export function calculateDailyActivitySummary(
  activities: ActivityRecord[],
  dateKey: string
): DailyActivitySummary {
  const dayActivities = activities.filter((act) => act.dateKey === dateKey);
  const totalDurationMinutes = dayActivities.reduce((sum, act) => sum + act.durationMinutes, 0);

  return {
    dateKey,
    count: dayActivities.length,
    totalDurationMinutes,
  };
}

/**
 * Calculates total activities linked to a specific Challenge ID.
 */
export function calculateChallengeActivityCount(
  activities: ActivityRecord[],
  challengeId: string
): number {
  if (!challengeId) return 0;
  return activities.filter((act) => act.associatedChallengeId === challengeId).length;
}

/**
 * Sums total logged activity minutes across a collection of activities.
 */
export function calculateTotalActivityMinutes(activities: ActivityRecord[]): number {
  return activities.reduce((sum, act) => sum + act.durationMinutes, 0);
}
