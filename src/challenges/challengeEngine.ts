/**
 * SDA Ability Challenges System — Core Engine (Phase 37)
 *
 * Implements business logic, progress derivation, calendar date math,
 * and Resume-Ability event aggregation.
 *
 * SDA Recovery Philosophy:
 * - A Resume-Ability challenge is NOT a "no slip" challenge.
 * - Slips are opportunities to practice recovery and re-commitment.
 * - Zero punitive states; no "challenge failed" logic.
 * - Near-Slip, 20% OFF TRACK, planned unstructured, and neutral logs
 *   NEVER count as slips.
 * - When 0 slips occur, resumeRate is null ("No Resume opportunities yet"),
 *   never a misleading 0%.
 */

import type {
  ChallengeAbilityId,
  ChallengeDayProgress,
  ChallengeDayState,
  ChallengeDurationDays,
  ChallengeEventCounts,
  ChallengeInstance,
  ChallengeReminderConfig,
} from './types';
import {
  getActiveChallenge,
  saveActiveChallenge,
  archiveChallenge,
} from './challengeStorage';
import {
  getLocalDateKey,
  loadAllDietVerifications,
  isEligibleSlipRecord,
} from '../utils/dietVerificationStorage';
import { loadSlips } from '../utils';

// ── Reminder Validation Helpers (Phase 41B) ───────────────────────────────────

/**
 * Validates and normalizes challenge reminder configuration.
 *
 * Rules:
 * - If reminders are disabled: returns normalized config with reminderEnabled: false and reminderTimes: [].
 * - If reminders are enabled:
 *   - reminderTimes must be valid HH:mm format.
 *   - Duplicate times are rejected/deduplicated.
 *   - Times are sorted chronologically.
 *   - Must have at least 1 valid time and at most 6 valid times.
 *   - 1x expects 1 time, 2x expects 2 times, 3x expects 3 times, custom allows 1-6 times.
 */
export function validateAndNormalizeReminderConfig(config?: Partial<ChallengeReminderConfig>): ChallengeReminderConfig {
  if (!config || !config.reminderEnabled) {
    return {
      reminderEnabled: false,
      reminderFrequency: config?.reminderFrequency || '1x',
      reminderTimes: [],
    };
  }

  const validFrequencies = ['1x', '2x', '3x', 'custom'] as const;
  const frequency = validFrequencies.includes(config.reminderFrequency as any)
    ? (config.reminderFrequency as ChallengeReminderConfig['reminderFrequency'])
    : '1x';

  const rawTimes = Array.isArray(config.reminderTimes) ? config.reminderTimes : [];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  // Validate format and deduplicate preserving chronological order
  const uniqueTimes = Array.from(new Set(rawTimes.filter(t => typeof t === 'string' && timeRegex.test(t.trim())).map(t => t.trim())));
  uniqueTimes.sort();

  if (uniqueTimes.length === 0) {
    throw new Error('At least one valid reminder time (HH:mm) is required when reminders are enabled.');
  }

  if (uniqueTimes.length > 6) {
    throw new Error('A maximum of 6 reminder times per day is supported.');
  }

  // Frequency preset validation
  if (frequency === '1x' && uniqueTimes.length !== 1) {
    // If multiple were provided, slice to 1
    uniqueTimes.splice(1);
  } else if (frequency === '2x' && uniqueTimes.length !== 2) {
    if (uniqueTimes.length > 2) uniqueTimes.splice(2);
  } else if (frequency === '3x' && uniqueTimes.length !== 3) {
    if (uniqueTimes.length > 3) uniqueTimes.splice(3);
  }

  return {
    reminderEnabled: true,
    reminderFrequency: frequency,
    reminderTimes: uniqueTimes,
  };
}

// ── Local Calendar Date Helpers ───────────────────────────────────────────────

/**
 * Validates a YYYY-MM-DD date key.
 */
export function isValidDateKey(dateKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
}

/**
 * Adds an integer number of calendar days to a local YYYY-MM-DD date key.
 */
export function addDaysToDateKey(dateKey: string, daysToAdd: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + daysToAdd);
  return getLocalDateKey(date);
}

/**
 * Returns the difference in calendar days (toDate - fromDate).
 * Returns positive if toDate is after fromDate.
 */
export function getCalendarDaysDiff(fromDateKey: string, toDateKey: string): number {
  const [y1, m1, d1] = fromDateKey.split('-').map(Number);
  const [y2, m2, d2] = toDateKey.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const diffMs = date2.getTime() - date1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Checks if targetDateKey is within [startDateKey, endDateKey] inclusive.
 */
export function isDateInRange(targetDateKey: string, startDateKey: string, endDateKey: string): boolean {
  return targetDateKey >= startDateKey && targetDateKey <= endDateKey;
}

// ── Event Aggregation Across Dates ────────────────────────────────────────────

/**
 * Aggregates verified diet slips and emergency slips for a single date key.
 * Strictly respects SDA boundaries:
 * - Excludes neutral logs
 * - Excludes 20% OFF TRACK
 * - Excludes near-slips
 * - Excludes planned unstructured eating
 * - Excludes on-track / adjusted on-track
 */
export function getDaySlipStats(dateKey: string): { slipsCount: number; resumedCount: number } {
  let slipsCount = 0;
  let resumedCount = 0;

  // 1. Check Diet Block Verifications
  const allVerifications = loadAllDietVerifications();
  const daily = allVerifications[dateKey];
  if (daily && Array.isArray(daily.entries)) {
    for (const entry of daily.entries) {
      if (isEligibleSlipRecord(entry)) {
        slipsCount++;
        if (entry.isResumed === true) {
          resumedCount++;
        }
      }
    }
  }

  // 2. Check emergency slip records (timer flow)
  try {
    const allSlips = loadSlips();
    for (const slip of allSlips) {
      const slipDateKey = getLocalDateKey(new Date(slip.timestamp));
      if (slipDateKey === dateKey) {
        // If this slip wasn't already logged as a block verification
        // (to prevent double counting if recorded in both, check uniqueness if needed)
        // Here we count recovered status as resumed
        if (slip.status === 'recovered') {
          // If we had no entries in verification or want to ensure timer slip is counted
          if (slipsCount === 0) {
            slipsCount++;
            resumedCount++;
          }
        }
      }
    }
  } catch {
    // Ignore storage issues in test/SSR
  }

  return { slipsCount, resumedCount };
}

/**
 * Aggregates challenge-wide event metrics across the challenge date range.
 */
export function calculateChallengeEventCounts(
  startDateKey: string,
  endDateKey: string,
  referenceDateKey: string,
  totalDays: number
): ChallengeEventCounts {
  let eligibleSlips = 0;
  let resumedSlips = 0;

  // We scan dates from startDate up to min(referenceDateKey, endDateKey)
  const maxDateKey = referenceDateKey < endDateKey ? referenceDateKey : endDateKey;
  const daysDiff = Math.max(0, getCalendarDaysDiff(startDateKey, maxDateKey));

  for (let i = 0; i <= daysDiff; i++) {
    const dKey = addDaysToDateKey(startDateKey, i);
    const { slipsCount, resumedCount } = getDaySlipStats(dKey);
    eligibleSlips += slipsCount;
    resumedSlips += resumedCount;
  }

  const unresumedSlips = Math.max(0, eligibleSlips - resumedSlips);
  const resumeRate = eligibleSlips > 0 ? Math.round((resumedSlips / eligibleSlips) * 100) : null;
  const daysCompleted = Math.min(totalDays, Math.max(0, getCalendarDaysDiff(startDateKey, referenceDateKey)));

  return {
    eligibleSlips,
    resumedSlips,
    unresumedSlips,
    resumeRate,
    hasResumeOpportunities: eligibleSlips > 0,
    daysCompleted,
    totalDays,
  };
}

// ── Progress & State Derivation ───────────────────────────────────────────────

/**
 * Derives current day, days remaining, progress percentage, and checks for completion.
 */
export function deriveChallengeProgress(
  instance: ChallengeInstance,
  referenceDateKey = getLocalDateKey()
): ChallengeInstance {
  // If already completed or cancelled, event counts remain frozen
  if (instance.status === 'completed' || instance.status === 'cancelled') {
    return instance;
  }

  const daysSinceStart = getCalendarDaysDiff(instance.startDate, referenceDateKey);
  const currentDay = Math.min(instance.durationDays, Math.max(1, daysSinceStart + 1));
  const daysRemaining = Math.max(0, instance.durationDays - currentDay);
  const progress = Math.min(1.0, Math.max(0, currentDay / instance.durationDays));

  const relevantEventCounts = calculateChallengeEventCounts(
    instance.startDate,
    instance.endDate,
    referenceDateKey,
    instance.durationDays
  );

  // Check if challenge duration has completed
  // Completed when reference date has passed the end date (referenceDateKey > endDate)
  const isTimeComplete = referenceDateKey > instance.endDate;

  if (isTimeComplete && instance.status === 'active') {
    const completedInstance: ChallengeInstance = {
      ...instance,
      status: 'completed',
      completedAt: Date.now(),
      currentDay: instance.durationDays,
      daysRemaining: 0,
      progress: 1.0,
      relevantEventCounts: {
        ...relevantEventCounts,
        daysCompleted: instance.durationDays,
      },
    };

    // Auto-archive completed challenge
    archiveChallenge(completedInstance);
    return completedInstance;
  }

  return {
    ...instance,
    currentDay,
    daysRemaining,
    progress,
    relevantEventCounts,
  };
}

/**
 * Computes daily breakdown array for visual progress indicators (dots / timeline).
 */
export function getChallengeDayBreakdown(
  instance: ChallengeInstance,
  referenceDateKey = getLocalDateKey()
): ChallengeDayProgress[] {
  const days: ChallengeDayProgress[] = [];

  for (let i = 1; i <= instance.durationDays; i++) {
    const dKey = addDaysToDateKey(instance.startDate, i - 1);
    const isToday = dKey === referenceDateKey;
    const isPast = dKey < referenceDateKey;
    const isFuture = dKey > referenceDateKey;

    const { slipsCount, resumedCount } = getDaySlipStats(dKey);
    const hasResumeOpportunity = slipsCount > 0;

    let state: ChallengeDayState;
    if (isFuture) {
      state = 'upcoming';
    } else if (isToday) {
      state = hasResumeOpportunity && resumedCount > 0 ? 'resume_practiced' : 'current';
    } else {
      // Past day
      if (hasResumeOpportunity) {
        state = resumedCount > 0 ? 'resume_practiced' : 'completed';
      } else {
        state = 'no_opportunity';
      }
    }

    days.push({
      dayIndex: i,
      dateKey: dKey,
      state,
      isToday,
      isPast,
      isFuture,
      slipsCount,
      resumedCount,
      hasResumeOpportunity,
    });
  }

  return days;
}

// ── Public Engine Operations ──────────────────────────────────────────────────

/**
 * Starts a new challenge instance.
 * Enforces the One Active Challenge rule.
 * Optionally accepts reminderConfig (Phase 41B) for behavioral triggers.
 */
export function startChallenge(
  abilityId: ChallengeAbilityId = 'resume-ability',
  durationDays: ChallengeDurationDays = 7,
  startDateKey = getLocalDateKey(),
  reminderConfig?: Partial<ChallengeReminderConfig>
): ChallengeInstance {
  const existing = getActiveChallenge();
  if (existing && existing.status === 'active') {
    // If the existing active challenge is actually time-completed, resolve it first
    const synced = deriveChallengeProgress(existing, startDateKey);
    if (synced.status === 'active') {
      throw new Error('An active challenge already exists. You must complete or cancel it before starting another.');
    }
  }

  const normalizedReminders = validateAndNormalizeReminderConfig(reminderConfig);
  const endDateKey = addDaysToDateKey(startDateKey, durationDays - 1);
  const now = Date.now();

  const initialInstance: ChallengeInstance = {
    id: `ch_${now}_${Math.random().toString(36).slice(2, 6)}`,
    abilityId,
    challengeType: 'resume-ability',
    durationDays,
    startDate: startDateKey,
    endDate: endDateKey,
    status: 'active',
    createdAt: now,
    startedAt: now,
    currentDay: 1,
    daysRemaining: Math.max(0, durationDays - 1),
    progress: Math.min(1.0, 1 / durationDays),
    relevantEventCounts: {
      eligibleSlips: 0,
      resumedSlips: 0,
      unresumedSlips: 0,
      resumeRate: null,
      hasResumeOpportunities: false,
      daysCompleted: 0,
      totalDays: durationDays,
    },
    reminderEnabled: normalizedReminders.reminderEnabled,
    reminderFrequency: normalizedReminders.reminderFrequency,
    reminderTimes: normalizedReminders.reminderTimes,
  };

  const derived = deriveChallengeProgress(initialInstance, startDateKey);
  saveActiveChallenge(derived);
  return derived;
}

/**
 * Synchronizes the active challenge against current date and stores updates.
 */
export function syncCurrentChallenge(referenceDateKey = getLocalDateKey()): ChallengeInstance | null {
  const active = getActiveChallenge();
  if (!active) return null;

  const updated = deriveChallengeProgress(active, referenceDateKey);
  if (updated.status === 'active') {
    saveActiveChallenge(updated);
  }
  return updated;
}

/**
 * Cancels the active challenge and archives it to history.
 */
export function cancelActiveChallenge(reason = 'User cancelled'): ChallengeInstance | null {
  const active = getActiveChallenge();
  if (!active || active.status !== 'active') return null;

  const cancelled: ChallengeInstance = {
    ...active,
    status: 'cancelled',
    cancelledAt: Date.now(),
    cancellationReason: reason,
  };

  archiveChallenge(cancelled);
  return cancelled;
}
