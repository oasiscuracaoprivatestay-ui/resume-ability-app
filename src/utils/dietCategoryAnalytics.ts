/**
 * Diet Category Analytics Foundation — Phase 2
 *
 * Lightweight, reusable helper functions for calculating food category occurrences,
 * percentage distributions, and period breakdowns.
 *
 * Designed to power future analytics dashboards (daily, weekly, custom range).
 */

import { FOOD_CATEGORY_KEYS, type FoodCategoryKey, mapLegacyItemsToCategories } from '../data/dietData';
import type { StructuredDietBlock, StructuredDietDay } from './dietStorage';

/**
 * Extract active food categories for a block, falling back safely to mapped legacy items if needed.
 */
export function getBlockFoodCategories(block: StructuredDietBlock): FoodCategoryKey[] {
  if (Array.isArray(block.foodCategories) && block.foodCategories.length > 0) {
    return block.foodCategories;
  }
  if (Array.isArray(block.items) && block.items.length > 0) {
    return mapLegacyItemsToCategories(block.items);
  }
  return [];
}

/**
 * Creates an empty count map for all known food category keys.
 */
export function createEmptyCategoryCounts(): Record<FoodCategoryKey, number> {
  const counts = {} as Record<FoodCategoryKey, number>;
  for (const key of FOOD_CATEGORY_KEYS) {
    counts[key] = 0;
  }
  return counts;
}

/**
 * Counts occurrences of each food category across a collection of blocks.
 */
export function getCategoryCounts(blocks: StructuredDietBlock[]): Record<FoodCategoryKey, number> {
  const counts = createEmptyCategoryCounts();
  for (const block of blocks) {
    const cats = getBlockFoodCategories(block);
    for (const cat of cats) {
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(cat)) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Computes percentage breakdown of categories across a collection of blocks.
 * Percentage is based on total category selections (0% - 100%).
 * If no categories selected, all percentages are 0.
 */
export function getCategoryPercentages(blocks: StructuredDietBlock[]): Record<FoodCategoryKey, number> {
  const counts = getCategoryCounts(blocks);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const percentages = {} as Record<FoodCategoryKey, number>;

  for (const key of FOOD_CATEGORY_KEYS) {
    percentages[key] = total > 0 ? Math.round(((counts[key] / total) * 100) * 10) / 10 : 0;
  }

  return percentages;
}

export interface CategoryDistributionResult {
  totalBlocks: number;
  totalCategorySelections: number;
  categoryCounts: Record<FoodCategoryKey, number>;
  categoryPercentages: Record<FoodCategoryKey, number>;
}

/**
 * Computes category distribution across multiple StructuredDietDays (e.g. 7-day weekly plan).
 */
export function getDailyCategoryDistribution(days: StructuredDietDay[]): CategoryDistributionResult {
  const allBlocks: StructuredDietBlock[] = [];
  for (const day of days) {
    if (Array.isArray(day.blocks)) {
      allBlocks.push(...day.blocks);
    }
  }

  const categoryCounts = getCategoryCounts(allBlocks);
  const totalCategorySelections = Object.values(categoryCounts).reduce((sum, n) => sum + n, 0);
  const categoryPercentages = getCategoryPercentages(allBlocks);

  return {
    totalBlocks: allBlocks.length,
    totalCategorySelections,
    categoryCounts,
    categoryPercentages,
  };
}
