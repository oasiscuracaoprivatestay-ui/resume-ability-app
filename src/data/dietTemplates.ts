/**
 * Structured / Unstructured Diet Templates — Task 6
 *
 * Provides Sergio's approved daily templates (24-hour pattern: 06:00 AM → 06:00 AM next day).
 *
 * IMPORTANT:
 * - Content adheres strictly to Sergio's approved template source.
 * - Zero invented diet content or medical/nutritional recommendations.
 * - Daily scope: applied to the currently selected day only.
 * - Demo templates removed from production.
 */

import type { DayKey, DayMode, StructuredDietBlock, WeeklyStructuredDiet } from '../utils/dietStorage';
import { DAY_KEYS, generateBlockId, sortBlocks } from '../utils/dietStorage';
import type { Translations } from '../i18n/types';

export type DietTemplateScope = 'daily' | 'weekly';
export type DietTemplateCategory = 'structured' | 'unstructured' | 'free';

export interface DailyTemplatePoint {
  time: string;           // "06:00", "08:00", ..., "06:00"
  labelKey: keyof Translations;
  isNextDay?: boolean;    // true for overnight points (00:00, 02:00, 04:00, 06:00 next day)
}

import type { MealTypeKey } from '../utils/dietStorage';
import type { FoodCategoryKey } from './dietData';
import type { FoodSelectionsMap, CustomFoodsMap } from './foodOptions';

export interface TemplateBlock {
  startTime: string; // 24h "HH:MM"
  endTime: string;   // 24h "HH:MM"
  type: string;      // 'custom' | 'micro_fasting'
  items?: string[];
  customText?: string;
  mealType?: MealTypeKey;
  foodCategories?: FoodCategoryKey[];
  foodSelections?: FoodSelectionsMap;
  customFoods?: CustomFoodsMap;
}

export interface TemplateDay {
  dayKey: DayKey;
  mode: DayMode;
  blocks: TemplateBlock[];
}

export interface DietTemplate {
  id: string;
  nameKey: keyof Translations;
  descriptionKey: keyof Translations;
  category: DietTemplateCategory;
  scope: DietTemplateScope;
  version: number;
  targetMode: DayMode;
  timeline: DailyTemplatePoint[];
  blocks: TemplateBlock[];
  days?: TemplateDay[]; // optional legacy weekly support
}

// ── Approved Sergio Templates (13 Total: 6 Unstructured, 7 Structured) ─────────

export const DIET_TEMPLATES: DietTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // UNSTRUCTURED TEMPLATES (6)
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Unstructured Loss
  {
    id: 'unstructured-loss',
    nameKey: 'sdb_tpl_unstruct_loss_title',
    descriptionKey: 'sdb_tpl_unstruct_loss_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast_no_planned_meal' },
      { time: '08:00', labelKey: 'sdb_tl_protein_meal_hungry' },
      { time: '10:00', labelKey: 'sdb_tl_usually_no_eating' },
      { time: '12:00', labelKey: 'sdb_tl_protein_centered_meal' },
      { time: '14:00', labelKey: 'sdb_tl_micro_fast_no_grazing' },
      { time: '16:00', labelKey: 'sdb_tl_continue_gap_between_meals' },
      { time: '18:00', labelKey: 'sdb_tl_protein_centered_dinner' },
      { time: '20:00', labelKey: 'sdb_tl_eating_usually_finished' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_new_intentional_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_fast_no_planned_meal' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_protein_meal_hungry' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_usually_no_eating' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_protein_centered_meal' },
      { startTime: '14:00', endTime: '14:30', type: 'micro_fasting', customText: 'sdb_tl_micro_fast_no_grazing' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_continue_gap_between_meals' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_centered_dinner' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_eating_usually_finished' },
      { startTime: '22:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 2. Moderate Loss
  {
    id: 'moderate-loss',
    nameKey: 'sdb_tpl_moderate_loss_title',
    descriptionKey: 'sdb_tpl_moderate_loss_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast_optional_breakfast' },
      { time: '08:00', labelKey: 'sdb_tl_protein_centered_breakfast' },
      { time: '10:00', labelKey: 'sdb_tl_optional' },
      { time: '12:00', labelKey: 'sdb_tl_protein_vegetables' },
      { time: '14:00', labelKey: 'sdb_tl_usually_no_eating' },
      { time: '16:00', labelKey: 'sdb_tl_continue_gap' },
      { time: '18:00', labelKey: 'sdb_tl_protein_vegetables' },
      { time: '20:00', labelKey: 'sdb_tl_eating_usually_finished' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_new_intentional_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_fast_optional_breakfast' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_protein_centered_breakfast' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_optional' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_protein_vegetables' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_usually_no_eating' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_continue_gap' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_vegetables' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_eating_usually_finished' },
      { startTime: '22:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 3. Low-Carb Flexible
  {
    id: 'low-carb-flexible',
    nameKey: 'sdb_tpl_low_carb_flex_title',
    descriptionKey: 'sdb_tpl_low_carb_flex_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast_optional_breakfast' },
      { time: '08:00', labelKey: 'sdb_tl_eggs_meat_dairy' },
      { time: '10:00', labelKey: 'sdb_tl_optional' },
      { time: '12:00', labelKey: 'sdb_tl_meat_fish_eggs_veg' },
      { time: '14:00', labelKey: 'sdb_tl_optional_dairy_protein' },
      { time: '16:00', labelKey: 'sdb_tl_continue_gap' },
      { time: '18:00', labelKey: 'sdb_tl_protein_veg_fat' },
      { time: '20:00', labelKey: 'sdb_tl_fast_if_finished' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_new_intentional_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_fast_optional_breakfast' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_eggs_meat_dairy' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_optional' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_meat_fish_eggs_veg' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_optional_dairy_protein' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_continue_gap' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_veg_fat' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_fast_if_finished' },
      { startTime: '22:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 4. Balanced Flexible
  {
    id: 'balanced-flexible',
    nameKey: 'sdb_tpl_balanced_flex_title',
    descriptionKey: 'sdb_tpl_balanced_flex_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_breakfast_if_hungry' },
      { time: '08:00', labelKey: 'sdb_tl_protein_whole_food_carb' },
      { time: '10:00', labelKey: 'sdb_tl_optional' },
      { time: '12:00', labelKey: 'sdb_tl_protein_veg_healthy_carb' },
      { time: '14:00', labelKey: 'sdb_tl_optional_planned_snack' },
      { time: '16:00', labelKey: 'sdb_tl_continue_gap' },
      { time: '18:00', labelKey: 'sdb_tl_protein_veg_healthy_carb' },
      { time: '20:00', labelKey: 'sdb_tl_fast_if_finished' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_new_intentional_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_breakfast_if_hungry' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_protein_whole_food_carb' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_optional' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_protein_veg_healthy_carb' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_optional_planned_snack' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_continue_gap' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_veg_healthy_carb' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_fast_if_finished' },
      { startTime: '22:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 5. Unstructured Maintenance
  {
    id: 'unstructured-maintenance',
    nameKey: 'sdb_tpl_unstruct_maint_title',
    descriptionKey: 'sdb_tpl_unstruct_maint_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_eat_fast_choice' },
      { time: '08:00', labelKey: 'sdb_tl_normal_breakfast_desired' },
      { time: '10:00', labelKey: 'sdb_tl_optional' },
      { time: '12:00', labelKey: 'sdb_tl_meal_appetite' },
      { time: '14:00', labelKey: 'sdb_tl_optional' },
      { time: '16:00', labelKey: 'sdb_tl_flexible' },
      { time: '18:00', labelKey: 'sdb_tl_normal_balanced_dinner' },
      { time: '20:00', labelKey: 'sdb_tl_optional_eating' },
      { time: '22:00', labelKey: 'sdb_tl_preferably_finished' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_continue_maintenance', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_eat_fast_choice' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_normal_breakfast_desired' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_optional' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_meal_appetite' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_optional' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_normal_balanced_dinner' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_optional_eating' },
      { startTime: '22:00', endTime: '22:30', type: 'custom', customText: 'sdb_tl_preferably_finished' },
      { startTime: '00:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 6. Social / Free Day
  {
    id: 'social-free-day',
    nameKey: 'sdb_tpl_social_free_title',
    descriptionKey: 'sdb_tpl_social_free_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'unstructured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_flexible' },
      { time: '08:00', labelKey: 'sdb_tl_flexible' },
      { time: '10:00', labelKey: 'sdb_tl_flexible' },
      { time: '12:00', labelKey: 'sdb_tl_flexible' },
      { time: '14:00', labelKey: 'sdb_tl_flexible' },
      { time: '16:00', labelKey: 'sdb_tl_flexible' },
      { time: '18:00', labelKey: 'sdb_tl_celebration_social_meal' },
      { time: '20:00', labelKey: 'sdb_tl_resume_structure_social' },
      { time: '22:00', labelKey: 'sdb_tl_resume_dont_extend' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_normal_structure_resumes', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '16:00', endTime: '16:30', type: 'custom', customText: 'sdb_tl_flexible' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_celebration_social_meal' },
      { startTime: '20:00', endTime: '20:30', type: 'custom', customText: 'sdb_tl_resume_structure_social' },
      { startTime: '22:00', endTime: '22:30', type: 'custom', customText: 'sdb_tl_resume_dont_extend' },
      { startTime: '00:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURED TEMPLATES (7)
  // ═══════════════════════════════════════════════════════════════════════════

  // 7. Fasting
  {
    id: 'fasting',
    nameKey: 'sdb_tpl_fasting_title',
    descriptionKey: 'sdb_tpl_fasting_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast' },
      { time: '08:00', labelKey: 'sdb_tl_fast' },
      { time: '10:00', labelKey: 'sdb_tl_fast' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_fast' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_fast' },
      { time: '20:00', labelKey: 'sdb_tl_fast' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_end_continue_fast', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '20:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 8. Low-Calorie Shakes
  {
    id: 'low-calorie-shakes',
    nameKey: 'sdb_tpl_low_cal_shakes_title',
    descriptionKey: 'sdb_tpl_low_cal_shakes_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_shake_1' },
      { time: '08:00', labelKey: 'sdb_tl_fast' },
      { time: '10:00', labelKey: 'sdb_tl_shake_2' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_shake_3' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_shake_4' },
      { time: '20:00', labelKey: 'sdb_tl_fast' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_next_structured_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_shake_1' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_shake_2' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_shake_3' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_shake_4' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // 9. 1 Protein Meal + Shakes
  {
    id: '1-protein-meal-shakes',
    nameKey: 'sdb_tpl_1_protein_shakes_title',
    descriptionKey: 'sdb_tpl_1_protein_shakes_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_shake_1' },
      { time: '08:00', labelKey: 'sdb_tl_fast' },
      { time: '10:00', labelKey: 'sdb_tl_shake_2' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_shake_3' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_protein_meal' },
      { time: '20:00', labelKey: 'sdb_tl_fast_begins' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_next_structured_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_shake_1' },
      { startTime: '10:00', endTime: '10:30', type: 'custom', customText: 'sdb_tl_shake_2' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_shake_3' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_meal' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast_begins' },
    ],
  },

  // 10. 2 Protein Meals + Shakes
  {
    id: '2-protein-meals-shakes',
    nameKey: 'sdb_tpl_2_protein_shakes_title',
    descriptionKey: 'sdb_tpl_2_protein_shakes_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_shake_1' },
      { time: '08:00', labelKey: 'sdb_tl_fast' },
      { time: '10:00', labelKey: 'sdb_tl_fast' },
      { time: '12:00', labelKey: 'sdb_tl_protein_meal_1' },
      { time: '14:00', labelKey: 'sdb_tl_shake_2' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_protein_meal_2' },
      { time: '20:00', labelKey: 'sdb_tl_fast_begins' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_next_structured_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'custom', customText: 'sdb_tl_shake_1' },
      { startTime: '12:00', endTime: '12:30', type: 'custom', customText: 'sdb_tl_protein_meal_1' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_shake_2' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_meal_2' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast_begins' },
    ],
  },

  // 11. 2 Protein Meals + Zuivel/Dairy
  {
    id: '2-protein-meals-dairy',
    nameKey: 'sdb_tpl_2_protein_dairy_title',
    descriptionKey: 'sdb_tpl_2_protein_dairy_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast_coffee_tea' },
      { time: '08:00', labelKey: 'sdb_tl_protein_1_dairy' },
      { time: '10:00', labelKey: 'sdb_tl_fast' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_dairy_protein_option' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_protein_2_dairy' },
      { time: '20:00', labelKey: 'sdb_tl_fast_begins' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_next_structured_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'micro_fasting', customText: 'sdb_tl_fast_coffee_tea' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_protein_1_dairy' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_dairy_protein_option' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_2_dairy' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast_begins' },
    ],
  },

  // 12. 2 Protein Meals + Healthy Carbs
  {
    id: '2-protein-meals-healthy-carbs',
    nameKey: 'sdb_tpl_2_protein_carbs_title',
    descriptionKey: 'sdb_tpl_2_protein_carbs_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast_coffee_tea' },
      { time: '08:00', labelKey: 'sdb_tl_protein_1_healthy_carb' },
      { time: '10:00', labelKey: 'sdb_tl_fast' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_optional_planned_snack' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_protein_2_healthy_carb' },
      { time: '20:00', labelKey: 'sdb_tl_fast_begins' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_next_structured_day', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '06:30', type: 'micro_fasting', customText: 'sdb_tl_fast_coffee_tea' },
      { startTime: '08:00', endTime: '08:30', type: 'custom', customText: 'sdb_tl_protein_1_healthy_carb' },
      { startTime: '14:00', endTime: '14:30', type: 'custom', customText: 'sdb_tl_optional_planned_snack' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_protein_2_healthy_carb' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast_begins' },
    ],
  },

  // 13. OMAD
  {
    id: 'omad',
    nameKey: 'sdb_tpl_omad_title',
    descriptionKey: 'sdb_tpl_omad_desc',
    category: 'structured',
    scope: 'daily',
    version: 1,
    targetMode: 'structured',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_fast' },
      { time: '08:00', labelKey: 'sdb_tl_fast' },
      { time: '10:00', labelKey: 'sdb_tl_fast' },
      { time: '12:00', labelKey: 'sdb_tl_fast' },
      { time: '14:00', labelKey: 'sdb_tl_fast' },
      { time: '16:00', labelKey: 'sdb_tl_fast' },
      { time: '18:00', labelKey: 'sdb_tl_omad_meal' },
      { time: '20:00', labelKey: 'sdb_tl_fast' },
      { time: '22:00', labelKey: 'sdb_tl_fast' },
      { time: '00:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '02:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '04:00', labelKey: 'sdb_tl_fast', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_continue_until_omad', isNextDay: true },
    ],
    blocks: [
      { startTime: '06:00', endTime: '18:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
      { startTime: '18:00', endTime: '18:30', type: 'custom', customText: 'sdb_tl_omad_meal' },
      { startTime: '20:00', endTime: '06:00', type: 'micro_fasting', customText: 'sdb_tl_fast' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FREE SCHEDULE TEMPLATE (1)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'free-schedule-days',
    nameKey: 'sdb_tpl_free_schedule_title',
    descriptionKey: 'sdb_tpl_free_schedule_desc',
    category: 'unstructured',
    scope: 'daily',
    version: 1,
    targetMode: 'free',
    timeline: [
      { time: '06:00', labelKey: 'sdb_tl_free_schedule' },
      { time: '12:00', labelKey: 'sdb_tl_free_schedule' },
      { time: '18:00', labelKey: 'sdb_tl_free_schedule' },
      { time: '00:00', labelKey: 'sdb_tl_free_schedule', isNextDay: true },
      { time: '06:00', labelKey: 'sdb_tl_free_schedule', isNextDay: true },
    ],
    blocks: [],
  },
];

// ── Application Helpers ────────────────────────────────────────────────────────

/**
 * Applies a daily DietTemplate to a single day.
 *
 * Guarantees:
 * 1. Brand new unique IDs generated for all blocks via generateBlockId().
 * 2. Deep-cloned data with zero shared references with the template source.
 * 3. Preserves targetMode ('structured' | 'unstructured').
 * 4. Overnight block ranges correctly sorted.
 */
export function applyDailyTemplateToDay(template: DietTemplate): {
  mode: DayMode;
  blocks: StructuredDietBlock[];
} {
  const freshBlocks: StructuredDietBlock[] = template.blocks.map(b => ({
    id: generateBlockId(),
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    items: b.items ? [...b.items] : [],
    customText: b.customText ?? '',
  }));

  return {
    mode: template.targetMode,
    blocks: sortBlocks(freshBlocks),
  };
}

/**
 * Legacy/Weekly template applicator (if weekly templates are ever used).
 */
export function applyTemplateToWeekly(
  template: DietTemplate,
  resolvedPlanName?: string
): WeeklyStructuredDiet {
  if (template.scope === 'daily') {
    // If called with a daily template, convert for entire week (fallback only)
    return {
      version: 2,
      planName: resolvedPlanName || 'My Structured Diet',
      days: DAY_KEYS.map((dayKey, idx) => {
        const { mode, blocks } = applyDailyTemplateToDay(template);
        return {
          dayKey,
          dayOfWeek: idx,
          mode,
          blocks,
        };
      }),
    };
  }

  // Weekly scope fallback
  return {
    version: 2,
    planName: resolvedPlanName || 'My Structured Diet',
    days: (template.days ?? []).map((tDay, idx) => ({
      dayKey: tDay.dayKey,
      dayOfWeek: idx,
      mode: tDay.mode,
      blocks: tDay.mode === 'structured'
        ? sortBlocks(
            tDay.blocks.map(b => ({
              id: generateBlockId(),
              startTime: b.startTime,
              endTime: b.endTime,
              type: b.type,
              items: b.items ? [...b.items] : [],
              customText: b.customText ?? '',
            }))
          )
        : [],
    })),
  };
}
