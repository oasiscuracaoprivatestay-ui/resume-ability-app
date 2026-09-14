/**
 * Structured Diet Structure & Category Awareness Analytics — Phase 3
 *
 * Core analytical engine calculating:
 *   1. Structured vs. Unstructured Eating awareness (counts, percentages, ratio comparison)
 *   2. Resume recovery analytics (Resume Count, eligible slip denominator, Resume Rate)
 *   3. Food Category distribution (counts, percentage of total occurrences, ranked list)
 *   4. Multi-period filtering (Today, 7 Days, 30 Days, All Time)
 *   5. Structure Goal profile isolation with seamless legacy fallback
 *
 * Product Principle:
 *   Focus is STRUCTURED vs. UNSTRUCTURED awareness, NOT planned vs. unplanned.
 *   Planned status does not dictate structure status.
 *   Analytics actions award strictly ZERO score points.
 */

import {
  FOOD_CATEGORY_KEYS,
  type FoodCategoryKey,
  mapLegacyItemsToCategories,
} from '../data/dietData';
import {
  type DietBlockVerification,
  type DailyDietVerification,
  isStructuredOutcome,
  isUnstructuredOutcome,
  isEligibleSlipRecord,
  getLocalDateKey,
} from './dietVerificationStorage';
import { DEFAULT_ACTIVE_GOAL_ID } from './dietStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StructureTimePeriod = 'today' | '7d' | '30d' | 'all';

export interface StructureAwarenessStatsResult {
  structuredCount: number;
  unstructuredCount: number;
  totalClassified: number;
  structuredPercentage: number;   // 0 - 100
  unstructuredPercentage: number; // 0 - 100
  hasData: boolean;               // True when totalClassified > 0; prevents false 0%/100% display
  unclassifiedCount: number;      // e.g. Legacy slips without detailed outcome
}

export interface ResumeAwarenessStatsResult {
  resumeCount: number;
  eligibleCount: number;
  resumeRate: number;             // 0 - 100 percentage
  hasEligibleSlips: boolean;
}

export interface CategoryDistributionItem {
  category: FoodCategoryKey;
  count: number;
  percentage: number;             // 0 - 100
}

export interface FoodCategoryStatsResult {
  totalCategoryOccurrences: number;
  items: CategoryDistributionItem[];
  hasData: boolean;
}

export interface AwarenessSummaryResult {
  period: StructureTimePeriod;
  profileId: string;
  totalVerifiedRecords: number;
  structureStats: StructureAwarenessStatsResult;
  resumeStats: ResumeAwarenessStatsResult;
  categoryStats: FoodCategoryStatsResult;
}

export interface StructureAnalyticsOptions {
  activeProfileId?: string;
  legacySlipFallback?: 'unclassified' | 'unstructured' | 'structured';
  referenceDate?: Date;
}

// ── Rounding & Formatting Helper ──────────────────────────────────────────────

/**
 * Clean human-friendly percentage rounding:
 * Returns whole number when integer (e.g. 75), or max 1 decimal place (e.g. 33.3).
 */
export function formatPercentage(val: number): number {
  if (isNaN(val) || !isFinite(val) || val <= 0) return 0;
  if (val >= 100) return 100;
  return Math.round(val * 10) / 10;
}

// ── Date Period Calculation ───────────────────────────────────────────────────

/**
 * Returns the minimum local date key for a given period relative to a reference date.
 */
export function getStartDateForPeriod(
  period: StructureTimePeriod,
  referenceDate = new Date()
): string | null {
  if (period === 'all') return null;
  if (period === 'today') return getLocalDateKey(referenceDate);

  const daysBack = period === '7d' ? 6 : 29; // 7 days total inclusive, 30 days total inclusive
  const d = new Date(referenceDate.getTime());
  d.setDate(d.getDate() - daysBack);
  return getLocalDateKey(d);
}

// ── Period & Profile Filtering ────────────────────────────────────────────────

/**
 * Filters all daily verifications by time period and active Structure Goal profile.
 * Legacy records lacking profile metadata safely fall back to DEFAULT_ACTIVE_GOAL_ID.
 */
export function filterVerificationsByPeriod(
  allVerifications: Record<string, DailyDietVerification>,
  period: StructureTimePeriod,
  options?: StructureAnalyticsOptions
): DietBlockVerification[] {
  const activeProfileId = options?.activeProfileId || DEFAULT_ACTIVE_GOAL_ID;
  const refDate = options?.referenceDate || new Date();
  const todayKey = getLocalDateKey(refDate);
  const minDateKey = getStartDateForPeriod(period, refDate);

  const matchingRecords: DietBlockVerification[] = [];

  const dateKeys = Object.keys(allVerifications).sort();

  for (const dateKey of dateKeys) {
    // 1. Date filter
    if (period === 'today' && dateKey !== todayKey) {
      continue;
    }
    if (minDateKey && dateKey < minDateKey) {
      continue;
    }
    // Prevent future dates from polluting historical periods
    if (dateKey > todayKey) {
      continue;
    }

    const daily = allVerifications[dateKey];
    if (!daily || !Array.isArray(daily.entries)) continue;

    // 2. Profile filter
    const dailyProfileId = daily.profileId || DEFAULT_ACTIVE_GOAL_ID;
    if (dailyProfileId !== activeProfileId) {
      continue;
    }

    for (const entry of daily.entries) {
      matchingRecords.push(entry);
    }
  }

  return matchingRecords;
}

// ── Structure Classification Analytics ────────────────────────────────────────

/**
 * Calculates Structured vs Unstructured statistics.
 *
 * Source of truth:
 *   Structured:
 *     - 'on_track'
 *     - 'adjusted_on_track'
 *     - 'near_slip'
 *     - 'structured_slip'
 *     - legacy 'on-track' (status === 'on-track' without detailedOutcome)
 *
 *   Unstructured:
 *     - 'planned_unstructured'
 *     - 'unstructured_slip'
 *
 * Legacy fallback:
 *   - Legacy 'slip' without detailed outcome cannot be definitely assigned to structured
 *     or unstructured slip; by default it is marked 'unclassified' so percentages
 *     use ONLY records that can meaningfully participate in structure classification.
 */
export function getStructureStats(
  records: DietBlockVerification[],
  options?: StructureAnalyticsOptions
): StructureAwarenessStatsResult {
  const fallback = options?.legacySlipFallback || 'unclassified';
  let structuredCount = 0;
  let unstructuredCount = 0;
  let unclassifiedCount = 0;

  for (const r of records) {
    if (isStructuredOutcome(r.detailedOutcome, r.status)) {
      structuredCount++;
    } else if (isUnstructuredOutcome(r.detailedOutcome, r.status)) {
      unstructuredCount++;
    } else if (r.status === 'slip' && !r.detailedOutcome) {
      // Legacy slip without detailed outcome
      if (fallback === 'unstructured') {
        unstructuredCount++;
      } else if (fallback === 'structured') {
        structuredCount++;
      } else {
        unclassifiedCount++;
      }
    } else {
      unclassifiedCount++;
    }
  }

  const totalClassified = structuredCount + unstructuredCount;
  const hasData = totalClassified > 0;

  let structuredPercentage = 0;
  let unstructuredPercentage = 0;

  if (hasData) {
    structuredPercentage = formatPercentage((structuredCount / totalClassified) * 100);
    // Ensure the two sum precisely to 100% when rounded
    unstructuredPercentage = formatPercentage(100 - structuredPercentage);
  }

  return {
    structuredCount,
    unstructuredCount,
    totalClassified,
    structuredPercentage,
    unstructuredPercentage,
    hasData,
    unclassifiedCount,
  };
}

// ── Resume Analytics ──────────────────────────────────────────────────────────

/**
 * Calculates Resume statistics.
 * Denominator includes all eligible slips: near_slip, structured_slip, unstructured_slip, and legacy slip.
 * Numerator counts records marked isResumed === true.
 */
export function getResumeStats(records: DietBlockVerification[]): ResumeAwarenessStatsResult {
  const eligible = records.filter(isEligibleSlipRecord);
  const eligibleCount = eligible.length;
  const resumeCount = eligible.filter(r => r.isResumed === true).length;
  const resumeRate = eligibleCount > 0 ? Math.round((resumeCount / eligibleCount) * 100) : 0;

  return {
    resumeCount,
    eligibleCount,
    resumeRate,
    hasEligibleSlips: eligibleCount > 0,
  };
}

// ── Food Category Extraction Precedence ───────────────────────────────────────

/**
 * Resolves food categories for a verified block according to strict precedence:
 *   1. actualFoodCategories (actual consumed) if present and non-empty
 *   2. plannedSnapshot.foodCategories if present and non-empty
 *   3. mapLegacyItemsToCategories(actualItems)
 *   4. mapLegacyItemsToCategories(plannedSnapshot.items)
 *
 * Guarantees NO double counting of planned and actual categories for the same event.
 */
export function getRecordFoodCategories(record: DietBlockVerification): FoodCategoryKey[] {
  if (Array.isArray(record.actualFoodCategories) && record.actualFoodCategories.length > 0) {
    return Array.from(new Set(record.actualFoodCategories));
  }
  if (
    Array.isArray(record.plannedSnapshot?.foodCategories) &&
    record.plannedSnapshot.foodCategories.length > 0
  ) {
    return Array.from(new Set(record.plannedSnapshot.foodCategories));
  }
  if (Array.isArray(record.actualItems) && record.actualItems.length > 0) {
    return Array.from(new Set(mapLegacyItemsToCategories(record.actualItems)));
  }
  if (Array.isArray(record.plannedSnapshot?.items) && record.plannedSnapshot.items.length > 0) {
    return Array.from(new Set(mapLegacyItemsToCategories(record.plannedSnapshot.items)));
  }
  return [];
}

// ── Food Category Distribution Analytics ──────────────────────────────────────

/**
 * Calculates food category counts and percentage distribution across verified records.
 * Category percentages represent: category occurrences / total category occurrences * 100.
 * Returned items are sorted descending by count, with stable category key order as tie-breaker.
 */
export function getFoodCategoryStats(records: DietBlockVerification[]): FoodCategoryStatsResult {
  const counts = {} as Record<FoodCategoryKey, number>;
  for (const key of FOOD_CATEGORY_KEYS) {
    counts[key] = 0;
  }

  let totalCategoryOccurrences = 0;

  for (const record of records) {
    const cats = getRecordFoodCategories(record);
    for (const cat of cats) {
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(cat)) {
        counts[cat] = (counts[cat] || 0) + 1;
        totalCategoryOccurrences++;
      }
    }
  }

  const items: CategoryDistributionItem[] = FOOD_CATEGORY_KEYS.map(key => {
    const count = counts[key] || 0;
    const percentage =
      totalCategoryOccurrences > 0
        ? formatPercentage((count / totalCategoryOccurrences) * 100)
        : 0;
    return {
      category: key,
      count,
      percentage,
    };
  });

  // Sort descending by count, with stable original index as tie breaker
  items.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return FOOD_CATEGORY_KEYS.indexOf(a.category) - FOOD_CATEGORY_KEYS.indexOf(b.category);
  });

  return {
    totalCategoryOccurrences,
    items,
    hasData: totalCategoryOccurrences > 0,
  };
}

// ── Combined Awareness Summary ────────────────────────────────────────────────

/**
 * High-level helper returning all three awareness metrics for a given period and profile.
 */
export function getAwarenessSummary(
  allVerifications: Record<string, DailyDietVerification>,
  period: StructureTimePeriod,
  options?: StructureAnalyticsOptions
): AwarenessSummaryResult {
  const activeProfileId = options?.activeProfileId || DEFAULT_ACTIVE_GOAL_ID;
  const filteredRecords = filterVerificationsByPeriod(allVerifications, period, options);

  const structureStats = getStructureStats(filteredRecords, options);
  const resumeStats = getResumeStats(filteredRecords);
  const categoryStats = getFoodCategoryStats(filteredRecords);

  return {
    period,
    profileId: activeProfileId,
    totalVerifiedRecords: filteredRecords.length,
    structureStats,
    resumeStats,
    categoryStats,
  };
}
