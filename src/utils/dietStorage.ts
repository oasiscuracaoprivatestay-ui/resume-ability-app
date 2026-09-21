/**
 * Structured Diet Storage — Phase 10 & Phase 26 (Structure Goal / Master Profiles)
 *
 * Upgraded from single-plan (v1) to weekly plan (v2) to multi-profile Structure Goal system (v3).
 * A Structure Goal is a master profile/template representing high-level diet strategies
 * (e.g. Rapid Fat Loss, Moderate Fat Loss, Maintenance, etc.).
 * Each profile contains its own isolated 7-day schedule (Mon..Sun), date overrides, and snapshots.
 * Switching active profiles preserves all profiles without data loss.
 *
 * Storage key: 'resume-ability-diet'
 * Version: 3
 * Fully backward-compatible: automatically migrates v2/v1 data into Moderate Fat Loss.
 */

import {
  FoodCategoryKey,
  FOOD_CATEGORY_KEYS,
  mapLegacyItemsToCategories,
} from '../data/dietData';
import {
  isValidCanonicalFood,
  isCanonicalFoodKeyOrLabel,
  getDerivedFoodItems,
  type FoodQuantitiesMap,
} from '../data/foodOptions';
import type { FoodPhotoMetadata } from './photoStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayMode = 'structured' | 'unstructured' | 'free';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// ── Meal Type (Phase 7B: Optional Descriptive Metadata) ─────────────────────
export const MEAL_TYPE_KEYS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type MealTypeKey = typeof MEAL_TYPE_KEYS[number];

export interface StructuredDietBlock {
  id: string;
  startTime: string;   // 24h "HH:MM"
  endTime: string;     // 24h "HH:MM"
  type: string;        // from BLOCK_TYPES or 'Custom'
  items: string[];     // legacy selected options or sample items
  customText: string;  // free-text; empty string if not set
  mealType?: MealTypeKey; // Phase 7B: optional descriptive meal type
  foodCategories?: FoodCategoryKey[]; // Phase 2: multi-select categories
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>; // Phase 7C: canonical specific food keys per category
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;    // Phase 7C: custom food strings per category
  foodQuantities?: FoodQuantitiesMap; // Phase 28: optional quantities per food item
  foodPhoto?: FoodPhotoMetadata;      // Phase 6: legacy single photo attachment
  foodPhotos?: FoodPhotoMetadata[];   // Phase 6B: multi-photo support (food + beverages)
}

/**
 * Extract an array of FoodPhotoMetadata from a block, normalizing legacy single foodPhoto into array.
 */
export function getBlockPhotos(
  block?: { foodPhotos?: FoodPhotoMetadata[]; foodPhoto?: FoodPhotoMetadata } | null
): FoodPhotoMetadata[] {
  if (!block) return [];
  if (Array.isArray(block.foodPhotos) && block.foodPhotos.length > 0) {
    return block.foodPhotos.filter(p => p && typeof p.id === 'string');
  }
  if (block.foodPhoto && typeof block.foodPhoto.id === 'string') {
    return [block.foodPhoto];
  }
  return [];
}

/**
 * Helper to determine the primary display description for a Structured Diet block or food log.
 *
 * Sergio's Phase 26I Requirement:
 * Prioritizes WHAT THE USER ACTUALLY PLANS TO EAT over generic meal/block types.
 * E.g., Fruit > Banana => Main description is "Banana" (instead of "Breakfast").
 *
 * Deterministic Fallback Hierarchy:
 * 1. Explicit actual food description in `customText` (if non-empty and not just matching the generic block type).
 * 2. Specific selected foods in `foodSelections` and `customFoods` (e.g. ['banana'] => "Banana", or multi-foods joined).
 * 3. Legacy food items in `items` (if non-empty and not just category keys).
 * 4. Special structure blocks (Micro-Fasting, Kitchen Closed) => localized structure block name.
 * 5. Ordinary meal/block type fallback => localized block type name (e.g. "Breakfast", "Lunch", "Dinner").
 */
export function getBlockPrimaryDescription(
  block?: {
    type?: string;
    customText?: string;
    items?: string[];
    foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
    customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  } | null,
  t?: Record<string, any>
): string {
  if (!block) return '';

  const blockType = (block.type || '').trim().toLowerCase();
  const rawCustom = (block.customText || '').trim();

  // Helper to translate or fallback a block type key
  const getTypeName = (k: string) => {
    if (!k) return '';
    if (t) {
      const trans = t[`sdb_type_${k}`] || t[`sdb_type_${k.toLowerCase()}`];
      if (trans && typeof trans === 'string') return trans;
    }
    // Fallback: title case
    return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
  };

  const typeName = getTypeName(blockType);

  // Check active selected or custom foods
  const activeItems = getDerivedFoodItems(block.foodSelections, block.customFoods, t);
  const hasActiveFoods = activeItems.length > 0;

  // 1. Check if customText has genuine actual-food text
  // (Ignore if customText is just an old stored copy of the block type name itself,
  // or a stale auto-populated canonical food name that was deselected from foodSelections)
  if (rawCustom) {
    const rawLower = rawCustom.toLowerCase();
    const isJustType = rawLower === blockType || (typeName && rawLower === typeName.toLowerCase());

    let isStaleDeselectedFood = false;
    if (hasActiveFoods) {
      const isCanonical = isCanonicalFoodKeyOrLabel(rawCustom, t);
      const isCurrentlyActive = activeItems.some(item => item.toLowerCase() === rawLower);
      if (isCanonical && !isCurrentlyActive) {
        isStaleDeselectedFood = true;
      }
    }

    if (!isJustType && !isStaleDeselectedFood) {
      if (t && t[rawCustom]) {
        return t[rawCustom];
      }
      return rawCustom;
    }
  }

  // 2. Extract specific selected foods from foodSelections and customFoods
  if (activeItems.length > 0) {
    return activeItems.join(', ');
  }

  // 3. Legacy items fallback (if items contains specific food items, not category keys)
  if (Array.isArray(block.items) && block.items.length > 0) {
    const legacyFoodLabels: string[] = [];
    for (const item of block.items) {
      const lower = item.trim().toLowerCase();
      // Skip if item is just a category key or structure key
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(lower)) continue;
      if (lower === 'micro_fasting' || lower === 'kitchen_closed') continue;

      let label = '';
      if (t && t[`sdb_food_${item}`]) {
        label = t[`sdb_food_${item}`];
      } else {
        label = item.charAt(0).toUpperCase() + item.slice(1).replace(/_/g, ' ');
      }
      if (label && !legacyFoodLabels.includes(label)) {
        legacyFoodLabels.push(label);
      }
    }
    if (legacyFoodLabels.length > 0) {
      return legacyFoodLabels.join(', ');
    }
  }

  // 4. Special structure blocks (micro_fasting, kitchen_closed)
  if (blockType === 'micro_fasting' || blockType === 'kitchen_closed') {
    return typeName || (blockType === 'micro_fasting' ? 'Micro-Fasting' : 'Kitchen Closed');
  }

  // 5. Fallback: rawCustom if present, else block type name
  if (rawCustom) {
    return rawCustom;
  }

  return typeName || 'Breakfast';
}

export interface StructuredDietDay {
  dayKey: DayKey;
  dayOfWeek: number;   // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  mode: DayMode;
  blocks: StructuredDietBlock[];
}

export interface WeeklyStructuredDiet {
  version: 2;
  planName: string;
  days: StructuredDietDay[];
  /** Optional date-specific plan overrides (keyed by "YYYY-MM-DD"). */
  dateOverrides?: Record<string, StructuredDietDay>;
  /** Historical snapshots for past dates (keyed by "YYYY-MM-DD") to guarantee immutability. */
  historySnapshots?: Record<string, StructuredDietDay>;
}

// Built-in goal identifiers
export type BuiltInGoalId =
  | 'rapid_fat_loss'
  | 'moderate_fat_loss'
  | 'protecting_current_loss'
  | 'maintenance'
  | 'vacation_maintenance'
  | 'recovery_illness';

export interface StructureGoalProfile {
  id: string; // BuiltInGoalId or custom "goal_..."
  type: 'builtin' | 'custom';
  name: string;
  description?: string;
  isDefault?: boolean;
  createdAt: number;
  diet: WeeklyStructuredDiet;
}

export interface StructureDietStore {
  version: 3;
  activeProfileId: string;
  profiles: StructureGoalProfile[];
}

// Legacy v1 interface for backward compatibility
export interface StructuredDietPlan {
  name: string;
  blocks: StructuredDietBlock[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-diet';
export const DEFAULT_PLAN_NAME = 'My Structured Diet';
export const DEFAULT_ACTIVE_GOAL_ID: BuiltInGoalId = 'moderate_fat_loss';

export const BUILT_IN_GOALS: Array<{
  id: BuiltInGoalId;
  name: string;
  description: string;
  sampleBlocks: Array<Omit<StructuredDietBlock, 'id'>>;
}> = [
  {
    id: 'rapid_fat_loss',
    name: 'Rapid Fat Loss',
    description: 'Aggressive fat loss protocol with structured eating windows',
    sampleBlocks: [
      { startTime: '08:00', endTime: '08:30', type: 'Breakfast', items: ['Eggs', 'Spinach'], customText: '', foodCategories: ['protein', 'vegetables'] },
      { startTime: '13:00', endTime: '13:30', type: 'Lunch', items: ['Chicken Breast', 'Broccoli', 'Mixed Greens'], customText: '', foodCategories: ['protein', 'vegetables'] },
      { startTime: '19:00', endTime: '19:30', type: 'Dinner', items: ['White Fish', 'Asparagus', 'Zucchini'], customText: '', foodCategories: ['protein', 'vegetables'] },
    ],
  },
  {
    id: 'moderate_fat_loss',
    name: 'Moderate Fat Loss',
    description: 'Steady, sustainable fat loss with balanced daily nutrition',
    sampleBlocks: [
      { startTime: '08:00', endTime: '08:30', type: 'Breakfast', items: ['Eggs', 'Oatmeal', 'Berries'], customText: '', foodCategories: ['protein', 'complex_carbs', 'fruits'] },
      { startTime: '12:30', endTime: '13:00', type: 'Lunch', items: ['Chicken Breast', 'Rice', 'Broccoli'], customText: '', foodCategories: ['protein', 'complex_carbs', 'vegetables'] },
      { startTime: '16:00', endTime: '16:20', type: 'Snack', items: ['Greek Yogurt', 'Almonds'], customText: '', foodCategories: ['protein', 'healthy_fats', 'snacks'] },
      { startTime: '19:30', endTime: '20:00', type: 'Dinner', items: ['Salmon', 'Sweet Potato', 'Mixed Greens'], customText: '', foodCategories: ['protein', 'healthy_fats', 'complex_carbs', 'vegetables'] },
    ],
  },
  {
    id: 'protecting_current_loss',
    name: 'Protecting the Current Loss',
    description: 'Consolidation phase to protect recent weight loss and reset baseline',
    sampleBlocks: [
      { startTime: '08:30', endTime: '09:00', type: 'Breakfast', items: ['Oatmeal', 'Protein Powder', 'Berries'], customText: '', foodCategories: ['protein', 'complex_carbs', 'fruits'] },
      { startTime: '13:00', endTime: '13:30', type: 'Lunch', items: ['Turkey Breast', 'Quinoa', 'Mixed Greens'], customText: '', foodCategories: ['protein', 'complex_carbs', 'vegetables'] },
      { startTime: '16:30', endTime: '16:50', type: 'Snack', items: ['Apple', 'Almonds'], customText: '', foodCategories: ['fruits', 'healthy_fats', 'snacks'] },
      { startTime: '19:30', endTime: '20:00', type: 'Dinner', items: ['Lean Beef', 'Baked Potato', 'Green Beans'], customText: '', foodCategories: ['protein', 'complex_carbs', 'vegetables'] },
    ],
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Long-term metabolic balance and flexible lifestyle nutrition',
    sampleBlocks: [
      { startTime: '08:00', endTime: '08:30', type: 'Breakfast', items: ['Eggs', 'Whole Wheat Bread', 'Avocado'], customText: '', foodCategories: ['protein', 'complex_carbs', 'healthy_fats'] },
      { startTime: '12:30', endTime: '13:00', type: 'Lunch', items: ['Salmon', 'Brown Rice', 'Mixed Veggies'], customText: '', foodCategories: ['protein', 'healthy_fats', 'complex_carbs', 'vegetables'] },
      { startTime: '16:00', endTime: '16:20', type: 'Snack', items: ['Greek Yogurt', 'Berries', 'Walnuts'], customText: '', foodCategories: ['protein', 'fruits', 'healthy_fats', 'snacks'] },
      { startTime: '19:30', endTime: '20:00', type: 'Dinner', items: ['Chicken Breast', 'Pasta', 'Olive Oil', 'Salad'], customText: '', foodCategories: ['protein', 'complex_carbs', 'healthy_fats', 'vegetables'] },
    ],
  },
  {
    id: 'vacation_maintenance',
    name: 'Vacation Maintenance',
    description: 'Flexible rhythm with anchor meals to maintain weight while travelling',
    sampleBlocks: [
      { startTime: '10:00', endTime: '10:45', type: 'Breakfast', items: ['Eggs', 'Fruit', 'Coffee'], customText: 'Morning brunch', foodCategories: ['protein', 'fruits', 'beverages'] },
      { startTime: '15:00', endTime: '15:30', type: 'Snack', items: ['Fruit', 'Nuts'], customText: 'Afternoon refuel', foodCategories: ['fruits', 'healthy_fats', 'snacks'] },
      { startTime: '20:00', endTime: '21:00', type: 'Dinner', items: ['Fish', 'Salad'], customText: 'Social evening dinner', foodCategories: ['protein', 'vegetables'] },
    ],
  },
  {
    id: 'recovery_illness',
    name: 'Recovery During Illness',
    description: 'Light meals, gentle digestion, and restorative hydration',
    sampleBlocks: [
      { startTime: '08:30', endTime: '09:00', type: 'Breakfast', items: ['Tea', 'Toast', 'Honey'], customText: 'Hydration & light morning', foodCategories: ['beverages', 'simple_carbs'] },
      { startTime: '12:30', endTime: '13:00', type: 'Lunch', items: ['Chicken Soup', 'Crackers', 'Rice'], customText: 'Recovery lunch', foodCategories: ['protein', 'simple_carbs', 'complex_carbs'] },
      { startTime: '16:00', endTime: '16:30', type: 'Snack', items: ['Herbal Tea', 'Banana'], customText: 'Rest & fluids', foodCategories: ['beverages', 'fruits', 'snacks'] },
      { startTime: '19:00', endTime: '19:30', type: 'Dinner', items: ['Broth', 'Steamed Veggies', 'Rice'], customText: 'Gentle dinner', foodCategories: ['beverages', 'vegetables', 'complex_carbs'] },
    ],
  },
];

// ── Block cloning & ID generation ─────────────────────────────────────────────

/**
 * Generate a short unique block ID.
 * Uses crypto.randomUUID() where available, falls back to Date.now() + random.
 */
export function generateBlockId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

/**
 * Deep-clone a list of blocks, assigning brand new unique IDs to each block
 * to guarantee no identity collisions and zero reference sharing between days.
 */
export function deepCloneBlocks(blocks: StructuredDietBlock[]): StructuredDietBlock[] {
  return blocks.map(b => ({
    id: generateBlockId(),
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    items: Array.isArray(b.items) ? [...b.items] : [],
    customText: typeof b.customText === 'string' ? b.customText : '',
    mealType: b.mealType,
    foodCategories: Array.isArray(b.foodCategories)
      ? [...b.foodCategories]
      : mapLegacyItemsToCategories(Array.isArray(b.items) ? b.items : []),
    foodSelections: b.foodSelections ? JSON.parse(JSON.stringify(b.foodSelections)) : undefined,
    customFoods: b.customFoods ? JSON.parse(JSON.stringify(b.customFoods)) : undefined,
    foodQuantities: b.foodQuantities ? JSON.parse(JSON.stringify(b.foodQuantities)) : undefined,
    foodPhoto: b.foodPhoto ? { ...b.foodPhoto } : undefined,
    foodPhotos: b.foodPhotos ? b.foodPhotos.map(p => ({ ...p })) : undefined,
  }));
}

export function createDefaultWeeklyDiet(planName = DEFAULT_PLAN_NAME): WeeklyStructuredDiet {
  return {
    version: 2,
    planName,
    days: DAY_KEYS.map((dayKey, idx) => ({
      dayKey,
      dayOfWeek: idx,
      mode: 'structured',
      blocks: [],
    })),
  };
}

/** Build a WeeklyStructuredDiet from an initial set of template blocks */
export function createWeeklyDietFromTemplate(
  planName: string,
  sampleBlocks: Array<Omit<StructuredDietBlock, 'id'>>,
): WeeklyStructuredDiet {
  return {
    version: 2,
    planName,
    days: DAY_KEYS.map((dayKey, idx) => ({
      dayKey,
      dayOfWeek: idx,
      mode: 'structured',
      blocks: sampleBlocks.map(b => ({
        ...b,
        id: generateBlockId(),
        items: [...b.items],
        foodCategories: Array.isArray(b.foodCategories)
          ? [...b.foodCategories]
          : mapLegacyItemsToCategories(Array.isArray(b.items) ? b.items : []),
      })),
    })),
  };
}

/** Create a built-in profile from its definition */
export function createBuiltInProfile(id: BuiltInGoalId): StructureGoalProfile {
  const def = BUILT_IN_GOALS.find(g => g.id === id) ?? BUILT_IN_GOALS[1]; // fallback moderate
  return {
    id: def.id,
    type: 'builtin',
    name: def.name,
    description: def.description,
    isDefault: def.id === DEFAULT_ACTIVE_GOAL_ID,
    createdAt: 1700000000000,
    diet: createWeeklyDietFromTemplate(def.name, def.sampleBlocks),
  };
}

/** Create initial store containing all 6 built-in goals */
export function createDefaultStore(): StructureDietStore {
  return {
    version: 3,
    activeProfileId: DEFAULT_ACTIVE_GOAL_ID,
    profiles: BUILT_IN_GOALS.map(g => createBuiltInProfile(g.id)),
  };
}

// ── Display helpers with i18n support ────────────────────────────────────────

/** Returns the display name of a profile, localized if built-in */
export function getGoalDisplayName(
  profile: StructureGoalProfile,
  t?: Record<string, any> | ((key: any) => string),
): string {
  if (profile.type === 'builtin' && t) {
    const key = `sdb_goal_${profile.id}`;
    if (typeof t === 'function') {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    } else if (typeof t[key] === 'string' && t[key]) {
      return t[key];
    }
  }
  return profile.name;
}

/** Returns the display description of a profile, localized if built-in */
export function getGoalDisplayDescription(
  profile: StructureGoalProfile,
  t?: Record<string, any> | ((key: any) => string),
): string {
  if (profile.type === 'builtin' && t) {
    const key = `sdb_goal_${profile.id}_desc`;
    if (typeof t === 'function') {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    } else if (typeof t[key] === 'string' && t[key]) {
      return t[key];
    }
  }
  return profile.description || '';
}

// ── Core persistence & idempotent migration ───────────────────────────────────

/** Parse a raw WeeklyStructuredDiet object safely */
function parseWeeklyDietObject(rawObj: Record<string, unknown>): WeeklyStructuredDiet {
  const planName = typeof rawObj.planName === 'string' && rawObj.planName.trim()
    ? rawObj.planName.trim()
    : DEFAULT_PLAN_NAME;

  const rawDays = Array.isArray(rawObj.days) ? (rawObj.days as Record<string, unknown>[]) : [];
  const days: StructuredDietDay[] = DAY_KEYS.map((dayKey, idx) => {
    const found = rawDays.find(d => d && typeof d === 'object' && d.dayKey === dayKey);
    if (!found) {
      return {
        dayKey,
        dayOfWeek: idx,
        mode: 'structured',
        blocks: [],
      };
    }
    const mode: DayMode =
      found.mode === 'unstructured'
        ? 'unstructured'
        : found.mode === 'free'
        ? 'free'
        : 'structured';
    const blocks = Array.isArray(found.blocks)
      ? (found.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
      : [];
    return {
      dayKey,
      dayOfWeek: idx,
      mode,
      blocks,
    };
  });

  // Safe parsing of dateOverrides if present
  let dateOverrides: Record<string, StructuredDietDay> | undefined = undefined;
  if (rawObj.dateOverrides && typeof rawObj.dateOverrides === 'object') {
    dateOverrides = {};
    for (const [k, v] of Object.entries(rawObj.dateOverrides as Record<string, unknown>)) {
      if (v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).blocks)) {
        const cast = v as Record<string, unknown>;
        dateOverrides[k] = {
          dayKey: (cast.dayKey as DayKey) ?? dateKeyToDayKey(k),
          dayOfWeek: typeof cast.dayOfWeek === 'number' ? cast.dayOfWeek : 0,
          mode: cast.mode === 'unstructured' ? 'unstructured' : cast.mode === 'free' ? 'free' : 'structured',
          blocks: Array.isArray(cast.blocks)
            ? (cast.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
            : [],
        };
      }
    }
  }

  // Safe parsing of historySnapshots if present
  let historySnapshots: Record<string, StructuredDietDay> | undefined = undefined;
  if (rawObj.historySnapshots && typeof rawObj.historySnapshots === 'object') {
    historySnapshots = {};
    for (const [k, v] of Object.entries(rawObj.historySnapshots as Record<string, unknown>)) {
      if (v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).blocks)) {
        const cast = v as Record<string, unknown>;
        historySnapshots[k] = {
          dayKey: (cast.dayKey as DayKey) ?? dateKeyToDayKey(k),
          dayOfWeek: typeof cast.dayOfWeek === 'number' ? cast.dayOfWeek : 0,
          mode: cast.mode === 'unstructured' ? 'unstructured' : cast.mode === 'free' ? 'free' : 'structured',
          blocks: Array.isArray(cast.blocks)
            ? (cast.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
            : [],
        };
      }
    }
  }

  return {
    version: 2,
    planName,
    days,
    ...(dateOverrides ? { dateOverrides } : {}),
    ...(historySnapshots ? { historySnapshots } : {}),
  };
}

/**
 * Load the complete StructureDietStore from localStorage.
 * Handles:
 * 1. Missing storage -> creates default store with 6 built-in goals.
 * 2. Version 3 data -> validates profiles, ensures all built-in goals exist, and returns.
 * 3. Version 2 or legacy v1 data -> migrates existing user diet into 'moderate_fat_loss',
 *    creates built-in profiles for the other goals, persists v3, and returns.
 */
export function loadDietStore(): StructureDietStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaultStore = createDefaultStore();
      saveDietStore(defaultStore);
      return defaultStore;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      const defaultStore = createDefaultStore();
      saveDietStore(defaultStore);
      return defaultStore;
    }

    // ── Check if already version 3 ──────────────────────────────────────────
    if (parsed.version === 3 && Array.isArray(parsed.profiles)) {
      const rawProfiles = parsed.profiles as Record<string, unknown>[];
      const validProfiles: StructureGoalProfile[] = [];

      for (const p of rawProfiles) {
        if (!p || typeof p !== 'object' || typeof p.id !== 'string') continue;
        const id = p.id;
        const type: 'builtin' | 'custom' = p.type === 'custom' ? 'custom' : 'builtin';
        const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Goal';
        const description = typeof p.description === 'string' ? p.description.trim() : undefined;
        const isDefault = Boolean(p.isDefault);
        const createdAt = typeof p.createdAt === 'number' ? p.createdAt : Date.now();
        const diet = (p.diet && typeof p.diet === 'object')
          ? parseWeeklyDietObject(p.diet as Record<string, unknown>)
          : createDefaultWeeklyDiet(name);

        validProfiles.push({
          id,
          type,
          name,
          description,
          isDefault,
          createdAt,
          diet,
        });
      }

      // Ensure all 6 built-in profiles exist
      for (const def of BUILT_IN_GOALS) {
        if (!validProfiles.some(p => p.id === def.id)) {
          validProfiles.push(createBuiltInProfile(def.id));
        }
      }

      let activeProfileId = typeof parsed.activeProfileId === 'string' && parsed.activeProfileId
        ? parsed.activeProfileId
        : DEFAULT_ACTIVE_GOAL_ID;

      // Verify activeProfileId exists
      if (!validProfiles.some(p => p.id === activeProfileId)) {
        activeProfileId = DEFAULT_ACTIVE_GOAL_ID;
      }

      const store: StructureDietStore = {
        version: 3,
        activeProfileId,
        profiles: validProfiles,
      };
      return store;
    }

    // ── Backward-compatible migration from v2 or legacy v1 ──────────────────
    let userDiet: WeeklyStructuredDiet;

    if (parsed.version === 2 && Array.isArray(parsed.days)) {
      userDiet = parseWeeklyDietObject(parsed);
    } else {
      // Legacy v1 migration
      const legacyName = typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim()
        : DEFAULT_PLAN_NAME;
      const legacyBlocks = Array.isArray(parsed.blocks)
        ? (parsed.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
        : [];
      userDiet = {
        version: 2,
        planName: legacyName,
        days: DAY_KEYS.map((dayKey, idx) => ({
          dayKey,
          dayOfWeek: idx,
          mode: 'structured',
          blocks: deepCloneBlocks(legacyBlocks),
        })),
      };
    }

    // Build the 6 built-in profiles, placing userDiet into moderate_fat_loss
    const defaultStore = createDefaultStore();
    const migratedProfiles = defaultStore.profiles.map(p => {
      if (p.id === DEFAULT_ACTIVE_GOAL_ID) {
        return {
          ...p,
          diet: userDiet,
        };
      }
      return p;
    });

    const migratedStore: StructureDietStore = {
      version: 3,
      activeProfileId: DEFAULT_ACTIVE_GOAL_ID,
      profiles: migratedProfiles,
    };

    saveDietStore(migratedStore);
    return migratedStore;
  } catch {
    const fallback = createDefaultStore();
    saveDietStore(fallback);
    return fallback;
  }
}

/** Persist the entire StructureDietStore to localStorage. */
export function saveDietStore(store: StructureDietStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently.
  }
}

/** Get the currently active profile from store */
export function getActiveProfile(store = loadDietStore()): StructureGoalProfile {
  const found = store.profiles.find(p => p.id === store.activeProfileId);
  if (found) return found;
  const fallback = store.profiles.find(p => p.id === DEFAULT_ACTIVE_GOAL_ID) ?? store.profiles[0];
  if (fallback) return fallback;
  return createBuiltInProfile(DEFAULT_ACTIVE_GOAL_ID);
}

/** Set the active profile ID and persist */
export function setActiveProfile(profileId: string): StructureGoalProfile {
  const store = loadDietStore();
  const exists = store.profiles.some(p => p.id === profileId);
  if (!exists) {
    return getActiveProfile(store);
  }
  store.activeProfileId = profileId;
  saveDietStore(store);
  return getActiveProfile(store);
}

/**
 * Create a new custom Structure Goal profile.
 * Can optionally clone days/blocks from an existing diet plan.
 */
export function createCustomProfile(params: {
  name: string;
  description?: string;
  cloneFromDiet?: WeeklyStructuredDiet;
}): StructureGoalProfile {
  const store = loadDietStore();
  const cleanName = params.name.trim();
  const cleanDesc = params.description?.trim();
  const id = `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  let diet: WeeklyStructuredDiet;
  if (params.cloneFromDiet) {
    diet = {
      version: 2,
      planName: cleanName,
      days: params.cloneFromDiet.days.map(d => ({
        ...d,
        blocks: deepCloneBlocks(d.blocks),
      })),
      dateOverrides: params.cloneFromDiet.dateOverrides
        ? JSON.parse(JSON.stringify(params.cloneFromDiet.dateOverrides))
        : undefined,
      historySnapshots: params.cloneFromDiet.historySnapshots
        ? JSON.parse(JSON.stringify(params.cloneFromDiet.historySnapshots))
        : undefined,
    };
  } else {
    diet = createDefaultWeeklyDiet(cleanName);
  }

  const newProfile: StructureGoalProfile = {
    id,
    type: 'custom',
    name: cleanName,
    description: cleanDesc || undefined,
    createdAt: Date.now(),
    diet,
  };

  store.profiles.push(newProfile);
  store.activeProfileId = id; // newly created profile becomes active
  saveDietStore(store);
  return newProfile;
}

/**
 * Update custom profile metadata (name, description).
 * Built-in profiles cannot have their names updated.
 */
export function updateCustomProfile(
  profileId: string,
  updates: { name?: string; description?: string },
): StructureGoalProfile | null {
  const store = loadDietStore();
  const profile = store.profiles.find(p => p.id === profileId);
  if (!profile) return null;

  if (profile.type === 'custom' && typeof updates.name === 'string' && updates.name.trim()) {
    profile.name = updates.name.trim();
    profile.diet.planName = updates.name.trim();
  }
  if (typeof updates.description === 'string') {
    profile.description = updates.description.trim() || undefined;
  }

  saveDietStore(store);
  return profile;
}

/**
 * Delete a custom Structure Goal profile.
 * Built-in profiles cannot be deleted.
 * If the deleted profile was active, activeProfileId falls back to Moderate Fat Loss.
 */
export function deleteCustomProfile(profileId: string): {
  success: boolean;
  newActiveProfile: StructureGoalProfile;
} {
  const store = loadDietStore();
  const profileIdx = store.profiles.findIndex(p => p.id === profileId);
  if (profileIdx === -1) {
    return { success: false, newActiveProfile: getActiveProfile(store) };
  }

  const profile = store.profiles[profileIdx];
  if (profile.type === 'builtin') {
    // Built-in goals cannot be deleted
    return { success: false, newActiveProfile: getActiveProfile(store) };
  }

  store.profiles.splice(profileIdx, 1);

  if (store.activeProfileId === profileId) {
    store.activeProfileId = DEFAULT_ACTIVE_GOAL_ID;
  }

  saveDietStore(store);
  return { success: true, newActiveProfile: getActiveProfile(store) };
}

/**
 * Backward-compatible loadWeeklyDiet:
 * Returns the weekly diet of the currently active profile.
 */
export function loadWeeklyDiet(): WeeklyStructuredDiet {
  const store = loadDietStore();
  return getActiveProfile(store).diet;
}

/**
 * Backward-compatible saveWeeklyDiet:
 * Persists the given weekly diet into the currently active profile.
 */
export function saveWeeklyDiet(diet: WeeklyStructuredDiet): void {
  try {
    const store = loadDietStore();
    const active = store.profiles.find(p => p.id === store.activeProfileId);
    if (active) {
      active.diet = diet;
      saveDietStore(store);
    }
  } catch {
    // Storage quota exceeded — fail silently.
  }
}

// ── Day accessors & mutators ──────────────────────────────────────────────────

/** Get the plan for a specific day from a WeeklyStructuredDiet. */
export function getDayPlan(diet: WeeklyStructuredDiet, dayKey: DayKey): StructuredDietDay {
  const day = diet.days.find(d => d.dayKey === dayKey);
  if (day) return day;
  const idx = DAY_KEYS.indexOf(dayKey);
  return {
    dayKey,
    dayOfWeek: idx >= 0 ? idx : 0,
    mode: 'structured',
    blocks: [],
  };
}

/** Update a single day's plan within the weekly structure. */
export function updateDayPlan(
  diet: WeeklyStructuredDiet,
  dayKey: DayKey,
  updater: (day: StructuredDietDay) => StructuredDietDay,
): WeeklyStructuredDiet {
  const nextDays = diet.days.map(d => {
    if (d.dayKey !== dayKey) return d;
    return updater({ ...d });
  });
  return { ...diet, days: nextDays };
}

/** Set the mode ('structured' | 'unstructured' | 'free') for a specific day. */
export function setDayMode(
  diet: WeeklyStructuredDiet,
  dayKey: DayKey,
  mode: DayMode,
): WeeklyStructuredDiet {
  return updateDayPlan(diet, dayKey, d => ({ ...d, mode }));
}

/** Check if a day plan is in Free Schedule Day mode */
export function isFreeDay(day?: StructuredDietDay | null): boolean {
  return day?.mode === 'free';
}

/**
 * Sets one or multiple specific calendar dates or weekdays as Free Schedule Days.
 * Intentionally schedule-free: zero blocks, mode: 'free'.
 * Preserves historical snapshots and existing verifications.
 */
export function setFreeScheduleDates(
  diet: WeeklyStructuredDiet,
  dates: string[], // YYYY-MM-DD or DayKey ('mon', 'tue', etc.)
): WeeklyStructuredDiet {
  let nextDiet = { ...diet };

  for (const dateOrDay of dates) {
    if (dateOrDay.length === 3 && DAY_KEYS.includes(dateOrDay as DayKey)) {
      // Recurring weekday
      const dayKey = dateOrDay as DayKey;
      nextDiet = updateDayPlan(nextDiet, dayKey, d => ({
        ...d,
        mode: 'free',
        blocks: [],
      }));
    } else if (dateOrDay.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Specific calendar date override
      const dateKey = dateOrDay;
      const dayKey = dateKeyToDayKey(dateKey);
      const dayIdx = DAY_KEYS.indexOf(dayKey);
      const freeDayPlan: StructuredDietDay = {
        dayKey,
        dayOfWeek: dayIdx >= 0 ? dayIdx : 0,
        mode: 'free',
        blocks: [],
      };
      nextDiet = setDateOverride(nextDiet, dateKey, freeDayPlan);
    }
  }

  return nextDiet;
}

/**
 * Copy a day's plan (blocks and mode) to one or more target days.
 * Target days receive independent deep copies of blocks with new IDs.
 */
export function copyDayPlan(
  diet: WeeklyStructuredDiet,
  sourceKey: DayKey,
  targetKeys: DayKey[],
): WeeklyStructuredDiet {
  const sourceDay = getDayPlan(diet, sourceKey);
  const targets = new Set(targetKeys.filter(k => k !== sourceKey));
  if (targets.size === 0) return diet;

  const nextDays = diet.days.map(d => {
    if (!targets.has(d.dayKey)) return d;
    return {
      ...d,
      mode: sourceDay.mode,
      blocks: deepCloneBlocks(sourceDay.blocks),
    };
  });

  return { ...diet, days: nextDays };
}

/**
 * Get device's current local calendar day as a DayKey ('mon' .. 'sun').
 * Based entirely on local time, zero UTC assumptions.
 */
export function getLocalTodayKey(): DayKey {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const map: Record<number, DayKey> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[jsDay] ?? 'mon';
}

// ── Legacy adapters (for backward compatibility if called) ────────────────────

export function loadDietPlan(): StructuredDietPlan {
  const weekly = loadWeeklyDiet();
  const todayKey = getLocalTodayKey();
  const today = getDayPlan(weekly, todayKey);
  return {
    name: weekly.planName,
    blocks: today.blocks,
  };
}

export function saveDietPlan(plan: StructuredDietPlan): void {
  const weekly = loadWeeklyDiet();
  const todayKey = getLocalTodayKey();
  const updated = updateDayPlan(
    { ...weekly, planName: plan.name },
    todayKey,
    d => ({ ...d, blocks: plan.blocks }),
  );
  saveWeeklyDiet(updated);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidBlock(b: unknown): b is StructuredDietBlock {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' &&
    typeof block.startTime === 'string' &&
    typeof block.endTime === 'string' &&
    typeof block.type === 'string'
  );
}

export function sanitiseBlock(b: StructuredDietBlock): StructuredDietBlock {
  const categories: FoodCategoryKey[] = Array.isArray(b.foodCategories)
    ? (b.foodCategories.filter(c => (FOOD_CATEGORY_KEYS as readonly string[]).includes(c)) as FoodCategoryKey[])
    : mapLegacyItemsToCategories(Array.isArray(b.items) ? b.items : []);

  // Normalize photos: support both multi-photo foodPhotos and legacy foodPhoto
  const rawPhotos = getBlockPhotos(b);
  const foodPhotos: FoodPhotoMetadata[] | undefined = rawPhotos.length > 0
    ? rawPhotos.map(p => ({
        id: p.id,
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        mimeType: typeof p.mimeType === 'string' ? p.mimeType : 'image/jpeg',
      }))
    : undefined;

  const foodPhoto: FoodPhotoMetadata | undefined = foodPhotos && foodPhotos.length > 0
    ? foodPhotos[0]
    : undefined;

  const mealType: MealTypeKey | undefined = (MEAL_TYPE_KEYS as readonly string[]).includes(b.mealType as string)
    ? (b.mealType as MealTypeKey)
    : undefined;

  // Prune and sanitize specific food selections by valid category
  let foodSelections: Partial<Record<FoodCategoryKey, string[]>> | undefined;
  if (b.foodSelections && typeof b.foodSelections === 'object') {
    const nextSel: Partial<Record<FoodCategoryKey, string[]>> = {};
    let hasAny = false;
    for (const cat of categories) {
      const arr = b.foodSelections[cat];
      if (Array.isArray(arr)) {
        const valid = arr.filter(
          item => typeof item === 'string' && item.trim().length > 0 && isValidCanonicalFood(cat, item.trim())
        );
        if (valid.length > 0) {
          nextSel[cat] = Array.from(new Set(valid.map(s => s.trim())));
          hasAny = true;
        }
      }
    }
    if (hasAny) foodSelections = nextSel;
  }

  // Prune and sanitize custom food strings by valid category
  let customFoods: Partial<Record<FoodCategoryKey, string[]>> | undefined;
  if (b.customFoods && typeof b.customFoods === 'object') {
    const nextCustom: Partial<Record<FoodCategoryKey, string[]>> = {};
    let hasAny = false;
    for (const cat of categories) {
      const arr = b.customFoods[cat];
      if (Array.isArray(arr)) {
        const valid = arr
          .map(s => (typeof s === 'string' ? s.trim() : ''))
          .filter(s => s.length > 0);
        const unique = Array.from(new Set(valid));
        if (unique.length > 0) {
          nextCustom[cat] = unique;
          hasAny = true;
        }
      }
    }
    if (hasAny) customFoods = nextCustom;
  }

  // Prune and sanitize food quantities
  let foodQuantities: FoodQuantitiesMap | undefined;
  if (b.foodQuantities && typeof b.foodQuantities === 'object') {
    const nextQuantities: FoodQuantitiesMap = {};
    let hasAny = false;
    for (const [key, qty] of Object.entries(b.foodQuantities)) {
      if (qty && typeof qty === 'object' && typeof qty.amount === 'number' && !isNaN(qty.amount) && qty.amount > 0 && typeof qty.unit === 'string') {
        const item: any = {
          amount: Number(qty.amount),
          unit: qty.unit,
        };
        if (typeof qty.customUnit === 'string' && qty.customUnit.trim()) {
          item.customUnit = qty.customUnit.trim();
        }
        if (typeof qty.grams === 'number' && !isNaN(qty.grams)) {
          item.grams = Number(qty.grams);
        }
        if (typeof qty.calories === 'number' && !isNaN(qty.calories)) {
          item.calories = Number(qty.calories);
        }
        nextQuantities[key] = item;
        hasAny = true;
      }
    }
    if (hasAny) foodQuantities = nextQuantities;
  }

  return {
    id: b.id,
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    items: Array.isArray(b.items) ? b.items.filter(i => typeof i === 'string') : [],
    customText: typeof b.customText === 'string' ? b.customText : '',
    mealType,
    foodCategories: categories,
    foodSelections,
    customFoods,
    foodQuantities,
    foodPhoto,
    foodPhotos,
  };
}

/**
 * Returns true if the block spans midnight (overnight range).
 * An overnight block has endTime <= startTime numerically.
 */
export function isOvernightBlock(block: Pick<StructuredDietBlock, 'startTime' | 'endTime'>): boolean {
  return timeToMinutes(block.endTime) <= timeToMinutes(block.startTime);
}

/** Convert "HH:MM" to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Sort blocks in display order:
 * - Same-day blocks by startTime ascending
 * - Overnight blocks appear at the end (they start in the evening)
 *   but are sorted among themselves by startTime
 */
export function sortBlocks(blocks: StructuredDietBlock[]): StructuredDietBlock[] {
  return [...blocks].sort((a, b) => {
    const aMin = timeToMinutes(a.startTime);
    const bMin = timeToMinutes(b.startTime);
    const aOver = isOvernightBlock(a);
    const bOver = isOvernightBlock(b);
    // Non-overnight before overnight
    if (!aOver && bOver) return -1;
    if (aOver && !bOver) return 1;
    return aMin - bMin;
  });
}

/**
 * Returns the stable local date key formatted as "YYYY-MM-DD".
 * Never uses UTC or toISOString() to prevent day shifts across timezones.
 */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a local "YYYY-MM-DD" date key to a DayKey ('mon'..'sun').
 */
export function dateKeyToDayKey(dateKey: string): DayKey {
  const parts = dateKey.split('-').map(Number);
  const date = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1);
  const jsDay = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const map: Record<number, DayKey> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[jsDay] ?? 'mon';
}

/**
 * Returns the effective plan for a specific calendar date (formatted as "YYYY-MM-DD").
 * Implements the weekly inheritance and history preservation rules:
 * 1. If dateKey has an explicit override in dateOverrides[dateKey], return it.
 * 2. If dateKey is in the past (dateKey < todayDateKey):
 *    - Return historySnapshots[dateKey] if preserved.
 *    - Does NOT retroactively inherit changes made today.
 * 3. If dateKey is today or in the future (dateKey >= todayDateKey):
 *    - Returns the latest recurring weekday structure from diet.days.
 *    - This achieves same-weekday future inheritance by default.
 */
export function getDayPlanForDate(diet: WeeklyStructuredDiet, dateKey: string): StructuredDietDay {
  // 1. Explicit date override takes precedence
  if (diet.dateOverrides && diet.dateOverrides[dateKey]) {
    const override = diet.dateOverrides[dateKey];
    return {
      ...override,
      blocks: deepCloneBlocks(override.blocks),
    };
  }

  const todayDateKey = getLocalDateKey();
  const dayKey = dateKeyToDayKey(dateKey);

  // 2. Historical dates must remain immutable
  if (dateKey < todayDateKey) {
    if (diet.historySnapshots && diet.historySnapshots[dateKey]) {
      const snap = diet.historySnapshots[dateKey];
      return {
        ...snap,
        blocks: deepCloneBlocks(snap.blocks),
      };
    }
  }

  // 3. Default: inherit the latest weekday template
  const templateDay = getDayPlan(diet, dayKey);
  return {
    ...templateDay,
    blocks: deepCloneBlocks(templateDay.blocks),
  };
}

/**
 * When the user changes a block's start time, shift the end time by the previous block's duration.
 * Maintains overnight status correctly.
 */
export function calculateShiftedEndTime(newStartTime: string, oldStartTime: string, oldEndTime: string): string {
  const oldStartMin = timeToMinutes(oldStartTime);
  let oldEndMin = timeToMinutes(oldEndTime);
  if (oldEndMin <= oldStartMin) {
    oldEndMin += 24 * 60; // overnight duration
  }
  const duration = Math.max(15, oldEndMin - oldStartMin);
  const newStartMin = timeToMinutes(newStartTime);
  const newEndMin = (newStartMin + duration) % (24 * 60);

  const endH = Math.floor(newEndMin / 60);
  const endM = newEndMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Set an explicit override for a specific calendar date (e.g. future date override).
 */
export function setDateOverride(
  diet: WeeklyStructuredDiet,
  dateKey: string,
  dayPlan: StructuredDietDay,
): WeeklyStructuredDiet {
  const nextOverrides = {
    ...(diet.dateOverrides || {}),
    [dateKey]: {
      ...dayPlan,
      blocks: deepCloneBlocks(dayPlan.blocks),
    },
  };
  return { ...diet, dateOverrides: nextOverrides };
}

/**
 * Clear an explicit date override.
 */
export function clearDateOverride(
  diet: WeeklyStructuredDiet,
  dateKey: string,
): WeeklyStructuredDiet {
  if (!diet.dateOverrides || !diet.dateOverrides[dateKey]) return diet;
  const nextOverrides = { ...diet.dateOverrides };
  delete nextOverrides[dateKey];
  return { ...diet, dateOverrides: nextOverrides };
}

/**
 * Freeze a historical date's plan so future template updates cannot alter it.
 */
export function snapshotHistoryDate(
  diet: WeeklyStructuredDiet,
  dateKey: string,
  dayPlan?: StructuredDietDay,
): WeeklyStructuredDiet {
  if (diet.historySnapshots && diet.historySnapshots[dateKey]) {
    return diet; // already snapshotted, keep immutable
  }
  const planToFreeze = dayPlan ?? getDayPlan(diet, dateKeyToDayKey(dateKey));
  const nextSnapshots = {
    ...(diet.historySnapshots || {}),
    [dateKey]: {
      ...planToFreeze,
      blocks: deepCloneBlocks(planToFreeze.blocks),
    },
  };
  return { ...diet, historySnapshots: nextSnapshots };
}

