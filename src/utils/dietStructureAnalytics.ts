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
  type FoodItemQuantity,
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
  portionCount: number;
  percentage: number;                 // 0 - 100: quantity-weighted percentage of totalPortions
  hasExplicitPortions: boolean;
  recordPercentage: number;           // 0 - 100: original record occurrence rate
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
  totalPortions: number;              // Total quantity-weighted food portions
  hasExplicitPortions: boolean;
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
  if (record.recordType === 'neutral') return false;
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
      if (entry.recordType === 'neutral') {
        continue;
      }
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
  records = records.filter(r => r.recordType !== 'neutral');
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
  records = records.filter(r => r.recordType !== 'neutral');
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
  records = records.filter(r => r.recordType !== 'neutral');
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
  if (record.recordType === 'neutral') {
    return [];
  }
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

// ── Food Analytics Weighting & Portion Rules (Phase 32) ────────────────────────

/**
 * Determines whether a quantity unit represents a countable food portion
 * rather than a physical measurement (e.g. grams, ml, oz) or non-food unit.
 *
 * Recognized portion units:
 *   - 'portion', 'serving', 'piece', 'slice', 'cup'
 *   - custom unit whose text explicitly represents a portion/serving
 *
 * Physical units (gram, oz, ml) return false.
 */
export function isPortionCountUnit(unit?: FoodQuantityUnit | string, customUnit?: string): boolean {
  if (!unit) return false;
  const normalized = unit.trim().toLowerCase();
  if (['portion', 'serving', 'piece', 'slice', 'cup'].includes(normalized)) {
    return true;
  }
  if (normalized === 'custom' && customUnit && typeof customUnit === 'string') {
    const cLower = customUnit.trim().toLowerCase();
    const PORTION_SYNONYMS = [
      'portion', 'portions',
      'serving', 'servings',
      'piece', 'pieces',
      'slice', 'slices',
      'cup', 'cups',
      'portie', 'porties',
      'porción', 'porciones',
    ];
    return PORTION_SYNONYMS.includes(cLower);
  }
  return false;
}

/**
 * Extracts a safe portion weight from a FoodItemQuantity.
 * If the quantity is an explicit portion count with amount > 0, returns that amount.
 * If the quantity is a physical unit (e.g. 250 g, 350 ml) or invalid/zero/negative,
 * returns fallback weight 1 (isExplicitPortion = false).
 */
export function getFoodItemPortionWeight(qty?: FoodItemQuantity | null): { weight: number; isExplicitPortion: boolean } {
  if (!qty || typeof qty.amount !== 'number') {
    return { weight: 1, isExplicitPortion: false };
  }
  if (isNaN(qty.amount) || !isFinite(qty.amount) || qty.amount <= 0) {
    return { weight: 1, isExplicitPortion: false };
  }
  if (isPortionCountUnit(qty.unit, qty.customUnit)) {
    return { weight: qty.amount, isExplicitPortion: true };
  }
  // Physical measurement unit (g, ml, oz) or non-portion custom unit: safe fallback 1
  return { weight: 1, isExplicitPortion: false };
}

/**
 * Resolves the quantity-weighted portion count and explicit flag for a category within a single record.
 * Handles:
 *   - Neutral logs: weight 0, isExplicitPortion false
 *   - Itemized foods in this category (canonical + custom): sums item portion weights
 *   - Single category records with entryQuantity
 *   - Multi-category records without itemized breakdown: safe fallback weight 1 per category
 *   - Fallback weight 1 for records with no explicit portion counts
 */
export function getRecordCategoryPortionWeight(
  record: DietBlockVerification,
  category: FoodCategoryKey
): { weight: number; isExplicitPortion: boolean } {
  if (record.recordType === 'neutral') {
    return { weight: 0, isExplicitPortion: false };
  }

  const recordCategories = getRecordFoodCategories(record);
  if (!recordCategories.includes(category)) {
    return { weight: 0, isExplicitPortion: false };
  }

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

  const canonicalFoods = Array.isArray(canonicalSelections[category]) ? canonicalSelections[category]! : [];
  const customFoods = Array.isArray(customSelections[category]) ? customSelections[category]! : [];

  const totalFoodItems = canonicalFoods.length + customFoods.length;

  // Case 1: Specific food items exist under this category
  if (totalFoodItems > 0) {
    let categoryWeight = 0;
    let hasExplicit = false;

    for (const foodKey of canonicalFoods) {
      if (!foodKey || typeof foodKey !== 'string') continue;
      const normalizedKey = foodKey.trim().toLowerCase();
      const qtyKey = getFoodQuantityKey(category, normalizedKey, false);
      const qty = rawQuantities[qtyKey];
      if (qty) {
        const itemResult = getFoodItemPortionWeight(qty);
        categoryWeight += itemResult.weight;
        if (itemResult.isExplicitPortion) hasExplicit = true;
      } else {
        categoryWeight += 1;
      }
    }

    for (const customFood of customFoods) {
      if (!customFood || typeof customFood !== 'string') continue;
      const normalizedKey = customFood.trim().toLowerCase();
      const qtyKey = getFoodQuantityKey(category, normalizedKey, true);
      const qty = rawQuantities[qtyKey];
      if (qty) {
        const itemResult = getFoodItemPortionWeight(qty);
        categoryWeight += itemResult.weight;
        if (itemResult.isExplicitPortion) hasExplicit = true;
      } else {
        categoryWeight += 1;
      }
    }

    // If specific food items had no itemized quantities, but record has an entryQuantity
    // and this was the ONLY category on the record, apply the entryQuantity if valid portion count
    if (!hasExplicit && recordCategories.length === 1 && record.entryQuantity) {
      const entryResult = getFoodItemPortionWeight(record.entryQuantity);
      if (entryResult.isExplicitPortion) {
        return { weight: entryResult.weight, isExplicitPortion: true };
      }
    }

    return { weight: categoryWeight, isExplicitPortion: hasExplicit };
  }

  // Case 2: No specific food items listed under this category, but category is in recordCategories
  // Check record.entryQuantity if this is the ONLY category in this record
  if (recordCategories.length === 1 && record.entryQuantity) {
    const entryResult = getFoodItemPortionWeight(record.entryQuantity);
    if (entryResult.isExplicitPortion) {
      return { weight: entryResult.weight, isExplicitPortion: true };
    }
  }

  // Default fallback weight for this category in this record
  return { weight: 1, isExplicitPortion: false };
}

/**
 * Universal helper returning the food analytics weight of a record, optionally scoped to a category.
 *
 * Examples:
 *   - getFoodAnalyticsWeight(record, 'protein') => portion weight of protein in record
 *   - getFoodAnalyticsWeight(record) => total portion weight of all food categories in record
 */
export function getFoodAnalyticsWeight(
  record: DietBlockVerification,
  category?: FoodCategoryKey
): number {
  if (record.recordType === 'neutral') {
    return 0;
  }
  if (category) {
    return getRecordCategoryPortionWeight(record, category).weight;
  }
  const cats = getRecordFoodCategories(record);
  if (cats.length === 0) return 0;
  let total = 0;
  for (const cat of cats) {
    total += getRecordCategoryPortionWeight(record, cat).weight;
  }
  return total;
}

// ── Food Category Distribution Analytics ──────────────────────────────────────

/**
 * Calculates food category counts and quantity-weighted distribution across verified records.
 *
 * Category percentage =
 *   category weighted portions /
 *   total weighted food portions across all categories * 100
 *
 * Preserves occurrence count and recordPercentage for backward compatibility.
 * Safely handles empty records and zero denominators (returns 0%).
 */
export function getFoodCategoryStats(records: DietBlockVerification[]): FoodCategoryStatsResult {
  records = records.filter(r => r.recordType !== 'neutral');
  const counts = {} as Record<FoodCategoryKey, number>;
  const portionCounts = {} as Record<FoodCategoryKey, number>;
  const categoryExplicitPortions = {} as Record<FoodCategoryKey, boolean>;

  for (const key of FOOD_CATEGORY_KEYS) {
    counts[key] = 0;
    portionCounts[key] = 0;
    categoryExplicitPortions[key] = false;
  }

  let totalCategoryOccurrences = 0;
  let recordsWithCategories = 0;
  let hasAnyExplicitPortions = false;
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

        const weightResult = getRecordCategoryPortionWeight(record, cat);
        portionCounts[cat] = (portionCounts[cat] || 0) + weightResult.weight;
        if (weightResult.isExplicitPortion) {
          categoryExplicitPortions[cat] = true;
          hasAnyExplicitPortions = true;
        }
      }
    }
  }

  let totalPortions = 0;
  for (const key of FOOD_CATEGORY_KEYS) {
    totalPortions += portionCounts[key] || 0;
  }
  totalPortions = Math.round(totalPortions * 100) / 100;

  const items: CategoryDistributionItem[] = FOOD_CATEGORY_KEYS.map(key => {
    const count = counts[key] || 0;
    const catPortions = portionCounts[key] || 0;
    const percentage =
      totalPortions > 0
        ? formatPercentage((catPortions / totalPortions) * 100)
        : 0;
    const recordPercentage =
      recordsWithCategories > 0
        ? formatPercentage((count / recordsWithCategories) * 100)
        : 0;

    return {
      category: key,
      count,
      portionCount: Math.round(catPortions * 100) / 100,
      percentage,
      hasExplicitPortions: categoryExplicitPortions[key] || false,
      recordPercentage,
    };
  });

  // Sort descending by portionCount, then count, with stable original index as tie breaker
  items.sort((a, b) => {
    if (b.portionCount !== a.portionCount) return b.portionCount - a.portionCount;
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
    soups: {},
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
          accum[cat][normalizedKey].quantitiesByUnit[unitKey].totalAmount =
            Math.round((accum[cat][normalizedKey].quantitiesByUnit[unitKey].totalAmount + qty.amount) * 100) / 100;
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
          accum[cat][customIdent].quantitiesByUnit[unitKey].totalAmount =
            Math.round((accum[cat][customIdent].quantitiesByUnit[unitKey].totalAmount + qty.amount) * 100) / 100;
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
    soups: [],
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
    totalPortions,
    hasExplicitPortions: hasAnyExplicitPortions,
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
  portionCount: number;
  categoryPercentage: number; // percentage within parent category
  overallPercentage: number;  // percentage of all specific food selections
  hasExplicitPortions: boolean;
}

export interface SpecificFoodStatsResult {
  totalSpecificFoodOccurrences: number;
  totalSpecificFoodPortions: number;
  items: SpecificFoodDistributionItem[];
  byCategory: Record<FoodCategoryKey, { total: number; totalPortions: number; items: SpecificFoodDistributionItem[] }>;
  topFoods: SpecificFoodDistributionItem[];
  hasData: boolean;
}

/**
 * Extracts specific food occurrences (canonical + custom) from a verification record.
 * Prioritizes actual selections if reported, falling back to planned snapshot.
 */
export function getRecordSpecificFoods(record: DietBlockVerification): SpecificFoodOccurrence[] {
  if (record.recordType === 'neutral') {
    return [];
  }
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
 * Incorporates quantity weighting (Phase 32) when explicit portions exist.
 * Denominator within category: specific food portions / total specific food portions in that category * 100.
 */
export function getSpecificFoodStats(records: DietBlockVerification[]): SpecificFoodStatsResult {
  records = records.filter(r => r.recordType !== 'neutral');
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
    soups: 0,
  };
  const categoryPortionTotals: Record<FoodCategoryKey, number> = {
    protein: 0,
    simple_carbs: 0,
    complex_carbs: 0,
    healthy_fats: 0,
    vegetables: 0,
    fruits: 0,
    desserts: 0,
    snacks: 0,
    beverages: 0,
    soups: 0,
  };

  const itemMap = new Map<
    string,
    { key: string; category: FoodCategoryKey; isCustom: boolean; count: number; portionCount: number; hasExplicitPortions: boolean }
  >();
  let totalSpecificFoodOccurrences = 0;
  let totalSpecificFoodPortions = 0;

  for (const record of records) {
    const specificFoods = getRecordSpecificFoods(record);
    const rawQuantities: FoodQuantitiesMap =
      record.actualFoodQuantities ||
      record.foodQuantities ||
      record.plannedSnapshot?.foodQuantities ||
      {};

    for (const food of specificFoods) {
      const qtyKey = getFoodQuantityKey(food.category, food.key, food.isCustom);
      const qty = rawQuantities[qtyKey];
      let itemWeight = 1;
      let isExplicit = false;

      if (qty) {
        const itemResult = getFoodItemPortionWeight(qty);
        itemWeight = itemResult.weight;
        isExplicit = itemResult.isExplicitPortion;
      } else if (specificFoods.length === 1 && record.entryQuantity) {
        const entryResult = getFoodItemPortionWeight(record.entryQuantity);
        if (entryResult.isExplicitPortion) {
          itemWeight = entryResult.weight;
          isExplicit = true;
        }
      }

      totalSpecificFoodOccurrences++;
      totalSpecificFoodPortions += itemWeight;
      categoryTotals[food.category] = (categoryTotals[food.category] || 0) + 1;
      categoryPortionTotals[food.category] = (categoryPortionTotals[food.category] || 0) + itemWeight;

      const mapKey = `${food.category}::${food.isCustom ? 'custom' : 'canonical'}::${food.key.toLowerCase()}`;
      const existing = itemMap.get(mapKey);
      if (existing) {
        existing.count++;
        existing.portionCount += itemWeight;
        if (isExplicit) existing.hasExplicitPortions = true;
      } else {
        itemMap.set(mapKey, {
          key: food.key,
          category: food.category,
          isCustom: food.isCustom,
          count: 1,
          portionCount: itemWeight,
          hasExplicitPortions: isExplicit,
        });
      }
    }
  }

  totalSpecificFoodPortions = Math.round(totalSpecificFoodPortions * 100) / 100;

  const items: SpecificFoodDistributionItem[] = Array.from(itemMap.values()).map(raw => {
    const catPortionTotal = categoryPortionTotals[raw.category] || 0;
    const categoryPercentage = catPortionTotal > 0 ? formatPercentage((raw.portionCount / catPortionTotal) * 100) : 0;
    const overallPercentage =
      totalSpecificFoodPortions > 0
        ? formatPercentage((raw.portionCount / totalSpecificFoodPortions) * 100)
        : 0;

    return {
      key: raw.key,
      category: raw.category,
      isCustom: raw.isCustom,
      count: raw.count,
      portionCount: Math.round(raw.portionCount * 100) / 100,
      categoryPercentage,
      overallPercentage,
      hasExplicitPortions: raw.hasExplicitPortions,
    };
  });

  // Sort descending by portionCount, then count
  items.sort((a, b) => {
    if (b.portionCount !== a.portionCount) return b.portionCount - a.portionCount;
    return b.count - a.count;
  });

  const byCategory: Record<FoodCategoryKey, { total: number; totalPortions: number; items: SpecificFoodDistributionItem[] }> = {
    protein: { total: categoryTotals.protein, totalPortions: categoryPortionTotals.protein, items: items.filter(i => i.category === 'protein') },
    simple_carbs: { total: categoryTotals.simple_carbs, totalPortions: categoryPortionTotals.simple_carbs, items: items.filter(i => i.category === 'simple_carbs') },
    complex_carbs: { total: categoryTotals.complex_carbs, totalPortions: categoryPortionTotals.complex_carbs, items: items.filter(i => i.category === 'complex_carbs') },
    healthy_fats: { total: categoryTotals.healthy_fats, totalPortions: categoryPortionTotals.healthy_fats, items: items.filter(i => i.category === 'healthy_fats') },
    vegetables: { total: categoryTotals.vegetables, totalPortions: categoryPortionTotals.vegetables, items: items.filter(i => i.category === 'vegetables') },
    fruits: { total: categoryTotals.fruits, totalPortions: categoryPortionTotals.fruits, items: items.filter(i => i.category === 'fruits') },
    desserts: { total: categoryTotals.desserts, totalPortions: categoryPortionTotals.desserts, items: items.filter(i => i.category === 'desserts') },
    snacks: { total: categoryTotals.snacks, totalPortions: categoryPortionTotals.snacks, items: items.filter(i => i.category === 'snacks') },
    beverages: { total: categoryTotals.beverages, totalPortions: categoryPortionTotals.beverages, items: items.filter(i => i.category === 'beverages') },
    soups: { total: categoryTotals.soups, totalPortions: categoryPortionTotals.soups, items: items.filter(i => i.category === 'soups') },
  };

  return {
    totalSpecificFoodOccurrences,
    totalSpecificFoodPortions,
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

