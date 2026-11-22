/**
 * Super Diet-Ability — Personal Meal Library Storage (Final Completion Phase 1)
 *
 * Provides a backward-compatible, local-first persistence layer for named reusable
 * custom meals across days, Structure Goal profiles, alternative meal slots, and
 * future Smart Structured Diet Wizard flows.
 *
 * Core Guarantees:
 * 1. Reuses existing IndexedDB photo storage ('resume-ability-photos-db') via lightweight
 *    `FoodPhotoMetadata` and `MealImageRef` IDs — NEVER duplicates image blobs.
 * 2. Preserves full meal fidelity: name, mealType, blockType, foodCategories, canonical
 *    foodSelections, customFoods, foodQuantities, soupPortion, and photo/image references.
 * 3. Safe deletion: deleting a library meal checks `isPhotoReferenced` across all diet
 *    profiles (days, dateOverrides, historySnapshots, alternatives), verifications, and
 *    remaining library meals before removing any unreferenced IndexedDB photo.
 * 4. Strictly pre-meal / plan-level: never writes Slip, Check-In, Verification, or Score events.
 */

import {
  type FoodCategoryKey,
  FOOD_CATEGORY_KEYS,
  mapLegacyItemsToCategories,
} from '../data/dietData';
import {
  isValidCanonicalFood,
  type FoodQuantitiesMap,
  type SoupPortionKey,
} from '../data/foodOptions';
import {
  MEAL_TYPE_KEYS,
  type MealTypeKey,
  type MealApprovalStatus,
  type MealAlternativeOption,
  type MealImageRef,
  type StructuredDietBlock,
  generateBlockId,
  getBlockPhotos,
  getBlockPrimaryDescription,
  sanitiseBlock,
  sanitiseImageRef,
  sanitiseMealAlternative,
  cloneMealImageRef,
  cloneMealAlternative,
  loadDietStore,
} from './dietStorage';
import { loadAllDietVerifications } from './dietVerificationStorage';
import {
  PERSONAL_MEAL_LIBRARY_STORAGE_KEY,
  deleteFoodPhoto,
  isPhotoReferenced,
  type FoodPhotoMetadata,
} from './photoStorage';

export { PERSONAL_MEAL_LIBRARY_STORAGE_KEY };
export const MEAL_LIBRARY_STORAGE_KEY = PERSONAL_MEAL_LIBRARY_STORAGE_KEY;
export const MEAL_LIBRARY_UPDATED_EVENT = 'sda_meal_library_updated';

export interface PersonalMealLibraryItem {
  id: string;
  /** User-facing reusable meal title (required, non-empty). */
  name: string;
  /** Optional custom description / preparation note. */
  description?: string;
  /** Optional default block type (e.g. 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Custom'). */
  blockType?: string;
  /** Optional canonical descriptive meal type ('breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'). */
  mealType?: MealTypeKey;
  /** Optional legacy/simple food item labels. */
  items?: string[];
  /** Multi-select canonical food categories. */
  foodCategories: FoodCategoryKey[];
  /** Canonical specific food keys per category. */
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  /** User-entered custom food names per category. */
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  /** Optional food item quantities & units. */
  foodQuantities?: FoodQuantitiesMap;
  /** Optional soup portion size when 'soups' category is present or applicable. */
  soupPortion?: SoupPortionKey;
  /** Primary uploaded photo reference (points to existing IndexedDB photo ID, no blob copy). */
  foodPhoto?: FoodPhotoMetadata;
  /** Multi-photo uploaded references (points to existing IndexedDB photo IDs, no blob copy). */
  foodPhotos?: FoodPhotoMetadata[];
  /** Explicit primary image reference (uploaded IndexedDB photo or built-in stock asset). */
  imageRef?: MealImageRef;
  /** Optional organizational tags. */
  tags?: string[];
  /** Optional favorite pin. */
  isFavorite?: boolean;
  /** Number of times inserted/applied into schedules. */
  useCount: number;
  /** Epoch ms when last inserted/applied. */
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalMealLibraryStore {
  version: 1;
  meals: PersonalMealLibraryItem[];
}

export interface SaveLibraryMealInput {
  id?: string;
  name: string;
  description?: string;
  blockType?: string;
  mealType?: MealTypeKey;
  items?: string[];
  foodCategories?: FoodCategoryKey[];
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  foodQuantities?: FoodQuantitiesMap;
  soupPortion?: SoupPortionKey;
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
  imageRef?: MealImageRef;
  tags?: string[];
  isFavorite?: boolean;
  useCount?: number;
  lastUsedAt?: number;
  createdAt?: number;
}

export interface DeleteLibraryMealResult {
  deleted: boolean;
  deletedPhotoIds: string[];
  preservedPhotoIds: string[];
}

export function generateLibraryMealId(): string {
  return `meal_lib_${generateBlockId()}`;
}

export function createEmptyMealLibraryStore(): PersonalMealLibraryStore {
  return {
    version: 1,
    meals: [],
  };
}

/**
 * Extracts normalized FoodPhotoMetadata references from a library meal without duplicating blobs.
 */
export function getLibraryMealPhotos(
  meal?: Pick<PersonalMealLibraryItem, 'foodPhotos' | 'foodPhoto' | 'imageRef'> | null
): FoodPhotoMetadata[] {
  if (!meal) return [];
  return getBlockPhotos(meal);
}

/**
 * Extracts all unique IndexedDB photo IDs referenced by a library meal.
 */
export function getLibraryMealPhotoIds(
  meal?: Pick<PersonalMealLibraryItem, 'foodPhotos' | 'foodPhoto' | 'imageRef'> | null
): string[] {
  if (!meal) return [];
  const ids = new Set<string>();
  if (meal.foodPhoto && typeof meal.foodPhoto.id === 'string' && meal.foodPhoto.id.trim()) {
    ids.add(meal.foodPhoto.id.trim());
  }
  if (Array.isArray(meal.foodPhotos)) {
    for (const p of meal.foodPhotos) {
      if (p && typeof p.id === 'string' && p.id.trim()) {
        ids.add(p.id.trim());
      }
    }
  }
  if (meal.imageRef && meal.imageRef.kind === 'uploaded_photo') {
    if (typeof meal.imageRef.photoId === 'string' && meal.imageRef.photoId.trim()) {
      ids.add(meal.imageRef.photoId.trim());
    }
    if (
      meal.imageRef.photoMeta &&
      typeof meal.imageRef.photoMeta.id === 'string' &&
      meal.imageRef.photoMeta.id.trim()
    ) {
      ids.add(meal.imageRef.photoMeta.id.trim());
    }
  }
  return Array.from(ids);
}

function sanitiseCategories(
  rawCategories?: unknown,
  fallbackItems?: string[]
): FoodCategoryKey[] {
  if (Array.isArray(rawCategories)) {
    const valid = rawCategories.filter(
      (c): c is FoodCategoryKey =>
        typeof c === 'string' && (FOOD_CATEGORY_KEYS as readonly string[]).includes(c)
    );
    return Array.from(new Set(valid));
  }
  if (Array.isArray(fallbackItems) && fallbackItems.length > 0) {
    return mapLegacyItemsToCategories(fallbackItems);
  }
  return [];
}

function sanitiseSelections(
  rawSelections: Partial<Record<FoodCategoryKey, string[]>> | undefined,
  categories: FoodCategoryKey[]
): Partial<Record<FoodCategoryKey, string[]>> | undefined {
  if (!rawSelections || typeof rawSelections !== 'object') return undefined;
  const out: Partial<Record<FoodCategoryKey, string[]>> = {};
  let hasAny = false;
  for (const cat of categories) {
    const list = rawSelections[cat];
    if (Array.isArray(list)) {
      const valid = list
        .map(s => (typeof s === 'string' ? s.trim() : ''))
        .filter(s => s.length > 0 && isValidCanonicalFood(cat, s));
      const unique = Array.from(new Set(valid));
      if (unique.length > 0) {
        out[cat] = unique;
        hasAny = true;
      }
    }
  }
  return hasAny ? out : undefined;
}

function sanitiseCustomFoods(
  rawCustoms: Partial<Record<FoodCategoryKey, string[]>> | undefined,
  categories: FoodCategoryKey[]
): Partial<Record<FoodCategoryKey, string[]>> | undefined {
  if (!rawCustoms || typeof rawCustoms !== 'object') return undefined;
  const out: Partial<Record<FoodCategoryKey, string[]>> = {};
  let hasAny = false;
  for (const cat of categories) {
    const list = rawCustoms[cat];
    if (Array.isArray(list)) {
      const valid = list
        .map(s => (typeof s === 'string' ? s.trim() : ''))
        .filter(s => s.length > 0);
      const unique = Array.from(new Set(valid));
      if (unique.length > 0) {
        out[cat] = unique;
        hasAny = true;
      }
    }
  }
  return hasAny ? out : undefined;
}

function sanitiseQuantities(rawQuantities?: FoodQuantitiesMap): FoodQuantitiesMap | undefined {
  if (!rawQuantities || typeof rawQuantities !== 'object') return undefined;
  const out: FoodQuantitiesMap = {};
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
      const cleaned: any = {
        amount: Number(qty.amount),
        unit: qty.unit,
      };
      if (typeof qty.customUnit === 'string' && qty.customUnit.trim()) {
        cleaned.customUnit = qty.customUnit.trim();
      }
      if (typeof qty.grams === 'number' && !isNaN(qty.grams)) {
        cleaned.grams = Number(qty.grams);
      }
      if (typeof qty.calories === 'number' && !isNaN(qty.calories)) {
        cleaned.calories = Number(qty.calories);
      }
      out[key] = cleaned;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

/**
 * Sanitizes a raw PersonalMealLibraryItem, ensuring backward compatibility with
 * partial or legacy shapes while preserving existing photo IDs without copying blobs.
 */
export function sanitiseLibraryMealItem(raw: unknown): PersonalMealLibraryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;

  const rawName =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim()
      : typeof obj.customText === 'string' && obj.customText.trim()
      ? obj.customText.trim()
      : typeof obj.description === 'string' && obj.description.trim()
      ? obj.description.trim()
      : '';
  if (!rawName) return null;

  const now = Date.now();
  const items = Array.isArray(obj.items)
    ? obj.items.filter((i: unknown): i is string => typeof i === 'string' && i.trim().length > 0)
    : undefined;

  // Ensure categories cover any keys present in foodSelections or customFoods if foodCategories was omitted
  let categories = sanitiseCategories(obj.foodCategories, items);
  if (categories.length === 0) {
    const inferred = new Set<FoodCategoryKey>();
    for (const mapCandidate of [obj.foodSelections, obj.customFoods]) {
      if (mapCandidate && typeof mapCandidate === 'object') {
        for (const key of Object.keys(mapCandidate)) {
          if ((FOOD_CATEGORY_KEYS as readonly string[]).includes(key)) {
            inferred.add(key as FoodCategoryKey);
          }
        }
      }
    }
    categories = Array.from(inferred);
  }

  const foodSelections = sanitiseSelections(obj.foodSelections, categories);
  const customFoods = sanitiseCustomFoods(obj.customFoods, categories);
  const foodQuantities = sanitiseQuantities(obj.foodQuantities);

  const mealType: MealTypeKey | undefined = (MEAL_TYPE_KEYS as readonly string[]).includes(
    obj.mealType as string
  )
    ? (obj.mealType as MealTypeKey)
    : undefined;

  const soupPortion: SoupPortionKey | undefined =
    typeof obj.soupPortion === 'string' &&
    ['small', 'medium', 'large', 'xlarge'].includes(obj.soupPortion)
      ? (obj.soupPortion as SoupPortionKey)
      : undefined;

  let imageRef = sanitiseImageRef(obj.imageRef);

  const normalizedPhotos = getBlockPhotos({
    foodPhotos: obj.foodPhotos,
    foodPhoto: obj.foodPhoto,
    imageRef,
  }).map(p => ({
    id: p.id.trim(),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date(now).toISOString(),
    mimeType: typeof p.mimeType === 'string' ? p.mimeType : 'image/jpeg',
  }));

  const foodPhotos = normalizedPhotos.length > 0 ? normalizedPhotos : undefined;
  const foodPhoto = foodPhotos ? foodPhotos[0] : undefined;

  // If uploaded photo exists and no explicit imageRef was provided, populate uploaded_photo imageRef
  if (!imageRef && foodPhoto) {
    imageRef = {
      kind: 'uploaded_photo',
      photoId: foodPhoto.id,
      photoMeta: { ...foodPhoto },
    };
  }

  const tags = Array.isArray(obj.tags)
    ? Array.from(
        new Set(
          obj.tags
            .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
            .filter((t: string) => t.length > 0)
        )
      )
    : undefined;

  const createdAt =
    typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now;
  const updatedAt =
    typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : createdAt;
  const useCount =
    typeof obj.useCount === 'number' && Number.isFinite(obj.useCount) && obj.useCount >= 0
      ? Math.floor(obj.useCount)
      : 0;
  const lastUsedAt =
    typeof obj.lastUsedAt === 'number' && Number.isFinite(obj.lastUsedAt)
      ? obj.lastUsedAt
      : undefined;

  return {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : generateLibraryMealId(),
    name: rawName,
    ...(typeof obj.description === 'string' && obj.description.trim()
      ? { description: obj.description.trim() }
      : {}),
    ...(typeof obj.blockType === 'string' && obj.blockType.trim()
      ? { blockType: obj.blockType.trim() }
      : {}),
    ...(mealType ? { mealType } : {}),
    ...(items && items.length > 0 ? { items } : {}),
    foodCategories: categories,
    ...(foodSelections ? { foodSelections } : {}),
    ...(customFoods ? { customFoods } : {}),
    ...(foodQuantities ? { foodQuantities } : {}),
    ...(soupPortion ? { soupPortion } : {}),
    ...(foodPhoto ? { foodPhoto } : {}),
    ...(foodPhotos ? { foodPhotos } : {}),
    ...(imageRef ? { imageRef } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(typeof obj.isFavorite === 'boolean' ? { isFavorite: obj.isFavorite } : {}),
    useCount,
    ...(lastUsedAt !== undefined ? { lastUsedAt } : {}),
    createdAt,
    updatedAt,
  };
}

/**
 * Deep-clone a PersonalMealLibraryItem without duplicating any IndexedDB photo blobs.
 */
export function cloneLibraryMeal(
  meal: PersonalMealLibraryItem,
  options?: { regenerateId?: boolean }
): PersonalMealLibraryItem {
  const regenerate = options?.regenerateId ?? false;
  return {
    id: regenerate ? generateLibraryMealId() : meal.id,
    name: meal.name,
    ...(meal.description !== undefined ? { description: meal.description } : {}),
    ...(meal.blockType !== undefined ? { blockType: meal.blockType } : {}),
    ...(meal.mealType ? { mealType: meal.mealType } : {}),
    ...(meal.items ? { items: [...meal.items] } : {}),
    foodCategories: [...meal.foodCategories],
    ...(meal.foodSelections
      ? { foodSelections: JSON.parse(JSON.stringify(meal.foodSelections)) }
      : {}),
    ...(meal.customFoods ? { customFoods: JSON.parse(JSON.stringify(meal.customFoods)) } : {}),
    ...(meal.foodQuantities
      ? { foodQuantities: JSON.parse(JSON.stringify(meal.foodQuantities)) }
      : {}),
    ...(meal.soupPortion ? { soupPortion: meal.soupPortion } : {}),
    ...(meal.foodPhoto ? { foodPhoto: { ...meal.foodPhoto } } : {}),
    ...(meal.foodPhotos ? { foodPhotos: meal.foodPhotos.map(p => ({ ...p })) } : {}),
    ...(meal.imageRef ? { imageRef: cloneMealImageRef(meal.imageRef) } : {}),
    ...(meal.tags ? { tags: [...meal.tags] } : {}),
    ...(meal.isFavorite !== undefined ? { isFavorite: meal.isFavorite } : {}),
    useCount: regenerate ? 0 : meal.useCount,
    ...(regenerate || meal.lastUsedAt === undefined ? {} : { lastUsedAt: meal.lastUsedAt }),
    createdAt: regenerate ? Date.now() : meal.createdAt,
    updatedAt: regenerate ? Date.now() : meal.updatedAt,
  };
}

/**
 * Load the Personal Meal Library store safely from localStorage.
 * Recovers cleanly from missing, corrupted, or legacy raw-array JSON without throwing.
 */
export function loadMealLibraryStore(): PersonalMealLibraryStore {
  try {
    if (typeof localStorage === 'undefined') {
      return createEmptyMealLibraryStore();
    }
    const raw = localStorage.getItem(MEAL_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return createEmptyMealLibraryStore();
    }

    const parsed = JSON.parse(raw);
    const rawMeals: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).meals)
      ? (parsed as any).meals
      : [];

    const seenIds = new Set<string>();
    const meals: PersonalMealLibraryItem[] = [];
    for (const item of rawMeals) {
      const cleaned = sanitiseLibraryMealItem(item);
      if (!cleaned) continue;
      if (seenIds.has(cleaned.id)) {
        cleaned.id = generateLibraryMealId();
      }
      seenIds.add(cleaned.id);
      meals.push(cleaned);
    }

    return {
      version: 1,
      meals,
    };
  } catch {
    return createEmptyMealLibraryStore();
  }
}

/**
 * Persist the Personal Meal Library store to localStorage and emit update event.
 */
export function saveMealLibraryStore(store: PersonalMealLibraryStore): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const normalized: PersonalMealLibraryStore = {
      version: 1,
      meals: Array.isArray(store?.meals)
        ? store.meals
            .map(m => sanitiseLibraryMealItem(m))
            .filter((m): m is PersonalMealLibraryItem => Boolean(m))
        : [],
    };
    localStorage.setItem(MEAL_LIBRARY_STORAGE_KEY, JSON.stringify(normalized));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(MEAL_LIBRARY_UPDATED_EVENT));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Query saved Personal Meal Library items with optional filtering.
 * Returns deep clones so caller mutations cannot corrupt storage state.
 */
export function listLibraryMeals(filter?: {
  mealType?: MealTypeKey;
  category?: FoodCategoryKey;
  query?: string;
  favoritesOnly?: boolean;
}): PersonalMealLibraryItem[] {
  const store = loadMealLibraryStore();
  const q = filter?.query?.trim().toLowerCase() || '';

  return store.meals
    .filter(meal => {
      if (filter?.favoritesOnly && !meal.isFavorite) return false;
      if (filter?.mealType && meal.mealType !== filter.mealType) return false;
      if (filter?.category && !meal.foodCategories.includes(filter.category)) return false;
      if (q) {
        const haystacks = [
          meal.name,
          meal.description || '',
          meal.blockType || '',
          meal.mealType || '',
          ...(meal.items || []),
          ...(meal.tags || []),
          ...Object.values(meal.foodSelections || {}).flat(),
          ...Object.values(meal.customFoods || {}).flat(),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystacks.includes(q)) return false;
      }
      return true;
    })
    .map(m => cloneLibraryMeal(m));
}

/**
 * Look up a single Personal Meal Library item by ID.
 */
export function getLibraryMealById(id: string): PersonalMealLibraryItem | null {
  if (!id || typeof id !== 'string') return null;
  const store = loadMealLibraryStore();
  const found = store.meals.find(m => m.id === id.trim());
  return found ? cloneLibraryMeal(found) : null;
}

/**
 * Create or update a Personal Meal Library entry.
 * Reuses existing uploaded photo IDs without duplicating IndexedDB blobs.
 */
export function saveLibraryMeal(input: SaveLibraryMealInput): PersonalMealLibraryItem {
  const store = loadMealLibraryStore();
  const now = Date.now();
  const existingIdx =
    typeof input.id === 'string' && input.id.trim()
      ? store.meals.findIndex(m => m.id === input.id!.trim())
      : -1;
  const existing = existingIdx >= 0 ? store.meals[existingIdx] : null;

  const candidate = sanitiseLibraryMealItem({
    ...existing,
    ...input,
    id: existing ? existing.id : input.id?.trim() || generateLibraryMealId(),
    createdAt: existing ? existing.createdAt : input.createdAt ?? now,
    updatedAt: now,
    useCount: input.useCount ?? existing?.useCount ?? 0,
    lastUsedAt: input.lastUsedAt ?? existing?.lastUsedAt,
  });

  if (!candidate) {
    throw new Error('Personal Meal Library item requires a non-empty meal name.');
  }

  if (existingIdx >= 0) {
    store.meals[existingIdx] = candidate;
  } else {
    store.meals.unshift(candidate);
  }

  saveMealLibraryStore(store);
  return cloneLibraryMeal(candidate);
}

/**
 * Update an existing Personal Meal Library item by ID.
 * Returns null if `id` does not exist.
 */
export function updateLibraryMeal(
  id: string,
  updates: Partial<Omit<SaveLibraryMealInput, 'id'>>
): PersonalMealLibraryItem | null {
  const store = loadMealLibraryStore();
  const idx = store.meals.findIndex(m => m.id === id);
  if (idx === -1) return null;

  const current = store.meals[idx];
  const nextName =
    updates.name !== undefined && updates.name.trim() ? updates.name.trim() : current.name;

  const updated = sanitiseLibraryMealItem({
    ...current,
    ...updates,
    id: current.id,
    name: nextName,
    createdAt: current.createdAt,
    updatedAt: Date.now(),
  });
  if (!updated) return null;

  store.meals[idx] = updated;
  saveMealLibraryStore(store);
  return cloneLibraryMeal(updated);
}

/**
 * Attaches an existing uploaded IndexedDB photo (by FoodPhotoMetadata or photoId) to a
 * Personal Meal Library entry WITHOUT re-uploading or duplicating any image blob.
 */
export function attachExistingPhotoToLibraryMeal(
  mealId: string,
  photoOrId: FoodPhotoMetadata | string
): PersonalMealLibraryItem | null {
  const current = getLibraryMealById(mealId);
  if (!current) return null;

  const meta: FoodPhotoMetadata =
    typeof photoOrId === 'string'
      ? {
          id: photoOrId.trim(),
          createdAt: new Date().toISOString(),
          mimeType: 'image/jpeg',
        }
      : {
          id: photoOrId.id.trim(),
          createdAt: photoOrId.createdAt || new Date().toISOString(),
          mimeType: photoOrId.mimeType || 'image/jpeg',
        };

  if (!meta.id) return null;

  const existingPhotos = getLibraryMealPhotos(current);
  const deduped = [meta, ...existingPhotos.filter(p => p.id !== meta.id)];

  return updateLibraryMeal(mealId, {
    foodPhoto: deduped[0],
    foodPhotos: deduped,
    imageRef: {
      kind: 'uploaded_photo',
      photoId: deduped[0].id,
      photoMeta: { ...deduped[0] },
    },
  });
}

/**
 * Saves an existing StructuredDietBlock as a reusable Personal Meal Library item.
 * Shares existing uploaded photo IDs (`foodPhotos` / `imageRef`) with zero blob duplication.
 */
export function createLibraryMealFromBlock(
  block: StructuredDietBlock,
  options?: {
    name?: string;
    description?: string;
    tags?: string[];
    isFavorite?: boolean;
    t?: Record<string, any>;
  }
): PersonalMealLibraryItem {
  const derivedTitle =
    (options?.name && options.name.trim()) ||
    getBlockPrimaryDescription(block, options?.t) ||
    block.type ||
    'Custom Meal';

  const blockPhotos = getBlockPhotos(block);
  const mealType: MealTypeKey | undefined =
    block.mealType ??
    ((MEAL_TYPE_KEYS as readonly string[]).includes(block.type.trim().toLowerCase())
      ? (block.type.trim().toLowerCase() as MealTypeKey)
      : undefined);

  return saveLibraryMeal({
    name: derivedTitle,
    description: options?.description ?? (block.customText?.trim() || undefined),
    blockType: block.type,
    mealType,
    items: block.items ? [...block.items] : undefined,
    foodCategories: block.foodCategories ? [...block.foodCategories] : [],
    foodSelections: block.foodSelections
      ? JSON.parse(JSON.stringify(block.foodSelections))
      : undefined,
    customFoods: block.customFoods ? JSON.parse(JSON.stringify(block.customFoods)) : undefined,
    foodQuantities: block.foodQuantities
      ? JSON.parse(JSON.stringify(block.foodQuantities))
      : undefined,
    soupPortion: block.soupPortion,
    foodPhoto: blockPhotos[0] ? { ...blockPhotos[0] } : undefined,
    foodPhotos: blockPhotos.length > 0 ? blockPhotos.map(p => ({ ...p })) : undefined,
    imageRef: block.imageRef
      ? cloneMealImageRef(block.imageRef)
      : blockPhotos[0]
      ? {
          kind: 'uploaded_photo',
          photoId: blockPhotos[0].id,
          photoMeta: { ...blockPhotos[0] },
        }
      : undefined,
    tags: options?.tags,
    isFavorite: options?.isFavorite,
  });
}

/**
 * Applies a Personal Meal Library item onto a scheduled StructuredDietBlock time window.
 * Deep-clones arrays/maps so editing the scheduled block never mutates the library item,
 * while sharing the exact same IndexedDB photo IDs (zero blob duplication).
 * Strictly pre-meal plan level — never writes a Verification or Score event.
 */
export function applyLibraryMealToBlock(
  libraryMeal: PersonalMealLibraryItem,
  slot: {
    id?: string;
    startTime: string;
    endTime: string;
    type?: string;
    mealType?: MealTypeKey;
    approvalStatus?: MealApprovalStatus;
    alternatives?: MealAlternativeOption[];
  }
): StructuredDietBlock {
  const photos = getLibraryMealPhotos(libraryMeal);
  const resolvedType =
    slot.type ||
    libraryMeal.blockType ||
    (libraryMeal.mealType
      ? libraryMeal.mealType.charAt(0).toUpperCase() + libraryMeal.mealType.slice(1)
      : 'Custom');

  const slotTypeLower = slot.type ? slot.type.trim().toLowerCase() : '';
  const resolvedMealType: MealTypeKey | undefined =
    slot.mealType && (MEAL_TYPE_KEYS as readonly string[]).includes(slot.mealType)
      ? slot.mealType
      : (MEAL_TYPE_KEYS as readonly string[]).includes(slotTypeLower)
      ? (slotTypeLower as MealTypeKey)
      : libraryMeal.mealType;

  return sanitiseBlock({
    id: slot.id || generateBlockId(),
    startTime: slot.startTime,
    endTime: slot.endTime,
    type: resolvedType,
    items: libraryMeal.items ? [...libraryMeal.items] : [],
    customText: libraryMeal.name || libraryMeal.description || '',
    mealType: resolvedMealType,
    foodCategories: [...libraryMeal.foodCategories],
    foodSelections: libraryMeal.foodSelections
      ? JSON.parse(JSON.stringify(libraryMeal.foodSelections))
      : undefined,
    customFoods: libraryMeal.customFoods
      ? JSON.parse(JSON.stringify(libraryMeal.customFoods))
      : undefined,
    foodQuantities: libraryMeal.foodQuantities
      ? JSON.parse(JSON.stringify(libraryMeal.foodQuantities))
      : undefined,
    soupPortion: libraryMeal.soupPortion,
    foodPhoto: photos[0] ? { ...photos[0] } : undefined,
    foodPhotos: photos.length > 0 ? photos.map(p => ({ ...p })) : undefined,
    libraryMealId: libraryMeal.id,
    approvalStatus: slot.approvalStatus,
    alternatives: slot.alternatives
      ? slot.alternatives.map(a => cloneMealAlternative(a, false))
      : undefined,
    imageRef: libraryMeal.imageRef
      ? cloneMealImageRef(libraryMeal.imageRef)
      : photos[0]
      ? {
          kind: 'uploaded_photo',
          photoId: photos[0].id,
          photoMeta: { ...photos[0] },
        }
      : undefined,
  });
}

/**
 * Converts a Personal Meal Library item into a reusable MealAlternativeOption
 * sharing the same IndexedDB photo references without copying image blobs.
 */
export function buildAlternativeFromLibraryMeal(
  libraryMeal: PersonalMealLibraryItem,
  targetSlot?: { type?: string; mealType?: MealTypeKey }
): MealAlternativeOption {
  const photos = getLibraryMealPhotos(libraryMeal);
  const slotTypeLower = targetSlot?.type ? targetSlot.type.trim().toLowerCase() : '';
  const resolvedMealType: MealTypeKey | undefined =
    targetSlot?.mealType && (MEAL_TYPE_KEYS as readonly string[]).includes(targetSlot.mealType)
      ? targetSlot.mealType
      : (MEAL_TYPE_KEYS as readonly string[]).includes(slotTypeLower)
      ? (slotTypeLower as MealTypeKey)
      : libraryMeal.mealType;

  const built = sanitiseMealAlternative({
    id: `alt_${generateBlockId()}`,
    name: libraryMeal.name,
    customText: libraryMeal.description || libraryMeal.name,
    type: targetSlot?.type || libraryMeal.blockType,
    mealType: resolvedMealType,
    items: libraryMeal.items ? [...libraryMeal.items] : undefined,
    foodCategories: [...libraryMeal.foodCategories],
    foodSelections: libraryMeal.foodSelections
      ? JSON.parse(JSON.stringify(libraryMeal.foodSelections))
      : undefined,
    customFoods: libraryMeal.customFoods
      ? JSON.parse(JSON.stringify(libraryMeal.customFoods))
      : undefined,
    foodQuantities: libraryMeal.foodQuantities
      ? JSON.parse(JSON.stringify(libraryMeal.foodQuantities))
      : undefined,
    soupPortion: libraryMeal.soupPortion,
    libraryMealId: libraryMeal.id,
    foodPhoto: photos[0] ? { ...photos[0] } : undefined,
    foodPhotos: photos.length > 0 ? photos.map(p => ({ ...p })) : undefined,
    imageRef: libraryMeal.imageRef ? cloneMealImageRef(libraryMeal.imageRef) : undefined,
  });

  if (!built) {
    return {
      id: `alt_${generateBlockId()}`,
      name: libraryMeal.name || 'Alternative Meal',
      libraryMealId: libraryMeal.id,
    };
  }
  return built;
}

/**
 * Increments usage tracking metadata when a library meal is inserted into a schedule.
 */
export function recordLibraryMealUsed(id: string): PersonalMealLibraryItem | null {
  const store = loadMealLibraryStore();
  const idx = store.meals.findIndex(m => m.id === id);
  if (idx === -1) return null;

  const now = Date.now();
  store.meals[idx] = {
    ...store.meals[idx],
    useCount: (store.meals[idx].useCount || 0) + 1,
    lastUsedAt: now,
    updatedAt: now,
  };
  saveMealLibraryStore(store);
  return cloneLibraryMeal(store.meals[idx]);
}

/**
 * Deletes a meal from the Personal Meal Library while strictly protecting shared photos.
 *
 * Photo Deletion Protection Guarantee:
 * Every photo ID attached to the deleted meal is checked against:
 *  - All Structure Goal profiles (days, dateOverrides, historySnapshots, and alternative meals)
 *  - All Daily Diet Verifications & plannedSnapshots
 *  - All remaining Personal Meal Library entries
 * Only photo IDs with ZERO remaining references anywhere are deleted from IndexedDB.
 */
export async function deleteLibraryMeal(
  id: string,
  options?: { cleanupUnreferencedPhotos?: boolean }
): Promise<DeleteLibraryMealResult> {
  const store = loadMealLibraryStore();
  const idx = store.meals.findIndex(m => m.id === id);
  if (idx === -1) {
    return { deleted: false, deletedPhotoIds: [], preservedPhotoIds: [] };
  }

  const [removed] = store.meals.splice(idx, 1);
  saveMealLibraryStore(store);

  const candidatePhotoIds = getLibraryMealPhotoIds(removed);
  const deletedPhotoIds: string[] = [];
  const preservedPhotoIds: string[] = [];

  if (candidatePhotoIds.length > 0) {
    const shouldCleanup = options?.cleanupUnreferencedPhotos ?? true;
    const dietStore = loadDietStore();
    const verifications = loadAllDietVerifications();

    for (const photoId of candidatePhotoIds) {
      const stillReferenced = isPhotoReferenced(photoId, dietStore, verifications, store);
      if (stillReferenced || !shouldCleanup) {
        preservedPhotoIds.push(photoId);
      } else {
        await deleteFoodPhoto(photoId);
        deletedPhotoIds.push(photoId);
      }
    }
  }

  return {
    deleted: true,
    deletedPhotoIds,
    preservedPhotoIds,
  };
}

/**
 * Lists all unique uploaded FoodPhotoMetadata references currently stored across the
 * Personal Meal Library, Structured Diet schedules (including overrides & alternatives),
 * and Daily Verifications so existing uploaded photos can be reused without re-uploading.
 */
export function listReusableUploadedPhotos(): FoodPhotoMetadata[] {
  const byId = new Map<string, FoodPhotoMetadata>();

  const registerPhotos = (photos: FoodPhotoMetadata[]) => {
    for (const p of photos) {
      if (p && typeof p.id === 'string' && p.id.trim() && !byId.has(p.id.trim())) {
        byId.set(p.id.trim(), {
          id: p.id.trim(),
          createdAt: p.createdAt || new Date(0).toISOString(),
          mimeType: p.mimeType || 'image/jpeg',
        });
      }
    }
  };

  // 1. Personal Meal Library photos (newest first)
  const libStore = loadMealLibraryStore();
  for (const meal of libStore.meals) {
    registerPhotos(getLibraryMealPhotos(meal));
  }

  // 2. Structured Diet profiles (days, dateOverrides, historySnapshots, and alternatives)
  const dietStore = loadDietStore();
  for (const profile of dietStore.profiles) {
    for (const day of profile.diet.days) {
      for (const block of day.blocks) {
        registerPhotos(getBlockPhotos(block));
        for (const alt of block.alternatives || []) {
          registerPhotos(getBlockPhotos(alt));
        }
      }
    }
    if (profile.diet.dateOverrides) {
      for (const overrideDay of Object.values(profile.diet.dateOverrides)) {
        for (const block of overrideDay.blocks) {
          registerPhotos(getBlockPhotos(block));
          for (const alt of block.alternatives || []) {
            registerPhotos(getBlockPhotos(alt));
          }
        }
      }
    }
    if (profile.diet.historySnapshots) {
      for (const snap of Object.values(profile.diet.historySnapshots)) {
        for (const block of snap.blocks) {
          registerPhotos(getBlockPhotos(block));
          for (const alt of block.alternatives || []) {
            registerPhotos(getBlockPhotos(alt));
          }
        }
      }
    }
  }

  // 3. Daily Diet Verifications
  const verifications = loadAllDietVerifications();
  for (const daily of Object.values(verifications)) {
    for (const entry of daily.entries || []) {
      registerPhotos(getBlockPhotos(entry));
      if (entry.plannedSnapshot) {
        registerPhotos(getBlockPhotos(entry.plannedSnapshot));
        for (const alt of entry.plannedSnapshot.alternatives || []) {
          registerPhotos(getBlockPhotos(alt));
        }
      }
    }
  }

  return Array.from(byId.values());
}
