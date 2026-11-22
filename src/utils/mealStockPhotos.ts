/**
 * Super Diet-Ability — Built-In Meal Photography & Built-In Content Localization Helpers
 *
 * Guarantees:
 * 1. User-uploaded meal photos in IndexedDB ALWAYS remain highest priority (handled before fallback).
 * 2. Built-in example meals, templates, structure windows, and alternatives resolve to realistic,
 *    appetizing food photography in `/images/meals/*.jpg` without duplicating any blobs in IndexedDB.
 * 3. Built-in meal titles, alternative descriptions, and sample food items translate cleanly across
 *    EN / ES / NL while NEVER auto-translating user-created custom meal names.
 */

import type { FoodCategoryKey } from '../data/dietData';
import { findFoodOption } from '../data/foodOptions';

export type MealStockKey =
  | 'breakfast_bowl'
  | 'overnight_oats'
  | 'greek_yogurt_bowl'
  | 'avocado_egg_toast'
  | 'protein_smoothie'
  | 'chicken_rice_broccoli'
  | 'quinoa_salad_bowl'
  | 'plant_protein_bowl'
  | 'tuna_wrap'
  | 'salmon_dinner'
  | 'white_fish_greens'
  | 'beef_sweet_potato'
  | 'veggie_omelette'
  | 'yogurt_almonds_snack'
  | 'fruit_nuts_snack'
  | 'fruit_veggie_snack'
  | 'recovery_soup'
  | 'herbal_hydration';

export const MEAL_STOCK_PHOTO_URLS: Record<MealStockKey, string> = {
  breakfast_bowl: '/images/meals/breakfast.jpg',
  overnight_oats: '/images/meals/overnight-oats.jpg',
  greek_yogurt_bowl: '/images/meals/greek-yogurt-bowl.jpg',
  avocado_egg_toast: '/images/meals/avocado-egg-toast.jpg',
  protein_smoothie: '/images/meals/protein-smoothie.jpg',
  chicken_rice_broccoli: '/images/meals/lunch.jpg',
  quinoa_salad_bowl: '/images/meals/quinoa-salad-bowl.jpg',
  plant_protein_bowl: '/images/meals/plant-tofu-quinoa-bowl.jpg',
  tuna_wrap: '/images/meals/tuna-wrap.jpg',
  salmon_dinner: '/images/meals/dinner.jpg',
  white_fish_greens: '/images/meals/white-fish-greens.jpg',
  beef_sweet_potato: '/images/meals/beef-sweet-potato.jpg',
  veggie_omelette: '/images/meals/veggie-omelette.jpg',
  yogurt_almonds_snack: '/images/meals/snack.jpg',
  fruit_nuts_snack: '/images/meals/fruit-nuts-snack.jpg',
  fruit_veggie_snack: '/images/meals/fresh-fruit-veggie-snack.jpg',
  recovery_soup: '/images/meals/recovery-soup.jpg',
  herbal_hydration: '/images/meals/herbal-hydration.jpg',
};

export interface MealStockPhotoTarget {
  type?: string;
  mealType?: string;
  name?: string;
  customText?: string;
  description?: string;
  items?: string[];
  foodCategories?: string[];
  foodSelections?: Partial<Record<string, string[]>>;
  imageRef?: {
    kind?: string;
    assetUrl?: string;
    stockKey?: string;
  } | null;
}

/**
 * Resolves the most appropriate realistic built-in food photograph for a meal block,
 * alternative option, or library item when no user-uploaded photo is attached.
 */
export function resolveMealStockPhoto(target?: MealStockPhotoTarget | null): string {
  if (!target) return MEAL_STOCK_PHOTO_URLS.breakfast_bowl;

  // 1. Explicit stock_asset reference (stockKey or direct assetUrl)
  if (target.imageRef?.kind === 'stock_asset') {
    const sk = target.imageRef.stockKey as MealStockKey | undefined;
    if (sk && MEAL_STOCK_PHOTO_URLS[sk]) {
      return MEAL_STOCK_PHOTO_URLS[sk];
    }
    if (target.imageRef.assetUrl && target.imageRef.assetUrl.trim()) {
      return target.imageRef.assetUrl.trim();
    }
  }

  // Gather normalized tokens across foodSelections, items, and preset keys/titles
  const selectionTokens: string[] = [];
  if (target.foodSelections && typeof target.foodSelections === 'object') {
    for (const list of Object.values(target.foodSelections)) {
      if (Array.isArray(list)) {
        for (const k of list) {
          if (typeof k === 'string') selectionTokens.push(k.toLowerCase().trim());
        }
      }
    }
  }

  const itemTokens = Array.isArray(target.items)
    ? target.items.map(i => String(i || '').toLowerCase().trim())
    : [];

  const catTokens = Array.isArray(target.foodCategories)
    ? target.foodCategories.map(c => String(c || '').toLowerCase().trim())
    : [];

  const textBlob = [
    target.name || '',
    target.customText || '',
    target.description || '',
    ...selectionTokens,
    ...itemTokens,
  ]
    .join(' ')
    .toLowerCase();

  const rawType = (target.mealType || target.type || '').toLowerCase().trim();

  // 2. Structure / Hydration / Fasting windows
  if (
    rawType === 'micro_fasting' ||
    rawType === 'kitchen_closed' ||
    textBlob.includes('sdb_tl_fast') ||
    textBlob.includes('hydration')
  ) {
    return MEAL_STOCK_PHOTO_URLS.herbal_hydration;
  }

  // 3. Specific dish matches
  if (
    rawType === 'protein_shake' ||
    textBlob.includes('smoothie') ||
    textBlob.includes('protein_shake') ||
    textBlob.includes('sdb_tl_shake') ||
    (textBlob.includes('protein powder') && !textBlob.includes('oatmeal'))
  ) {
    return MEAL_STOCK_PHOTO_URLS.protein_smoothie;
  }

  if (
    textBlob.includes('soup') ||
    textBlob.includes('broth') ||
    catTokens.includes('soups')
  ) {
    return MEAL_STOCK_PHOTO_URLS.recovery_soup;
  }

  if (
    textBlob.includes('tuna') ||
    textBlob.includes('wrap') ||
    textBlob.includes('tortilla') ||
    textBlob.includes('sandwich')
  ) {
    return MEAL_STOCK_PHOTO_URLS.tuna_wrap;
  }

  if (
    textBlob.includes('overnight_oats') ||
    textBlob.includes('overnight oats') ||
    (textBlob.includes('oat') &&
      (textBlob.includes('berries') || textBlob.includes('seeds') || textBlob.includes('chia')) &&
      !textBlob.includes('eggs') &&
      !textBlob.includes('yogurt'))
  ) {
    return MEAL_STOCK_PHOTO_URLS.overnight_oats;
  }

  if (
    textBlob.includes('avocado_egg_toast') ||
    (textBlob.includes('eggs') &&
      textBlob.includes('avocado') &&
      (textBlob.includes('bread') || textBlob.includes('toast')))
  ) {
    return MEAL_STOCK_PHOTO_URLS.avocado_egg_toast;
  }

  if (
    textBlob.includes('omelette') ||
    textBlob.includes('omelet') ||
    (textBlob.includes('eggs') &&
      (textBlob.includes('spinach') || textBlob.includes('bell_pepper') || textBlob.includes('peppers')))
  ) {
    return MEAL_STOCK_PHOTO_URLS.veggie_omelette;
  }

  if (
    (textBlob.includes('tofu') ||
      textBlob.includes('tempeh') ||
      textBlob.includes('beans_legumes') ||
      textBlob.includes('chickpea') ||
      textBlob.includes('lentils')) &&
    !textBlob.includes('chicken') &&
    !textBlob.includes('turkey') &&
    !textBlob.includes('beef') &&
    !textBlob.includes('salmon') &&
    !textBlob.includes('tuna') &&
    !textBlob.includes('eggs')
  ) {
    return MEAL_STOCK_PHOTO_URLS.plant_protein_bowl;
  }

  if (
    textBlob.includes('quinoa') ||
    ((textBlob.includes('chicken') || textBlob.includes('turkey')) &&
      (textBlob.includes('salad') || textBlob.includes('greens')))
  ) {
    return MEAL_STOCK_PHOTO_URLS.quinoa_salad_bowl;
  }

  if (
    (textBlob.includes('apple') || textBlob.includes('berries') || textBlob.includes('cucumber')) &&
    (textBlob.includes('seeds') || textBlob.includes('cucumber')) &&
    !textBlob.includes('walnut') &&
    !textBlob.includes('almond') &&
    !textBlob.includes('nuts') &&
    !textBlob.includes('yogurt') &&
    !textBlob.includes('oat') &&
    !textBlob.includes('chicken') &&
    !textBlob.includes('quinoa')
  ) {
    return MEAL_STOCK_PHOTO_URLS.fruit_veggie_snack;
  }

  if (
    (textBlob.includes('apple') || textBlob.includes('fruit')) &&
    (textBlob.includes('walnut') || textBlob.includes('almond') || textBlob.includes('nuts')) &&
    !textBlob.includes('yogurt') &&
    !textBlob.includes('oat')
  ) {
    return MEAL_STOCK_PHOTO_URLS.fruit_nuts_snack;
  }

  if (
    textBlob.includes('greek_yogurt_bowl') ||
    textBlob.includes('greek yogurt bowl') ||
    ((textBlob.includes('greek yogurt') || textBlob.includes('greek_yogurt') || textBlob.includes('yogurt')) &&
      (textBlob.includes('oat') || textBlob.includes('berries')) &&
      !textBlob.includes('eggs'))
  ) {
    return MEAL_STOCK_PHOTO_URLS.greek_yogurt_bowl;
  }

  if (
    (textBlob.includes('greek yogurt') || textBlob.includes('greek_yogurt') || textBlob.includes('yogurt')) &&
    !textBlob.includes('eggs')
  ) {
    return MEAL_STOCK_PHOTO_URLS.yogurt_almonds_snack;
  }

  if (
    textBlob.includes('white_fish') ||
    textBlob.includes('white fish') ||
    (textBlob.includes('fish') &&
      (textBlob.includes('asparagus') || textBlob.includes('zucchini')) &&
      !textBlob.includes('salmon') &&
      !textBlob.includes('tuna'))
  ) {
    return MEAL_STOCK_PHOTO_URLS.white_fish_greens;
  }

  if (
    textBlob.includes('salmon') ||
    textBlob.includes('fish')
  ) {
    return MEAL_STOCK_PHOTO_URLS.salmon_dinner;
  }

  if (
    textBlob.includes('beef') ||
    textBlob.includes('lean_beef') ||
    textBlob.includes('lean beef')
  ) {
    return MEAL_STOCK_PHOTO_URLS.beef_sweet_potato;
  }

  if (
    textBlob.includes('chicken') ||
    textBlob.includes('turkey')
  ) {
    return MEAL_STOCK_PHOTO_URLS.chicken_rice_broccoli;
  }

  if (
    rawType === 'beverages' ||
    (catTokens.length === 1 && catTokens[0] === 'beverages') ||
    ((textBlob.includes('herbal tea') || textBlob.includes('tea') || textBlob.includes('coffee')) &&
      catTokens.every(c => c === 'beverages' || c === 'simple_carbs' || c === 'fruits'))
  ) {
    if (rawType === 'beverages' || textBlob.includes('rest_fluids') || textBlob.includes('rest & fluids')) {
      return MEAL_STOCK_PHOTO_URLS.herbal_hydration;
    }
  }

  // 4. Meal-type defaults
  if (rawType.includes('breakfast')) return MEAL_STOCK_PHOTO_URLS.breakfast_bowl;
  if (rawType.includes('lunch')) return MEAL_STOCK_PHOTO_URLS.chicken_rice_broccoli;
  if (rawType.includes('snack')) return MEAL_STOCK_PHOTO_URLS.yogurt_almonds_snack;
  if (rawType.includes('dinner')) return MEAL_STOCK_PHOTO_URLS.salmon_dinner;

  return MEAL_STOCK_PHOTO_URLS.breakfast_bowl;
}

// ── Built-In Sample Item & Preset Meal Name Localization ──────────────────────

/**
 * Maps canonical / built-in sample food tokens (from `BUILT_IN_GOALS` and `foodSelections` aliases)
 * to their exact `Translations` key. User-entered freeform custom strings are NOT in this map
 * and therefore remain untouched.
 */
const BUILT_IN_SAMPLE_ITEM_I18N_MAP: Record<string, string> = {
  eggs: 'sdb_food_opt_eggs',
  spinach: 'sdb_food_opt_spinach',
  'chicken breast': 'sdb_builtin_item_chicken_breast',
  chicken_breast: 'sdb_builtin_item_chicken_breast',
  chicken: 'sdb_food_opt_chicken',
  broccoli: 'sdb_food_opt_broccoli',
  'mixed greens': 'sdb_food_opt_lettuce_salad_greens',
  mixed_greens: 'sdb_food_opt_lettuce_salad_greens',
  lettuce_salad_greens: 'sdb_food_opt_lettuce_salad_greens',
  salad: 'sdb_food_opt_lettuce_salad_greens',
  'white fish': 'sdb_builtin_item_white_fish',
  white_fish: 'sdb_builtin_item_white_fish',
  fish: 'sdb_food_opt_fish',
  asparagus: 'sdb_food_opt_asparagus',
  zucchini: 'sdb_food_opt_zucchini',
  oatmeal: 'sdb_food_opt_oats',
  oats: 'sdb_food_opt_oats',
  berries: 'sdb_food_opt_berries',
  rice: 'sdb_builtin_item_rice',
  'brown rice': 'sdb_food_opt_brown_rice',
  brown_rice: 'sdb_food_opt_brown_rice',
  'white rice': 'sdb_food_opt_white_rice',
  white_rice: 'sdb_food_opt_white_rice',
  'greek yogurt': 'sdb_food_opt_greek_yogurt',
  greek_yogurt: 'sdb_food_opt_greek_yogurt',
  yogurt: 'sdb_food_opt_yogurt',
  almonds: 'sdb_food_opt_almonds',
  salmon: 'sdb_food_opt_salmon',
  'sweet potato': 'sdb_food_opt_sweet_potato',
  sweet_potato: 'sdb_food_opt_sweet_potato',
  'protein powder': 'sdb_builtin_item_protein_powder',
  protein_powder: 'sdb_builtin_item_protein_powder',
  protein_shake: 'sdb_food_opt_protein_shake',
  'turkey breast': 'sdb_builtin_item_turkey_breast',
  turkey_breast: 'sdb_builtin_item_turkey_breast',
  turkey: 'sdb_food_opt_turkey',
  quinoa: 'sdb_food_opt_quinoa',
  apple: 'sdb_food_opt_apple',
  'lean beef': 'sdb_builtin_item_lean_beef',
  lean_beef: 'sdb_builtin_item_lean_beef',
  beef: 'sdb_food_opt_beef',
  'baked potato': 'sdb_builtin_item_baked_potato',
  baked_potato: 'sdb_builtin_item_baked_potato',
  potato: 'sdb_food_opt_potato',
  'green beans': 'sdb_food_opt_green_beans',
  green_beans: 'sdb_food_opt_green_beans',
  'whole wheat bread': 'sdb_food_opt_whole_grain_bread',
  whole_wheat_bread: 'sdb_food_opt_whole_grain_bread',
  whole_grain_bread: 'sdb_food_opt_whole_grain_bread',
  tortilla_wrap: 'sdb_food_opt_tortilla_wrap',
  avocado: 'sdb_food_opt_avocado',
  'mixed veggies': 'sdb_food_opt_mixed_vegetables',
  'steamed veggies': 'sdb_food_opt_mixed_vegetables',
  mixed_vegetables: 'sdb_food_opt_mixed_vegetables',
  walnuts: 'sdb_food_opt_walnuts',
  pasta: 'sdb_food_opt_pasta',
  'olive oil': 'sdb_food_opt_olive_oil',
  olive_oil: 'sdb_food_opt_olive_oil',
  fruit: 'sdb_food_opt_fruit',
  coffee: 'sdb_food_opt_coffee',
  black_coffee: 'sdb_food_opt_black_coffee',
  nuts: 'sdb_food_opt_nuts',
  tea: 'sdb_food_opt_tea',
  'herbal tea': 'sdb_food_opt_herbal_tea',
  herbal_tea: 'sdb_food_opt_herbal_tea',
  herbal_drink: 'sdb_food_herbal_drink',
  unsweetened_beverages: 'sdb_food_unsweetened_beverages',
  protein_rich_food: 'sdb_food_protein_rich_food',
  minimal_carbs: 'sdb_food_minimal_carbs',
  toast: 'sdb_builtin_item_toast',
  honey: 'sdb_builtin_item_honey',
  'chicken soup': 'sdb_food_opt_chicken_soup',
  chicken_soup: 'sdb_food_opt_chicken_soup',
  vegetable_soup: 'sdb_food_opt_vegetable_soup',
  crackers: 'sdb_food_opt_crackers',
  banana: 'sdb_food_opt_banana',
  broth: 'sdb_food_opt_broth',
  tuna: 'sdb_food_opt_tuna',
  bell_pepper: 'sdb_food_opt_bell_pepper',
  tomato: 'sdb_food_opt_tomato',
  cucumber: 'sdb_food_opt_cucumber',
  tofu: 'sdb_food_opt_tofu',
  tempeh: 'sdb_food_opt_tempeh',
  seeds: 'sdb_food_opt_seeds',
  beans_legumes: 'sdb_food_opt_beans_legumes',
  lentils: 'sdb_food_opt_lentils',
  smoothie: 'sdb_food_opt_smoothie',
};

const LEGACY_BUILT_IN_MEAL_TITLE_I18N_MAP: Record<string, string> = {
  'morning brunch': 'sdb_builtin_meal_morning_brunch',
  'afternoon refuel': 'sdb_builtin_meal_afternoon_refuel',
  'social evening dinner': 'sdb_builtin_meal_social_dinner',
  'hydration & light morning': 'sdb_builtin_meal_hydration_morning',
  'recovery lunch': 'sdb_builtin_meal_recovery_lunch',
  'rest & fluids': 'sdb_builtin_meal_rest_fluids',
  'gentle dinner': 'sdb_builtin_meal_gentle_dinner',
  'greek yogurt bowl': 'sdb_builtin_ex_greek_yogurt_bowl',
  'protein smoothie': 'sdb_builtin_ex_protein_smoothie',
  'grilled chicken & quinoa salad': 'sdb_builtin_ex_chicken_quinoa',
  "chef's grilled chicken & quinoa bowl": 'wiz_meal_chefs_chicken_quinoa',
  'tuna whole-grain wrap': 'sdb_builtin_ex_tuna_wrap',
  'baked salmon & vegetables': 'sdb_builtin_ex_salmon_veg',
  'spinach & herb veggie omelette': 'sdb_builtin_ex_veggie_omelette',
  'crisp apple & walnuts': 'sdb_builtin_ex_apple_walnuts',
  'warm vegetable & chicken broth': 'sdb_builtin_ex_broth_soup',
  'savory tofu & spinach bowl': 'wiz_meal_tofu_scramble',
  'berry & seed overnight oats': 'wiz_meal_overnight_oats',
  'eggs & avocado whole-grain plate': 'wiz_meal_avocado_egg_toast',
  'turkey, brown rice & broccoli box': 'wiz_meal_turkey_rice_box',
  'mediterranean quinoa & legume bowl': 'wiz_meal_chickpea_quinoa_bowl',
  'lean beef, sweet potato & green beans': 'wiz_meal_beef_sweet_potato',
  'roasted tofu, quinoa & mixed greens': 'wiz_meal_tofu_veggie_stirfry',
  'baked white fish & steamed vegetables': 'wiz_meal_white_fish_greens',
  'fresh fruit & crisp veggie snack': 'wiz_meal_hummus_veggie_snack',
};

/**
 * Translates a canonical food key or built-in sample item (`BUILT_IN_GOALS.items` / `foodSelections`).
 * Leaves any unknown user-entered item text unchanged.
 */
export function translateBuiltInFoodItem(
  rawItem: string,
  t?: Record<string, any>,
  categoryHint?: FoodCategoryKey
): string {
  const clean = (rawItem || '').trim();
  if (!clean) return '';

  if (categoryHint) {
    const opt = findFoodOption(categoryHint, clean);
    if (opt && t && typeof t[opt.i18nKey] === 'string' && t[opt.i18nKey]) {
      return t[opt.i18nKey];
    }
  }

  if (t) {
    const directFoodKey = `sdb_food_${clean}`;
    if (typeof t[directFoodKey] === 'string' && t[directFoodKey]) {
      return t[directFoodKey];
    }
    const optKey = `sdb_food_opt_${clean.toLowerCase()}`;
    if (typeof t[optKey] === 'string' && t[optKey]) {
      return t[optKey];
    }
    const mappedI18nKey = BUILT_IN_SAMPLE_ITEM_I18N_MAP[clean.toLowerCase()];
    if (mappedI18nKey && typeof t[mappedI18nKey] === 'string' && t[mappedI18nKey]) {
      return t[mappedI18nKey];
    }
  }

  return clean;
}

/**
 * Resolves built-in preset meal names / descriptions (`sdb_*` keys and built-in `BUILT_IN_GOALS`
 * preset titles) across EN / ES / NL, while NEVER translating user-created custom meal names!
 */
export function resolveBuiltInMealText(
  rawText?: string | null,
  t?: Record<string, any>,
  options?: { isUserCustomMeal?: boolean }
): string {
  const clean = (rawText || '').trim();
  if (!clean || !t) return clean;

  // Explicit i18n keys (e.g. 'sdb_tl_*', 'sdb_builtin_*', 'wiz_meal_*') always resolve in all locales
  if (
    (clean.startsWith('sdb_') || clean.startsWith('pl_') || clean.startsWith('wiz_')) &&
    typeof t[clean] === 'string' &&
    t[clean]
  ) {
    return t[clean];
  }

  // User-created custom meals (e.g. Personal Meal Library entries or blocks linked to libraryMealId)
  // must NEVER have their freeform title/notes auto-translated.
  if (options?.isUserCustomMeal) {
    return clean;
  }

  const legacyBuiltInKey = LEGACY_BUILT_IN_MEAL_TITLE_I18N_MAP[clean.toLowerCase()];
  if (legacyBuiltInKey && typeof t[legacyBuiltInKey] === 'string' && t[legacyBuiltInKey]) {
    return t[legacyBuiltInKey];
  }

  return clean;
}
