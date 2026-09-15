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
