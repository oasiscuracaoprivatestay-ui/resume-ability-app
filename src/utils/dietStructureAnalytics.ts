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
  nearSlipCount: number;          // Approaches boundary but stopped
  structuredSlipCount: number;    // True slip that retained structure
  unstructuredSlipCount: number;  // True slip without structure
  totalSlips: number;             // Total true slips (structured_slip + unstructured_slip + legacy slip)
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
  percentage: number;             // 0 - 100 (percentage of blocks containing this category)
}

export interface FoodCategoryStatsResult {
  totalBlocks: number;
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
  let nearSlipCount = 0;
  let structuredSlipCount = 0;
  let unstructuredSlipCount = 0;
  let totalSlips = 0;

  for (const r of records) {
    if (r.detailedOutcome === 'near_slip') {
      nearSlipCount++;
    } else if (r.detailedOutcome === 'structured_slip') {
      structuredSlipCount++;
    } else if (r.detailedOutcome === 'unstructured_slip') {
      unstructuredSlipCount++;
    }

    if (isEligibleSlipRecord(r)) {
      totalSlips++;
    }

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
    nearSlipCount,
    structuredSlipCount,
    unstructuredSlipCount,
    totalSlips,
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
  const totalBlocks = records.length;

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
      totalBlocks > 0
        ? formatPercentage((count / totalBlocks) * 100)
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
    totalBlocks,
    totalCategoryOccurrences,
    items,
    hasData: totalBlocks > 0 && totalCategoryOccurrences > 0,
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

