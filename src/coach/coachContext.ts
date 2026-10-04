/**
 * SDA AI Coach — Read-Only Context Projection Layer (Phase 33 & Phase 40B)
 *
 * Privacy / Context Minimization Boundary:
 * ─────────────────────────────────────────────────────────────────────────────
 * This module projects raw application storage into an AI-safe, normalized,
 * privacy-conscious CoachContext.
 *
 * Principles:
 * 1. STRICTLY READ-ONLY: Never executes mutations or state modifications.
 * 2. NO RAW DUMPS: Selectively extracts only domain fields needed for coaching.
 * 3. GRACEFUL FALLBACKS: Missing data returns safe empty structures or nulls.
 * 4. ISOLATED: External AI providers will only see this normalized projection,
 *    protecting internal storage keys, raw food logs, and personal text from leaking.
 */

import type {
  CoachContext,
  CoachContextToday,
  CoachContextCommitment,
  CoachContextSlipperyZones,
  CoachContextProgression,
  CoachContextStructuredDiet,
  CoachContextChallenge,
  NormalizedScoringSnapshot,
  NormalizedCheckInSnapshot,
  NormalizedDietSnapshot,
  NormalizedDietSlipResumeSnapshot,
  NormalizedResumeAbilitySnapshot,
  NormalizedCommitmentSnapshot,
  NormalizedNonNegotiablesSnapshot,
  NormalizedSlipperyZonesSnapshot,
  NormalizedChallengeSnapshot,
  TurnScopedSensitiveContext,
} from './types';
import { ACTIVE_ABILITY_ID } from './types';
import { getLocalDateKey, loadWeeklyDiet, getDayPlanForDate } from '../utils/dietStorage';
import { getTodayScore, getLifetimeScore } from '../utils/scoringEngine';
import { getCurrentLevel } from '../utils/progressionEngine';
import { loadPledge } from '../utils/pledgeStorage';
import { loadSlipperyZones } from '../utils/slipperyZonesStorage';
import { getTodayCheckIns, getLatestCheckIn, getCheckIns } from '../utils/checkInStorage';
import {
  getDailyDietVerification,
  getTodayDietVerification,
  isEligibleSlipRecord,
  getUnresolvedDietSlips,
  calculateResumeStats,
} from '../utils/dietVerificationStorage';
import { getFoodCategoryStats } from '../utils/dietStructureAnalytics';
import { getActiveChallenge, deriveChallengeProgress } from '../challenges';
import { loadSlips } from '../utils';
import { loadRecommitEvents } from '../utils/recommitStorage';
import { loadInControlEvents, loadCommitEvents } from '../utils/inControlStorage';
import { loadReviewEvents } from '../utils/reviewStorage';
import { calculateDailyResumeAbilityScore } from '../utils/dailyScore';

/**
 * Builds the normalized, read-only CoachContext for the current user state.
 *
 * Safe for server, test runners, and browser runtimes.
 */
export function buildCoachContext(dateKey = getLocalDateKey()): CoachContext {
  // ── 1. Scoring & Progression ───────────────────────────────────────────────
  let todayPoints = 0;
  let lifetimePoints = 0;
  let level = 1;
  let levelTitle = 'Level 1';

  try {
    todayPoints = getTodayScore();
    lifetimePoints = getLifetimeScore();
    level = getCurrentLevel(lifetimePoints);
    levelTitle = `Level ${level}`;
  } catch {
    todayPoints = 0;
    lifetimePoints = 0;
    level = 1;
    levelTitle = 'Level 1';
  }

  const scoring: NormalizedScoringSnapshot = {
    todayPoints,
    lifetimePoints,
    level,
    levelTitle,
  };

  const progression: CoachContextProgression = {
    level,
    lifetimeScore: lifetimePoints,
    levelTitle,
  };

  // ── 2. Daily Check-In (Canonical Domain) ───────────────────────────────────
  let checkIns: ReturnType<typeof getTodayCheckIns> = [];
  let latestCheckInStatus: 'on-structure' | 'near-slip' | 'slip' | null = null;
  try {
    checkIns = getTodayCheckIns();
    const latest = getLatestCheckIn();
    latestCheckInStatus = latest ? latest.status : null;
  } catch {
    checkIns = [];
    latestCheckInStatus = null;
  }

  const checkIn: NormalizedCheckInSnapshot = {
    hasCheckedInToday: checkIns.length > 0,
    checkInCountToday: checkIns.length,
    latestCheckInStatus,
  };

  // ── 3. Structured Diet Plan & Food Verifications ───────────────────────────
  let hasStructuredDiet = false;
  let plannedBlocksCount = 0;
  let nextPlannedMealTime: string | undefined;

  try {
    const dietPlan = loadWeeklyDiet();
    const dayPlan = getDayPlanForDate(dietPlan, dateKey);
    const plannedToday = dayPlan?.blocks || [];
    hasStructuredDiet = plannedToday.length > 0;
    plannedBlocksCount = plannedToday.length;
    nextPlannedMealTime = plannedToday[0]?.startTime;
  } catch {
    hasStructuredDiet = false;
    plannedBlocksCount = 0;
    nextPlannedMealTime = undefined;
  }

  const structuredDiet: CoachContextStructuredDiet = {
    hasPlan: hasStructuredDiet,
    todayPlannedCount: plannedBlocksCount,
    nextPlannedMealTime,
  };

  let totalPortions = 0;
  let onTrackCountToday = 0;
  let twentyPercentCountToday = 0;
  let neutralCountToday = 0;
  let dietSlipsToday = 0;
  let dietResumesToday = 0;
  const topCategories: CoachContextToday['topCategories'] = [];
  const recentFoods: NonNullable<CoachContextToday['recentFoods']> = [];
  let eligibleDietSlips: any[] = [];

  try {
    const todayVerification = getDailyDietVerification(dateKey) || getTodayDietVerification();
    const entries = todayVerification?.entries || [];

    for (const e of entries) {
      if (e.recordType === 'neutral') {
        neutralCountToday++;
      } else {
        if (e.detailedOutcome === 'twenty_percent_off_track') {
          twentyPercentCountToday++;
        } else if (
          e.detailedOutcome === 'on_track' ||
          e.detailedOutcome === 'adjusted_on_track' ||
          (!e.detailedOutcome && e.status === 'on-track')
        ) {
          onTrackCountToday++;
        }
      }
    }

    eligibleDietSlips = entries.filter(isEligibleSlipRecord);
    dietSlipsToday = eligibleDietSlips.length;
    dietResumesToday = eligibleDietSlips.filter(e => e.isResumed === true).length;

    // Food category and portion breakdown
    const catStats = getFoodCategoryStats(entries);
    totalPortions = catStats.totalPortions;
    for (const item of catStats.items) {
      if (item.portionCount > 0 || item.count > 0) {
        topCategories.push({
          category: item.category,
          portions: item.portionCount,
          percentage: item.percentage,
        });
      }
    }

    // Local-only: recent food names (preserved for local provider, omitted remotely)
    for (const e of entries) {
      if (e.recordType === 'neutral') continue;
      if (e.actualFoodSelections) {
        for (const foods of Object.values(e.actualFoodSelections)) {
          if (Array.isArray(foods)) {
            for (const f of foods) {
              if (f && typeof f === 'string') {
                recentFoods.push({ name: f, portions: 1 });
              }
            }
          }
        }
      } else if (e.actualCustomText) {
        recentFoods.push({ name: e.actualCustomText, portions: 1 });
      }
    }
  } catch {
    // Keep safe defaults on any extraction failure
  }

  const dietEntriesLoggedToday = onTrackCountToday + twentyPercentCountToday + neutralCountToday + dietSlipsToday;

  const diet: NormalizedDietSnapshot = {
    hasStructuredDiet,
    plannedBlocksCount,
    dietEntriesLoggedToday,
    onTrackCountToday,
    twentyPercentCountToday,
    neutralCountToday,
    totalPortions,
    topCategories: topCategories.slice(0, 5),
  };

  // ── 4. Diet Slip / Resume State (Canonical Domain) ─────────────────────────
  let hasUnresolvedDietSlip = false;
  let unresolvedDietSlipCount = 0;
  let dietResumeRate: number | null = null;

  try {
    const unresolved = getUnresolvedDietSlips();
    hasUnresolvedDietSlip = unresolved.length > 0;
    unresolvedDietSlipCount = unresolved.length;

    const stats = calculateResumeStats(eligibleDietSlips);
    dietResumeRate = stats.eligibleCount > 0 ? stats.resumeRate : null;
  } catch {
    hasUnresolvedDietSlip = false;
    unresolvedDietSlipCount = 0;
    dietResumeRate = null;
  }

  const dietSlipResume: NormalizedDietSlipResumeSnapshot = {
    dietSlipsToday,
    dietResumesToday,
    hasUnresolvedDietSlip,
    unresolvedDietSlipCount,
    dietResumeRate,
  };

  // ── 5. Daily Resume-Ability Index (Reusing Canonical Dashboard Helper) ───────
  let dailyResumeAbilityIndex = 0;
  try {
    const result = calculateDailyResumeAbilityScore({
      checkIns: getCheckIns(),
      slips: loadSlips(),
      recommits: loadRecommitEvents(),
      inControlEvents: loadInControlEvents(),
      commitEvents: loadCommitEvents(),
      reviewEvents: loadReviewEvents(),
    });
    dailyResumeAbilityIndex = result.score;
  } catch {
    dailyResumeAbilityIndex = 0;
  }

  const resumeAbility: NormalizedResumeAbilitySnapshot = {
    dailyResumeAbilityIndex,
  };

  // ── 6. Commitment & Reasons ("My Why") ──────────────────────────────────────
  let pledgeReasons: string[] = [];
  let pledgeNonNegotiables: string[] = [];
  let reviewCount = 0;
  let lastReviewedAt: string | null = null;

  try {
    const pledge = loadPledge();
    pledgeReasons = pledge.reasons || [];
    pledgeNonNegotiables = pledge.nonNegotiables || [];
    reviewCount = pledge.nonNegotiableReviewCount || 0;
    lastReviewedAt = pledge.lastNonNegotiableReviewAt || null;
  } catch {
    // Safe defaults
  }

  const whyCount = pledgeReasons.length;
  const nonNegotiablesCount = pledgeNonNegotiables.length;
  const hasCommitment = whyCount > 0 || nonNegotiablesCount > 0;
  const hasNonNegotiables = nonNegotiablesCount > 0;

  const commitment: CoachContextCommitment & NormalizedCommitmentSnapshot = {
    hasCommitment,
    whyCount,
    reasons: pledgeReasons,
    nonNegotiables: pledgeNonNegotiables,
    reviewCount,
    lastReviewedAt,
  };

  const nonNegotiables: NormalizedNonNegotiablesSnapshot = {
    hasNonNegotiables,
    nonNegotiablesCount,
    nonNegotiables: pledgeNonNegotiables,
  };

  // ── 7. Personal Slippery Zones ──────────────────────────────────────────────
  let szTitles: string[] = [];
  let szLastReviewed: string | undefined;

  try {
    const szData = loadSlipperyZones();
    szTitles = szData.zones.map(z => z.title);
    szLastReviewed = szData.lastReviewedAt;
  } catch {
    // Safe defaults
  }

  const slipperyZones: CoachContextSlipperyZones & NormalizedSlipperyZonesSnapshot = {
    count: szTitles.length,
    zones: szTitles,
    lastReviewedAt: szLastReviewed,
  };

  // ── 8. Ability Challenge Status (Phase 37: Read-Only) ──────────────────────
  let challengeContext: CoachContextChallenge & NormalizedChallengeSnapshot = {
    hasActiveChallenge: false,
  };

  try {
    const rawActive = getActiveChallenge();
    if (rawActive && rawActive.status === 'active') {
      const active = deriveChallengeProgress(rawActive, dateKey);
      if (active.status === 'active') {
        challengeContext = {
          hasActiveChallenge: true,
          activeChallenge: {
            id: active.id,
            abilityId: active.abilityId,
            challengeType: active.challengeType,
            durationDays: active.durationDays,
            currentDay: active.currentDay,
            daysRemaining: active.daysRemaining,
            startDate: active.startDate,
            endDate: active.endDate,
            status: active.status,
            eligibleSlips: active.relevantEventCounts.eligibleSlips,
            resumedSlips: active.relevantEventCounts.resumedSlips,
            resumeRate: active.relevantEventCounts.resumeRate,
          },
        };
      }
    }
  } catch {
    // Safe defaults
  }

  // ── 9. Backwards-Compatible Legacy Today View ──────────────────────────────
  const today: CoachContextToday = {
    dateKey,
    todayScore: todayPoints,
    checkInCount: checkIns.length,
    latestCheckInStatus,
    foodLogsCount: onTrackCountToday + twentyPercentCountToday + dietSlipsToday,
    neutralLogsCount: neutralCountToday,
    totalPortions,
    slipsCount: dietSlipsToday,
    resumedCount: dietResumesToday,
    topCategories: topCategories.slice(0, 5),
    recentFoods: recentFoods.slice(0, 5),
  };

  return {
    ability: ACTIVE_ABILITY_ID,
    dateKey,
    scoring,
    checkIn,
    diet,
    dietSlipResume,
    resumeAbility,
    commitment,
    nonNegotiables,
    slipperyZones,
    challenge: challengeContext,
    today,
    progression,
    structuredDiet,
  };
}

// ── Turn-Scoped Inquiry Detectors (Phase 40B) ─────────────────────────────────

export function isWhyInquiry(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    /\b(?:why did i commit|what(?:'s| is) my why|why am i doing this|show my why|review my why|my reasons|remind me why)\b/i.test(lower) ||
    /\b(?:por qu[eé] me compromet[ií]|cu[aá]l es mi por qu[eé]|mis motivos|mis razones)\b/i.test(lower) ||
    /\b(?:waarom heb ik me gecommitteerd|wat is mijn waarom|mijn redenen)\b/i.test(lower)
  );
}

export function isNonNegotiablesInquiry(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    /\b(?:what are my non[- ]negotiables|show my non[- ]negotiables|review my non[- ]negotiables|list my non[- ]negotiables|my rules|what are my rules|show (?:my )?rules)\b/i.test(lower) ||
    /\b(?:cu[aá]les son mis no negociables|mostrar mis no negociables|mis reglas|ver mis no negociables)\b/i.test(lower) ||
    /\b(?:wat zijn mijn niet[- ]onderhandelbare|toon mijn niet[- ]onderhandelbare|mijn regels|toon (?:mijn )?regels)\b/i.test(lower)
  );
}

// ── Remote-Safe Context Projection Layer (Phase 40B) ──────────────────────────

/**
 * Projects a local rich CoachContext into a privacy-safe remote projection.
 *
 * Enforces:
 * - Zero recent food names / notes
 * - Zero My Why free-text by default (turn-scoped only if explicit Why inquiry)
 * - Zero Non-Negotiable free-text by default (turn-scoped only if explicit rule inquiry)
 * - Zero Slippery Zone titles by default (count only)
 * - Zero raw timestamps or DB UUIDs
 * - Normalized counts, booleans, points, and indices
 */
export function projectRemoteSafeContext(
  context: CoachContext,
  userMessage = ''
): CoachContext {
  const whyRequested = isWhyInquiry(userMessage);
  const nnRequested = isNonNegotiablesInquiry(userMessage);

  const turnScopedSensitive: TurnScopedSensitiveContext | undefined =
    whyRequested || nnRequested
      ? {
          reasons: whyRequested ? (context.commitment?.reasons || []) : undefined,
          nonNegotiables: nnRequested
            ? (context.nonNegotiables?.nonNegotiables || context.commitment?.nonNegotiables || [])
            : undefined,
        }
      : undefined;

  // Remote safe challenge (strips internal UUIDs and exact date bounds)
  const remoteChallenge = context.challenge?.hasActiveChallenge && context.challenge.activeChallenge
    ? {
        hasActiveChallenge: true,
        activeChallenge: {
          id: 'active_challenge',
          abilityId: context.challenge.activeChallenge.abilityId,
          challengeType: context.challenge.activeChallenge.challengeType,
          durationDays: context.challenge.activeChallenge.durationDays,
          currentDay: context.challenge.activeChallenge.currentDay,
          daysRemaining: context.challenge.activeChallenge.daysRemaining,
          startDate: '',
          endDate: '',
          status: context.challenge.activeChallenge.status,
          eligibleSlips: context.challenge.activeChallenge.eligibleSlips,
          resumedSlips: context.challenge.activeChallenge.resumedSlips,
          resumeRate: context.challenge.activeChallenge.resumeRate,
        },
      }
    : (context.challenge ? { hasActiveChallenge: false } : undefined);

  return {
    ability: context.ability,
    dateKey: context.dateKey,
    scoring: { ...context.scoring },
    checkIn: { ...context.checkIn },
    diet: {
      hasStructuredDiet: context.diet.hasStructuredDiet,
      plannedBlocksCount: context.diet.plannedBlocksCount,
      dietEntriesLoggedToday: context.diet.dietEntriesLoggedToday,
      onTrackCountToday: context.diet.onTrackCountToday,
      twentyPercentCountToday: context.diet.twentyPercentCountToday,
      neutralCountToday: context.diet.neutralCountToday,
      totalPortions: context.diet.totalPortions,
      topCategories: context.diet.topCategories,
    },
    dietSlipResume: { ...context.dietSlipResume },
    resumeAbility: { ...context.resumeAbility },
    commitment: {
      hasCommitment: context.commitment.hasCommitment,
      whyCount: context.commitment.whyCount ?? 0,
      reasons: [], // Stripped by default from remote payload
      nonNegotiables: [], // Stripped by default from remote payload
      reviewCount: context.commitment.reviewCount,
      lastReviewedAt: null,
    },
    nonNegotiables: {
      hasNonNegotiables: context.nonNegotiables.hasNonNegotiables,
      nonNegotiablesCount: context.nonNegotiables.nonNegotiablesCount,
      nonNegotiables: [], // Stripped by default from remote payload
    },
    slipperyZones: {
      count: context.slipperyZones.count,
      zones: [], // Stripped by default from remote payload
      lastReviewedAt: undefined,
    },
    challenge: remoteChallenge,
    turnScopedSensitive,
    // Backwards-compatible legacy properties for gateway validation:
    today: {
      dateKey: context.dateKey,
      todayScore: context.scoring.todayPoints,
      checkInCount: context.checkIn.checkInCountToday,
      latestCheckInStatus: context.checkIn.latestCheckInStatus,
      foodLogsCount: context.diet.dietEntriesLoggedToday - context.diet.neutralCountToday,
      neutralLogsCount: context.diet.neutralCountToday,
      totalPortions: context.diet.totalPortions,
      slipsCount: context.dietSlipResume.dietSlipsToday,
      resumedCount: context.dietSlipResume.dietResumesToday,
      topCategories: context.diet.topCategories,
      recentFoods: [], // Strictly empty in remote projection!
    },
    progression: { ...context.progression },
    structuredDiet: {
      hasPlan: context.diet.hasStructuredDiet,
      todayPlannedCount: context.diet.plannedBlocksCount,
    },
  };
}
