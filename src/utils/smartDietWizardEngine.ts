/**
 * Super Diet-Ability — Phase 3: Smart Structured Diet Wizard Engine
 *
 * Deterministic, local-first personalization, validation, meal generation, and safe-saving engine:
 * - Zero external AI APIs, zero calorie targets, zero medical or nutritional prescriptions.
 * - Reuses existing Personal Meal Library (`mealLibraryStorage.ts`), realistic `/images/meals/*.jpg`
 *   stock photography (`mealStockPhotos.ts`), user-uploaded IndexedDB photo references, individual
 *   meal approval states, and `StructureDietStore` profiles/overrides (`dietStorage.ts`).
 * - Strictly preserves existing plans, history snapshots, uploaded photos, slips, and XP scores.
 */

import type { FoodCategoryKey } from '../data/dietData';
import type { FoodSelectionsMap } from '../data/foodOptions';
import {
  DAY_KEYS,
  calculateEndTimeFromStart,
  cloneMealAlternative,
  cloneMealImageRef,
  createCustomProfile,
  dateKeyToDayKey,
  deepCloneBlocks,
  generateBlockId,
  getActiveProfile,
  getLocalDateKey,
  loadDietStore,
  loadWeeklyDiet,
  sanitiseBlock,
  saveWeeklyDiet,
  setDateOverride,
  sortBlocks,
  timeToMinutes,
  updateDayPlan,
  type DayKey,
  type MealAlternativeOption,
  type MealApprovalStatus,
  type MealImageRef,
  type MealTypeKey,
  type StructureGoalProfile,
  type StructuredDietBlock,
} from './dietStorage';
import {
  getLibraryMealPhotos,
  listLibraryMeals,
  type PersonalMealLibraryItem,
} from './mealLibraryStorage';
import type { MealStockKey } from './mealStockPhotos';

export const SMART_WIZARD_STORAGE_KEY = 'sda_smart_diet_wizard_v1';

// ── Step 1: Food Preferences Types ────────────────────────────────────────────

export type WizardProteinChoice =
  | 'chicken'
  | 'fish'
  | 'beef'
  | 'turkey'
  | 'eggs'
  | 'greek_yogurt'
  | 'plant_based';

export type WizardCarbChoice =
  | 'rice'
  | 'potato'
  | 'quinoa'
  | 'whole_grain'
  | 'oats'
  | 'minimal_carbs';

export type WizardVegFruitMode = 'variety' | 'greens_focused' | 'simple_favorites';

export type WizardBeverageChoice =
  | 'water'
  | 'tea'
  | 'coffee'
  | 'smoothies'
  | 'avoid_sugary_drinks';

export type WizardRestrictionChoice =
  | 'none'
  | 'dairy_free'
  | 'gluten_free'
  | 'nut_free'
  | 'vegetarian'
  | 'pescatarian'
  | 'other';

export interface WizardFoodPreferences {
  proteins: WizardProteinChoice[];
  carbs: WizardCarbChoice[];
  vegFruitMode: WizardVegFruitMode;
  favoriteProduce: string[];
  beverages: WizardBeverageChoice[];
  foodsToAvoid: string;
  restrictions: WizardRestrictionChoice[];
  customRestrictionNote: string;
  customPreferencesNote: string;
}

// ── Step 2: Daily Routine Types ───────────────────────────────────────────────

export type WizardSchedulePattern = 'regular_work' | 'variable_shift' | 'flexible_home';
export type WizardMealLocation = 'home' | 'work' | 'on_the_go';
export type WizardWeekendMode = 'same_as_weekdays' | 'later_shifted' | 'flexible_unstructured';

export interface WizardMealSlotConfig {
  id: string;
  mealType: MealTypeKey;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location: WizardMealLocation;
}

export interface WizardDailyRoutine {
  wakeTime: string;
  sleepTime: string;
  schedulePattern: WizardSchedulePattern;
  workStart: string;
  workEnd: string;
  middayLocation: WizardMealLocation;
  mealCount: 2 | 3 | 4 | 5;
  slots: WizardMealSlotConfig[];
  weekendMode: WizardWeekendMode;
  includeOvernightFastingWindow: boolean;
}

// ── Step 3: Food Access Types ─────────────────────────────────────────────────

export type WizardAccessOption =
  | 'cook_at_home'
  | 'meal_prep'
  | 'bring_to_work'
  | 'workplace_cafeteria'
  | 'restaurant_takeaway'
  | 'limited_cooking';

export const WIZARD_ACCESS_OPTIONS: readonly WizardAccessOption[] = [
  'cook_at_home',
  'meal_prep',
  'bring_to_work',
  'workplace_cafeteria',
  'restaurant_takeaway',
  'limited_cooking',
] as const;

// ── Persisted Wizard Profile ──────────────────────────────────────────────────

export interface SmartWizardProfile {
  version: 1;
  preferences: WizardFoodPreferences;
  routine: WizardDailyRoutine;
  foodAccess: WizardAccessOption[];
  lastStep: 1 | 2 | 3 | 4 | 5;
  updatedAt: number;
}

// ── Step 4 & 5: Proposed Meal Block & Save Types ──────────────────────────────

export interface WizardProposedBlock extends StructuredDietBlock {
  accessSuitability: WizardAccessOption;
  backupAccessSuitability?: WizardAccessOption;
}

export interface GeneratedWizardPlan {
  weekdayBlocks: WizardProposedBlock[];
  weekendBlocks: WizardProposedBlock[];
  weekendDayMode: 'structured' | 'unstructured';
}

export interface WizardApprovalSummary {
  acceptedCount: number;
  modifiedCount: number;
  rejectedCount: number;
  pendingCount: number;
  activeCount: number;
  totalCount: number;
}

export type WizardSaveDestination = 'new_profile' | 'today_only' | 'selected_weekdays';

export interface WizardSafeSaveOptions {
  destination: WizardSaveDestination;
  weekdayBlocks: StructuredDietBlock[];
  weekendBlocks?: StructuredDietBlock[];
  weekendMode?: WizardWeekendMode;
  profileName?: string;
  profileDescription?: string;
  selectedWeekdays?: DayKey[];
  alsoApplyToToday?: boolean;
  todayDateKey?: string;
}

export interface WizardSafeSaveResult {
  destination: WizardSaveDestination;
  savedBlocksCount: number;
  createdProfile?: StructureGoalProfile;
  updatedDays?: DayKey[];
  todayDateKey?: string;
}

// ── Time & Routine Helpers (Overnight-Safe & Non-Overlapping) ─────────────────

function minutesToHHMM(totalMins: number): string {
  const normalized = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function snapToQuarterHour(mins: number): number {
  return Math.round(mins / 15) * 15;
}

export function isValidHHMM(val: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test((val || '').trim());
}

/**
 * Returns true if the user's waking day crosses midnight (e.g. wake 07:00 -> sleep 00:30,
 * or night-shift wake 17:00 -> sleep 08:00).
 */
export function isOvernightWakeSleep(wakeTime: string, sleepTime: string): boolean {
  if (!isValidHHMM(wakeTime) || !isValidHHMM(sleepTime)) return false;
  const w = timeToMinutes(wakeTime);
  const s = timeToMinutes(sleepTime);
  if (s <= w) {
    // e.g. wake 06:30 (390), sleep 00:30 (30) -> crosses midnight
    // e.g. wake 18:00 (1080), sleep 08:00 (480) -> crosses midnight
    return true;
  }
  return false;
}

/**
 * Maps any 24h "HH:MM" onto [0, 1440) minutes elapsed since `wakeTime`.
 */
export function minutesSinceWake(timeStr: string, wakeTime: string): number {
  const t = timeToMinutes(timeStr);
  const w = timeToMinutes(wakeTime);
  return ((t - w) % 1440 + 1440) % 1440;
}

/**
 * Computes clean, non-overlapping 30-minute meal windows across the user's waking hours.
 * Respects both daytime schedules and overnight / shift schedules cleanly.
 */
export function computeDefaultSlotsForRoutine(
  wakeTime: string,
  sleepTime: string,
  mealCount: 2 | 3 | 4 | 5,
  middayLocation: WizardMealLocation = 'work'
): WizardMealSlotConfig[] {
  const safeWake = isValidHHMM(wakeTime) ? wakeTime : '06:30';
  const safeSleep = isValidHHMM(sleepTime) ? sleepTime : '22:30';
  const wakeMin = timeToMinutes(safeWake);
  const rawSleepOffset = minutesSinceWake(safeSleep, safeWake);
  // Active waking span clamped between 6h (360m) and 19h (1140m)
  const wakeSpan = Math.min(1140, Math.max(360, rawSleepOffset === 0 ? 960 : rawSleepOffset));

  const firstOffset = Math.min(90, Math.max(30, snapToQuarterHour(wakeSpan * 0.08)));
  const lastMealLead = Math.min(180, Math.max(90, snapToQuarterHour(wakeSpan * 0.16)));
  const lastOffset = Math.max(firstOffset + (mealCount - 1) * 90, wakeSpan - lastMealLead);

  const rolesByCount: Record<2 | 3 | 4 | 5, MealTypeKey[]> = {
    2: ['lunch', 'dinner'],
    3: ['breakfast', 'lunch', 'dinner'],
    4: ['breakfast', 'lunch', 'snack', 'dinner'],
    5: ['breakfast', 'snack', 'lunch', 'snack', 'dinner'],
  };
  const roles = rolesByCount[mealCount] || rolesByCount[3];

  return roles.map((mealType, idx) => {
    const ratio = roles.length === 1 ? 0 : idx / (roles.length - 1);
    const rawOffset =
      mealCount === 2 && idx === 0
        ? Math.min(lastOffset - 180, Math.max(120, snapToQuarterHour(wakeSpan * 0.28)))
        : snapToQuarterHour(firstOffset + ratio * (lastOffset - firstOffset));

    const startAbs = wakeMin + rawOffset;
    const startTime = minutesToHHMM(startAbs);
    const duration = mealType === 'snack' ? 30 : 30;
    const endTime = calculateEndTimeFromStart(startTime, duration);
    const location: WizardMealLocation =
      mealType === 'breakfast' || mealType === 'dinner' ? 'home' : middayLocation;

    return {
      id: `wiz_slot_${idx + 1}`,
      mealType,
      startTime,
      endTime,
      location,
    };
  });
}

export interface RoutineValidationResult {
  valid: boolean;
  invalidIndex: number | null;
  overlappingIndices: [number, number] | null;
}

/**
 * Validates that every meal slot has valid HH:MM bounds, positive duration (15m..240m),
 * and zero overlap with any other slot along the 24h cycle anchored at `wakeTime`.
 */
export function validateRoutineSlots(
  slots: WizardMealSlotConfig[],
  wakeTime = '06:30'
): RoutineValidationResult {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { valid: false, invalidIndex: 0, overlappingIndices: null };
  }

  const intervals: Array<{ idx: number; start: number; end: number }> = [];

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s || !isValidHHMM(s.startTime) || !isValidHHMM(s.endTime)) {
      return { valid: false, invalidIndex: i, overlappingIndices: null };
    }
    const sMin = timeToMinutes(s.startTime);
    const eMin = timeToMinutes(s.endTime);
    const duration = ((eMin - sMin) % 1440 + 1440) % 1440;
    if (duration === 0 || duration > 360) {
      return { valid: false, invalidIndex: i, overlappingIndices: null };
    }
    const relStart = minutesSinceWake(s.startTime, wakeTime);
    const relEnd = relStart + duration;
    intervals.push({ idx: i, start: relStart, end: relEnd });
  }

  // Sort along wake timeline and check both adjacent and wrap-around overlaps
  const ordered = [...intervals].sort((a, b) => a.start - b.start);
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const nxt = ordered[(i + 1) % ordered.length];
    const nxtStart = i === ordered.length - 1 ? nxt.start + 1440 : nxt.start;
    if (cur.end > nxtStart) {
      return {
        valid: false,
        invalidIndex: null,
        overlappingIndices: [cur.idx, nxt.idx],
      };
    }
  }

  return { valid: true, invalidIndex: null, overlappingIndices: null };
}

// ── Default Profile & Storage ─────────────────────────────────────────────────

export function createDefaultWizardProfile(): SmartWizardProfile {
  const defaultSlots = computeDefaultSlotsForRoutine('06:30', '22:30', 3, 'work');
  // Match iconic 07:30 / 12:30 / 19:00 defaults on standard 06:30-22:30 day
  defaultSlots[0] = { ...defaultSlots[0], startTime: '07:30', endTime: '08:00', location: 'home' };
  defaultSlots[1] = { ...defaultSlots[1], startTime: '12:30', endTime: '13:00', location: 'work' };
  defaultSlots[2] = { ...defaultSlots[2], startTime: '19:00', endTime: '19:30', location: 'home' };

  return {
    version: 1,
    preferences: {
      proteins: ['chicken', 'fish', 'eggs'],
      carbs: ['rice', 'quinoa', 'oats'],
      vegFruitMode: 'variety',
      favoriteProduce: ['spinach', 'broccoli', 'berries', 'avocado'],
      beverages: ['water', 'tea', 'coffee'],
      foodsToAvoid: '',
      restrictions: ['none'],
      customRestrictionNote: '',
      customPreferencesNote: '',
    },
    routine: {
      wakeTime: '06:30',
      sleepTime: '22:30',
      schedulePattern: 'regular_work',
      workStart: '09:00',
      workEnd: '17:00',
      middayLocation: 'work',
      mealCount: 3,
      slots: defaultSlots,
      weekendMode: 'same_as_weekdays',
      includeOvernightFastingWindow: false,
    },
    foodAccess: ['cook_at_home', 'bring_to_work'],
    lastStep: 1,
    updatedAt: Date.now(),
  };
}

export function loadSmartWizardProfile(): SmartWizardProfile {
  const fallback = createDefaultWizardProfile();
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(SMART_WIZARD_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const p = parsed.preferences || {};
    const r = parsed.routine || {};
    const mealCount: 2 | 3 | 4 | 5 = [2, 3, 4, 5].includes(r.mealCount) ? r.mealCount : 3;
    const wakeTime = isValidHHMM(r.wakeTime) ? r.wakeTime : fallback.routine.wakeTime;
    const sleepTime = isValidHHMM(r.sleepTime) ? r.sleepTime : fallback.routine.sleepTime;
    const middayLocation: WizardMealLocation = ['home', 'work', 'on_the_go'].includes(r.middayLocation)
      ? r.middayLocation
      : 'work';

    const loadedSlots: WizardMealSlotConfig[] =
      Array.isArray(r.slots) && r.slots.length === mealCount
        ? r.slots.map((s: any, idx: number) => ({
            id: typeof s?.id === 'string' && s.id ? s.id : `wiz_slot_${idx + 1}`,
            mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(s?.mealType)
              ? s.mealType
              : 'lunch',
            startTime: isValidHHMM(s?.startTime) ? s.startTime : '12:00',
            endTime: isValidHHMM(s?.endTime) ? s.endTime : '12:30',
            location: ['home', 'work', 'on_the_go'].includes(s?.location) ? s.location : 'home',
          }))
        : computeDefaultSlotsForRoutine(wakeTime, sleepTime, mealCount, middayLocation);

    const validated = validateRoutineSlots(loadedSlots, wakeTime);
    const safeSlots = validated.valid
      ? loadedSlots
      : computeDefaultSlotsForRoutine(wakeTime, sleepTime, mealCount, middayLocation);

    const validAccess = Array.isArray(parsed.foodAccess)
      ? (parsed.foodAccess.filter((a: any) =>
          (WIZARD_ACCESS_OPTIONS as readonly string[]).includes(a)
        ) as WizardAccessOption[])
      : [];

    const lastStep = [1, 2, 3, 4, 5].includes(parsed.lastStep) ? parsed.lastStep : 1;

    return {
      version: 1,
      preferences: {
        proteins: Array.isArray(p.proteins) ? p.proteins : fallback.preferences.proteins,
        carbs: Array.isArray(p.carbs) ? p.carbs : fallback.preferences.carbs,
        vegFruitMode: ['variety', 'greens_focused', 'simple_favorites'].includes(p.vegFruitMode)
          ? p.vegFruitMode
          : 'variety',
        favoriteProduce: Array.isArray(p.favoriteProduce)
          ? p.favoriteProduce.filter((x: any) => typeof x === 'string')
          : fallback.preferences.favoriteProduce,
        beverages: Array.isArray(p.beverages) ? p.beverages : fallback.preferences.beverages,
        foodsToAvoid: typeof p.foodsToAvoid === 'string' ? p.foodsToAvoid : '',
        restrictions:
          Array.isArray(p.restrictions) && p.restrictions.length > 0
            ? p.restrictions
            : ['none'],
        customRestrictionNote:
          typeof p.customRestrictionNote === 'string' ? p.customRestrictionNote : '',
        customPreferencesNote:
          typeof p.customPreferencesNote === 'string' ? p.customPreferencesNote : '',
      },
      routine: {
        wakeTime,
        sleepTime,
        schedulePattern: ['regular_work', 'variable_shift', 'flexible_home'].includes(
          r.schedulePattern
        )
          ? r.schedulePattern
          : 'regular_work',
        workStart: isValidHHMM(r.workStart) ? r.workStart : '09:00',
        workEnd: isValidHHMM(r.workEnd) ? r.workEnd : '17:00',
        middayLocation,
        mealCount,
        slots: safeSlots,
        weekendMode: ['same_as_weekdays', 'later_shifted', 'flexible_unstructured'].includes(
          r.weekendMode
        )
          ? r.weekendMode
          : 'same_as_weekdays',
        includeOvernightFastingWindow: Boolean(r.includeOvernightFastingWindow),
      },
      foodAccess: validAccess.length > 0 ? validAccess : fallback.foodAccess,
      lastStep,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return fallback;
  }
}

export function saveSmartWizardProfile(profile: SmartWizardProfile): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const next: SmartWizardProfile = {
      ...profile,
      version: 1,
      updatedAt: Date.now(),
    };
    localStorage.setItem(SMART_WIZARD_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

// ── Curated Meal Catalog (Reuses Existing Stock Photography & i18n Keys) ─────

interface CuratedWizardDish {
  id: string;
  mealTypes: MealTypeKey[];
  nameKey: string;
  descKey: string;
  stockKey: MealStockKey;
  foodCategories: FoodCategoryKey[];
  foodSelections: FoodSelectionsMap;
  items: string[];
  proteinTags: WizardProteinChoice[];
  carbTags: WizardCarbChoice[];
  containsDairy?: boolean;
  containsGluten?: boolean;
  containsNuts?: boolean;
  containsLandMeat?: boolean;
  containsFish?: boolean;
  accessTags: WizardAccessOption[];
  isPortableOrQuick?: boolean;
  searchKeywords: string[];
}

const CURATED_WIZARD_DISHES: readonly CuratedWizardDish[] = [
  // ── BREAKFASTS ──
  {
    id: 'cur_greek_yogurt_bowl',
    mealTypes: ['breakfast', 'snack'],
    nameKey: 'sdb_builtin_ex_greek_yogurt_bowl',
    descKey: 'sdb_builtin_ex_greek_yogurt_bowl_desc',
    stockKey: 'greek_yogurt_bowl',
    foodCategories: ['protein', 'complex_carbs', 'fruits', 'healthy_fats'],
    foodSelections: {
      protein: ['greek_yogurt'],
      complex_carbs: ['oats'],
      fruits: ['berries'],
      healthy_fats: ['almonds'],
    },
    items: ['Greek Yogurt', 'Oatmeal', 'Berries', 'Almonds'],
    proteinTags: ['greek_yogurt'],
    carbTags: ['oats'],
    containsDairy: true,
    containsNuts: true,
    accessTags: ['cook_at_home', 'meal_prep', 'bring_to_work', 'limited_cooking'],
    isPortableOrQuick: true,
    searchKeywords: ['yogurt', 'dairy', 'oats', 'berries', 'almonds', 'nuts'],
  },
  {
    id: 'cur_protein_smoothie',
    mealTypes: ['breakfast', 'snack'],
    nameKey: 'sdb_builtin_ex_protein_smoothie',
    descKey: 'sdb_builtin_ex_protein_smoothie_desc',
    stockKey: 'protein_smoothie',
    foodCategories: ['protein', 'fruits', 'beverages'],
    foodSelections: {
      protein: ['protein_shake'],
      fruits: ['banana', 'berries'],
      beverages: ['smoothie'],
    },
    items: ['Protein Powder', 'Banana', 'Berries'],
    proteinTags: ['plant_based', 'greek_yogurt'],
    carbTags: ['oats', 'minimal_carbs'],
    containsDairy: true,
    containsNuts: true,
    accessTags: ['cook_at_home', 'bring_to_work', 'limited_cooking', 'restaurant_takeaway'],
    isPortableOrQuick: true,
    searchKeywords: ['smoothie', 'shake', 'banana', 'berries', 'protein', 'whey', 'almond'],
  },
  {
    id: 'cur_avocado_egg_toast',
    mealTypes: ['breakfast'],
    nameKey: 'wiz_meal_avocado_egg_toast',
    descKey: 'wiz_meal_avocado_egg_toast_desc',
    stockKey: 'avocado_egg_toast',
    foodCategories: ['protein', 'complex_carbs', 'healthy_fats', 'fruits'],
    foodSelections: {
      protein: ['eggs'],
      complex_carbs: ['whole_grain_bread'],
      healthy_fats: ['avocado'],
      fruits: ['berries'],
    },
    items: ['Eggs', 'Avocado', 'Whole Wheat Bread', 'Berries'],
    proteinTags: ['eggs'],
    carbTags: ['whole_grain'],
    containsGluten: true,
    accessTags: ['cook_at_home', 'workplace_cafeteria', 'restaurant_takeaway'],
    searchKeywords: ['eggs', 'avocado', 'bread', 'toast', 'wheat', 'berries'],
  },
  {
    id: 'cur_tofu_scramble',
    mealTypes: ['breakfast', 'dinner'],
    nameKey: 'wiz_meal_tofu_scramble',
    descKey: 'wiz_meal_tofu_scramble_desc',
    stockKey: 'plant_protein_bowl',
    foodCategories: ['protein', 'vegetables', 'healthy_fats', 'complex_carbs'],
    foodSelections: {
      protein: ['tofu'],
      vegetables: ['spinach', 'broccoli'],
      healthy_fats: ['avocado'],
      complex_carbs: ['quinoa'],
    },
    items: ['Spinach', 'Avocado', 'Quinoa'],
    proteinTags: ['plant_based'],
    carbTags: ['quinoa', 'oats', 'minimal_carbs'],
    accessTags: ['cook_at_home', 'meal_prep', 'bring_to_work'],
    searchKeywords: ['tofu', 'soy', 'spinach', 'broccoli', 'avocado', 'plant'],
  },
  {
    id: 'cur_overnight_oats',
    mealTypes: ['breakfast', 'snack'],
    nameKey: 'wiz_meal_overnight_oats',
    descKey: 'wiz_meal_overnight_oats_desc',
    stockKey: 'overnight_oats',
    foodCategories: ['complex_carbs', 'fruits', 'healthy_fats'],
    foodSelections: {
      complex_carbs: ['oats'],
      fruits: ['berries'],
      healthy_fats: ['seeds'],
    },
    items: ['Oatmeal', 'Berries'],
    proteinTags: ['plant_based'],
    carbTags: ['oats'],
    accessTags: ['meal_prep', 'bring_to_work', 'limited_cooking', 'cook_at_home'],
    isPortableOrQuick: true,
    searchKeywords: ['oats', 'chia', 'seeds', 'berries'],
  },
  {
    id: 'cur_breakfast_omelette',
    mealTypes: ['breakfast', 'dinner'],
    nameKey: 'sdb_builtin_ex_veggie_omelette',
    descKey: 'sdb_builtin_ex_veggie_omelette_desc',
    stockKey: 'veggie_omelette',
    foodCategories: ['protein', 'vegetables'],
    foodSelections: {
      protein: ['eggs'],
      vegetables: ['spinach', 'bell_pepper', 'lettuce_salad_greens'],
    },
    items: ['Eggs', 'Spinach', 'Salad'],
    proteinTags: ['eggs'],
    carbTags: ['minimal_carbs', 'oats'],
    accessTags: ['cook_at_home', 'meal_prep', 'workplace_cafeteria', 'restaurant_takeaway'],
    searchKeywords: ['eggs', 'omelette', 'spinach', 'bell pepper', 'peppers'],
  },

  // ── LUNCHES ──
  {
    id: 'cur_chicken_quinoa',
    mealTypes: ['lunch', 'dinner'],
    nameKey: 'wiz_meal_chefs_chicken_quinoa',
    descKey: 'wiz_meal_chefs_chicken_quinoa_desc',
    stockKey: 'quinoa_salad_bowl',
    foodCategories: ['protein', 'complex_carbs', 'vegetables', 'healthy_fats'],
    foodSelections: {
      protein: ['chicken'],
      complex_carbs: ['quinoa'],
      vegetables: ['lettuce_salad_greens', 'cucumber'],
      healthy_fats: ['olive_oil'],
    },
    items: ['Chicken Breast', 'Quinoa', 'Mixed Greens', 'Olive Oil'],
    proteinTags: ['chicken'],
    carbTags: ['quinoa'],
    containsLandMeat: true,
    accessTags: ['cook_at_home', 'meal_prep', 'bring_to_work', 'workplace_cafeteria', 'restaurant_takeaway'],
    isPortableOrQuick: true,
    searchKeywords: ['chicken', 'quinoa', 'greens', 'salad', 'cucumber', 'olive oil'],
  },
  {
    id: 'cur_tuna_wrap',
    mealTypes: ['lunch'],
    nameKey: 'sdb_builtin_ex_tuna_wrap',
    descKey: 'sdb_builtin_ex_tuna_wrap_desc',
    stockKey: 'tuna_wrap',
    foodCategories: ['protein', 'complex_carbs', 'vegetables'],
    foodSelections: {
      protein: ['tuna'],
      complex_carbs: ['whole_grain_bread'],
      vegetables: ['lettuce_salad_greens'],
    },
    items: ['Fish', 'Whole Wheat Bread', 'Salad'],
    proteinTags: ['fish'],
    carbTags: ['whole_grain'],
    containsGluten: true,
    containsFish: true,
    accessTags: ['bring_to_work', 'limited_cooking', 'workplace_cafeteria', 'restaurant_takeaway', 'meal_prep'],
    isPortableOrQuick: true,
    searchKeywords: ['tuna', 'fish', 'wrap', 'wheat', 'lettuce'],
  },
  {
    id: 'cur_turkey_rice_box',
    mealTypes: ['lunch', 'dinner'],
    nameKey: 'wiz_meal_turkey_rice_box',
    descKey: 'wiz_meal_turkey_rice_box_desc',
    stockKey: 'chicken_rice_broccoli',
    foodCategories: ['protein', 'complex_carbs', 'vegetables', 'healthy_fats'],
    foodSelections: {
      protein: ['turkey'],
      complex_carbs: ['brown_rice'],
      vegetables: ['broccoli'],
      healthy_fats: ['olive_oil'],
    },
    items: ['Turkey Breast', 'Brown Rice', 'Broccoli', 'Olive Oil'],
    proteinTags: ['turkey'],
    carbTags: ['rice'],
    containsLandMeat: true,
    accessTags: ['meal_prep', 'bring_to_work', 'cook_at_home', 'workplace_cafeteria'],
    isPortableOrQuick: true,
    searchKeywords: ['turkey', 'rice', 'broccoli'],
  },
  {
    id: 'cur_chickpea_quinoa_bowl',
    mealTypes: ['lunch', 'dinner'],
    nameKey: 'wiz_meal_chickpea_quinoa_bowl',
    descKey: 'wiz_meal_chickpea_quinoa_bowl_desc',
    stockKey: 'plant_protein_bowl',
    foodCategories: ['protein', 'complex_carbs', 'vegetables', 'healthy_fats'],
    foodSelections: {
      protein: ['beans_legumes'],
      complex_carbs: ['quinoa'],
      vegetables: ['cucumber', 'lettuce_salad_greens'],
      healthy_fats: ['olive_oil'],
    },
    items: ['Quinoa', 'Mixed Greens', 'Olive Oil'],
    proteinTags: ['plant_based'],
    carbTags: ['quinoa'],
    accessTags: ['meal_prep', 'bring_to_work', 'limited_cooking', 'workplace_cafeteria', 'restaurant_takeaway'],
    isPortableOrQuick: true,
    searchKeywords: ['chickpea', 'beans', 'legumes', 'quinoa', 'cucumber', 'greens'],
  },
  {
    id: 'cur_broth_soup',
    mealTypes: ['lunch', 'dinner'],
    nameKey: 'sdb_builtin_ex_broth_soup',
    descKey: 'sdb_builtin_ex_broth_soup_desc',
    stockKey: 'recovery_soup',
    foodCategories: ['protein', 'soups', 'vegetables'],
    foodSelections: {
      protein: ['chicken'],
      soups: ['chicken_soup'],
      vegetables: ['mixed_vegetables'],
    },
    items: ['Chicken Soup', 'Steamed Veggies'],
    proteinTags: ['chicken'],
    carbTags: ['minimal_carbs', 'rice'],
    containsLandMeat: true,
    accessTags: ['cook_at_home', 'meal_prep', 'workplace_cafeteria', 'restaurant_takeaway'],
    searchKeywords: ['chicken', 'soup', 'broth', 'vegetables'],
  },

  // ── SNACKS ──
  {
    id: 'cur_apple_walnuts',
    mealTypes: ['snack'],
    nameKey: 'sdb_builtin_ex_apple_walnuts',
    descKey: 'sdb_builtin_ex_apple_walnuts_desc',
    stockKey: 'fruit_nuts_snack',
    foodCategories: ['fruits', 'healthy_fats', 'snacks'],
    foodSelections: {
      fruits: ['apple'],
      healthy_fats: ['walnuts'],
      snacks: ['nuts'],
    },
    items: ['Apple', 'Walnuts'],
    proteinTags: ['plant_based'],
    carbTags: ['minimal_carbs'],
    containsNuts: true,
    accessTags: ['bring_to_work', 'limited_cooking', 'cook_at_home', 'meal_prep'],
    isPortableOrQuick: true,
    searchKeywords: ['apple', 'walnuts', 'nuts', 'fruit'],
  },
  {
    id: 'cur_hummus_veggie_snack',
    mealTypes: ['snack'],
    nameKey: 'wiz_meal_hummus_veggie_snack',
    descKey: 'wiz_meal_hummus_veggie_snack_desc',
    stockKey: 'fruit_veggie_snack',
    foodCategories: ['fruits', 'vegetables', 'healthy_fats'],
    foodSelections: {
      fruits: ['apple', 'berries'],
      vegetables: ['cucumber'],
      healthy_fats: ['seeds'],
    },
    items: ['Apple', 'Berries'],
    proteinTags: ['plant_based'],
    carbTags: ['minimal_carbs'],
    accessTags: ['bring_to_work', 'limited_cooking', 'cook_at_home', 'meal_prep', 'workplace_cafeteria'],
    isPortableOrQuick: true,
    searchKeywords: ['apple', 'berries', 'cucumber', 'seeds', 'fruit'],
  },

  // ── DINNERS ──
  {
    id: 'cur_salmon_veg',
    mealTypes: ['dinner', 'lunch'],
    nameKey: 'sdb_builtin_ex_salmon_veg',
    descKey: 'sdb_builtin_ex_salmon_veg_desc',
    stockKey: 'salmon_dinner',
    foodCategories: ['protein', 'vegetables', 'complex_carbs'],
    foodSelections: {
      protein: ['salmon'],
      vegetables: ['broccoli'],
      complex_carbs: ['brown_rice'],
    },
    items: ['Salmon', 'Broccoli', 'Brown Rice'],
    proteinTags: ['fish'],
    carbTags: ['rice'],
    containsFish: true,
    accessTags: ['cook_at_home', 'meal_prep', 'restaurant_takeaway', 'workplace_cafeteria'],
    searchKeywords: ['salmon', 'fish', 'broccoli', 'rice'],
  },
  {
    id: 'cur_white_fish_greens',
    mealTypes: ['dinner', 'lunch'],
    nameKey: 'wiz_meal_white_fish_greens',
    descKey: 'wiz_meal_white_fish_greens_desc',
    stockKey: 'white_fish_greens',
    foodCategories: ['protein', 'vegetables'],
    foodSelections: {
      protein: ['fish'],
      vegetables: ['asparagus', 'zucchini'],
    },
    items: ['White Fish', 'Asparagus', 'Zucchini'],
    proteinTags: ['fish'],
    carbTags: ['minimal_carbs', 'potato'],
    containsFish: true,
    accessTags: ['cook_at_home', 'restaurant_takeaway'],
    searchKeywords: ['fish', 'white fish', 'asparagus', 'zucchini'],
  },
  {
    id: 'cur_beef_sweet_potato',
    mealTypes: ['dinner', 'lunch'],
    nameKey: 'wiz_meal_beef_sweet_potato',
    descKey: 'wiz_meal_beef_sweet_potato_desc',
    stockKey: 'beef_sweet_potato',
    foodCategories: ['protein', 'complex_carbs', 'vegetables'],
    foodSelections: {
      protein: ['beef'],
      complex_carbs: ['sweet_potato'],
      vegetables: ['green_beans'],
    },
    items: ['Lean Beef', 'Sweet Potato', 'Green Beans'],
    proteinTags: ['beef'],
    carbTags: ['potato'],
    containsLandMeat: true,
    accessTags: ['cook_at_home', 'meal_prep', 'restaurant_takeaway'],
    searchKeywords: ['beef', 'steak', 'sweet potato', 'potato', 'green beans'],
  },
  {
    id: 'cur_tofu_veggie_stirfry',
    mealTypes: ['dinner', 'lunch'],
    nameKey: 'wiz_meal_tofu_veggie_stirfry',
    descKey: 'wiz_meal_tofu_veggie_stirfry_desc',
    stockKey: 'plant_protein_bowl',
    foodCategories: ['protein', 'complex_carbs', 'vegetables', 'healthy_fats'],
    foodSelections: {
      protein: ['tofu'],
      complex_carbs: ['quinoa'],
      vegetables: ['broccoli', 'spinach'],
      healthy_fats: ['olive_oil'],
    },
    items: ['Quinoa', 'Broccoli', 'Olive Oil'],
    proteinTags: ['plant_based'],
    carbTags: ['quinoa', 'rice'],
    accessTags: ['cook_at_home', 'meal_prep', 'bring_to_work', 'restaurant_takeaway'],
    searchKeywords: ['tofu', 'soy', 'quinoa', 'broccoli', 'spinach', 'plant'],
  },
];

function parseAvoidTokens(prefs: WizardFoodPreferences): string[] {
  const combined = `${prefs.foodsToAvoid || ''},${prefs.customRestrictionNote || ''}`;
  return combined
    .split(/[,;/\n]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 2);
}

function dishRespectsRestrictions(
  dish: CuratedWizardDish,
  prefs: WizardFoodPreferences,
  avoidTokens: string[]
): boolean {
  const rests = prefs.restrictions || [];
  if (rests.includes('dairy_free') && dish.containsDairy) return false;
  if (rests.includes('gluten_free') && dish.containsGluten) return false;
  if (rests.includes('nut_free') && dish.containsNuts) return false;
  if (rests.includes('vegetarian') && (dish.containsLandMeat || dish.containsFish)) return false;
  if (rests.includes('pescatarian') && dish.containsLandMeat) return false;

  if (avoidTokens.length > 0) {
    const hay = dish.searchKeywords.join(' ').toLowerCase();
    for (const tok of avoidTokens) {
      if (hay.includes(tok)) return false;
    }
  }
  return true;
}

function libraryMealRespectsRestrictions(
  meal: PersonalMealLibraryItem,
  prefs: WizardFoodPreferences,
  avoidTokens: string[]
): boolean {
  const blob = [
    meal.name,
    meal.description || '',
    ...(meal.items || []),
    ...Object.values(meal.foodSelections || {}).flat(),
    ...Object.values(meal.customFoods || {}).flat(),
  ]
    .join(' ')
    .toLowerCase();

  const rests = prefs.restrictions || [];
  if (rests.includes('dairy_free') && /(yogurt|cheese|milk|dairy|whey)/.test(blob)) return false;
  if (rests.includes('gluten_free') && /(bread|wheat|pasta|tortilla|wrap|crackers|toast)/.test(blob)) {
    return false;
  }
  if (rests.includes('nut_free') && /(almond|walnut|nut|peanut)/.test(blob)) return false;
  if (
    rests.includes('vegetarian') &&
    /(chicken|beef|turkey|pork|salmon|tuna|fish|shrimp|meat)/.test(blob)
  ) {
    return false;
  }
  if (rests.includes('pescatarian') && /(chicken|beef|turkey|pork|meat)/.test(blob)) {
    return false;
  }

  for (const tok of avoidTokens) {
    if (blob.includes(tok)) return false;
  }
  return true;
}

function resolveSuitabilityForSlot(
  candidateTags: WizardAccessOption[],
  userAccess: WizardAccessOption[],
  slotLocation: WizardMealLocation,
  preferQuickBackup = false
): WizardAccessOption {
  const effectiveUserAccess: WizardAccessOption[] =
    userAccess.length > 0 ? userAccess : ['cook_at_home'];

  if (preferQuickBackup) {
    for (const quickPref of [
      'bring_to_work',
      'limited_cooking',
      'meal_prep',
      'restaurant_takeaway',
      'workplace_cafeteria',
      'cook_at_home',
    ] as WizardAccessOption[]) {
      if (effectiveUserAccess.includes(quickPref) && candidateTags.includes(quickPref)) {
        return quickPref;
      }
    }
  }

  if (slotLocation === 'work') {
    for (const workPref of [
      'bring_to_work',
      'workplace_cafeteria',
      'meal_prep',
      'restaurant_takeaway',
    ] as WizardAccessOption[]) {
      if (effectiveUserAccess.includes(workPref) && candidateTags.includes(workPref)) {
        return workPref;
      }
    }
  }

  if (slotLocation === 'on_the_go') {
    for (const goPref of [
      'restaurant_takeaway',
      'bring_to_work',
      'limited_cooking',
    ] as WizardAccessOption[]) {
      if (effectiveUserAccess.includes(goPref) && candidateTags.includes(goPref)) {
        return goPref;
      }
    }
  }

  for (const acc of effectiveUserAccess) {
    if (candidateTags.includes(acc)) return acc;
  }

  return candidateTags[0] || effectiveUserAccess[0] || 'cook_at_home';
}

interface ScoredCandidate {
  key: string;
  name: string;
  desc: string;
  foodCategories: FoodCategoryKey[];
  foodSelections?: FoodSelectionsMap;
  customFoods?: PersonalMealLibraryItem['customFoods'];
  foodQuantities?: PersonalMealLibraryItem['foodQuantities'];
  soupPortion?: PersonalMealLibraryItem['soupPortion'];
  items: string[];
  imageRef?: MealImageRef;
  foodPhotos?: PersonalMealLibraryItem['foodPhotos'];
  libraryMealId?: string;
  accessTags: WizardAccessOption[];
  isPortableOrQuick: boolean;
  score: number;
}

function buildCandidatesForSlot(
  slot: WizardMealSlotConfig,
  profile: SmartWizardProfile,
  libraryMeals: PersonalMealLibraryItem[]
): ScoredCandidate[] {
  const { preferences, foodAccess } = profile;
  const avoidTokens = parseAvoidTokens(preferences);
  const candidates: ScoredCandidate[] = [];

  // 1. User's saved Personal Meal Library entries matching mealType & restrictions (reused with existing photo refs!)
  for (const lm of libraryMeals) {
    const lmType = lm.mealType || 'lunch';
    if (lmType !== slot.mealType) continue;
    if (!libraryMealRespectsRestrictions(lm, preferences, avoidTokens)) continue;

    const lmBlob = [
      lm.name,
      lm.description || '',
      ...(lm.items || []),
      ...Object.values(lm.foodSelections || {}).flat(),
      ...Object.values(lm.customFoods || {}).flat(),
    ]
      .join(' ')
      .toLowerCase();

    let libScore = 58 + Math.min(10, lm.useCount || 0) + (lm.isFavorite ? 8 : 0);
    if (preferences.proteins.includes('chicken') && /chicken/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('turkey') && /turkey/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('fish') && /(salmon|tuna|fish|cod|shrimp)/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('beef') && /(beef|steak)/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('eggs') && /(egg|omelet)/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('greek_yogurt') && /(yogurt|cheese)/.test(lmBlob)) libScore += 12;
    if (preferences.proteins.includes('plant_based') && /(tofu|lentil|chickpea|bean|plant|vegan)/.test(lmBlob)) {
      libScore += 12;
    }
    for (const ct of preferences.carbs) {
      if (lmBlob.includes(ct.replace('whole_wheat_', ''))) libScore += 8;
    }
    for (const fav of preferences.favoriteProduce) {
      if (lmBlob.includes(fav.toLowerCase())) libScore += 4;
    }

    const photos = getLibraryMealPhotos(lm);
    candidates.push({
      key: `lib_${lm.id}`,
      name: lm.name,
      desc: lm.description || '',
      foodCategories: [...lm.foodCategories],
      foodSelections: lm.foodSelections ? JSON.parse(JSON.stringify(lm.foodSelections)) : undefined,
      customFoods: lm.customFoods ? JSON.parse(JSON.stringify(lm.customFoods)) : undefined,
      foodQuantities: lm.foodQuantities ? JSON.parse(JSON.stringify(lm.foodQuantities)) : undefined,
      soupPortion: lm.soupPortion,
      items: lm.items ? [...lm.items] : [],
      imageRef: lm.imageRef
        ? cloneMealImageRef(lm.imageRef)
        : photos[0]
        ? { kind: 'uploaded_photo', photoId: photos[0].id, photoMeta: { ...photos[0] } }
        : undefined,
      foodPhotos: photos.length > 0 ? photos.map(p => ({ ...p })) : undefined,
      libraryMealId: lm.id,
      accessTags: foodAccess.length > 0 ? [...foodAccess] : ['cook_at_home'],
      isPortableOrQuick: true,
      score: libScore,
    });
  }

  // 2. Curated SDA dishes filtered strictly by restrictions & scored by user preferences + food access
  const filteredCurated = CURATED_WIZARD_DISHES.filter(
    d => d.mealTypes.includes(slot.mealType) && dishRespectsRestrictions(d, preferences, avoidTokens)
  );

  // Safe fallback if user selected an ultra-strict combination that filtered every dish in this slot
  const pool =
    filteredCurated.length > 0
      ? filteredCurated
      : CURATED_WIZARD_DISHES.filter(d => dishRespectsRestrictions(d, preferences, avoidTokens));
  const finalPool = pool.length > 0 ? pool : CURATED_WIZARD_DISHES.filter(d => d.mealTypes.includes(slot.mealType));

  for (const d of finalPool) {
    let score = 10;
    let matchedProtein = false;
    for (const pt of d.proteinTags) {
      if (preferences.proteins.includes(pt)) {
        score += 24;
        matchedProtein = true;
      }
    }
    if (!matchedProtein && preferences.proteins.length > 0 && d.proteinTags.length > 0) {
      score -= 10;
    }
    for (const ct of d.carbTags) {
      if (preferences.carbs.includes(ct)) score += 10;
    }
    for (const acc of foodAccess) {
      if (d.accessTags.includes(acc)) score += 8;
    }
    if (slot.location === 'work' && d.accessTags.includes('bring_to_work')) score += 9;
    if (slot.location === 'on_the_go' && d.isPortableOrQuick) score += 9;
    if (
      d.id === 'cur_protein_smoothie' &&
      preferences.beverages.includes('smoothies')
    ) {
      score += 8;
    }
    for (const fav of preferences.favoriteProduce) {
      if (d.searchKeywords.includes(fav.toLowerCase())) score += 4;
    }

    candidates.push({
      key: d.id,
      name: d.nameKey,
      desc: d.descKey,
      foodCategories: [...d.foodCategories],
      foodSelections: JSON.parse(JSON.stringify(d.foodSelections)),
      items: [...d.items],
      imageRef: { kind: 'stock_asset', stockKey: d.stockKey },
      accessTags: [...d.accessTags],
      isPortableOrQuick: Boolean(d.isPortableOrQuick),
      score,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function generateBlocksForSlots(
  slots: WizardMealSlotConfig[],
  profile: SmartWizardProfile,
  libraryMeals: PersonalMealLibraryItem[],
  variantSeed: number,
  includeOvernightFasting: boolean,
  wakeTime: string
): WizardProposedBlock[] {
  const usedMainKeys = new Set<string>();
  const generated: WizardProposedBlock[] = [];

  slots.forEach((slot, slotIdx) => {
    const ranked = buildCandidatesForSlot(slot, profile, libraryMeals);
    const nonDuplicateRanked = ranked.filter(c => !usedMainKeys.has(c.key));
    const mainPool = nonDuplicateRanked.length > 0 ? nonDuplicateRanked : ranked;
    const pickIdx = (variantSeed + slotIdx * 0) % Math.min(Math.max(mainPool.length, 1), 3);
    const mainChoice = mainPool[pickIdx] || mainPool[0];
    if (mainChoice) usedMainKeys.add(mainChoice.key);

    // Choose a distinct practical backup meal (preferring portable / quick assembly)
    const backupPool = ranked.filter(c => c.key !== mainChoice?.key);
    const sortedBackupPool = [...backupPool].sort(
      (a, b) => Number(b.isPortableOrQuick) - Number(a.isPortableOrQuick) || b.score - a.score
    );
    const backupChoice =
      sortedBackupPool[variantSeed % Math.max(sortedBackupPool.length, 1)] || mainChoice;

    const mainSuitability = resolveSuitabilityForSlot(
      mainChoice.accessTags,
      profile.foodAccess,
      slot.location,
      false
    );
    const backupSuitability = backupChoice
      ? resolveSuitabilityForSlot(backupChoice.accessTags, profile.foodAccess, slot.location, true)
      : undefined;

    const altOption: MealAlternativeOption | undefined =
      backupChoice && backupChoice.key !== mainChoice.key
        ? {
            id: `alt_${generateBlockId()}`,
            name: backupChoice.name,
            customText: backupChoice.desc || backupChoice.name,
            type: slot.mealType,
            mealType: slot.mealType,
            items: [...backupChoice.items],
            foodCategories: [...backupChoice.foodCategories],
            foodSelections: backupChoice.foodSelections
              ? JSON.parse(JSON.stringify(backupChoice.foodSelections))
              : undefined,
            customFoods: backupChoice.customFoods
              ? JSON.parse(JSON.stringify(backupChoice.customFoods))
              : undefined,
            foodQuantities: backupChoice.foodQuantities
              ? JSON.parse(JSON.stringify(backupChoice.foodQuantities))
              : undefined,
            soupPortion: backupChoice.soupPortion,
            libraryMealId: backupChoice.libraryMealId,
            foodPhotos: backupChoice.foodPhotos
              ? backupChoice.foodPhotos.map(p => ({ ...p }))
              : undefined,
            imageRef: backupChoice.imageRef ? cloneMealImageRef(backupChoice.imageRef) : undefined,
          }
        : undefined;

    const baseBlock = sanitiseBlock({
      id: `wiz_blk_${slotIdx + 1}_${generateBlockId()}`,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type: slot.mealType,
      mealType: slot.mealType,
      items: [...mainChoice.items],
      customText: mainChoice.name,
      foodCategories: [...mainChoice.foodCategories],
      foodSelections: mainChoice.foodSelections
        ? JSON.parse(JSON.stringify(mainChoice.foodSelections))
        : undefined,
      customFoods: mainChoice.customFoods
        ? JSON.parse(JSON.stringify(mainChoice.customFoods))
        : undefined,
      foodQuantities: mainChoice.foodQuantities
        ? JSON.parse(JSON.stringify(mainChoice.foodQuantities))
        : undefined,
      soupPortion: mainChoice.soupPortion,
      foodPhotos: mainChoice.foodPhotos ? mainChoice.foodPhotos.map(p => ({ ...p })) : undefined,
      libraryMealId: mainChoice.libraryMealId,
      approvalStatus: 'pending',
      alternatives: altOption ? [altOption] : undefined,
      imageRef: mainChoice.imageRef ? cloneMealImageRef(mainChoice.imageRef) : undefined,
    });

    generated.push({
      ...baseBlock,
      accessSuitability: mainSuitability,
      backupAccessSuitability: backupSuitability,
    });
  });

  if (includeOvernightFasting && slots.length > 0) {
    const lastSlot = slots[slots.length - 1];
    const fastStart = calculateEndTimeFromStart(lastSlot.endTime, 30);
    const fastEnd = isValidHHMM(wakeTime) ? wakeTime : '06:30';
    if (fastStart !== fastEnd) {
      const fastBlock = sanitiseBlock({
        id: `wiz_blk_fast_${generateBlockId()}`,
        startTime: fastStart,
        endTime: fastEnd,
        type: 'kitchen_closed',
        items: ['kitchen_closed'],
        customText: '',
        approvalStatus: 'pending',
        imageRef: { kind: 'stock_asset', stockKey: 'herbal_hydration' },
      });
      generated.push({
        ...fastBlock,
        accessSuitability: 'cook_at_home',
      });
    }
  }

  return generated;
}

/**
 * Generates a complete, editable daily structured eating schedule (plus weekend schedule)
 * grounded in the user's Food Preferences, Daily Routine, Food Access, and Personal Meal Library.
 */
export function generatePersonalizedWizardPlan(
  profile: SmartWizardProfile,
  options?: { variantSeed?: number; customLibraryMeals?: PersonalMealLibraryItem[] }
): GeneratedWizardPlan {
  const variantSeed = Math.max(0, Math.floor(options?.variantSeed ?? 0));
  const libraryMeals = options?.customLibraryMeals ?? listLibraryMeals();

  const validated = validateRoutineSlots(profile.routine.slots, profile.routine.wakeTime);
  const effectiveSlots = validated.valid
    ? profile.routine.slots
    : computeDefaultSlotsForRoutine(
        profile.routine.wakeTime,
        profile.routine.sleepTime,
        profile.routine.mealCount,
        profile.routine.middayLocation
      );

  const weekdayBlocks = generateBlocksForSlots(
    effectiveSlots,
    profile,
    libraryMeals,
    variantSeed,
    profile.routine.includeOvernightFastingWindow,
    profile.routine.wakeTime
  );

  if (profile.routine.weekendMode === 'flexible_unstructured') {
    return {
      weekdayBlocks,
      weekendBlocks: [],
      weekendDayMode: 'unstructured',
    };
  }

  if (profile.routine.weekendMode === 'later_shifted') {
    const shiftedSlots: WizardMealSlotConfig[] = effectiveSlots.map(s => {
      const shiftedStart = calculateEndTimeFromStart(s.startTime, 60);
      const origDur = ((timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) % 1440 + 1440) % 1440 || 30;
      const shiftedEnd = calculateEndTimeFromStart(shiftedStart, origDur);
      return {
        ...s,
        startTime: shiftedStart,
        endTime: shiftedEnd,
        location: 'home',
      };
    });
    const shiftedWake = calculateEndTimeFromStart(profile.routine.wakeTime, 60);
    const shiftedValid = validateRoutineSlots(shiftedSlots, shiftedWake);
    const safeWeekendSlots = shiftedValid.valid ? shiftedSlots : effectiveSlots;

    // Clone weekday meal choices onto shifted weekend times so weekend keeps the same curated dishes
    const weekendBlocks: WizardProposedBlock[] = weekdayBlocks.map((wb, idx) => {
      if (idx < safeWeekendSlots.length) {
        return {
          ...wb,
          id: `wiz_wknd_${idx + 1}_${generateBlockId()}`,
          startTime: safeWeekendSlots[idx].startTime,
          endTime: safeWeekendSlots[idx].endTime,
          alternatives: wb.alternatives ? wb.alternatives.map(a => cloneMealAlternative(a, true)) : undefined,
        };
      }
      return {
        ...wb,
        id: `wiz_wknd_fast_${generateBlockId()}`,
        startTime: calculateEndTimeFromStart(
          safeWeekendSlots[safeWeekendSlots.length - 1].endTime,
          30
        ),
        endTime: shiftedWake,
      };
    });

    return {
      weekdayBlocks,
      weekendBlocks,
      weekendDayMode: 'structured',
    };
  }

  return {
    weekdayBlocks,
    weekendBlocks: weekdayBlocks.map((wb, idx) => ({
      ...wb,
      id: `wiz_wknd_same_${idx + 1}_${generateBlockId()}`,
      alternatives: wb.alternatives ? wb.alternatives.map(a => cloneMealAlternative(a, true)) : undefined,
    })),
    weekendDayMode: 'structured',
  };
}

// ── Step 5: Approval Summary & Non-Destructive Safe Saving ────────────────────

export function summarizeWizardApprovals(
  blocks: Array<{ approvalStatus?: MealApprovalStatus | string }>
): WizardApprovalSummary {
  let acceptedCount = 0;
  let modifiedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (const b of blocks) {
    const st = b.approvalStatus || 'pending';
    if (st === 'accepted') acceptedCount++;
    else if (st === 'modified') modifiedCount++;
    else if (st === 'rejected') rejectedCount++;
    else pendingCount++;
  }

  return {
    acceptedCount,
    modifiedCount,
    rejectedCount,
    pendingCount,
    activeCount: acceptedCount + modifiedCount + pendingCount,
    totalCount: blocks.length,
  };
}

function finalizeBlocksForPersistence(rawBlocks: StructuredDietBlock[]): StructuredDietBlock[] {
  // Exclude rejected blocks cleanly (never creating slips or score events),
  // promote remaining pending blocks to 'accepted' upon explicit final confirmation,
  // and preserve 'modified' status on customized blocks.
  const active = rawBlocks
    .filter(b => b.approvalStatus !== 'rejected')
    .map(b => {
      const status: MealApprovalStatus =
        b.approvalStatus === 'modified' ? 'modified' : 'accepted';
      return sanitiseBlock({
        ...b,
        approvalStatus: status,
      });
    });

  return sortBlocks(deepCloneBlocks(active));
}

/**
 * Safely saves the user's confirmed Smart Wizard structure into `StructureDietStore`:
 * - NEVER silently overwrites an active weekly plan.
 * - Preserves all existing profiles, `historySnapshots`, `dateOverrides`, and uploaded photo references.
 * - Emits `DIET_UPDATED_EVENT` via `saveDietStore` / `saveWeeklyDiet` so Today, Daily Review,
 *   Weekly Review, Book 1, and Book 2 stay synchronized automatically.
 */
export function applyWizardPlanSafely(options: WizardSafeSaveOptions): WizardSafeSaveResult {
  const confirmedWeekdayBlocks = finalizeBlocksForPersistence(options.weekdayBlocks);
  if (confirmedWeekdayBlocks.length === 0) {
    throw new Error('WIZARD_ERR_ALL_REJECTED');
  }

  const todayKey = options.todayDateKey || getLocalDateKey();
  const todayDayKey = dateKeyToDayKey(todayKey);

  // Align weekend blocks with any individual rejections/modifications made on the corresponding weekday index
  const buildFinalWeekendBlocks = (): StructuredDietBlock[] => {
    if (!options.weekendBlocks || options.weekendBlocks.length === 0) {
      return deepCloneBlocks(confirmedWeekdayBlocks);
    }
    const synced: StructuredDietBlock[] = [];
    options.weekdayBlocks.forEach((wb, idx) => {
      if (wb.approvalStatus === 'rejected') return;
      const wkSlot = options.weekendBlocks![idx];
      const finalStatus: MealApprovalStatus =
        wb.approvalStatus === 'modified' ? 'modified' : 'accepted';
      synced.push(
        sanitiseBlock({
          ...wb,
          startTime: wkSlot ? wkSlot.startTime : wb.startTime,
          endTime: wkSlot ? wkSlot.endTime : wb.endTime,
          approvalStatus: finalStatus,
        })
      );
    });
    return sortBlocks(deepCloneBlocks(synced.length > 0 ? synced : confirmedWeekdayBlocks));
  };

  if (options.destination === 'new_profile') {
    const cleanName = (options.profileName || '').trim();
    if (!cleanName) {
      throw new Error('WIZARD_ERR_PROFILE_NAME');
    }

    const created = createCustomProfile({
      name: cleanName,
      description: options.profileDescription,
    });

    let nextDiet = getActiveProfile(loadDietStore()).diet;
    for (const dk of DAY_KEYS) {
      const isWeekend = dk === 'sat' || dk === 'sun';
      if (isWeekend && options.weekendMode === 'flexible_unstructured') {
        nextDiet = updateDayPlan(nextDiet, dk, d => ({
          ...d,
          mode: 'unstructured',
          blocks: [],
        }));
      } else if (isWeekend && options.weekendMode === 'later_shifted') {
        nextDiet = updateDayPlan(nextDiet, dk, d => ({
          ...d,
          mode: 'structured',
          blocks: buildFinalWeekendBlocks(),
        }));
      } else {
        nextDiet = updateDayPlan(nextDiet, dk, d => ({
          ...d,
          mode: 'structured',
          blocks: deepCloneBlocks(confirmedWeekdayBlocks),
        }));
      }
    }

    saveWeeklyDiet(nextDiet);
    const updatedActive = getActiveProfile(loadDietStore());
    return {
      destination: 'new_profile',
      savedBlocksCount: confirmedWeekdayBlocks.length,
      createdProfile: updatedActive.id === created.id ? updatedActive : created,
      updatedDays: [...DAY_KEYS],
    };
  }

  if (options.destination === 'today_only') {
    const currentWeekly = loadWeeklyDiet();
    const dayIdx = DAY_KEYS.indexOf(todayDayKey);
    const nextWeekly = setDateOverride(currentWeekly, todayKey, {
      dayKey: todayDayKey,
      dayOfWeek: dayIdx >= 0 ? dayIdx : 0,
      mode: 'structured',
      blocks: deepCloneBlocks(confirmedWeekdayBlocks),
    });
    saveWeeklyDiet(nextWeekly);
    return {
      destination: 'today_only',
      savedBlocksCount: confirmedWeekdayBlocks.length,
      todayDateKey: todayKey,
    };
  }

  // 'selected_weekdays'
  const daysToUpdate = Array.isArray(options.selectedWeekdays) ? options.selectedWeekdays : [];
  if (daysToUpdate.length === 0) {
    throw new Error('WIZARD_ERR_NO_WEEKDAYS');
  }

  let nextWeekly = loadWeeklyDiet();
  for (const dk of daysToUpdate) {
    const isWeekend = dk === 'sat' || dk === 'sun';
    if (isWeekend && options.weekendMode === 'flexible_unstructured') {
      nextWeekly = updateDayPlan(nextWeekly, dk, d => ({
        ...d,
        mode: 'unstructured',
        blocks: [],
      }));
    } else if (isWeekend && options.weekendMode === 'later_shifted') {
      nextWeekly = updateDayPlan(nextWeekly, dk, d => ({
        ...d,
        mode: 'structured',
        blocks: buildFinalWeekendBlocks(),
      }));
    } else {
      nextWeekly = updateDayPlan(nextWeekly, dk, d => ({
        ...d,
        mode: 'structured',
        blocks: deepCloneBlocks(confirmedWeekdayBlocks),
      }));
    }
  }

  if (options.alsoApplyToToday && daysToUpdate.includes(todayDayKey)) {
    const isWeekendToday = todayDayKey === 'sat' || todayDayKey === 'sun';
    const dayIdx = DAY_KEYS.indexOf(todayDayKey);
    if (isWeekendToday && options.weekendMode === 'flexible_unstructured') {
      nextWeekly = setDateOverride(nextWeekly, todayKey, {
        dayKey: todayDayKey,
        dayOfWeek: dayIdx >= 0 ? dayIdx : 0,
        mode: 'unstructured',
        blocks: [],
      });
    } else {
      const blocksForToday =
        isWeekendToday && options.weekendMode === 'later_shifted'
          ? buildFinalWeekendBlocks()
          : deepCloneBlocks(confirmedWeekdayBlocks);
      nextWeekly = setDateOverride(nextWeekly, todayKey, {
        dayKey: todayDayKey,
        dayOfWeek: dayIdx >= 0 ? dayIdx : 0,
        mode: 'structured',
        blocks: blocksForToday,
      });
    }
  }

  saveWeeklyDiet(nextWeekly);
  return {
    destination: 'selected_weekdays',
    savedBlocksCount: confirmedWeekdayBlocks.length,
    updatedDays: [...daysToUpdate],
    todayDateKey: options.alsoApplyToToday ? todayKey : undefined,
  };
}
