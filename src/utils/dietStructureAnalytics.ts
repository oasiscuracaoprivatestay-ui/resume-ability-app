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
  getFoodQuantityKey,
  type FoodQuantityUnit,
  type FoodQuantitiesMap,
} from '../data/foodOptions';
import {
  type DietBlockVerification,
  type DailyDietVerification,
  type DetailedBlockOutcome,
  type DietVerificationStatus,
  ALL_DETAILED_OUTCOMES,
  getLocalDateKey,
} from './dietVerificationStorage';
import { DEFAULT_ACTIVE_GOAL_ID } from './dietStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StructureTimePeriod = 'today' | '7d' | '30d' | 'all';

export type HighLevelBucketKey = 'structured_core' | 'flex_off_track' | 'risk' | 'slip';

export interface HighLevelBucketStat {
  key: HighLevelBucketKey;
  count: number;
  percentage: number; // 0 - 100
}

export interface DetailedOutcomeDistributionItem {
  outcome: DetailedBlockOutcome;
  count: number;
  percentage: number; // 0 - 100
  bucket: HighLevelBucketKey;
}

export interface StructureAwarenessStatsResult {
  // Main comparison: Structured Core vs Outside Core
  structuredCoreCount: number;
  outsideCoreCount: number;
  structuredCorePercentage: number;   // 0 - 100
  outsideCorePercentage: number;     // 0 - 100

  // 4 Behavioral Buckets
  buckets: {
    structuredCore: HighLevelBucketStat;
    flexOffTrack: HighLevelBucketStat;
    risk: HighLevelBucketStat;
    slip: HighLevelBucketStat;
  };

  // Detailed 7-outcome distribution
  detailedOutcomes: DetailedOutcomeDistributionItem[];

  // Compatibility aliases
  structuredCount: number;
  unstructuredCount: number;
  structuredPercentage: number;       // 0 - 100
  unstructuredPercentage: number;     // 0 - 100

  totalClassified: number;
  totalRecords: number;
  hasData: boolean;                   // True when totalClassified > 0; prevents false 0%/100% display
  unclassifiedCount: number;          // e.g. Legacy slips without detailed outcome
  nearSlipCount: number;              // Approaches boundary but stopped
  twentyPercentOffTrackCount: number; // Intentional 20% flexible eating (non-slip)
  structuredSlipCount: number;        // True slip that retained structure
  unstructuredSlipCount: number;      // True slip without structure
  totalSlips: number;                 // Total true slips (structured_slip + unstructured_slip + legacy slip)

  // Spontaneous vs Planned tracking (Phase 26A/26C)
  plannedCount: number;
  spontaneousCount: number;
}

export interface ResumeAwarenessStatsResult {
  resumeCount: number;
  eligibleCount: number;
  resumeRate: number;                 // 0 - 100 percentage
  hasEligibleSlips: boolean;
}

export interface DriftAwarenessStatsResult {
  eligibleCount: number;
  enteredDriftCount: number;
  currentlyDriftingCount: number;
  stoppedDriftCount: number;
  driftRate: number;                 // 0 - 100 percentage
  hasEligibleSlips: boolean;
}

export interface CategoryDistributionItem {
  category: FoodCategoryKey;
  count: number;
  percentage: number;                 // 0 - 100 (Category Record Rate: % of food records with categories containing this category)
}

export interface ItemizedFoodPortionStat {
  key: string;           // Canonical key or custom food name
  category: FoodCategoryKey;
  isCustom: boolean;
  totalOccurrences: number; // Number of records this food was logged in
  quantitiesByUnit: Record<string, { totalAmount: number; unit: FoodQuantityUnit; customUnit?: string }>;
}

export interface FoodCategoryStatsResult {
  totalBlocks: number;
  recordsWithCategories: number;      // Denominator for Category Record Rate
  totalCategoryOccurrences: number;
  items: CategoryDistributionItem[];
  itemizedPortions?: Record<FoodCategoryKey, ItemizedFoodPortionStat[]>;
  totalPortionsLogged?: number;       // Total count of food instances with recorded quantities
  hasData: boolean;
}

export interface AwarenessSummaryResult {
  period: StructureTimePeriod;
  profileId: string;
  totalVerifiedRecords: number;
  structureStats: StructureAwarenessStatsResult;
  resumeStats: ResumeAwarenessStatsResult;
  driftStats: DriftAwarenessStatsResult;
  categoryStats: FoodCategoryStatsResult;
}

export interface StructureAnalyticsOptions {
  activeProfileId?: string;
  legacySlipFallback?: 'unclassified' | 'unstructured' | 'structured';
  referenceDate?: Date;
}

// ── Centralized Classification Model ──────────────────────────────────────────

export const STRUCTURED_CORE_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
] as const;

export const FLEX_OFF_TRACK_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'twenty_percent_off_track',
  'planned_unstructured',
] as const;

export const RISK_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'near_slip',
] as const;

export const SLIP_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'structured_slip',
  'unstructured_slip',
] as const;

/**
 * Centralized classification helper mapping outcomes to high-level behavioral buckets.
 *
 * Rules:
 *   - STRUCTURED CORE: on_track, adjusted_on_track (or legacy on-track)
 *   - FLEX / OFF-TRACK: twenty_percent_off_track, planned_unstructured
 *   - RISK: near_slip (approached boundary but stopped; NOT a slip)
 *   - SLIP: structured_slip, unstructured_slip (or legacy slip)
 */
export function classifyRecordOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  status?: DietVerificationStatus
): HighLevelBucketKey | 'unclassified' {
  if (detailedOutcome) {
    if ((STRUCTURED_CORE_OUTCOMES as readonly string[]).includes(detailedOutcome)) {
      return 'structured_core';
    }
    if ((FLEX_OFF_TRACK_OUTCOMES as readonly string[]).includes(detailedOutcome)) {
      return 'flex_off_track';
    }
    if ((RISK_OUTCOMES as readonly string[]).includes(detailedOutcome)) {
      return 'risk';
    }
    if ((SLIP_OUTCOMES as readonly string[]).includes(detailedOutcome)) {
      return 'slip';
    }
  }
  if (status === 'on-track') return 'structured_core';
  if (status === 'slip') return 'slip';
  return 'unclassified';
}

export function isStructuredCoreOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  status?: DietVerificationStatus
): boolean {
  return classifyRecordOutcome(detailedOutcome, status) === 'structured_core';
}

export function isOutsideCoreOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  status?: DietVerificationStatus
): boolean {
  const bucket = classifyRecordOutcome(detailedOutcome, status);
  return bucket === 'flex_off_track' || bucket === 'risk' || bucket === 'slip';
}

/**
 * Determines whether a record is an eligible slip for the Resume Rate denominator.
 * Denominator includes: structured_slip, unstructured_slip, legacy slip.
 * Excludes: 20% OFF TRACK, near_slip, on_track, adjusted_on_track, planned_unstructured.
 */
export function isEligibleSlipForResume(record: DietBlockVerification): boolean {
  if (record.detailedOutcome) {
    return (
      record.detailedOutcome === 'structured_slip' ||
      record.detailedOutcome === 'unstructured_slip'
    );
  }
  return record.status === 'slip';
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
 * Calculates Structure Awareness statistics according to Phase 26C rules.
 *
 * Primary classification:
 *   - STRUCTURED CORE:
 *     - 'on_track'
 *     - 'adjusted_on_track'
 *     - legacy 'on-track' (status === 'on-track' without detailedOutcome)
 *
 *   - OUTSIDE CORE:
 *     - Flex / Off-Track: 'twenty_percent_off_track', 'planned_unstructured'
 *     - Risk: 'near_slip'
 *     - Slip: 'structured_slip', 'unstructured_slip', legacy 'slip'
 *
 * Outside Core is an awareness metric, never labeled as bad or failure.
 */
export function getStructureStats(
  records: DietBlockVerification[],
  options?: StructureAnalyticsOptions
): StructureAwarenessStatsResult {
  const fallback = options?.legacySlipFallback || 'unclassified';
  let structuredCoreCount = 0;
  let flexOffTrackCount = 0;
  let riskCount = 0;
  let slipCount = 0;
  let unclassifiedCount = 0;

  let nearSlipCount = 0;
  let twentyPercentOffTrackCount = 0;
  let structuredSlipCount = 0;
  let unstructuredSlipCount = 0;
  let totalSlips = 0;

  let plannedCount = 0;
  let spontaneousCount = 0;

  const outcomeCounts: Record<DetailedBlockOutcome, number> = {
    on_track: 0,
    adjusted_on_track: 0,
    twenty_percent_off_track: 0,
    planned_unstructured: 0,
    near_slip: 0,
    structured_slip: 0,
    unstructured_slip: 0,
  };

  for (const r of records) {
    if (r.isUnplanned || r.plannedBlockId.startsWith('unplanned_')) {
      spontaneousCount++;
    } else {
      plannedCount++;
    }

    if (r.detailedOutcome && (ALL_DETAILED_OUTCOMES as readonly string[]).includes(r.detailedOutcome)) {
      outcomeCounts[r.detailedOutcome]++;
    }

    if (r.detailedOutcome === 'near_slip') {
      nearSlipCount++;
    } else if (r.detailedOutcome === 'twenty_percent_off_track') {
      twentyPercentOffTrackCount++;
    } else if (r.detailedOutcome === 'structured_slip') {
      structuredSlipCount++;
    } else if (r.detailedOutcome === 'unstructured_slip') {
      unstructuredSlipCount++;
    }

    if (isEligibleSlipForResume(r)) {
      totalSlips++;
    }

    const bucket = classifyRecordOutcome(r.detailedOutcome, r.status);
    if (bucket === 'structured_core') {
      structuredCoreCount++;
    } else if (bucket === 'flex_off_track') {
      flexOffTrackCount++;
    } else if (bucket === 'risk') {
      riskCount++;
    } else if (bucket === 'slip') {
      slipCount++;
    } else if (r.status === 'slip' && !r.detailedOutcome) {
      if (fallback === 'unstructured') {
        flexOffTrackCount++;
      } else if (fallback === 'structured') {
        structuredCoreCount++;
      } else {
        unclassifiedCount++;
      }
    } else {
      unclassifiedCount++;
    }
  }

  const outsideCoreCount = flexOffTrackCount + riskCount + slipCount;
  const totalClassified = structuredCoreCount + outsideCoreCount;
  const totalRecords = records.length;
  const hasData = totalClassified > 0;

  let structuredCorePercentage = 0;
  let outsideCorePercentage = 0;

  if (hasData) {
    structuredCorePercentage = formatPercentage((structuredCoreCount / totalClassified) * 100);
    // Ensure the pair cleanly sums to 100%
    outsideCorePercentage = formatPercentage(100 - structuredCorePercentage);
  }

  const buckets = {
    structuredCore: {
      key: 'structured_core' as const,
      count: structuredCoreCount,
      percentage: totalClassified > 0 ? formatPercentage((structuredCoreCount / totalClassified) * 100) : 0,
    },
    flexOffTrack: {
      key: 'flex_off_track' as const,
      count: flexOffTrackCount,
      percentage: totalClassified > 0 ? formatPercentage((flexOffTrackCount / totalClassified) * 100) : 0,
    },
    risk: {
      key: 'risk' as const,
      count: riskCount,
      percentage: totalClassified > 0 ? formatPercentage((riskCount / totalClassified) * 100) : 0,
    },
    slip: {
      key: 'slip' as const,
      count: slipCount,
      percentage: totalClassified > 0 ? formatPercentage((slipCount / totalClassified) * 100) : 0,
    },
  };

  const detailedOutcomes: DetailedOutcomeDistributionItem[] = ALL_DETAILED_OUTCOMES.map(outcome => {
    const count = outcomeCounts[outcome];
    const percentage = totalRecords > 0 ? formatPercentage((count / totalRecords) * 100) : 0;
    const bucket = (classifyRecordOutcome(outcome) === 'unclassified'
      ? 'structured_core'
      : classifyRecordOutcome(outcome)) as HighLevelBucketKey;

    return {
      outcome,
      count,
      percentage,
      bucket,
    };
  });

  return {
    structuredCoreCount,
    outsideCoreCount,
    structuredCorePercentage,
    outsideCorePercentage,
    buckets,
    detailedOutcomes,
    structuredCount: structuredCoreCount,
    unstructuredCount: outsideCoreCount,
    structuredPercentage: structuredCorePercentage,
    unstructuredPercentage: outsideCorePercentage,
    totalClassified,
    totalRecords,
    hasData,
    unclassifiedCount,
    nearSlipCount,
    twentyPercentOffTrackCount,
    structuredSlipCount,
    unstructuredSlipCount,
    totalSlips,
    plannedCount,
    spontaneousCount,
  };
}

// ── Resume Analytics ──────────────────────────────────────────────────────────

/**
 * Calculates Resume statistics according to Phase 26A / 26C rules:
 *
 * Denominator includes strictly true slip events requiring recovery:
 *   - 'structured_slip'
 *   - 'unstructured_slip'
 *   - legacy slip records without detailedOutcome
 *
 * Excludes:
 *   - 'twenty_percent_off_track' (NOT a slip; intentional flexibility)
 *   - 'near_slip' (boundary preserved; no slip occurred to resume from)
 *   - 'on_track', 'adjusted_on_track', 'planned_unstructured'
 *
 * Empty state: when eligibleCount === 0, hasEligibleSlips is false.
 */
export function getResumeStats(records: DietBlockVerification[]): ResumeAwarenessStatsResult {
  const eligible = records.filter(isEligibleSlipForResume);
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

// ── Drift Analytics (Phase 26D) ─────────────────────────────────────────────

/**
 * Calculates Drift statistics according to Phase 26D rules:
 *
 * Denominator includes strictly eligible slips (same as Resume Rate):
 *   - 'structured_slip'
 *   - 'unstructured_slip'
 *   - legacy slip records without detailedOutcome
 *
 * Excludes:
 *   - 'twenty_percent_off_track'
 *   - 'near_slip'
 *   - 'on_track', 'adjusted_on_track', 'planned_unstructured'
 *
 * Single slip entering drift:
 *   - Counted as exactly ONE entered drift episode even if user transitions
 *     none -> started -> drifting -> stopped.
 *
 * Currently drifting:
 *   - 'started' or 'drifting'
 *
 * Stopped drift:
 *   - 'stopped'
 *
 * Drift Rate:
 *   - (enteredDriftCount / eligibleCount) * 100
 */
export function getDriftStats(records: DietBlockVerification[]): DriftAwarenessStatsResult {
  const eligible = records.filter(isEligibleSlipForResume);
  const eligibleCount = eligible.length;

  if (eligibleCount === 0) {
    return {
      eligibleCount: 0,
      enteredDriftCount: 0,
      currentlyDriftingCount: 0,
      stoppedDriftCount: 0,
      driftRate: 0,
      hasEligibleSlips: false,
    };
  }

  let enteredDriftCount = 0;
  let currentlyDriftingCount = 0;
  let stoppedDriftCount = 0;

  for (const r of eligible) {
    const hasEntered = Boolean(
      r.driftStartedAt != null ||
      (r.driftState && r.driftState !== 'none')
    );

    if (hasEntered) {
      enteredDriftCount++;
    }

    if (r.driftState === 'started' || r.driftState === 'drifting') {
      currentlyDriftingCount++;
    } else if (r.driftState === 'stopped') {
      stoppedDriftCount++;
    }
  }

  const driftRate = formatPercentage((enteredDriftCount / eligibleCount) * 100);

  return {
    eligibleCount,
    enteredDriftCount,
    currentlyDriftingCount,
    stoppedDriftCount,
    driftRate,
    hasEligibleSlips: true,
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
 * Guarantees NO double counting of planned and actual categories for the same event,
 * and deduplicates categories within the same record.
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
 * Calculates food category counts and Category Record Rate distribution across verified records.
 *
 * Category Record Rate =
 *   number of food records containing category /
 *   number of food records with at least one category * 100
 *
 * Categories are MULTI-SELECT: percentages can overlap and do NOT need to sum to 100%.
 * Categories within a single record are deduplicated.
 */
export function getFoodCategoryStats(records: DietBlockVerification[]): FoodCategoryStatsResult {
  const counts = {} as Record<FoodCategoryKey, number>;
  for (const key of FOOD_CATEGORY_KEYS) {
    counts[key] = 0;
  }

  let totalCategoryOccurrences = 0;
  let recordsWithCategories = 0;
  const totalBlocks = records.length;

  for (const record of records) {
    const cats = getRecordFoodCategories(record);
    if (cats.length > 0) {
      recordsWithCategories++;
    }
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
      recordsWithCategories > 0
        ? formatPercentage((count / recordsWithCategories) * 100)
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

  // Itemized portion tracking (Phase 28)
  const accum: Record<FoodCategoryKey, Record<string, ItemizedFoodPortionStat>> = {
    protein: {},
    simple_carbs: {},
    complex_carbs: {},
    healthy_fats: {},
    vegetables: {},
    fruits: {},
    desserts: {},
    snacks: {},
    beverages: {},
  };
  let totalPortionsLogged = 0;

  for (const record of records) {
    const rawQuantities: FoodQuantitiesMap =
      record.actualFoodQuantities ||
      record.foodQuantities ||
      record.plannedSnapshot?.foodQuantities ||
      {};

    const canonicalSelections =
      record.actualFoodSelections ||
      record.foodSelections ||
      record.plannedSnapshot?.foodSelections ||
      {};

    const customSelections =
      record.actualCustomFoods ||
      record.customFoods ||
      record.plannedSnapshot?.customFoods ||
      {};

    // 1. Process canonical food selections
    for (const [catStr, foods] of Object.entries(canonicalSelections)) {
      const cat = catStr as FoodCategoryKey;
      if (!accum[cat] || !Array.isArray(foods)) continue;

      for (const foodKey of foods) {
        if (!foodKey || typeof foodKey !== 'string') continue;
        const normalizedKey = foodKey.trim().toLowerCase();
        if (!accum[cat][normalizedKey]) {
          accum[cat][normalizedKey] = {
            key: normalizedKey,
            category: cat,
            isCustom: false,
            totalOccurrences: 0,
            quantitiesByUnit: {},
          };
        }
        accum[cat][normalizedKey].totalOccurrences++;

        const qtyKey = getFoodQuantityKey(cat, normalizedKey, false);
        const qty = rawQuantities[qtyKey];
        if (qty && typeof qty.amount === 'number' && !isNaN(qty.amount) && qty.amount > 0 && typeof qty.unit === 'string') {
          const unitKey = qty.unit === 'custom' && qty.customUnit ? `custom:${qty.customUnit.toLowerCase()}` : qty.unit;
          if (!accum[cat][normalizedKey].quantitiesByUnit[unitKey]) {
            accum[cat][normalizedKey].quantitiesByUnit[unitKey] = {
              totalAmount: 0,
              unit: qty.unit,
              customUnit: qty.customUnit,
            };
          }
          accum[cat][normalizedKey].quantitiesByUnit[unitKey].totalAmount += qty.amount;
          totalPortionsLogged++;
        }
      }
    }

    // 2. Process custom foods
    for (const [catStr, customFoods] of Object.entries(customSelections)) {
      const cat = catStr as FoodCategoryKey;
      if (!accum[cat] || !Array.isArray(customFoods)) continue;

      for (const customFood of customFoods) {
        if (!customFood || typeof customFood !== 'string') continue;
        const normalizedKey = customFood.trim().toLowerCase();
        const customIdent = `custom:${normalizedKey}`;
        if (!accum[cat][customIdent]) {
          accum[cat][customIdent] = {
            key: customFood.trim(),
            category: cat,
            isCustom: true,
            totalOccurrences: 0,
            quantitiesByUnit: {},
          };
        }
        accum[cat][customIdent].totalOccurrences++;

        const qtyKey = getFoodQuantityKey(cat, normalizedKey, true);
        const qty = rawQuantities[qtyKey];
        if (qty && typeof qty.amount === 'number' && !isNaN(qty.amount) && qty.amount > 0 && typeof qty.unit === 'string') {
          const unitKey = qty.unit === 'custom' && qty.customUnit ? `custom:${qty.customUnit.toLowerCase()}` : qty.unit;
          if (!accum[cat][customIdent].quantitiesByUnit[unitKey]) {
            accum[cat][customIdent].quantitiesByUnit[unitKey] = {
              totalAmount: 0,
              unit: qty.unit,
              customUnit: qty.customUnit,
            };
          }
          accum[cat][customIdent].quantitiesByUnit[unitKey].totalAmount += qty.amount;
          totalPortionsLogged++;
        }
      }
    }
  }

  const itemizedPortions: Record<FoodCategoryKey, ItemizedFoodPortionStat[]> = {
    protein: [],
    simple_carbs: [],
    complex_carbs: [],
    healthy_fats: [],
    vegetables: [],
    fruits: [],
    desserts: [],
    snacks: [],
    beverages: [],
  };

  for (const cat of FOOD_CATEGORY_KEYS) {
    const itemsList = Object.values(accum[cat]);
    itemsList.sort((a, b) => b.totalOccurrences - a.totalOccurrences);
    itemizedPortions[cat] = itemsList;
  }

  return {
    totalBlocks,
    recordsWithCategories,
    totalCategoryOccurrences,
    items,
    itemizedPortions,
    totalPortionsLogged,
    hasData: totalBlocks > 0 && recordsWithCategories > 0,
  };
}

// ── Specific Food Distribution Analytics (Phase 7C) ───────────────────────────

export interface SpecificFoodOccurrence {
  key: string;
  category: FoodCategoryKey;
  isCustom: boolean;
}

export interface SpecificFoodDistributionItem {
  key: string;
  category: FoodCategoryKey;
  isCustom: boolean;
  count: number;
  categoryPercentage: number; // percentage within parent category
  overallPercentage: number;  // percentage of all specific food selections
}

export interface SpecificFoodStatsResult {
  totalSpecificFoodOccurrences: number;
  items: SpecificFoodDistributionItem[];
  byCategory: Record<FoodCategoryKey, { total: number; items: SpecificFoodDistributionItem[] }>;
  topFoods: SpecificFoodDistributionItem[];
  hasData: boolean;
}

/**
 * Extracts specific food occurrences (canonical + custom) from a verification record.
 * Prioritizes actual selections if reported, falling back to planned snapshot.
 */
export function getRecordSpecificFoods(record: DietBlockVerification): SpecificFoodOccurrence[] {
  const result: SpecificFoodOccurrence[] = [];
  const foodSelections = record.actualFoodSelections || record.foodSelections || record.plannedSnapshot?.foodSelections;
  const customFoods = record.actualCustomFoods || record.customFoods || record.plannedSnapshot?.customFoods;

  if (foodSelections && typeof foodSelections === 'object') {
    for (const [cat, foods] of Object.entries(foodSelections)) {
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(cat) && Array.isArray(foods)) {
        for (const food of foods) {
          if (typeof food === 'string' && food.trim().length > 0) {
            result.push({
              key: food.trim(),
              category: cat as FoodCategoryKey,
              isCustom: false,
            });
          }
        }
      }
    }
  }

  if (customFoods && typeof customFoods === 'object') {
    for (const [cat, foods] of Object.entries(customFoods)) {
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(cat) && Array.isArray(foods)) {
        for (const food of foods) {
          if (typeof food === 'string' && food.trim().length > 0) {
            result.push({
              key: food.trim(),
              category: cat as FoodCategoryKey,
              isCustom: true,
            });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Calculates specific food occurrence counts and percentages across verified records.
 * Denominator within category: specific food count / total specific food selections in that category * 100.
 */
export function getSpecificFoodStats(records: DietBlockVerification[]): SpecificFoodStatsResult {
  const categoryTotals: Record<FoodCategoryKey, number> = {
    protein: 0,
    simple_carbs: 0,
    complex_carbs: 0,
    healthy_fats: 0,
    vegetables: 0,
    fruits: 0,
    desserts: 0,
    snacks: 0,
    beverages: 0,
  };

  const itemMap = new Map<string, { key: string; category: FoodCategoryKey; isCustom: boolean; count: number }>();
  let totalSpecificFoodOccurrences = 0;

  for (const record of records) {
    const specificFoods = getRecordSpecificFoods(record);
    for (const food of specificFoods) {
      totalSpecificFoodOccurrences++;
      categoryTotals[food.category] = (categoryTotals[food.category] || 0) + 1;

      const mapKey = `${food.category}::${food.isCustom ? 'custom' : 'canonical'}::${food.key.toLowerCase()}`;
      const existing = itemMap.get(mapKey);
      if (existing) {
        existing.count++;
      } else {
        itemMap.set(mapKey, {
          key: food.key,
          category: food.category,
          isCustom: food.isCustom,
          count: 1,
        });
      }
    }
  }

  const items: SpecificFoodDistributionItem[] = Array.from(itemMap.values()).map(raw => {
    const catTotal = categoryTotals[raw.category] || 0;
    const categoryPercentage = catTotal > 0 ? formatPercentage((raw.count / catTotal) * 100) : 0;
    const overallPercentage =
      totalSpecificFoodOccurrences > 0
        ? formatPercentage((raw.count / totalSpecificFoodOccurrences) * 100)
        : 0;

    return {
      key: raw.key,
      category: raw.category,
      isCustom: raw.isCustom,
      count: raw.count,
      categoryPercentage,
      overallPercentage,
    };
  });

  // Sort descending by count
  items.sort((a, b) => b.count - a.count);

  const byCategory: Record<FoodCategoryKey, { total: number; items: SpecificFoodDistributionItem[] }> = {
    protein: { total: categoryTotals.protein, items: items.filter(i => i.category === 'protein') },
    simple_carbs: { total: categoryTotals.simple_carbs, items: items.filter(i => i.category === 'simple_carbs') },
    complex_carbs: { total: categoryTotals.complex_carbs, items: items.filter(i => i.category === 'complex_carbs') },
    healthy_fats: { total: categoryTotals.healthy_fats, items: items.filter(i => i.category === 'healthy_fats') },
    vegetables: { total: categoryTotals.vegetables, items: items.filter(i => i.category === 'vegetables') },
    fruits: { total: categoryTotals.fruits, items: items.filter(i => i.category === 'fruits') },
    desserts: { total: categoryTotals.desserts, items: items.filter(i => i.category === 'desserts') },
    snacks: { total: categoryTotals.snacks, items: items.filter(i => i.category === 'snacks') },
    beverages: { total: categoryTotals.beverages, items: items.filter(i => i.category === 'beverages') },
  };

  return {
    totalSpecificFoodOccurrences,
    items,
    byCategory,
    topFoods: items.slice(0, 10),
    hasData: totalSpecificFoodOccurrences > 0,
  };
}

// ── Combined Awareness Summary ────────────────────────────────────────────────

/**
 * High-level helper returning all awareness metrics for a given period and profile.
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
  const driftStats = getDriftStats(filteredRecords);
  const categoryStats = getFoodCategoryStats(filteredRecords);

  return {
    period,
    profileId: activeProfileId,
    totalVerifiedRecords: filteredRecords.length,
    structureStats,
    resumeStats,
    driftStats,
    categoryStats,
  };
}

