/**
 * Diet Builder Data — Phase 6B
 *
 * Centralised configuration for block types, food/structure options,
 * and 30-minute time slots. Keeping data out of components follows
 * the same pattern as SLIP_CONTEXT_ICONS in types.ts.
 */

// ── Block types ───────────────────────────────────────────────────────────────
// i18n keys are defined in the Translations interface (sdb_ prefix).
// The value here is the internal storage string, also used as an i18n key suffix.

export const BLOCK_TYPE_KEYS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'beverages',
  'protein_shake',
  'micro_fasting',
  'kitchen_closed',
  'custom',
] as const;

export type BlockTypeKey = (typeof BLOCK_TYPE_KEYS)[number];

export const BLOCK_TYPE_ICONS: Record<BlockTypeKey, string> = {
  breakfast:      '🌅',
  lunch:          '☀️',
  dinner:         '🌙',
  snack:          '🍎',
  beverages:      '☕',
  protein_shake:  '💪',
  micro_fasting:  '⏳',
  kitchen_closed: '🔒',
  custom:         '✏️',
};

// ── Food categories (Phase 2) ──────────────────────────────────────────────
// Language-independent stable keys for actual food-content classification.
export const FOOD_CATEGORY_KEYS = [
  'protein',
  'simple_carbs',
  'complex_carbs',
  'healthy_fats',
  'vegetables',
  'fruits',
  'desserts',
  'snacks',
  'beverages',
  'soups',
] as const;

export type FoodCategoryKey = (typeof FOOD_CATEGORY_KEYS)[number];

export const FOOD_CATEGORY_ICONS: Record<FoodCategoryKey, string> = {
  protein:       '🥩',
  simple_carbs:  '⚡',
  complex_carbs: '🌾',
  healthy_fats:  '🥑',
  vegetables:    '🥦',
  fruits:        '🍓',
  desserts:      '🍰',
  snacks:        '🥨',
  beverages:     '💧',
  soups:         '🥣',
};

/**
 * Maps legacy food options or sample items into food category keys for seamless backward compatibility.
 */
export function mapLegacyItemsToCategories(items: string[]): FoodCategoryKey[] {
  const result = new Set<FoodCategoryKey>();
  for (const item of items) {
    const lower = item.toLowerCase().trim();
    if (
      lower === 'protein' ||
      lower === 'protein_rich_food' ||
      lower === 'protein_shake' ||
      lower === 'eggs' ||
      lower === 'chicken' ||
      lower === 'chicken breast' ||
      lower === 'salmon' ||
      lower === 'white fish' ||
      lower === 'turkey breast' ||
      lower === 'lean beef'
    ) {
      result.add('protein');
    }
    if (
      lower === 'simple_carbs' ||
      lower === 'sugar' ||
      lower === 'candy' ||
      lower === 'honey' ||
      lower === 'crackers' ||
      lower === 'toast'
    ) {
      result.add('simple_carbs');
    }
    if (
      lower === 'complex_carbs' ||
      lower === 'minimal_carbs' ||
      lower === 'rice' ||
      lower === 'brown rice' ||
      lower === 'quinoa' ||
      lower === 'sweet potato' ||
      lower === 'baked potato' ||
      lower === 'oatmeal' ||
      lower === 'whole wheat bread' ||
      lower === 'pasta'
    ) {
      result.add('complex_carbs');
    }
    if (
      lower === 'healthy_fats' ||
      lower === 'avocado' ||
      lower === 'almonds' ||
      lower === 'walnuts' ||
      lower === 'nuts' ||
      lower === 'olive oil'
    ) {
      result.add('healthy_fats');
    }
    if (
      lower === 'vegetables' ||
      lower === 'spinach' ||
      lower === 'broccoli' ||
      lower === 'asparagus' ||
      lower === 'zucchini' ||
      lower === 'mixed greens' ||
      lower === 'green beans' ||
      lower === 'salad' ||
      lower === 'steamed veggies'
    ) {
      result.add('vegetables');
    }
    if (
      lower === 'fruits' ||
      lower === 'berries' ||
      lower === 'apple' ||
      lower === 'fruit' ||
      lower === 'banana'
    ) {
      result.add('fruits');
    }
    if (lower === 'desserts') {
      result.add('desserts');
    }
    if (lower === 'snacks' || lower === 'greek yogurt') {
      result.add('snacks');
    }
    if (
      lower === 'beverages' ||
      lower === 'unsweetened_beverages' ||
      lower === 'black_coffee' ||
      lower === 'tea' ||
      lower === 'herbal_drink' ||
      lower === 'coffee' ||
      lower === 'herbal tea' ||
      lower === 'water'
    ) {
      result.add('beverages');
    }
    if (
      lower === 'soups' ||
      lower === 'soup' ||
      lower === 'vegetable soup' ||
      lower === 'chicken soup' ||
      lower === 'tomato soup' ||
      lower === 'lentil soup' ||
      lower === 'noodle soup'
    ) {
      result.add('soups');
    }
  }
  return Array.from(result);
}

// ── Legacy Food / structure options (Preserved for compatibility) ──────────────

export const FOOD_OPTION_KEYS = [
  'unsweetened_beverages',
  'black_coffee',
  'tea',
  'herbal_drink',
  'protein_shake',
  'protein_rich_food',
  'vegetables',
  'minimal_carbs',
  'micro_fasting',
  'kitchen_closed',
] as const;

export type FoodOptionKey = (typeof FOOD_OPTION_KEYS)[number];

// ── 15-minute time slots ──────────────────────────────────────────────────────

/** All 96 15-minute slots in 12-hour display format. Internal value is 24h "HH:MM". */
export interface TimeSlot {
  value: string;   // "00:00" ... "23:45"
  label: string;   // "12:00 AM" ... "11:45 PM"
}

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;

      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${period}`;

      slots.push({ value, label });
    }
  }
  return slots;
}

export const TIME_SLOTS: TimeSlot[] = buildTimeSlots();

/** Convert internal 24h "HH:MM" to display label. */
export function formatTime(value: string): string {
  const slot = TIME_SLOTS.find(s => s.value === value);
  return slot?.label ?? value;
}
