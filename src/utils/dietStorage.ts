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
  type SoupPortionKey,
} from '../data/foodOptions';
import type { FoodPhotoMetadata } from './photoStorage';
import { resolveBuiltInMealText, translateBuiltInFoodItem } from './mealStockPhotos';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayMode = 'structured' | 'unstructured' | 'free';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// ── Meal Type (Phase 7B: Optional Descriptive Metadata) ─────────────────────
export const MEAL_TYPE_KEYS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'] as const;
export type MealTypeKey = typeof MEAL_TYPE_KEYS[number];

// ── Proposed Meal Approval Status (Pre-Meal Plan Only — Never a Slip or Score Event) ──
export const MEAL_APPROVAL_STATUSES = ['pending', 'accepted', 'modified', 'rejected'] as const;
export type MealApprovalStatus = typeof MEAL_APPROVAL_STATUSES[number];

// ── Image Reference Model (Reuses IndexedDB Photo IDs or Stock Assets — Zero Blob Duplication) ──
export const MEAL_IMAGE_REF_KINDS = ['uploaded_photo', 'stock_asset'] as const;
export type MealImageRefKind = typeof MEAL_IMAGE_REF_KINDS[number];

export interface MealImageRef {
  kind: MealImageRefKind;
  /** Existing IndexedDB photo ID in 'resume-ability-photos-db' when kind === 'uploaded_photo'. */
  photoId?: string;
  /** Optional lightweight metadata for the existing IndexedDB photo (no image blob). */
  photoMeta?: FoodPhotoMetadata;
  /** Public stock asset URL/path when kind === 'stock_asset' (e.g. '/images/meals/breakfast.jpg'). */
  assetUrl?: string;
  /** Optional canonical stock meal key (e.g. 'breakfast', 'lunch', 'snack', 'dinner'). */
  stockKey?: string;
}

export interface MealAlternativeOption {
  id: string;
  name: string;
  customText?: string;
  type?: string;
  mealType?: MealTypeKey;
  items?: string[];
  foodCategories?: FoodCategoryKey[];
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  foodQuantities?: FoodQuantitiesMap;
  soupPortion?: SoupPortionKey;
  libraryMealId?: string;
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
  imageRef?: MealImageRef;
}

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
  soupPortion?: SoupPortionKey;       // Phase 31A: optional quick soup portion size
  foodPhoto?: FoodPhotoMetadata;      // Phase 6: legacy single photo attachment
  foodPhotos?: FoodPhotoMetadata[];   // Phase 6B: multi-photo support (food + beverages)
  libraryMealId?: string;             // Final Phase 1: optional link to PersonalMealLibraryItem.id
  approvalStatus?: MealApprovalStatus; // Final Phase 1: pre-meal plan approval; omitted = 'accepted'
  alternatives?: MealAlternativeOption[]; // Final Phase 1: optional alternative meal options
  imageRef?: MealImageRef;            // Final Phase 1: optional primary image reference
}

/**
 * Returns the effective approval status of a scheduled block.
 * Existing/legacy blocks without an explicit `approvalStatus` remain 100% functional
 * and are treated as `'accepted'`.
 */
export function getEffectiveBlockApprovalStatus(
  block?: { approvalStatus?: MealApprovalStatus | string } | null
): MealApprovalStatus {
  if (!block || !block.approvalStatus) return 'accepted';
  return (MEAL_APPROVAL_STATUSES as readonly string[]).includes(block.approvalStatus)
    ? (block.approvalStatus as MealApprovalStatus)
    : 'accepted';
}

/**
 * Returns true if the scheduled block is active in the plan (not rejected).
 * Legacy blocks without `approvalStatus` resolve to `'accepted'` (active = true).
 */
export function isBlockScheduleActive(
  block?: { approvalStatus?: MealApprovalStatus | string } | null
): boolean {
  return getEffectiveBlockApprovalStatus(block) !== 'rejected';
}

/**
 * Extract an array of FoodPhotoMetadata from a block, normalizing multi-photo `foodPhotos`,
 * legacy single `foodPhoto`, and `imageRef` (`kind === 'uploaded_photo'`) without duplicating blobs.
 */
export function getBlockPhotos(
  block?: {
    foodPhotos?: FoodPhotoMetadata[];
    foodPhoto?: FoodPhotoMetadata;
    imageRef?: MealImageRef;
  } | null
): FoodPhotoMetadata[] {
  if (!block) return [];
  if (Array.isArray(block.foodPhotos) && block.foodPhotos.length > 0) {
    return block.foodPhotos.filter(p => p && typeof p.id === 'string' && p.id.trim().length > 0);
  }
  if (block.foodPhoto && typeof block.foodPhoto.id === 'string' && block.foodPhoto.id.trim().length > 0) {
    return [block.foodPhoto];
  }
  if (
    block.imageRef &&
    block.imageRef.kind === 'uploaded_photo' &&
    typeof block.imageRef.photoId === 'string' &&
    block.imageRef.photoId.trim().length > 0
  ) {
    if (block.imageRef.photoMeta && block.imageRef.photoMeta.id === block.imageRef.photoId) {
      return [block.imageRef.photoMeta];
    }
    return [
      {
        id: block.imageRef.photoId.trim(),
        createdAt: new Date(0).toISOString(),
        mimeType: 'image/jpeg',
      },
    ];
  }
  return [];
}

/**
 * Collects every uploaded IndexedDB photo ID referenced directly on a block
 * (`foodPhotos`, `foodPhoto`, `imageRef`) OR inside any of its `alternatives`.
 */
export function getAllBlockReferencedPhotoIds(
  block?: {
    foodPhotos?: Array<{ id?: string }>;
    foodPhoto?: { id?: string };
    imageRef?: { kind?: string; photoId?: string; photoMeta?: { id?: string } };
    alternatives?: Array<{
      foodPhotos?: Array<{ id?: string }>;
      foodPhoto?: { id?: string };
      imageRef?: { kind?: string; photoId?: string; photoMeta?: { id?: string } };
    }>;
  } | null
): string[] {
  if (!block) return [];
  const ids = new Set<string>();

  const addFromTarget = (target?: {
    foodPhotos?: Array<{ id?: string }>;
    foodPhoto?: { id?: string };
    imageRef?: { kind?: string; photoId?: string; photoMeta?: { id?: string } };
  } | null) => {
    if (!target) return;
    if (target.foodPhoto && typeof target.foodPhoto.id === 'string' && target.foodPhoto.id.trim()) {
      ids.add(target.foodPhoto.id.trim());
    }
    if (Array.isArray(target.foodPhotos)) {
      for (const p of target.foodPhotos) {
        if (p && typeof p.id === 'string' && p.id.trim()) {
          ids.add(p.id.trim());
        }
      }
    }
    if (target.imageRef && target.imageRef.kind === 'uploaded_photo') {
      if (typeof target.imageRef.photoId === 'string' && target.imageRef.photoId.trim()) {
        ids.add(target.imageRef.photoId.trim());
      }
      if (
        target.imageRef.photoMeta &&
        typeof target.imageRef.photoMeta.id === 'string' &&
        target.imageRef.photoMeta.id.trim()
      ) {
        ids.add(target.imageRef.photoMeta.id.trim());
      }
    }
  };

  addFromTarget(block);
  if (Array.isArray(block.alternatives)) {
    for (const alt of block.alternatives) {
      addFromTarget(alt);
    }
  }

  return Array.from(ids);
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
    libraryMealId?: string;
  } | null,
  t?: Record<string, any>
): string {
  if (!block) return '';

  const blockType = (block.type || '').trim().toLowerCase();
  const rawCustom = (block.customText || '').trim();
  const isUserCustomMeal = Boolean(block.libraryMealId && block.libraryMealId.trim());

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
    if (hasActiveFoods && !isUserCustomMeal) {
      const isCanonical = isCanonicalFoodKeyOrLabel(rawCustom, t);
      const isCurrentlyActive = activeItems.some(item => item.toLowerCase() === rawLower);
      if (isCanonical && !isCurrentlyActive) {
        isStaleDeselectedFood = true;
      }
    }

    if (!isJustType && !isStaleDeselectedFood) {
      return resolveBuiltInMealText(rawCustom, t, { isUserCustomMeal });
    }
  }

  // 2. Extract specific selected foods from foodSelections and customFoods
  if (activeItems.length > 0) {
    return activeItems.join(', ');
  }

  // 3. Legacy / built-in sample items fallback (if items contains specific food items, not category keys)
  if (Array.isArray(block.items) && block.items.length > 0) {
    const legacyFoodLabels: string[] = [];
    for (const item of block.items) {
      const lower = item.trim().toLowerCase();
      // Skip if item is just a category key or structure key
      if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(lower)) continue;
      if (lower === 'micro_fasting' || lower === 'kitchen_closed') continue;

      const translated = translateBuiltInFoodItem(item, t);
      const label =
        translated !== item.trim()
          ? translated
          : item.charAt(0).toUpperCase() + item.slice(1).replace(/_/g, ' ');
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

  // 5. Fallback: resolved rawCustom if present, else block type name
  if (rawCustom) {
    return resolveBuiltInMealText(rawCustom, t, { isUserCustomMeal });
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
export const DIET_UPDATED_EVENT = 'sda_diet_updated';
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
      {
        startTime: '08:00',
        endTime: '08:30',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Eggs', 'Spinach'],
        customText: '',
        foodCategories: ['protein', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'veggie_omelette' },
        alternatives: [
          {
            id: 'alt_rfl_bfast',
            name: 'sdb_builtin_ex_protein_smoothie',
            customText: 'sdb_builtin_ex_protein_smoothie_desc',
            mealType: 'breakfast',
            foodCategories: ['protein', 'fruits'],
            imageRef: { kind: 'stock_asset', stockKey: 'protein_smoothie' },
          },
        ],
      },
      {
        startTime: '13:00',
        endTime: '13:30',
        type: 'Lunch',
        mealType: 'lunch',
        items: ['Chicken Breast', 'Broccoli', 'Mixed Greens'],
        customText: '',
        foodCategories: ['protein', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'chicken_rice_broccoli' },
        alternatives: [
          {
            id: 'alt_rfl_lunch',
            name: 'sdb_builtin_ex_tuna_wrap',
            customText: 'sdb_builtin_ex_tuna_wrap_desc',
            mealType: 'lunch',
            foodCategories: ['protein', 'complex_carbs', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'tuna_wrap' },
          },
        ],
      },
      {
        startTime: '19:00',
        endTime: '19:30',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['White Fish', 'Asparagus', 'Zucchini'],
        customText: '',
        foodCategories: ['protein', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'salmon_dinner' },
        alternatives: [
          {
            id: 'alt_rfl_dinner',
            name: 'sdb_builtin_ex_veggie_omelette',
            customText: 'sdb_builtin_ex_veggie_omelette_desc',
            mealType: 'dinner',
            foodCategories: ['protein', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'veggie_omelette' },
          },
        ],
      },
    ],
  },
  {
    id: 'moderate_fat_loss',
    name: 'Moderate Fat Loss',
    description: 'Steady, sustainable fat loss with balanced daily nutrition',
    sampleBlocks: [
      {
        startTime: '08:00',
        endTime: '08:30',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Eggs', 'Oatmeal', 'Berries'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'fruits'],
        imageRef: { kind: 'stock_asset', stockKey: 'breakfast_bowl' },
        alternatives: [
          {
            id: 'alt_mfl_bfast',
            name: 'sdb_builtin_ex_protein_smoothie',
            customText: 'sdb_builtin_ex_protein_smoothie_desc',
            mealType: 'breakfast',
            foodCategories: ['protein', 'fruits'],
            imageRef: { kind: 'stock_asset', stockKey: 'protein_smoothie' },
          },
        ],
      },
      {
        startTime: '12:30',
        endTime: '13:00',
        type: 'Lunch',
        mealType: 'lunch',
        items: ['Chicken Breast', 'Rice', 'Broccoli'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'chicken_rice_broccoli' },
        alternatives: [
          {
            id: 'alt_mfl_lunch',
            name: 'sdb_builtin_ex_tuna_wrap',
            customText: 'sdb_builtin_ex_tuna_wrap_desc',
            mealType: 'lunch',
            foodCategories: ['protein', 'complex_carbs', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'tuna_wrap' },
          },
        ],
      },
      {
        startTime: '16:00',
        endTime: '16:20',
        type: 'Snack',
        mealType: 'snack',
        items: ['Greek Yogurt', 'Almonds'],
        customText: '',
        foodCategories: ['protein', 'healthy_fats', 'snacks'],
        imageRef: { kind: 'stock_asset', stockKey: 'yogurt_almonds_snack' },
        alternatives: [
          {
            id: 'alt_mfl_snack',
            name: 'sdb_builtin_ex_apple_walnuts',
            customText: 'sdb_builtin_ex_apple_walnuts_desc',
            mealType: 'snack',
            foodCategories: ['fruits', 'healthy_fats', 'snacks'],
            imageRef: { kind: 'stock_asset', stockKey: 'fruit_nuts_snack' },
          },
        ],
      },
      {
        startTime: '19:30',
        endTime: '20:00',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['Salmon', 'Sweet Potato', 'Mixed Greens'],
        customText: '',
        foodCategories: ['protein', 'healthy_fats', 'complex_carbs', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'salmon_dinner' },
        alternatives: [
          {
            id: 'alt_mfl_dinner',
            name: 'sdb_builtin_ex_veggie_omelette',
            customText: 'sdb_builtin_ex_veggie_omelette_desc',
            mealType: 'dinner',
            foodCategories: ['protein', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'veggie_omelette' },
          },
        ],
      },
    ],
  },
  {
    id: 'protecting_current_loss',
    name: 'Protecting the Current Loss',
    description: 'Consolidation phase to protect recent weight loss and reset baseline',
    sampleBlocks: [
      {
        startTime: '08:30',
        endTime: '09:00',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Oatmeal', 'Protein Powder', 'Berries'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'fruits'],
        imageRef: { kind: 'stock_asset', stockKey: 'breakfast_bowl' },
        alternatives: [
          {
            id: 'alt_pcl_bfast',
            name: 'sdb_builtin_ex_greek_yogurt_bowl',
            customText: 'sdb_builtin_ex_greek_yogurt_bowl_desc',
            mealType: 'breakfast',
            foodCategories: ['protein', 'fruits', 'healthy_fats'],
            imageRef: { kind: 'stock_asset', stockKey: 'yogurt_almonds_snack' },
          },
        ],
      },
      {
        startTime: '13:00',
        endTime: '13:30',
        type: 'Lunch',
        mealType: 'lunch',
        items: ['Turkey Breast', 'Quinoa', 'Mixed Greens'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'quinoa_salad_bowl' },
        alternatives: [
          {
            id: 'alt_pcl_lunch',
            name: 'sdb_builtin_ex_tuna_wrap',
            customText: 'sdb_builtin_ex_tuna_wrap_desc',
            mealType: 'lunch',
            foodCategories: ['protein', 'complex_carbs', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'tuna_wrap' },
          },
        ],
      },
      {
        startTime: '16:30',
        endTime: '16:50',
        type: 'Snack',
        mealType: 'snack',
        items: ['Apple', 'Almonds'],
        customText: '',
        foodCategories: ['fruits', 'healthy_fats', 'snacks'],
        imageRef: { kind: 'stock_asset', stockKey: 'fruit_nuts_snack' },
      },
      {
        startTime: '19:30',
        endTime: '20:00',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['Lean Beef', 'Baked Potato', 'Green Beans'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'chicken_rice_broccoli' },
        alternatives: [
          {
            id: 'alt_pcl_dinner',
            name: 'sdb_builtin_ex_salmon_veg',
            customText: 'sdb_builtin_ex_salmon_veg_desc',
            mealType: 'dinner',
            foodCategories: ['protein', 'vegetables', 'complex_carbs'],
            imageRef: { kind: 'stock_asset', stockKey: 'salmon_dinner' },
          },
        ],
      },
    ],
  },
  {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Long-term metabolic balance and flexible lifestyle nutrition',
    sampleBlocks: [
      {
        startTime: '08:00',
        endTime: '08:30',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Eggs', 'Whole Wheat Bread', 'Avocado'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'healthy_fats'],
        imageRef: { kind: 'stock_asset', stockKey: 'breakfast_bowl' },
        alternatives: [
          {
            id: 'alt_mnt_bfast',
            name: 'sdb_builtin_ex_greek_yogurt_bowl',
            customText: 'sdb_builtin_ex_greek_yogurt_bowl_desc',
            mealType: 'breakfast',
            foodCategories: ['protein', 'fruits', 'healthy_fats'],
            imageRef: { kind: 'stock_asset', stockKey: 'yogurt_almonds_snack' },
          },
        ],
      },
      {
        startTime: '12:30',
        endTime: '13:00',
        type: 'Lunch',
        mealType: 'lunch',
        items: ['Salmon', 'Brown Rice', 'Mixed Veggies'],
        customText: '',
        foodCategories: ['protein', 'healthy_fats', 'complex_carbs', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'salmon_dinner' },
        alternatives: [
          {
            id: 'alt_mnt_lunch',
            name: 'sdb_builtin_ex_chicken_quinoa',
            customText: 'sdb_builtin_ex_chicken_quinoa_desc',
            mealType: 'lunch',
            foodCategories: ['protein', 'complex_carbs', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'quinoa_salad_bowl' },
          },
        ],
      },
      {
        startTime: '16:00',
        endTime: '16:20',
        type: 'Snack',
        mealType: 'snack',
        items: ['Greek Yogurt', 'Berries', 'Walnuts'],
        customText: '',
        foodCategories: ['protein', 'fruits', 'healthy_fats', 'snacks'],
        imageRef: { kind: 'stock_asset', stockKey: 'yogurt_almonds_snack' },
      },
      {
        startTime: '19:30',
        endTime: '20:00',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['Chicken Breast', 'Pasta', 'Olive Oil', 'Salad'],
        customText: '',
        foodCategories: ['protein', 'complex_carbs', 'healthy_fats', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'quinoa_salad_bowl' },
        alternatives: [
          {
            id: 'alt_mnt_dinner',
            name: 'sdb_builtin_ex_veggie_omelette',
            customText: 'sdb_builtin_ex_veggie_omelette_desc',
            mealType: 'dinner',
            foodCategories: ['protein', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'veggie_omelette' },
          },
        ],
      },
    ],
  },
  {
    id: 'vacation_maintenance',
    name: 'Vacation Maintenance',
    description: 'Flexible rhythm with anchor meals to maintain weight while travelling',
    sampleBlocks: [
      {
        startTime: '10:00',
        endTime: '10:45',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Eggs', 'Fruit', 'Coffee'],
        customText: 'sdb_builtin_meal_morning_brunch',
        foodCategories: ['protein', 'fruits', 'beverages'],
        imageRef: { kind: 'stock_asset', stockKey: 'breakfast_bowl' },
      },
      {
        startTime: '15:00',
        endTime: '15:30',
        type: 'Snack',
        mealType: 'snack',
        items: ['Fruit', 'Nuts'],
        customText: 'sdb_builtin_meal_afternoon_refuel',
        foodCategories: ['fruits', 'healthy_fats', 'snacks'],
        imageRef: { kind: 'stock_asset', stockKey: 'fruit_nuts_snack' },
      },
      {
        startTime: '20:00',
        endTime: '21:00',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['Fish', 'Salad'],
        customText: 'sdb_builtin_meal_social_dinner',
        foodCategories: ['protein', 'vegetables'],
        imageRef: { kind: 'stock_asset', stockKey: 'salmon_dinner' },
      },
    ],
  },
  {
    id: 'recovery_illness',
    name: 'Recovery During Illness',
    description: 'Light meals, gentle digestion, and restorative hydration',
    sampleBlocks: [
      {
        startTime: '08:30',
        endTime: '09:00',
        type: 'Breakfast',
        mealType: 'breakfast',
        items: ['Tea', 'Toast', 'Honey'],
        customText: 'sdb_builtin_meal_hydration_morning',
        foodCategories: ['beverages', 'simple_carbs'],
        imageRef: { kind: 'stock_asset', stockKey: 'herbal_hydration' },
      },
      {
        startTime: '12:30',
        endTime: '13:00',
        type: 'Lunch',
        mealType: 'lunch',
        items: ['Chicken Soup', 'Crackers', 'Rice'],
        customText: 'sdb_builtin_meal_recovery_lunch',
        foodCategories: ['protein', 'simple_carbs', 'complex_carbs', 'soups'],
        imageRef: { kind: 'stock_asset', stockKey: 'recovery_soup' },
        alternatives: [
          {
            id: 'alt_rec_lunch',
            name: 'sdb_builtin_ex_broth_soup',
            customText: 'sdb_builtin_ex_broth_soup_desc',
            mealType: 'lunch',
            foodCategories: ['soups', 'vegetables'],
            imageRef: { kind: 'stock_asset', stockKey: 'recovery_soup' },
          },
        ],
      },
      {
        startTime: '16:00',
        endTime: '16:30',
        type: 'Snack',
        mealType: 'snack',
        items: ['Herbal Tea', 'Banana'],
        customText: 'sdb_builtin_meal_rest_fluids',
        foodCategories: ['beverages', 'fruits', 'snacks'],
        imageRef: { kind: 'stock_asset', stockKey: 'herbal_hydration' },
      },
      {
        startTime: '19:00',
        endTime: '19:30',
        type: 'Dinner',
        mealType: 'dinner',
        items: ['Broth', 'Steamed Veggies', 'Rice'],
        customText: 'sdb_builtin_meal_gentle_dinner',
        foodCategories: ['beverages', 'vegetables', 'complex_carbs', 'soups'],
        imageRef: { kind: 'stock_asset', stockKey: 'recovery_soup' },
      },
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
 * Clone a MealImageRef without duplicating any underlying IndexedDB photo blob.
 */
export function cloneMealImageRef(ref?: MealImageRef | null): MealImageRef | undefined {
  if (!ref || typeof ref !== 'object') return undefined;
  return {
    kind: ref.kind,
    ...(typeof ref.photoId === 'string' && ref.photoId.trim() ? { photoId: ref.photoId.trim() } : {}),
    ...(ref.photoMeta ? { photoMeta: { ...ref.photoMeta } } : {}),
    ...(typeof ref.assetUrl === 'string' && ref.assetUrl.trim() ? { assetUrl: ref.assetUrl.trim() } : {}),
    ...(typeof ref.stockKey === 'string' && ref.stockKey.trim() ? { stockKey: ref.stockKey.trim() } : {}),
  };
}

/**
 * Clone a MealAlternativeOption cleanly.
 * Shares photo metadata IDs (zero IndexedDB blob duplication) while deep-cloning nested arrays/maps.
 */
export function cloneMealAlternative(
  alt: MealAlternativeOption,
  regenerateId = false
): MealAlternativeOption {
  return {
    id: regenerateId || !alt.id ? `alt_${generateBlockId()}` : alt.id,
    name: typeof alt.name === 'string' ? alt.name : '',
    ...(typeof alt.customText === 'string' ? { customText: alt.customText } : {}),
    ...(typeof alt.type === 'string' ? { type: alt.type } : {}),
    ...(alt.mealType ? { mealType: alt.mealType } : {}),
    ...(Array.isArray(alt.items) ? { items: [...alt.items] } : {}),
    ...(Array.isArray(alt.foodCategories) ? { foodCategories: [...alt.foodCategories] } : {}),
    ...(alt.foodSelections ? { foodSelections: JSON.parse(JSON.stringify(alt.foodSelections)) } : {}),
    ...(alt.customFoods ? { customFoods: JSON.parse(JSON.stringify(alt.customFoods)) } : {}),
    ...(alt.foodQuantities ? { foodQuantities: JSON.parse(JSON.stringify(alt.foodQuantities)) } : {}),
    ...(alt.soupPortion ? { soupPortion: alt.soupPortion } : {}),
    ...(typeof alt.libraryMealId === 'string' && alt.libraryMealId.trim()
      ? { libraryMealId: alt.libraryMealId.trim() }
      : {}),
    ...(alt.foodPhoto ? { foodPhoto: { ...alt.foodPhoto } } : {}),
    ...(Array.isArray(alt.foodPhotos) ? { foodPhotos: alt.foodPhotos.map(p => ({ ...p })) } : {}),
    ...(alt.imageRef ? { imageRef: cloneMealImageRef(alt.imageRef) } : {}),
  };
}

/**
 * Deep-clone a list of blocks, assigning brand new unique IDs to each block
 * to guarantee no identity collisions and zero reference sharing between days.
 * Preserves photo reference IDs (zero IndexedDB blob duplication) and all Phase 1 fields.
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
    soupPortion: b.soupPortion,
    foodPhoto: b.foodPhoto ? { ...b.foodPhoto } : undefined,
    foodPhotos: b.foodPhotos ? b.foodPhotos.map(p => ({ ...p })) : undefined,
    ...(typeof b.libraryMealId === 'string' && b.libraryMealId.trim()
      ? { libraryMealId: b.libraryMealId.trim() }
      : {}),
    ...(b.approvalStatus && (MEAL_APPROVAL_STATUSES as readonly string[]).includes(b.approvalStatus)
      ? { approvalStatus: b.approvalStatus }
      : {}),
    ...(Array.isArray(b.alternatives) && b.alternatives.length > 0
      ? { alternatives: b.alternatives.map(a => cloneMealAlternative(a, true)) }
      : {}),
    ...(b.imageRef ? { imageRef: cloneMealImageRef(b.imageRef) } : {}),
  }));
}

/**
 * Clone a list of blocks while preserving stable block IDs.
 * Use this when loading date plans, saving overrides, or modifying blocks
 * so that verification records and schedule references remain attached.
 */
export function cloneBlocks(blocks: StructuredDietBlock[]): StructuredDietBlock[] {
  return blocks.map(b => ({
    id: b.id,
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
    soupPortion: b.soupPortion,
    foodPhoto: b.foodPhoto ? { ...b.foodPhoto } : undefined,
    foodPhotos: b.foodPhotos ? b.foodPhotos.map(p => ({ ...p })) : undefined,
    ...(typeof b.libraryMealId === 'string' && b.libraryMealId.trim()
      ? { libraryMealId: b.libraryMealId.trim() }
      : {}),
    ...(b.approvalStatus && (MEAL_APPROVAL_STATUSES as readonly string[]).includes(b.approvalStatus)
      ? { approvalStatus: b.approvalStatus }
      : {}),
    ...(Array.isArray(b.alternatives) && b.alternatives.length > 0
      ? { alternatives: b.alternatives.map(a => cloneMealAlternative(a, false)) }
      : {}),
    ...(b.imageRef ? { imageRef: cloneMealImageRef(b.imageRef) } : {}),
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
      blocks: sampleBlocks.map(b =>
        deepCloneBlocks([
          {
            ...b,
            id: generateBlockId(),
          },
        ])[0]
      ),
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
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(DIET_UPDATED_EVENT));
    }
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
  const day = diet?.days?.find(d => d.dayKey === dayKey);
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

export function sanitiseImageRef(ref?: MealImageRef | null): MealImageRef | undefined {
  if (!ref || typeof ref !== 'object') return undefined;
  if (!(MEAL_IMAGE_REF_KINDS as readonly string[]).includes(ref.kind as string)) {
    return undefined;
  }

  if (ref.kind === 'uploaded_photo') {
    const photoId =
      typeof ref.photoId === 'string' && ref.photoId.trim()
        ? ref.photoId.trim()
        : ref.photoMeta && typeof ref.photoMeta.id === 'string' && ref.photoMeta.id.trim()
        ? ref.photoMeta.id.trim()
        : '';
    if (!photoId) return undefined;

    const photoMeta: FoodPhotoMetadata | undefined =
      ref.photoMeta && typeof ref.photoMeta === 'object' && typeof ref.photoMeta.id === 'string'
        ? {
            id: photoId,
            createdAt:
              typeof ref.photoMeta.createdAt === 'string'
                ? ref.photoMeta.createdAt
                : new Date(0).toISOString(),
            mimeType:
              typeof ref.photoMeta.mimeType === 'string' ? ref.photoMeta.mimeType : 'image/jpeg',
          }
        : undefined;

    return {
      kind: 'uploaded_photo',
      photoId,
      ...(photoMeta ? { photoMeta } : {}),
    };
  }

  const assetUrl = typeof ref.assetUrl === 'string' && ref.assetUrl.trim() ? ref.assetUrl.trim() : undefined;
  const stockKey = typeof ref.stockKey === 'string' && ref.stockKey.trim() ? ref.stockKey.trim() : undefined;
  if (!assetUrl && !stockKey) return undefined;

  return {
    kind: 'stock_asset',
    ...(assetUrl ? { assetUrl } : {}),
    ...(stockKey ? { stockKey } : {}),
  };
}

function sanitiseFoodSelectionsByCategories(
  rawSelections: Partial<Record<FoodCategoryKey, string[]>> | undefined,
  categories: FoodCategoryKey[]
): Partial<Record<FoodCategoryKey, string[]>> | undefined {
  if (!rawSelections || typeof rawSelections !== 'object') return undefined;
  const nextSel: Partial<Record<FoodCategoryKey, string[]>> = {};
  let hasAny = false;
  for (const cat of categories) {
    const arr = rawSelections[cat];
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
  return hasAny ? nextSel : undefined;
}

function sanitiseCustomFoodsByCategories(
  rawCustomFoods: Partial<Record<FoodCategoryKey, string[]>> | undefined,
  categories: FoodCategoryKey[]
): Partial<Record<FoodCategoryKey, string[]>> | undefined {
  if (!rawCustomFoods || typeof rawCustomFoods !== 'object') return undefined;
  const nextCustom: Partial<Record<FoodCategoryKey, string[]>> = {};
  let hasAny = false;
  for (const cat of categories) {
    const arr = rawCustomFoods[cat];
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
  return hasAny ? nextCustom : undefined;
}

function sanitiseFoodQuantitiesMap(rawQuantities: FoodQuantitiesMap | undefined): FoodQuantitiesMap | undefined {
  if (!rawQuantities || typeof rawQuantities !== 'object') return undefined;
  const nextQuantities: FoodQuantitiesMap = {};
  let hasAny = false;
  for (const [key, qty] of Object.entries(rawQuantities)) {
    if (
      qty &&
      typeof qty === 'object' &&
      typeof qty.amount === 'number' &&
      !isNaN(qty.amount) &&
      qty.amount > 0 &&
      typeof qty.unit === 'string'
    ) {
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
  return hasAny ? nextQuantities : undefined;
}

export function sanitiseMealAlternative(alt: unknown): MealAlternativeOption | undefined {
  if (!alt || typeof alt !== 'object') return undefined;
  const raw = alt as Partial<MealAlternativeOption>;
  const cleanName =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.customText === 'string' && raw.customText.trim()
      ? raw.customText.trim()
      : typeof raw.type === 'string' && raw.type.trim()
      ? raw.type.trim()
      : '';
  if (!cleanName) return undefined;

  const items = Array.isArray(raw.items) ? raw.items.filter(i => typeof i === 'string') : undefined;
  const categories: FoodCategoryKey[] = Array.isArray(raw.foodCategories)
    ? (raw.foodCategories.filter(c => (FOOD_CATEGORY_KEYS as readonly string[]).includes(c)) as FoodCategoryKey[])
    : items
    ? mapLegacyItemsToCategories(items)
    : [];

  const rawPhotos = getBlockPhotos(raw);
  const foodPhotos: FoodPhotoMetadata[] | undefined =
    rawPhotos.length > 0
      ? rawPhotos.map(p => ({
          id: p.id,
          createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
          mimeType: typeof p.mimeType === 'string' ? p.mimeType : 'image/jpeg',
        }))
      : undefined;
  const foodPhoto = foodPhotos && foodPhotos.length > 0 ? foodPhotos[0] : undefined;
  const imageRef = sanitiseImageRef(raw.imageRef);
  const mealType: MealTypeKey | undefined = (MEAL_TYPE_KEYS as readonly string[]).includes(raw.mealType as string)
    ? (raw.mealType as MealTypeKey)
    : undefined;
  const soupPortion =
    typeof raw.soupPortion === 'string' && ['small', 'medium', 'large', 'xlarge'].includes(raw.soupPortion)
      ? (raw.soupPortion as SoupPortionKey)
      : undefined;
  const foodSelections = sanitiseFoodSelectionsByCategories(raw.foodSelections, categories);
  const customFoods = sanitiseCustomFoodsByCategories(raw.customFoods, categories);
  const foodQuantities = sanitiseFoodQuantitiesMap(raw.foodQuantities);
  const libraryMealId =
    typeof raw.libraryMealId === 'string' && raw.libraryMealId.trim()
      ? raw.libraryMealId.trim()
      : undefined;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `alt_${generateBlockId()}`,
    name: cleanName,
    ...(typeof raw.customText === 'string' && raw.customText.trim() ? { customText: raw.customText.trim() } : {}),
    ...(typeof raw.type === 'string' && raw.type.trim() ? { type: raw.type.trim() } : {}),
    ...(mealType ? { mealType } : {}),
    ...(items && items.length > 0 ? { items } : {}),
    ...(categories.length > 0 ? { foodCategories: categories } : {}),
    ...(foodSelections ? { foodSelections } : {}),
    ...(customFoods ? { customFoods } : {}),
    ...(foodQuantities ? { foodQuantities } : {}),
    ...(soupPortion ? { soupPortion } : {}),
    ...(libraryMealId ? { libraryMealId } : {}),
    ...(foodPhoto ? { foodPhoto } : {}),
    ...(foodPhotos ? { foodPhotos } : {}),
    ...(imageRef ? { imageRef } : {}),
  };
}

export function sanitiseBlock(b: StructuredDietBlock): StructuredDietBlock {
  const categories: FoodCategoryKey[] = Array.isArray(b.foodCategories)
    ? (b.foodCategories.filter(c => (FOOD_CATEGORY_KEYS as readonly string[]).includes(c)) as FoodCategoryKey[])
    : mapLegacyItemsToCategories(Array.isArray(b.items) ? b.items : []);

  // Normalize photos: support multi-photo foodPhotos, legacy foodPhoto, and uploaded imageRef
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

  const foodSelections = sanitiseFoodSelectionsByCategories(b.foodSelections, categories);
  const customFoods = sanitiseCustomFoodsByCategories(b.customFoods, categories);
  const foodQuantities = sanitiseFoodQuantitiesMap(b.foodQuantities);

  const soupPortion = typeof b.soupPortion === 'string' && ['small', 'medium', 'large', 'xlarge'].includes(b.soupPortion)
    ? (b.soupPortion as SoupPortionKey)
    : undefined;

  const libraryMealId =
    typeof b.libraryMealId === 'string' && b.libraryMealId.trim()
      ? b.libraryMealId.trim()
      : undefined;

  // Omit approvalStatus when undefined so legacy blocks remain untouched and implicitly resolve to 'accepted'
  const approvalStatus: MealApprovalStatus | undefined =
    typeof b.approvalStatus === 'string' &&
    (MEAL_APPROVAL_STATUSES as readonly string[]).includes(b.approvalStatus)
      ? (b.approvalStatus as MealApprovalStatus)
      : undefined;

  let alternatives: MealAlternativeOption[] | undefined;
  if (Array.isArray(b.alternatives) && b.alternatives.length > 0) {
    const cleanedAlts = b.alternatives
      .map(sanitiseMealAlternative)
      .filter((a): a is MealAlternativeOption => Boolean(a));
    if (cleanedAlts.length > 0) {
      alternatives = cleanedAlts;
    }
  }

  const imageRef = sanitiseImageRef(b.imageRef);

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
    soupPortion,
    foodPhoto,
    foodPhotos,
    ...(libraryMealId ? { libraryMealId } : {}),
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(alternatives ? { alternatives } : {}),
    ...(imageRef ? { imageRef } : {}),
  };
}

/**
 * Pre-meal plan approval helper (Accept / Modify / Reject / Pending).
 * Strictly operates on the scheduled plan block — NEVER creates a Slip, Verification, or Score event.
 */
export function setBlockApprovalStatus(
  block: StructuredDietBlock,
  approvalStatus: MealApprovalStatus
): StructuredDietBlock {
  return sanitiseBlock({
    ...cloneBlocks([block])[0],
    approvalStatus,
  });
}

/**
 * Swaps a scheduled block's meal content with one of its alternatives (or an explicit alternative option)
 * while preserving the block's `id`, `startTime`, and `endTime`.
 * Optionally keeps the displaced meal in `alternatives` and marks `approvalStatus: 'modified'`.
 * Strictly pre-meal plan level — NEVER records a Slip or affects XP/Resume Rate.
 */
export function swapBlockWithAlternative(
  block: StructuredDietBlock,
  alternativeOrId: string | MealAlternativeOption,
  options?: {
    keepPreviousAsAlternative?: boolean;
    nextApprovalStatus?: MealApprovalStatus;
  }
): StructuredDietBlock {
  const existingAlts = Array.isArray(block.alternatives) ? block.alternatives : [];
  const chosenAlt: MealAlternativeOption | undefined =
    typeof alternativeOrId === 'string'
      ? existingAlts.find(a => a.id === alternativeOrId)
      : sanitiseMealAlternative(alternativeOrId);

  if (!chosenAlt) {
    return cloneBlocks([block])[0];
  }

  const keepPrev = options?.keepPreviousAsAlternative ?? true;
  const nextStatus: MealApprovalStatus = options?.nextApprovalStatus ?? 'modified';

  const remainingAlts = existingAlts
    .filter(a => a.id !== chosenAlt.id)
    .map(a => cloneMealAlternative(a, false));

  if (keepPrev) {
    const previousAsAlt = sanitiseMealAlternative({
      id: `alt_${generateBlockId()}`,
      name: getBlockPrimaryDescription(block) || block.type,
      customText: block.customText || undefined,
      type: block.type,
      mealType: block.mealType,
      items: block.items,
      foodCategories: block.foodCategories,
      foodSelections: block.foodSelections,
      customFoods: block.customFoods,
      foodQuantities: block.foodQuantities,
      soupPortion: block.soupPortion,
      libraryMealId: block.libraryMealId,
      foodPhoto: block.foodPhoto,
      foodPhotos: block.foodPhotos,
      imageRef: block.imageRef,
    });
    if (previousAsAlt) {
      remainingAlts.unshift(previousAsAlt);
    }
  }

  const chosenPhotos = getBlockPhotos(chosenAlt);
  return sanitiseBlock({
    id: block.id,
    startTime: block.startTime,
    endTime: block.endTime,
    type: block.type || chosenAlt.type || 'Custom',
    items: chosenAlt.items ? [...chosenAlt.items] : [],
    customText: chosenAlt.name || chosenAlt.customText || '',
    mealType: block.mealType ?? chosenAlt.mealType,
    foodCategories: chosenAlt.foodCategories ? [...chosenAlt.foodCategories] : [],
    foodSelections: chosenAlt.foodSelections
      ? JSON.parse(JSON.stringify(chosenAlt.foodSelections))
      : undefined,
    customFoods: chosenAlt.customFoods
      ? JSON.parse(JSON.stringify(chosenAlt.customFoods))
      : undefined,
    foodQuantities: chosenAlt.foodQuantities
      ? JSON.parse(JSON.stringify(chosenAlt.foodQuantities))
      : undefined,
    soupPortion: chosenAlt.soupPortion,
    foodPhoto: chosenPhotos[0] ? { ...chosenPhotos[0] } : undefined,
    foodPhotos: chosenPhotos.length > 0 ? chosenPhotos.map(p => ({ ...p })) : undefined,
    libraryMealId: chosenAlt.libraryMealId,
    approvalStatus: nextStatus,
    alternatives: remainingAlts.length > 0 ? remainingAlts : undefined,
    imageRef: chosenAlt.imageRef ? cloneMealImageRef(chosenAlt.imageRef) : undefined,
  });
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
 * Returns the local date key for yesterday formatted as "YYYY-MM-DD".
 */
export function getYesterdayDateKey(todayDate = new Date()): string {
  const d = new Date(todayDate);
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
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
      blocks: cloneBlocks(override.blocks),
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
        blocks: cloneBlocks(snap.blocks),
      };
    }
  }

  // 3. Default: inherit the latest weekday template
  const templateDay = getDayPlan(diet, dayKey);
  return {
    ...templateDay,
    blocks: cloneBlocks(templateDay.blocks),
  };
}

/**
 * Phase 31B: When the user selects or changes a block or food log's start time,
 * automatically set End Time = Start Time + 30 minutes.
 * Handles midnight rollover correctly (e.g. 23:45 + 30m = 00:15).
 * The user can still manually adjust end time afterwards.
 */
export function calculateEndTimeFromStart(startTime: string, durationMinutes = 30): string {
  if (!startTime || typeof startTime !== 'string' || !startTime.includes(':')) {
    return startTime;
  }
  const [hStr, mStr] = startTime.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) {
    return startTime;
  }
  const totalMinutes = (h * 60 + m + durationMinutes) % (24 * 60);
  const normalizedMinutes = totalMinutes < 0 ? totalMinutes + 24 * 60 : totalMinutes;
  const endH = Math.floor(normalizedMinutes / 60);
  const endM = normalizedMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
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
      blocks: cloneBlocks(dayPlan.blocks),
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
 * Phase 8B: Update a specific calendar date's plan (date override).
 * If no date override exists for dateKey, clones the effective weekday template
 * into that date's override before applying the updater.
 * If applyToRecurring is true, also updates the recurring weekday template (diet.days).
 */
export function updateDatePlan(
  diet: WeeklyStructuredDiet,
  dateKey: string,
  updater: (day: StructuredDietDay) => StructuredDietDay,
  options?: { applyToRecurring?: boolean; dayKey?: DayKey }
): WeeklyStructuredDiet {
  const effectiveDayKey = options?.dayKey || dateKeyToDayKey(dateKey);
  const baseDay = (diet.dateOverrides && diet.dateOverrides[dateKey])
    ? diet.dateOverrides[dateKey]
    : getDayPlan(diet, effectiveDayKey);

  const updatedDateDay = updater({
    ...baseDay,
    blocks: cloneBlocks(baseDay.blocks),
  });

  let nextDiet = setDateOverride(diet, dateKey, updatedDateDay);

  if (options?.applyToRecurring) {
    nextDiet = updateDayPlan(nextDiet, effectiveDayKey, updater);
  }

  return nextDiet;
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
      blocks: cloneBlocks(planToFreeze.blocks),
    },
  };
  return { ...diet, historySnapshots: nextSnapshots };
}

