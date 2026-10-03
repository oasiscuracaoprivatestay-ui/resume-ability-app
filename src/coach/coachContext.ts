/**
 * SDA AI Coach — Read-Only Context Projection Layer (Phase 33)
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
 *    protecting internal storage keys and metadata from leaking.
 */

import type {
  CoachContext,
  CoachContextToday,
  CoachContextCommitment,
  CoachContextSlipperyZones,
  CoachContextProgression,
  CoachContextStructuredDiet,
  CoachContextChallenge,
} from './types';
import { ACTIVE_ABILITY_ID } from './types';
import { getLocalDateKey, loadWeeklyDiet, getDayPlanForDate } from '../utils/dietStorage';
import { getTodayScore, getLifetimeScore } from '../utils/scoringEngine';
import { getCurrentLevel } from '../utils/progressionEngine';
import { loadPledge } from '../utils/pledgeStorage';
import { loadSlipperyZones } from '../utils/slipperyZonesStorage';
import { getTodayCheckIns, getLatestCheckIn } from '../utils/checkInStorage';
import { getTodayDietVerification } from '../utils/dietVerificationStorage';
import { getFoodCategoryStats } from '../utils/dietStructureAnalytics';
import { getActiveChallenge, deriveChallengeProgress } from '../challenges';

/**
 * Builds the normalized, read-only CoachContext for the current user state.
 *
 * Safe for server, test runners, and browser runtimes.
 */
export function buildCoachContext(dateKey = getLocalDateKey()): CoachContext {
  // ── 1. Today's Food Logs, Verifications & Check-Ins ─────────────────────────
  let todayScore = 0;
  try {
    todayScore = getTodayScore();
  } catch {
    todayScore = 0;
  }

  let checkIns: ReturnType<typeof getTodayCheckIns> = [];
  let latestCheckInStatus: string | null = null;
  try {
    checkIns = getTodayCheckIns();
    const latest = getLatestCheckIn();
    latestCheckInStatus = latest ? latest.status : null;
  } catch {
    checkIns = [];
    latestCheckInStatus = null;
  }

  let foodLogsCount = 0;
  let neutralLogsCount = 0;
  let totalPortions = 0;
  let slipsCount = 0;
  let resumedCount = 0;
  const topCategories: CoachContextToday['topCategories'] = [];
  const recentFoods: CoachContextToday['recentFoods'] = [];

  try {
    const todayVerification = getTodayDietVerification();
    const entries = todayVerification?.entries || [];

    for (const e of entries) {
      if (e.recordType === 'neutral') {
        neutralLogsCount++;
      } else {
        foodLogsCount++;
        if (e.status === 'slip') {
          slipsCount++;
          if (e.isResumed) {
            resumedCount++;
          }
        }
      }
    }

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

    // Extract human-friendly food item names
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

  const today: CoachContextToday = {
    dateKey,
    todayScore,
    checkInCount: checkIns.length,
    latestCheckInStatus,
    foodLogsCount,
    neutralLogsCount,
    totalPortions,
    slipsCount,
    resumedCount,
    topCategories: topCategories.slice(0, 5),
    recentFoods: recentFoods.slice(0, 5),
  };

  // ── 2. Commitment & Reasons ("My Why") ──────────────────────────────────────
  let commitment: CoachContextCommitment = {
    hasCommitment: false,
    reasons: [],
    nonNegotiables: [],
    reviewCount: 0,
    lastReviewedAt: null,
  };

  try {
    const pledge = loadPledge();
    commitment = {
      hasCommitment: pledge.reasons.length > 0 || pledge.nonNegotiables.length > 0,
      reasons: pledge.reasons || [],
      nonNegotiables: pledge.nonNegotiables || [],
      reviewCount: pledge.nonNegotiableReviewCount || 0,
      lastReviewedAt: pledge.lastNonNegotiableReviewAt || null,
    };
  } catch {
    // Safe defaults
  }

  // ── 3. Personal Slippery Zones ──────────────────────────────────────────────
  let slipperyZones: CoachContextSlipperyZones = {
    count: 0,
    zones: [],
    lastReviewedAt: undefined,
  };

  try {
    const szData = loadSlipperyZones();
    slipperyZones = {
      count: szData.zones.length,
      zones: szData.zones.map(z => z.title),
      lastReviewedAt: szData.lastReviewedAt,
    };
  } catch {
    // Safe defaults
  }

  // ── 4. Progression & Level ──────────────────────────────────────────────────
  let progression: CoachContextProgression = {
    level: 1,
    lifetimeScore: 0,
    levelTitle: 'Novice',
  };

  try {
    const lifetimeScore = getLifetimeScore();
    const level = getCurrentLevel(lifetimeScore);
    progression = {
      level,
      lifetimeScore,
      levelTitle: `Level ${level}`,
    };
  } catch {
    // Safe defaults
  }

  // ── 5. Structured Diet Plan Status ──────────────────────────────────────────
  let structuredDiet: CoachContextStructuredDiet = {
    hasPlan: false,
    todayPlannedCount: 0,
    nextPlannedMealTime: undefined,
  };

  try {
    const diet = loadWeeklyDiet();
    const dayPlan = getDayPlanForDate(diet, dateKey);
    const plannedToday = dayPlan?.blocks || [];
    structuredDiet = {
      hasPlan: plannedToday.length > 0,
      todayPlannedCount: plannedToday.length,
      nextPlannedMealTime: plannedToday[0]?.startTime,
    };
  } catch {
    // Safe defaults
  }

  // ── 6. Ability Challenge Status (Phase 37: Read-Only) ──────────────────────
  let challengeContext: CoachContextChallenge = {
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

  return {
    ability: ACTIVE_ABILITY_ID,
    dateKey,
    today,
    commitment,
    slipperyZones,
    progression,
    structuredDiet,
    challenge: challengeContext,
  };
}
