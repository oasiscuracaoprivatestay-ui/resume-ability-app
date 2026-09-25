/**
 * Canonical Food Options Library — Phase 7C
 *
 * Defines centralized, language-independent food options for each of the
 * 9 canonical food categories in Resume Ability.
 *
 * Principles:
 * - Language-independent canonical keys.
 * - Multi-select within each parent category.
 * - Lightweight & static (zero external API dependency).
 * - Purely informational awareness; 0 points, no macro/calorie calculation.
 */

import type { FoodCategoryKey } from './dietData';

export interface FoodOptionItem {
  key: string;               // Stable canonical key, e.g. 'chicken', 'broccoli'
  category: FoodCategoryKey; // Parent canonical category
  i18nKey: string;           // e.g. 'sdb_food_opt_chicken'
}

export type FoodSelectionsMap = Partial<Record<FoodCategoryKey, string[]>>;
export type CustomFoodsMap = Partial<Record<FoodCategoryKey, string[]>>;

export const FOOD_QUANTITY_UNITS = [
  'piece',
  'portion',
  'serving',
  'cup',
  'slice',
  'gram',
  'oz',
  'ml',
  'custom',
] as const;

export type FoodQuantityUnit = typeof FOOD_QUANTITY_UNITS[number];

export const SOUP_PORTION_KEYS = ['small', 'medium', 'large', 'xlarge'] as const;
export type SoupPortionKey = typeof SOUP_PORTION_KEYS[number];

export interface FoodItemQuantity {
  /** Numerical amount entered by user (e.g. 1, 2, 0.5, 3) */
  amount: number;
  /** Unit of measurement */
  unit: FoodQuantityUnit;
  /** Optional custom unit text if unit === 'custom' */
  customUnit?: string;
  /** Phase 31A: Optional explicit soup portion */
  soupPortion?: SoupPortionKey;
  /** Reserved for future phases (grams) */
  grams?: number;
  /** Reserved for future phases (calories) */
  calories?: number;
}

export type FoodQuantitiesMap = Record<string, FoodItemQuantity>;

export function getFoodQuantityKey(category: FoodCategoryKey, foodKey: string, isCustom = false): string {
  return isCustom
    ? `${category}:custom:${foodKey.trim().toLowerCase()}`
    : `${category}:${foodKey.trim().toLowerCase()}`;
}

export function parseFoodQuantityKey(key: string): { category: FoodCategoryKey; foodKey: string; isCustom: boolean } | null {
  const parts = key.split(':');
  if (parts.length === 2) {
    return { category: parts[0] as FoodCategoryKey, foodKey: parts[1], isCustom: false };
  }
  if (parts.length === 3 && parts[1] === 'custom') {
    return { category: parts[0] as FoodCategoryKey, foodKey: parts[2], isCustom: true };
  }
  return null;
}

export function formatQuantityValue(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return '0';
  const rounded = Math.round(amount * 100) / 100;
  const intPart = Math.floor(rounded);
  const fracPart = Math.round((rounded - intPart) * 100) / 100;

  let fracStr = '';
  if (Math.abs(fracPart - 0.5) < 0.01) {
    fracStr = '½';
  } else if (Math.abs(fracPart - 0.25) < 0.01) {
    fracStr = '¼';
  } else if (Math.abs(fracPart - 0.75) < 0.01) {
    fracStr = '¾';
  } else if (Math.abs(fracPart - 0.33) < 0.02) {
    fracStr = '⅓';
  } else if (Math.abs(fracPart - 0.67) < 0.02) {
    fracStr = '⅔';
  }

  if (fracStr) {
    return intPart > 0 ? `${intPart} ${fracStr}` : fracStr;
  }
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return String(rounded);
}

export function formatFoodItemQuantity(
  qty?: FoodItemQuantity | null,
  t?: any
): string {
  if (!qty || typeof qty.amount !== 'number' || isNaN(qty.amount) || qty.amount <= 0) return '';
  const amtStr = formatQuantityValue(qty.amount);
  if (qty.unit === 'custom') {
    return qty.customUnit ? `${amtStr} ${qty.customUnit}` : amtStr;
  }
  const unitKey = `sdb_unit_${qty.unit}`;
  let unitLabel: string = qty.unit;
  if (typeof t === 'function') {
    unitLabel = t(unitKey) || qty.unit;
  } else if (t && typeof t === 'object') {
    unitLabel = t[unitKey] || qty.unit;
  }
  const needsPlural = qty.amount > 1 && !['gram', 'oz', 'ml'].includes(qty.unit);
  const displayUnit = needsPlural ? `${unitLabel}s` : unitLabel;
  return `${amtStr} ${displayUnit}`;
}

export function formatSoupPortion(portion?: SoupPortionKey | null, t?: any): string {
  if (!portion) return '';
  const key = `sdb_soup_portion_${portion}`;
  if (typeof t === 'function') return t(key) || portion;
  if (t && typeof t === 'object') return t[key] || portion;
  if (portion === 'xlarge') return 'X-Large';
  return portion.charAt(0).toUpperCase() + portion.slice(1);
}

export function getDefaultFoodUnit(category: FoodCategoryKey, foodKey: string): FoodQuantityUnit {
  const k = foodKey.toLowerCase();
  if (category === 'soups') return 'portion';
  if (k.includes('bread') || k.includes('toast') || k.includes('pizza') || k.includes('cake')) return 'slice';
  if (['eggs', 'egg', 'apple', 'banana', 'orange', 'pear', 'peach', 'kiwi', 'cookie', 'cookies'].includes(k)) return 'piece';
  if (category === 'beverages' || k.includes('coffee') || k.includes('tea') || k.includes('water') || k.includes('milk') || k.includes('juice')) return 'cup';
  if (category === 'fruits' || category === 'snacks') return 'piece';
  return 'portion';
}

export const CANONICAL_FOOD_OPTIONS: Record<FoodCategoryKey, FoodOptionItem[]> = {
  protein: [
    { key: 'chicken', category: 'protein', i18nKey: 'sdb_food_opt_chicken' },
    { key: 'turkey', category: 'protein', i18nKey: 'sdb_food_opt_turkey' },
    { key: 'beef', category: 'protein', i18nKey: 'sdb_food_opt_beef' },
    { key: 'pork', category: 'protein', i18nKey: 'sdb_food_opt_pork' },
    { key: 'fish', category: 'protein', i18nKey: 'sdb_food_opt_fish' },
    { key: 'salmon', category: 'protein', i18nKey: 'sdb_food_opt_salmon' },
    { key: 'tuna', category: 'protein', i18nKey: 'sdb_food_opt_tuna' },
    { key: 'shrimp_seafood', category: 'protein', i18nKey: 'sdb_food_opt_shrimp_seafood' },
    { key: 'eggs', category: 'protein', i18nKey: 'sdb_food_opt_eggs' },
    { key: 'greek_yogurt', category: 'protein', i18nKey: 'sdb_food_opt_greek_yogurt' },
    { key: 'cottage_cheese', category: 'protein', i18nKey: 'sdb_food_opt_cottage_cheese' },
    { key: 'cheese', category: 'protein', i18nKey: 'sdb_food_opt_cheese' },
    { key: 'tofu', category: 'protein', i18nKey: 'sdb_food_opt_tofu' },
    { key: 'tempeh', category: 'protein', i18nKey: 'sdb_food_opt_tempeh' },
    { key: 'beans_legumes', category: 'protein', i18nKey: 'sdb_food_opt_beans_legumes' },
    { key: 'protein_shake', category: 'protein', i18nKey: 'sdb_food_opt_protein_shake' },
  ],
  simple_carbs: [
    { key: 'white_bread', category: 'simple_carbs', i18nKey: 'sdb_food_opt_white_bread' },
    { key: 'white_rice', category: 'simple_carbs', i18nKey: 'sdb_food_opt_white_rice' },
    { key: 'pasta', category: 'simple_carbs', i18nKey: 'sdb_food_opt_pasta' },
    { key: 'tortilla_wrap', category: 'simple_carbs', i18nKey: 'sdb_food_opt_tortilla_wrap' },
    { key: 'crackers', category: 'simple_carbs', i18nKey: 'sdb_food_opt_crackers' },
    { key: 'cereal', category: 'simple_carbs', i18nKey: 'sdb_food_opt_cereal' },
    { key: 'pastry', category: 'simple_carbs', i18nKey: 'sdb_food_opt_pastry' },
    { key: 'sugary_cereal', category: 'simple_carbs', i18nKey: 'sdb_food_opt_sugary_cereal' },
  ],
  complex_carbs: [
    { key: 'brown_rice', category: 'complex_carbs', i18nKey: 'sdb_food_opt_brown_rice' },
    { key: 'oats', category: 'complex_carbs', i18nKey: 'sdb_food_opt_oats' },
    { key: 'quinoa', category: 'complex_carbs', i18nKey: 'sdb_food_opt_quinoa' },
    { key: 'whole_grain_bread', category: 'complex_carbs', i18nKey: 'sdb_food_opt_whole_grain_bread' },
    { key: 'whole_grain_pasta', category: 'complex_carbs', i18nKey: 'sdb_food_opt_whole_grain_pasta' },
    { key: 'sweet_potato', category: 'complex_carbs', i18nKey: 'sdb_food_opt_sweet_potato' },
    { key: 'potato', category: 'complex_carbs', i18nKey: 'sdb_food_opt_potato' },
    { key: 'beans_legumes', category: 'complex_carbs', i18nKey: 'sdb_food_opt_beans_legumes' },
    { key: 'lentils', category: 'complex_carbs', i18nKey: 'sdb_food_opt_lentils' },
  ],
  healthy_fats: [
    { key: 'avocado', category: 'healthy_fats', i18nKey: 'sdb_food_opt_avocado' },
    { key: 'olive_oil', category: 'healthy_fats', i18nKey: 'sdb_food_opt_olive_oil' },
    { key: 'nuts', category: 'healthy_fats', i18nKey: 'sdb_food_opt_nuts' },
    { key: 'almonds', category: 'healthy_fats', i18nKey: 'sdb_food_opt_almonds' },
    { key: 'walnuts', category: 'healthy_fats', i18nKey: 'sdb_food_opt_walnuts' },
    { key: 'seeds', category: 'healthy_fats', i18nKey: 'sdb_food_opt_seeds' },
    { key: 'peanut_butter', category: 'healthy_fats', i18nKey: 'sdb_food_opt_peanut_butter' },
    { key: 'nut_butter', category: 'healthy_fats', i18nKey: 'sdb_food_opt_nut_butter' },
    { key: 'olives', category: 'healthy_fats', i18nKey: 'sdb_food_opt_olives' },
  ],
  vegetables: [
    { key: 'broccoli', category: 'vegetables', i18nKey: 'sdb_food_opt_broccoli' },
    { key: 'spinach', category: 'vegetables', i18nKey: 'sdb_food_opt_spinach' },
    { key: 'lettuce_salad_greens', category: 'vegetables', i18nKey: 'sdb_food_opt_lettuce_salad_greens' },
    { key: 'tomato', category: 'vegetables', i18nKey: 'sdb_food_opt_tomato' },
    { key: 'cucumber', category: 'vegetables', i18nKey: 'sdb_food_opt_cucumber' },
    { key: 'carrot', category: 'vegetables', i18nKey: 'sdb_food_opt_carrot' },
    { key: 'bell_pepper', category: 'vegetables', i18nKey: 'sdb_food_opt_bell_pepper' },
    { key: 'onion', category: 'vegetables', i18nKey: 'sdb_food_opt_onion' },
    { key: 'zucchini', category: 'vegetables', i18nKey: 'sdb_food_opt_zucchini' },
    { key: 'cauliflower', category: 'vegetables', i18nKey: 'sdb_food_opt_cauliflower' },
    { key: 'cabbage', category: 'vegetables', i18nKey: 'sdb_food_opt_cabbage' },
    { key: 'green_beans', category: 'vegetables', i18nKey: 'sdb_food_opt_green_beans' },
    { key: 'asparagus', category: 'vegetables', i18nKey: 'sdb_food_opt_asparagus' },
    { key: 'mushrooms', category: 'vegetables', i18nKey: 'sdb_food_opt_mushrooms' },
    { key: 'mixed_vegetables', category: 'vegetables', i18nKey: 'sdb_food_opt_mixed_vegetables' },
  ],
  fruits: [
    { key: 'apple', category: 'fruits', i18nKey: 'sdb_food_opt_apple' },
    { key: 'banana', category: 'fruits', i18nKey: 'sdb_food_opt_banana' },
    { key: 'orange', category: 'fruits', i18nKey: 'sdb_food_opt_orange' },
    { key: 'berries', category: 'fruits', i18nKey: 'sdb_food_opt_berries' },
    { key: 'strawberry', category: 'fruits', i18nKey: 'sdb_food_opt_strawberry' },
    { key: 'blueberry', category: 'fruits', i18nKey: 'sdb_food_opt_blueberry' },
    { key: 'mango', category: 'fruits', i18nKey: 'sdb_food_opt_mango' },
    { key: 'pineapple', category: 'fruits', i18nKey: 'sdb_food_opt_pineapple' },
    { key: 'grapes', category: 'fruits', i18nKey: 'sdb_food_opt_grapes' },
    { key: 'watermelon', category: 'fruits', i18nKey: 'sdb_food_opt_watermelon' },
    { key: 'melon', category: 'fruits', i18nKey: 'sdb_food_opt_melon' },
    { key: 'peach', category: 'fruits', i18nKey: 'sdb_food_opt_peach' },
    { key: 'pear', category: 'fruits', i18nKey: 'sdb_food_opt_pear' },
    { key: 'kiwi', category: 'fruits', i18nKey: 'sdb_food_opt_kiwi' },
    { key: 'papaya', category: 'fruits', i18nKey: 'sdb_food_opt_papaya' },
  ],
  desserts: [
    { key: 'cake', category: 'desserts', i18nKey: 'sdb_food_opt_cake' },
    { key: 'cookies', category: 'desserts', i18nKey: 'sdb_food_opt_cookies' },
    { key: 'chocolate', category: 'desserts', i18nKey: 'sdb_food_opt_chocolate' },
    { key: 'ice_cream', category: 'desserts', i18nKey: 'sdb_food_opt_ice_cream' },
    { key: 'pastry', category: 'desserts', i18nKey: 'sdb_food_opt_pastry' },
    { key: 'candy', category: 'desserts', i18nKey: 'sdb_food_opt_candy' },
    { key: 'pudding', category: 'desserts', i18nKey: 'sdb_food_opt_pudding' },
    { key: 'sweet_dessert', category: 'desserts', i18nKey: 'sdb_food_opt_sweet_dessert' },
  ],
  snacks: [
    { key: 'nuts', category: 'snacks', i18nKey: 'sdb_food_opt_nuts' },
    { key: 'yogurt', category: 'snacks', i18nKey: 'sdb_food_opt_yogurt' },
    { key: 'fruit', category: 'snacks', i18nKey: 'sdb_food_opt_fruit' },
    { key: 'protein_bar', category: 'snacks', i18nKey: 'sdb_food_opt_protein_bar' },
    { key: 'granola_bar', category: 'snacks', i18nKey: 'sdb_food_opt_granola_bar' },
    { key: 'chips', category: 'snacks', i18nKey: 'sdb_food_opt_chips' },
    { key: 'crackers', category: 'snacks', i18nKey: 'sdb_food_opt_crackers' },
    { key: 'popcorn', category: 'snacks', i18nKey: 'sdb_food_opt_popcorn' },
    { key: 'sandwich', category: 'snacks', i18nKey: 'sdb_food_opt_sandwich' },
    { key: 'other_snack', category: 'snacks', i18nKey: 'sdb_food_opt_other_snack' },
  ],
  beverages: [
    { key: 'water', category: 'beverages', i18nKey: 'sdb_food_opt_water' },
    { key: 'sparkling_water', category: 'beverages', i18nKey: 'sdb_food_opt_sparkling_water' },
    { key: 'black_coffee', category: 'beverages', i18nKey: 'sdb_food_opt_black_coffee' },
    { key: 'coffee', category: 'beverages', i18nKey: 'sdb_food_opt_coffee' },
    { key: 'tea', category: 'beverages', i18nKey: 'sdb_food_opt_tea' },
    { key: 'herbal_tea', category: 'beverages', i18nKey: 'sdb_food_opt_herbal_tea' },
    { key: 'milk', category: 'beverages', i18nKey: 'sdb_food_opt_milk' },
    { key: 'protein_shake', category: 'beverages', i18nKey: 'sdb_food_opt_protein_shake' },
    { key: 'juice', category: 'beverages', i18nKey: 'sdb_food_opt_juice' },
    { key: 'soft_drink', category: 'beverages', i18nKey: 'sdb_food_opt_soft_drink' },
    { key: 'diet_soft_drink', category: 'beverages', i18nKey: 'sdb_food_opt_diet_soft_drink' },
    { key: 'energy_drink', category: 'beverages', i18nKey: 'sdb_food_opt_energy_drink' },
    { key: 'smoothie', category: 'beverages', i18nKey: 'sdb_food_opt_smoothie' },
  ],
  soups: [
    { key: 'vegetable_soup', category: 'soups', i18nKey: 'sdb_food_opt_vegetable_soup' },
    { key: 'chicken_soup', category: 'soups', i18nKey: 'sdb_food_opt_chicken_soup' },
    { key: 'tomato_soup', category: 'soups', i18nKey: 'sdb_food_opt_tomato_soup' },
    { key: 'lentil_soup', category: 'soups', i18nKey: 'sdb_food_opt_lentil_soup' },
    { key: 'noodle_soup', category: 'soups', i18nKey: 'sdb_food_opt_noodle_soup' },
    { key: 'broth', category: 'soups', i18nKey: 'sdb_food_opt_broth' },
    { key: 'other_soup', category: 'soups', i18nKey: 'sdb_food_opt_other_soup' },
  ],
};

/**
 * Helper to get all food options for a category.
 */
export function getFoodOptionsForCategory(cat: FoodCategoryKey): FoodOptionItem[] {
  return CANONICAL_FOOD_OPTIONS[cat] ?? [];
}

/**
 * Helper to look up an option by key within a category.
 */
export function findFoodOption(cat: FoodCategoryKey, key: string): FoodOptionItem | undefined {
  return CANONICAL_FOOD_OPTIONS[cat]?.find(opt => opt.key === key);
}

/**
 * Validates if a given key is a canonical option under the specified category.
 */
export function isValidCanonicalFood(cat: FoodCategoryKey, key: string): boolean {
  return CANONICAL_FOOD_OPTIONS[cat]?.some(opt => opt.key === key) ?? false;
}

/**
 * Checks if a given text string matches any canonical food option key or label (case-insensitive)
 * across all 9 canonical food categories.
 */
export function isCanonicalFoodKeyOrLabel(text: string, t?: Record<string, any>): boolean {
  if (!text || !text.trim()) return false;
  const clean = text.trim().toLowerCase();
  for (const cat of Object.keys(CANONICAL_FOOD_OPTIONS) as FoodCategoryKey[]) {
    const list = CANONICAL_FOOD_OPTIONS[cat] || [];
    for (const opt of list) {
      if (opt.key.toLowerCase() === clean) return true;
      const formatted = opt.key.replace(/_/g, ' ').toLowerCase();
      if (formatted === clean) return true;
      if (t && t[opt.i18nKey] && typeof t[opt.i18nKey] === 'string' && t[opt.i18nKey].toLowerCase() === clean) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extracts an ordered list of human-readable food item names from food selections and custom foods.
 */
export function getDerivedFoodItems(
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>> | null,
  customFoods?: Partial<Record<FoodCategoryKey, string[]>> | null,
  t?: Record<string, any>
): string[] {
  const items: string[] = [];
  if (foodSelections) {
    for (const [cat, keys] of Object.entries(foodSelections)) {
      if (Array.isArray(keys)) {
        for (const k of keys) {
          if (!k) continue;
          const opt = findFoodOption(cat as FoodCategoryKey, k);
          let label = '';
          if (opt && t && t[opt.i18nKey] && typeof t[opt.i18nKey] === 'string') {
            label = t[opt.i18nKey];
          } else if (opt) {
            label = opt.key.charAt(0).toUpperCase() + opt.key.slice(1).replace(/_/g, ' ');
          } else {
            label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
          }
          if (label && !items.includes(label)) {
            items.push(label);
          }
        }
      }
    }
  }
  if (customFoods) {
    for (const [, list] of Object.entries(customFoods)) {
      if (Array.isArray(list)) {
        for (const c of list) {
          const trimmed = (c || '').trim();
          if (trimmed && !items.includes(trimmed)) {
            items.push(trimmed);
          }
        }
      }
    }
  }
  return items;
}

/**
 * Derives a comma-separated description string from the current food selections and custom foods.
 * e.g. "Papaya", "Papaya, Acai Bowl", or "Acai Bowl".
 */
export function getDerivedFoodDescription(
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>> | null,
  customFoods?: Partial<Record<FoodCategoryKey, string[]>> | null,
  t?: Record<string, any>
): string {
  const items = getDerivedFoodItems(foodSelections, customFoods, t);
  return items.join(', ');
}

