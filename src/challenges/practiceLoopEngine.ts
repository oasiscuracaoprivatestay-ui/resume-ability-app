/**
 * SDA Interactive Practice Loop Guidance Engine — Phase 5B.1
 *
 * Book 1: Resume-Ability (ACTIVE)
 * Book 2: Loss-Maintenance Ability (PREPARED ARCHITECTURE ONLY — NOT ACTIVATED)
 *
 * Implements Sergio Laurant's Book 1 practice flowchart as a deterministic,
 * context-aware guidance engine reading 100% from existing authoritative stores:
 *
 *   Structured Diet → Today → Daily Review → Weekly Review → Continue or Adjust Structure
 *
 * Strict Data-Integrity Invariants:
 * - Zero duplicate check-in, slip, resume, daily review, or challenge records.
 * - Zero hardcoded example meal times — all block times come strictly from `dietStorage`.
 * - Zero automatic Resume or milestone completion awards.
 * - Zero modifications to scoring/XP formulas.
 */

import type { ChallengeInstance } from './types';
import { addDaysToDateKey, calculateChallengePracticeStats } from './challengeEngine';
import type { NinetyDayJourneyView, NinetyDayMilestoneDay } from './ninetyDayJourneyStorage';
import { resolveNinetyDayJourneyView } from './ninetyDayJourneyStorage';
import {
  getActiveProfile,
  getDayPlanForDate,
  getBlockPrimaryDescription,
  getLocalDateKey,
  isOvernightBlock,
  loadDietStore,
  sortBlocks,
  timeToMinutes,
  type DayMode,
  type StructuredDietBlock,
} from '../utils/dietStorage';
import {
  getDailyDietVerification,
  getDailyVerificationStats,
  isEligibleSlipRecord,
} from '../utils/dietVerificationStorage';
import { loadSlips } from '../utils';
import { getCheckIns, type CheckInStatus } from '../utils/checkInStorage';
import { hasCompletedDailyReview } from '../utils/dailyReviewStorage';
import { loadProgressVictoriesStore } from '../utils/progressVictoriesStorage';
import {
  loadPracticeLoopStore,
  type EarlyDriftRecord,
  type FoodReadinessRecord,
  type MaintenanceAdjustmentRecord,
} from './book2PracticeStorage';

// ── Multi-Book Extensibility Registry (Book 1 & Book 2 Active in Phase 5B.2) ──

export type PracticeLoopBookId = 'book1_resume_ability' | 'book2_loss_maintenance';

export interface PracticeLoopBookDescriptor {
  id: PracticeLoopBookId;
  bookNumber: 1 | 2;
  abilityId: 'resume-ability' | 'loss-maintenance-ability';
  isEnabled: boolean;
}

export const PRACTICE_LOOP_BOOKS: readonly PracticeLoopBookDescriptor[] = [
  {
    id: 'book1_resume_ability',
    bookNumber: 1,
    abilityId: 'resume-ability',
    isEnabled: true,
  },
  {
    id: 'book2_loss_maintenance',
    bookNumber: 2,
    abilityId: 'loss-maintenance-ability',
    isEnabled: true,
  },
] as const;

// ── Guidance Domain Types ─────────────────────────────────────────────────────

export type PracticeCycleStepId = 'diet' | 'today' | 'daily-review' | 'weekly-review';

export type Book2PracticeCycleStepId =
  | 'blueprint'
  | 'today'
  | 'weekly-review'
  | 'adjustment';

export type PracticeGuidanceStateKind =
  | 'setup_structured_diet'
  | 'slip_recovery_next_block'
  | 'drifting_recovery'
  | 'resumed_confirmation'
  | 'pending_checkin'
  | 'next_meal_block'
  | 'next_fasting_block'
  | 'verify_remaining_blocks'
  | 'free_or_unstructured_day'
  | 'milestone_review_pending'
  | 'daily_review_pending'
  | 'weekly_review_pending'
  | 'cycle_complete_continue_or_adjust';

export type Book2PracticeGuidanceStateKind =
  | 'b2_setup_blueprint'
  | 'b2_food_readiness_incomplete'
  | 'b2_food_readiness_ready'
  | 'b2_early_drift_active'
  | 'b2_early_drift_addressed'
  | 'b2_pending_checkin'
  | 'b2_next_meal_block'
  | 'b2_next_fasting_block'
  | 'b2_verify_remaining_blocks'
  | 'b2_free_or_unstructured_day'
  | 'b2_milestone_review_pending'
  | 'b2_weekly_review_pending'
  | 'b2_test_one_adjustment'
  | 'b2_continue_structure';

export type PracticeGuidanceActionTarget =
  | 'open_structured_diet'
  | 'open_checkin_modal'
  | 'open_resume_modal'
  | 'open_detailed_slip'
  | 'open_recovery_timer'
  | 'open_daily_review'
  | 'open_weekly_review'
  | 'open_milestone_review'
  | 'open_b2_food_readiness'
  | 'open_b2_early_drift'
  | 'open_b2_weekly_review'
  | 'open_b2_adjustment'
  | 'open_b2_timer_shortcut';

export interface NextScheduledBlockInfo {
  blockId: string;
  startTime: string;
  endTime: string;
  blockTypeKey: string;
  blockTypeLabel: string;
  primaryDescription: string;
  isFasting: boolean;
  isTomorrow: boolean;
  timingState: 'active_now' | 'upcoming_today' | 'tomorrow';
}

export interface Book1PracticeGuidance {
  bookId: 'book1_resume_ability';
  stateKind: PracticeGuidanceStateKind;
  activeCycleStep: PracticeCycleStepId | null;
  // Underlying factual signals
  isStructuredDietConfigured: boolean;
  dayMode: DayMode;
  plannedBlocksCount: number;
  reportedBlocksCount: number;
  unverifiedBlocksCount: number;
  allTodayBlocksVerified: boolean;
  todayCheckedIn: boolean;
  todayLatestStatus?: CheckInStatus;
  hasActiveUnresumedSlip: boolean;
  hasActiveDrift: boolean;
  hasResumedToday: boolean;
  dailyReviewCompletedToday: boolean;
  weeklyReviewCompletedThisWeek: boolean;
  isWeeklyReviewDue: boolean;
  pendingMilestoneDay: NinetyDayMilestoneDay | null;
  // Next scheduled meal / fasting block (null if none exists — never fabricated)
  nextScheduledBlock: NextScheduledBlockInfo | null;
  // Contextual actions for "Your Next Step" & "Continue My Journey"
  primaryAction: PracticeGuidanceActionTarget;
  secondaryAction?: PracticeGuidanceActionTarget;
}

// ── Block Classification & Next-Block Resolution ──────────────────────────────

export function isFastingStructureBlock(block: Pick<StructuredDietBlock, 'type'>): boolean {
  const t = (block.type || '').trim().toLowerCase();
  return t === 'micro_fasting' || t === 'kitchen_closed';
}

function getLocalizedBlockTypeLabel(blockType: string, t?: Record<string, any>): string {
  const clean = (blockType || '').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();
  if (t) {
    const trans = t[`sdb_type_${lower}`] || t[`sdb_type_${clean}`];
    if (typeof trans === 'string' && trans.trim()) {
      return trans.trim();
    }
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1).replace(/_/g, ' ');
}

function buildBlockInfo(
  block: StructuredDietBlock,
  timingState: 'active_now' | 'upcoming_today' | 'tomorrow',
  t?: Record<string, any>
): NextScheduledBlockInfo {
  const isFasting = isFastingStructureBlock(block);
  const blockTypeLabel = getLocalizedBlockTypeLabel(block.type, t);
  const primaryDescription = getBlockPrimaryDescription(block, t) || blockTypeLabel;
  return {
    blockId: block.id,
    startTime: block.startTime,
    endTime: block.endTime,
    blockTypeKey: (block.type || '').trim().toLowerCase(),
    blockTypeLabel,
    primaryDescription,
    isFasting,
    isTomorrow: timingState === 'tomorrow',
    timingState,
  };
}

/**
 * Resolves the user's actual next scheduled meal or fasting block from `dietStorage`.
 * Never returns hardcoded or example times. Returns `null` if no scheduled block can be determined.
 */
export function resolveNextScheduledBlockForDate(options?: {
  now?: Date;
  t?: Record<string, any>;
  includeTomorrowFallback?: boolean;
}): NextScheduledBlockInfo | null {
  const now = options?.now || new Date();
  const t = options?.t;
  const includeTomorrow = options?.includeTomorrowFallback ?? true;

  const todayDateKey = getLocalDateKey(now);
  const store = loadDietStore();
  const activeProfile = getActiveProfile(store);
  const dayPlan = getDayPlanForDate(activeProfile.diet, todayDateKey);

  if (dayPlan.mode === 'structured' && dayPlan.blocks.length === 0) {
    return null;
  }

  const sortedToday = sortBlocks(dayPlan.blocks);
  const dailyVerif = getDailyDietVerification(todayDateKey);
  const verifiedPlannedIds = new Set(
    (dailyVerif?.entries || [])
      .filter((e) => !e.isUnplanned && e.plannedBlockId)
      .map((e) => e.plannedBlockId)
  );

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const block of sortedToday) {
    if (verifiedPlannedIds.has(block.id)) continue;

    const startMin = timeToMinutes(block.startTime);
    const endMin = timeToMinutes(block.endTime);
    const overnight = isOvernightBlock(block);
    const effectiveEndMin = overnight ? endMin + 1440 : endMin;

    const isActiveNow =
      (startMin <= nowMinutes && nowMinutes <= effectiveEndMin) ||
      (overnight && nowMinutes <= endMin);

    if (isActiveNow) {
      return buildBlockInfo(block, 'active_now', t);
    }
    if (startMin > nowMinutes) {
      return buildBlockInfo(block, 'upcoming_today', t);
    }
  }

  if (includeTomorrow) {
    const tomorrowDateKey = addDaysToDateKey(todayDateKey, 1);
    const tomorrowPlan = getDayPlanForDate(activeProfile.diet, tomorrowDateKey);
    const sortedTomorrow = sortBlocks(tomorrowPlan.blocks);
    if (sortedTomorrow.length > 0) {
      return buildBlockInfo(sortedTomorrow[0], 'tomorrow', t);
    }
  }

  return null;
}

// ── Duplicate Resume Check-In Guard ───────────────────────────────────────────

/**
 * Validates whether recording a new `'resumed'` check-in right now would duplicate
 * an already-active `'resumed'` check-in with no intervening slip event.
 */
export function isDuplicateConsecutiveResume(
  activeChallenge: ChallengeInstance | null | undefined,
  dateKey = getLocalDateKey()
): boolean {
  const todayChallengeCheckIns = (activeChallenge?.checkIns || []).filter(
    (c) => c.dateKey === dateKey
  );

  let latestStatus: CheckInStatus | undefined;
  let latestTimestamp = 0;

  if (todayChallengeCheckIns.length > 0) {
    const last = todayChallengeCheckIns[todayChallengeCheckIns.length - 1];
    latestStatus = last.status;
    latestTimestamp = last.timestamp;
  } else {
    const globalToday = getCheckIns().filter((c) => c.date === dateKey);
    if (globalToday.length > 0) {
      const last = globalToday[globalToday.length - 1];
      latestStatus = last.status;
      latestTimestamp = Date.parse(last.timestamp) || 0;
    }
  }

  if (latestStatus !== 'resumed') {
    return false;
  }

  // Check if an unresumed diet slip or newer slip occurred after that resume
  const dailyVerif = getDailyDietVerification(dateKey);
  const hasUnresumedOrNewerDietSlip = (dailyVerif?.entries || []).some(
    (e) => isEligibleSlipRecord(e) && (!e.isResumed || e.verifiedAt > latestTimestamp)
  );
  if (hasUnresumedOrNewerDietSlip) {
    return false;
  }

  const [y, m, d] = dateKey.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  const hasNewerEmergencySlip = loadSlips().some(
    (s) => s.timestamp >= dayStart && s.timestamp <= dayEnd && s.timestamp > latestTimestamp
  );
  if (hasNewerEmergencySlip) {
    return false;
  }

  return true;
}

// ── Rolling 7-Day Cadence Helper for Weekly Reflections ──────────────────────

/**
 * Evaluates Weekly Review status on a rolling 7-day cadence (today - 6 days .. today)
 * anchored to the user's actual journey/challenge progress and saved review history.
 * Never automatically marks a Weekly Review completed.
 */
function evaluateRollingWeeklyReview(params: {
  todayDateKey: string;
  activeChallenge: ChallengeInstance | null;
  journey: NinetyDayJourneyView;
}): { completedInRollingWindow: boolean; isDue: boolean } {
  const { todayDateKey, activeChallenge, journey } = params;
  const rollingWindowStartKey = addDaysToDateKey(todayDateKey, -6);
  const pvStore = loadProgressVictoriesStore();

  const completedInRollingWindow = pvStore.weeklyReflections.some((r) => {
    const recordedKey = getLocalDateKey(new Date(r.updatedAt || r.createdAt));
    const effectiveKey = r.weekStartDateKey || recordedKey;
    return (
      (effectiveKey >= rollingWindowStartKey && effectiveKey <= todayDateKey) ||
      (recordedKey >= rollingWindowStartKey && recordedKey <= todayDateKey)
    );
  });

  const challengeDay =
    activeChallenge && activeChallenge.status === 'active'
      ? activeChallenge.currentDay
      : 0;
  const journeyDay = journey.isActive ? journey.currentDay : 0;
  const activeSpanDay = Math.max(challengeDay, journeyDay);

  if (completedInRollingWindow) {
    return { completedInRollingWindow: true, isDue: false };
  }

  if (activeSpanDay > 0) {
    return {
      completedInRollingWindow: false,
      isDue: activeSpanDay >= 7,
    };
  }

  // Standalone practice without an active challenge/journey: due if prior reviews exist and >6 days elapsed
  return {
    completedInRollingWindow: false,
    isDue: pvStore.weeklyReflections.length > 0,
  };
}

// ── Main Book 1 Practice Loop Guidance Evaluator ──────────────────────────────

export function evaluateBook1PracticeLoopGuidance(params?: {
  activeChallenge?: ChallengeInstance | null;
  ninetyDayJourney?: NinetyDayJourneyView | null;
  now?: Date;
  t?: Record<string, any>;
}): Book1PracticeGuidance {
  const now = params?.now || new Date();
  const t = params?.t;
  const todayDateKey = getLocalDateKey(now);
  const activeChallenge = params?.activeChallenge ?? null;
  const journey =
    params?.ninetyDayJourney ?? resolveNinetyDayJourneyView(activeChallenge, todayDateKey);

  // 1. Structured Diet inspection
  const dietStore = loadDietStore();
  const activeProfile = getActiveProfile(dietStore);
  const dayPlan = getDayPlanForDate(activeProfile.diet, todayDateKey);
  const sortedBlocks = sortBlocks(dayPlan.blocks);
  const scheduledIds = sortedBlocks.map((b) => b.id);
  const dietStats = getDailyVerificationStats(sortedBlocks.length, todayDateKey, scheduledIds);

  const isStructuredDietConfigured =
    dayPlan.mode === 'free' || dayPlan.mode === 'unstructured' || sortedBlocks.length > 0;

  // 2. Challenge & Daily Check-In status
  const practiceStats =
    activeChallenge && activeChallenge.status === 'active'
      ? calculateChallengePracticeStats(activeChallenge, todayDateKey)
      : null;

  const todayChallengeCheckIns = (activeChallenge?.checkIns || []).filter(
    (c) => c.dateKey === todayDateKey
  );
  const latestChallengeCheckIn =
    todayChallengeCheckIns.length > 0
      ? todayChallengeCheckIns[todayChallengeCheckIns.length - 1]
      : null;

  const todayCheckedIn = practiceStats
    ? practiceStats.todayCheckedIn
    : getCheckIns().some((c) => c.date === todayDateKey);

  const todayLatestStatus = practiceStats?.todayLatestStatus ?? latestChallengeCheckIn?.status;

  // 3. Slip / Drift / Resume inspection across authoritative stores
  const dailyVerif = getDailyDietVerification(todayDateKey);
  const verifEntries = dailyVerif?.entries || [];

  const unresumedDietSlips = verifEntries.filter(
    (e) => isEligibleSlipRecord(e) && !e.isResumed
  );
  const activeDietDrifts = verifEntries.filter(
    (e) => e.driftState === 'started' || e.driftState === 'drifting'
  );
  const latestResumedDietTs = verifEntries
    .filter((e) => e.isResumed === true)
    .reduce((max, e) => Math.max(max, e.resumedAt || e.verifiedAt || 0), 0);

  const [yr, mo, da] = todayDateKey.split('-').map(Number);
  const todayStartMs = new Date(yr, mo - 1, da, 0, 0, 0, 0).getTime();
  const todayEndMs = new Date(yr, mo - 1, da, 23, 59, 59, 999).getTime();
  const todayEmergencySlips = loadSlips().filter(
    (s) => s.timestamp >= todayStartMs && s.timestamp <= todayEndMs
  );
  const latestUnrecoveredEmergencyTs = todayEmergencySlips
    .filter((s) => s.status === 'relapsed')
    .reduce((max, s) => Math.max(max, s.timestamp), 0);

  const latestSlipCheckInTs =
    latestChallengeCheckIn?.status === 'slip' ? latestChallengeCheckIn.timestamp : 0;
  const latestResumeCheckInTs =
    latestChallengeCheckIn?.status === 'resumed' ? latestChallengeCheckIn.timestamp : 0;

  const latestSlipSignalTs = Math.max(
    latestSlipCheckInTs,
    latestUnrecoveredEmergencyTs,
    unresumedDietSlips.reduce((max, e) => Math.max(max, e.verifiedAt || 0), 0)
  );
  const latestResumeSignalTs = Math.max(latestResumeCheckInTs, latestResumedDietTs);

  const hasActiveUnresumedSlip =
    unresumedDietSlips.length > 0 ||
    (latestChallengeCheckIn?.status === 'slip' && latestResumeSignalTs < latestSlipCheckInTs) ||
    (latestUnrecoveredEmergencyTs > 0 && latestResumeSignalTs < latestUnrecoveredEmergencyTs);

  const hasActiveDrift =
    !hasActiveUnresumedSlip &&
    (activeDietDrifts.length > 0 ||
      latestChallengeCheckIn?.status === 'off-structure-aware' ||
      latestChallengeCheckIn?.status === 'near-slip');

  const hasResumedToday =
    !hasActiveUnresumedSlip &&
    !hasActiveDrift &&
    (latestChallengeCheckIn?.status === 'resumed' ||
      (latestResumeSignalTs > 0 && latestResumeSignalTs >= latestSlipSignalTs));

  // 4. Daily Review & Rolling 7-Day Weekly Review inspection
  const dailyReviewCompletedToday = hasCompletedDailyReview(todayDateKey, activeProfile.id);

  const rollingWeekly = evaluateRollingWeeklyReview({
    todayDateKey,
    activeChallenge,
    journey,
  });
  const weeklyReviewCompletedThisWeek = rollingWeekly.completedInRollingWindow;
  const isWeeklyReviewDue = rollingWeekly.isDue;

  // 5. 90-Day Milestone Review inspection
  const pendingMilestone =
    journey.isActive && journey.pendingMilestoneReviews.length > 0
      ? journey.pendingMilestoneReviews[journey.pendingMilestoneReviews.length - 1]
      : null;
  const pendingMilestoneDay = pendingMilestone ? pendingMilestone.day : null;

  // 6. Next Scheduled Block resolution
  const nextScheduledBlock = isStructuredDietConfigured
    ? resolveNextScheduledBlockForDate({ now, t, includeTomorrowFallback: true })
    : null;

  const hasRemainingTodayBlock = Boolean(
    nextScheduledBlock && !nextScheduledBlock.isTomorrow
  );
  const unverifiedBlocksCount = Math.max(
    0,
    dietStats.plannedCount - dietStats.reportedCount
  );
  const allTodayBlocksVerified =
    sortedBlocks.length > 0 && dietStats.reportedCount >= sortedBlocks.length;

  const baseResult = {
    bookId: 'book1_resume_ability' as const,
    isStructuredDietConfigured,
    dayMode: dayPlan.mode,
    plannedBlocksCount: dietStats.plannedCount,
    reportedBlocksCount: dietStats.reportedCount,
    unverifiedBlocksCount,
    allTodayBlocksVerified,
    todayCheckedIn,
    todayLatestStatus,
    hasActiveUnresumedSlip,
    hasActiveDrift,
    hasResumedToday,
    dailyReviewCompletedToday,
    weeklyReviewCompletedThisWeek,
    isWeeklyReviewDue,
    pendingMilestoneDay,
    nextScheduledBlock,
  };

  // ── Decision Tree (Book 1 Flowchart) ────────────────────────────────────────

  // A. Structured Diet is NOT configured
  if (!isStructuredDietConfigured) {
    return {
      ...baseResult,
      stateKind: 'setup_structured_diet',
      activeCycleStep: 'diet',
      primaryAction: 'open_structured_diet',
    };
  }

  // C. Active Unresumed Slip -> Guide toward next scheduled meal/fasting block + detailed slip access (never auto-resume)
  if (hasActiveUnresumedSlip) {
    return {
      ...baseResult,
      stateKind: 'slip_recovery_next_block',
      activeCycleStep: 'today',
      primaryAction: 'open_resume_modal',
      secondaryAction: 'open_detailed_slip',
    };
  }

  // E. Drifting / Off-Structure-Aware -> Guide to awareness / 15-min urge delay / resume
  if (hasActiveDrift) {
    return {
      ...baseResult,
      stateKind: 'drifting_recovery',
      activeCycleStep: 'today',
      primaryAction: 'open_recovery_timer',
      secondaryAction: 'open_resume_modal',
    };
  }

  // F & G. End-of-day / All blocks verified -> Daily Review -> Weekly Review -> Continue or Adjust
  const isEndOfScheduleForToday =
    allTodayBlocksVerified ||
    (sortedBlocks.length > 0 && !hasRemainingTodayBlock && todayCheckedIn && unverifiedBlocksCount === 0);

  // D. Resume recorded today -> Show Resume confirmation AND the next meaningful step
  //    (Next scheduled meal/fasting block during the day, or Daily Review when schedule is complete)
  if (hasResumedToday && !dailyReviewCompletedToday) {
    return {
      ...baseResult,
      stateKind: 'resumed_confirmation',
      activeCycleStep: isEndOfScheduleForToday ? 'daily-review' : 'today',
      primaryAction: isEndOfScheduleForToday ? 'open_daily_review' : 'open_structured_diet',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : undefined,
    };
  }

  // 90-Day Milestone Review Pending (when checked in today or on exact milestone day without blocking unresumed slip)
  if (pendingMilestoneDay !== null && todayCheckedIn && (journey.currentDay === pendingMilestoneDay || isEndOfScheduleForToday)) {
    return {
      ...baseResult,
      stateKind: 'milestone_review_pending',
      activeCycleStep: dailyReviewCompletedToday ? 'weekly-review' : 'today',
      primaryAction: 'open_milestone_review',
      secondaryAction: 'open_structured_diet',
    };
  }

  // F. Daily Review Pending (all blocks verified today, or end of day after check-in)
  if (isEndOfScheduleForToday && !dailyReviewCompletedToday) {
    return {
      ...baseResult,
      stateKind: 'daily_review_pending',
      activeCycleStep: 'daily-review',
      primaryAction: 'open_daily_review',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : undefined,
    };
  }

  // G. Daily Review Completed -> Weekly Review Pending (rolling 7-day cadence when due)
  if (dailyReviewCompletedToday && isWeeklyReviewDue) {
    return {
      ...baseResult,
      stateKind: 'weekly_review_pending',
      activeCycleStep: 'weekly-review',
      primaryAction: 'open_weekly_review',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : 'open_structured_diet',
    };
  }

  // Cycle Complete -> Continue or Adjust Structure (never auto-marks Weekly Review complete)
  if (dailyReviewCompletedToday && !isWeeklyReviewDue) {
    return {
      ...baseResult,
      stateKind: 'cycle_complete_continue_or_adjust',
      activeCycleStep: weeklyReviewCompletedThisWeek ? 'weekly-review' : 'daily-review',
      primaryAction: pendingMilestoneDay ? 'open_milestone_review' : 'open_structured_diet',
    };
  }

  // Free or Unstructured Day with 0 fixed blocks
  if ((dayPlan.mode === 'free' || dayPlan.mode === 'unstructured') && sortedBlocks.length === 0) {
    if (!todayCheckedIn) {
      return {
        ...baseResult,
        stateKind: 'pending_checkin',
        activeCycleStep: 'today',
        primaryAction: 'open_checkin_modal',
        secondaryAction: 'open_structured_diet',
      };
    }
    return {
      ...baseResult,
      stateKind: 'free_or_unstructured_day',
      activeCycleStep: 'today',
      primaryAction: !dailyReviewCompletedToday ? 'open_daily_review' : 'open_structured_diet',
    };
  }

  // Pending Check-In today (still surfaces actual next scheduled meal/fasting block!)
  if (!todayCheckedIn) {
    return {
      ...baseResult,
      stateKind: 'pending_checkin',
      activeCycleStep: 'today',
      primaryAction: 'open_checkin_modal',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : 'open_structured_diet',
    };
  }

  // Resume confirmation when checked in as 'resumed' even if past blocks remain unverified
  if (hasResumedToday) {
    return {
      ...baseResult,
      stateKind: 'resumed_confirmation',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : undefined,
    };
  }

  // B. Structured Diet exists -> Next Scheduled Fasting or Meal Block
  if (hasRemainingTodayBlock && nextScheduledBlock) {
    if (nextScheduledBlock.isFasting) {
      return {
        ...baseResult,
        stateKind: 'next_fasting_block',
        activeCycleStep: 'today',
        primaryAction: 'open_structured_diet',
        secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : undefined,
      };
    }
    return {
      ...baseResult,
      stateKind: 'next_meal_block',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction: pendingMilestoneDay ? 'open_milestone_review' : undefined,
    };
  }

  // Past today's block times, unverified blocks remain
  if (unverifiedBlocksCount > 0) {
    return {
      ...baseResult,
      stateKind: 'verify_remaining_blocks',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
    };
  }

  return {
    ...baseResult,
    stateKind: 'daily_review_pending',
    activeCycleStep: 'daily-review',
    primaryAction: 'open_daily_review',
  };
}

// ── Book 2: Loss-Maintenance Interactive Guidance Engine (Phase 5B.2) ─────────

export interface Book2PracticeGuidance {
  bookId: 'book2_loss_maintenance';
  stateKind: Book2PracticeGuidanceStateKind;
  activeCycleStep: Book2PracticeCycleStepId | null;
  // Underlying factual signals
  isStructuredDietConfigured: boolean;
  activeProfileName: string;
  dayMode: DayMode;
  plannedBlocksCount: number;
  reportedBlocksCount: number;
  unverifiedBlocksCount: number;
  allTodayBlocksVerified: boolean;
  todayCheckedIn: boolean;
  todayLatestStatus?: CheckInStatus;
  weeklyReviewCompletedThisWeek: boolean;
  isWeeklyReviewDue: boolean;
  pendingMilestoneDay: NinetyDayMilestoneDay | null;
  // Book 2 specific non-Slip signals
  foodReadinessToday: FoodReadinessRecord | null;
  earlyDriftToday: EarlyDriftRecord | null;
  activeAdjustment: MaintenanceAdjustmentRecord | null;
  adjustmentHistory: MaintenanceAdjustmentRecord[];
  // Next scheduled meal / fasting block (null if none exists — never fabricated)
  nextScheduledBlock: NextScheduledBlockInfo | null;
  // Contextual actions for "Your Next Step" & "Continue My Journey"
  primaryAction: PracticeGuidanceActionTarget;
  secondaryAction?: PracticeGuidanceActionTarget;
}

/**
 * Evaluates Sergio Laurant's Book 2 (Loss-Maintenance Ability) core practice loop:
 *
 *   Structured Diet Blueprint → Today (Food Readiness / Early Signs of Drift)
 *     → Weekly Review → Test One Adjustment → Continue the Structure
 *
 * Strictly preserves Book 1 events without conflating Drift with Slip or Adjustment with Diet Edit.
 */
export function evaluateBook2PracticeLoopGuidance(params?: {
  activeChallenge?: ChallengeInstance | null;
  ninetyDayJourney?: NinetyDayJourneyView | null;
  now?: Date;
  t?: Record<string, any>;
}): Book2PracticeGuidance {
  const now = params?.now || new Date();
  const t = params?.t;
  const todayDateKey = getLocalDateKey(now);
  const activeChallenge = params?.activeChallenge ?? null;
  const journey =
    params?.ninetyDayJourney ?? resolveNinetyDayJourneyView(activeChallenge, todayDateKey);

  // 1. Structured Diet Blueprint inspection
  const dietStore = loadDietStore();
  const activeProfile = getActiveProfile(dietStore);
  const dayPlan = getDayPlanForDate(activeProfile.diet, todayDateKey);
  const sortedBlocks = sortBlocks(dayPlan.blocks);
  const scheduledIds = sortedBlocks.map((b) => b.id);
  const dietStats = getDailyVerificationStats(sortedBlocks.length, todayDateKey, scheduledIds);

  const isStructuredDietConfigured =
    dayPlan.mode === 'free' || dayPlan.mode === 'unstructured' || sortedBlocks.length > 0;

  // 2. Check-In & Challenge context
  const practiceStats =
    activeChallenge && activeChallenge.status === 'active'
      ? calculateChallengePracticeStats(activeChallenge, todayDateKey)
      : null;

  const todayChallengeCheckIns = (activeChallenge?.checkIns || []).filter(
    (c) => c.dateKey === todayDateKey
  );
  const latestChallengeCheckIn =
    todayChallengeCheckIns.length > 0
      ? todayChallengeCheckIns[todayChallengeCheckIns.length - 1]
      : null;

  const todayCheckedIn = practiceStats
    ? practiceStats.todayCheckedIn
    : getCheckIns().some((c) => c.date === todayDateKey);
  const todayLatestStatus = practiceStats?.todayLatestStatus ?? latestChallengeCheckIn?.status;

  // 3. Rolling 7-Day Weekly Review & 90-Day Milestone inspection
  const rollingWeekly = evaluateRollingWeeklyReview({
    todayDateKey,
    activeChallenge,
    journey,
  });
  const weeklyReviewCompletedThisWeek = rollingWeekly.completedInRollingWindow;
  const isWeeklyReviewDue = rollingWeekly.isDue;

  const pendingMilestone =
    journey.isActive && journey.pendingMilestoneReviews.length > 0
      ? journey.pendingMilestoneReviews[journey.pendingMilestoneReviews.length - 1]
      : null;
  const pendingMilestoneDay = pendingMilestone ? pendingMilestone.day : null;

  // 4. Book 2 Domain Signals (Food Readiness, Early Drift, Test One Adjustment)
  const plStore = loadPracticeLoopStore();
  const foodReadinessToday = plStore.foodReadinessByDate[todayDateKey] || null;
  const earlyDriftToday = plStore.earlyDriftByDate[todayDateKey] || null;
  const activeAdjustment =
    plStore.activeAdjustment && plStore.activeAdjustment.status === 'testing'
      ? plStore.activeAdjustment
      : null;
  const adjustmentHistory = plStore.adjustmentHistory || [];
  const continuedStructureToday = plStore.lastStructureContinuedDateKey === todayDateKey;

  // 5. Next Scheduled Block resolution (real data only — never hardcoded)
  const nextScheduledBlock = isStructuredDietConfigured
    ? resolveNextScheduledBlockForDate({ now, t, includeTomorrowFallback: true })
    : null;

  const hasRemainingTodayBlock = Boolean(
    nextScheduledBlock && !nextScheduledBlock.isTomorrow
  );
  const unverifiedBlocksCount = Math.max(
    0,
    dietStats.plannedCount - dietStats.reportedCount
  );
  const allTodayBlocksVerified =
    sortedBlocks.length > 0 && dietStats.reportedCount >= sortedBlocks.length;
  const isEndOfScheduleForToday =
    allTodayBlocksVerified ||
    (sortedBlocks.length > 0 && !hasRemainingTodayBlock && todayCheckedIn && unverifiedBlocksCount === 0);

  const baseResult = {
    bookId: 'book2_loss_maintenance' as const,
    isStructuredDietConfigured,
    activeProfileName: activeProfile.name,
    dayMode: dayPlan.mode,
    plannedBlocksCount: dietStats.plannedCount,
    reportedBlocksCount: dietStats.reportedCount,
    unverifiedBlocksCount,
    allTodayBlocksVerified,
    todayCheckedIn,
    todayLatestStatus,
    weeklyReviewCompletedThisWeek,
    isWeeklyReviewDue,
    pendingMilestoneDay,
    foodReadinessToday,
    earlyDriftToday,
    activeAdjustment,
    adjustmentHistory,
    nextScheduledBlock,
  };

  // A. Structured Diet Blueprint NOT configured
  if (!isStructuredDietConfigured) {
    return {
      ...baseResult,
      stateKind: 'b2_setup_blueprint',
      activeCycleStep: 'blueprint',
      primaryAction: 'open_structured_diet',
    };
  }

  // C1. Food Readiness flagged as incomplete ('needs_prep')
  if (foodReadinessToday?.status === 'needs_prep') {
    return {
      ...baseResult,
      stateKind: 'b2_food_readiness_incomplete',
      activeCycleStep: 'today',
      primaryAction: 'open_b2_food_readiness',
      secondaryAction: 'open_structured_diet',
    };
  }

  // D1. Early Signs of Drift acknowledged (needs planned response)
  if (earlyDriftToday?.status === 'acknowledged') {
    return {
      ...baseResult,
      stateKind: 'b2_early_drift_active',
      activeCycleStep: 'today',
      primaryAction: 'open_b2_early_drift',
      secondaryAction: 'open_structured_diet',
    };
  }

  // 90-Day Milestone Review Pending (shared 90-day journey integration)
  if (
    pendingMilestoneDay !== null &&
    todayCheckedIn &&
    (journey.currentDay === pendingMilestoneDay || isEndOfScheduleForToday)
  ) {
    return {
      ...baseResult,
      stateKind: 'b2_milestone_review_pending',
      activeCycleStep: weeklyReviewCompletedThisWeek ? 'adjustment' : 'today',
      primaryAction: 'open_milestone_review',
      secondaryAction: 'open_structured_diet',
    };
  }

  // E. Rolling 7-Day Weekly Review Pending (when today's blocks are done or checked in at end of schedule)
  if (isEndOfScheduleForToday && isWeeklyReviewDue) {
    return {
      ...baseResult,
      stateKind: 'b2_weekly_review_pending',
      activeCycleStep: 'weekly-review',
      primaryAction: 'open_b2_weekly_review',
      secondaryAction: activeAdjustment ? 'open_b2_adjustment' : 'open_structured_diet',
    };
  }

  // F. End of schedule & Weekly Review satisfied -> Test One Adjustment or Continue the Structure
  if (isEndOfScheduleForToday && !isWeeklyReviewDue) {
    if (weeklyReviewCompletedThisWeek && !activeAdjustment && !continuedStructureToday) {
      return {
        ...baseResult,
        stateKind: 'b2_test_one_adjustment',
        activeCycleStep: 'adjustment',
        primaryAction: 'open_b2_adjustment',
        secondaryAction: 'open_structured_diet',
      };
    }
    return {
      ...baseResult,
      stateKind: 'b2_continue_structure',
      activeCycleStep: 'adjustment',
      primaryAction: 'open_structured_diet',
      secondaryAction: 'open_b2_adjustment',
    };
  }

  // D2 & C2. Active today confirmations for Early Drift Addressed or Food Readiness Action Recorded
  const driftUpdatedTs = earlyDriftToday?.addressedAt || earlyDriftToday?.acknowledgedAt || 0;
  const readinessUpdatedTs = foodReadinessToday?.updatedAt || 0;

  if (earlyDriftToday?.status === 'addressed' && driftUpdatedTs >= readinessUpdatedTs) {
    return {
      ...baseResult,
      stateKind: 'b2_early_drift_addressed',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction:
        earlyDriftToday.plannedResponse === 'pause_15_min'
          ? 'open_b2_timer_shortcut'
          : 'open_b2_food_readiness',
    };
  }

  if (
    (foodReadinessToday?.status === 'action_planned' || foodReadinessToday?.status === 'ready') &&
    readinessUpdatedTs > 0
  ) {
    return {
      ...baseResult,
      stateKind: 'b2_food_readiness_ready',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction: 'open_b2_early_drift',
    };
  }

  // Free or Unstructured Day with 0 fixed blocks
  if ((dayPlan.mode === 'free' || dayPlan.mode === 'unstructured') && sortedBlocks.length === 0) {
    if (!todayCheckedIn) {
      return {
        ...baseResult,
        stateKind: 'b2_pending_checkin',
        activeCycleStep: 'today',
        primaryAction: 'open_checkin_modal',
        secondaryAction: 'open_structured_diet',
      };
    }
    return {
      ...baseResult,
      stateKind: 'b2_free_or_unstructured_day',
      activeCycleStep: 'today',
      primaryAction: isWeeklyReviewDue ? 'open_b2_weekly_review' : 'open_structured_diet',
      secondaryAction: 'open_b2_adjustment',
    };
  }

  // B1. Pending Check-In today (surfaces actual next scheduled block + Food Readiness shortcut)
  if (!todayCheckedIn) {
    return {
      ...baseResult,
      stateKind: 'b2_pending_checkin',
      activeCycleStep: 'today',
      primaryAction: 'open_checkin_modal',
      secondaryAction:
        nextScheduledBlock && !nextScheduledBlock.isFasting
          ? 'open_b2_food_readiness'
          : 'open_structured_diet',
    };
  }

  // B2. Structured Diet Blueprint exists -> Next Scheduled Fasting or Meal Block
  if (hasRemainingTodayBlock && nextScheduledBlock) {
    if (nextScheduledBlock.isFasting) {
      return {
        ...baseResult,
        stateKind: 'b2_next_fasting_block',
        activeCycleStep: 'today',
        primaryAction: 'open_structured_diet',
        secondaryAction: 'open_b2_early_drift',
      };
    }
    return {
      ...baseResult,
      stateKind: 'b2_next_meal_block',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction: 'open_b2_food_readiness',
    };
  }

  // Past today's block times, unverified blocks remain
  if (unverifiedBlocksCount > 0) {
    return {
      ...baseResult,
      stateKind: 'b2_verify_remaining_blocks',
      activeCycleStep: 'today',
      primaryAction: 'open_structured_diet',
      secondaryAction: isWeeklyReviewDue ? 'open_b2_weekly_review' : undefined,
    };
  }

  if (isWeeklyReviewDue) {
    return {
      ...baseResult,
      stateKind: 'b2_weekly_review_pending',
      activeCycleStep: 'weekly-review',
      primaryAction: 'open_b2_weekly_review',
      secondaryAction: 'open_b2_adjustment',
    };
  }

  return {
    ...baseResult,
    stateKind: 'b2_continue_structure',
    activeCycleStep: 'adjustment',
    primaryAction: 'open_structured_diet',
    secondaryAction: 'open_b2_adjustment',
  };
}

export type UnifiedPracticeLoopGuidance = Book1PracticeGuidance | Book2PracticeGuidance;

export function evaluatePracticeLoopGuidance(params: {
  selectedBookId: PracticeLoopBookId;
  activeChallenge?: ChallengeInstance | null;
  ninetyDayJourney?: NinetyDayJourneyView | null;
  now?: Date;
  t?: Record<string, any>;
}): UnifiedPracticeLoopGuidance {
  if (params.selectedBookId === 'book2_loss_maintenance') {
    return evaluateBook2PracticeLoopGuidance(params);
  }
  return evaluateBook1PracticeLoopGuidance(params);
}
