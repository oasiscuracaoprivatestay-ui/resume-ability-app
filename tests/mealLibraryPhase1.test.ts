/**
 * Super Diet-Ability — Final Completion Phase 1 Automated Test Suite
 *
 * Covers:
 * 1. Saving, reloading, updating, filtering, and corruption-recovery of Personal Meal Library items
 * 2. Shared IndexedDB photo references with ZERO blob duplication
 * 3. Photo deletion & stats-reset protection across Meal Library, schedules, dateOverrides,
 *    historySnapshots, alternative meals, imageRef, and verifications
 * 4. Backward compatibility for existing/legacy StructuredDietBlock records (omitted approvalStatus => 'accepted')
 * 5. Deep cloning & snapshot isolation (cloneBlocks, deepCloneBlocks, copyDayPlan, createPlannedBlockSnapshot)
 * 6. Strict separation between pre-meal plan approval (Accept / Modify / Reject / Swap Alternative)
 *    and post-meal On Track / Slip verification & XP scoring
 */

// ── Minimal Deterministic Browser Storage + IndexedDB Mock for Node Execution ──

const memoryLocalStorage: Record<string, string> = {};
const memorySessionStorage: Record<string, string> = {};

(globalThis as any).localStorage = {
  getItem: (key: string) => (Object.prototype.hasOwnProperty.call(memoryLocalStorage, key) ? memoryLocalStorage[key] : null),
  setItem: (key: string, val: string) => {
    memoryLocalStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete memoryLocalStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memoryLocalStorage)) {
      delete memoryLocalStorage[k];
    }
  },
};

(globalThis as any).sessionStorage = {
  getItem: (key: string) => (Object.prototype.hasOwnProperty.call(memorySessionStorage, key) ? memorySessionStorage[key] : null),
  setItem: (key: string, val: string) => {
    memorySessionStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete memorySessionStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memorySessionStorage)) {
      delete memorySessionStorage[k];
    }
  },
};

if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params?: { detail?: any }) {
      this.type = type;
      this.detail = params?.detail;
    }
  };
}

(globalThis as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: (globalThis as any).localStorage,
  sessionStorage: (globalThis as any).sessionStorage,
};

// In-memory IndexedDB mock backing 'resume-ability-photos-db' -> object store 'photos'
const idbPhotoRecords = new Map<string, any>();

function makeIdbRequest<T>(executor: () => T): any {
  const req: any = {
    result: undefined as T | undefined,
    error: null,
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
    onupgradeneeded: null as null | (() => void),
  };
  queueMicrotask(() => {
    try {
      req.result = executor();
      if (typeof req.onsuccess === 'function') req.onsuccess();
    } catch (err) {
      req.error = err;
      if (typeof req.onerror === 'function') req.onerror();
    }
  });
  return req;
}

const mockObjectStore = {
  put: (record: any) =>
    makeIdbRequest(() => {
      idbPhotoRecords.set(record.id, { ...record });
      return record.id;
    }),
  get: (id: string) =>
    makeIdbRequest(() => {
      const rec = idbPhotoRecords.get(id);
      return rec ? { ...rec } : undefined;
    }),
  delete: (id: string) =>
    makeIdbRequest(() => {
      idbPhotoRecords.delete(id);
      return undefined;
    }),
  getAllKeys: () =>
    makeIdbRequest(() => Array.from(idbPhotoRecords.keys())),
  openCursor: () => {
    const entries = Array.from(idbPhotoRecords.values());
    let idx = 0;
    const req: any = {
      result: null,
      error: null,
      onsuccess: null as null | (() => void),
      onerror: null as null | (() => void),
    };
    const advance = () => {
      queueMicrotask(() => {
        if (idx < entries.length) {
          req.result = {
            value: { ...entries[idx] },
            continue: () => {
              idx++;
              advance();
            },
          };
        } else {
          req.result = null;
        }
        if (typeof req.onsuccess === 'function') req.onsuccess();
      });
    };
    advance();
    return req;
  },
};

const mockDb = {
  objectStoreNames: {
    contains: (name: string) => name === 'photos',
  },
  createObjectStore: () => mockObjectStore,
  transaction: () => ({
    objectStore: () => mockObjectStore,
  }),
};

(globalThis as any).indexedDB = {
  open: () => makeIdbRequest(() => mockDb),
};

// ── Imports Under Test ────────────────────────────────────────────────────────

import {
  loadDietStore,
  saveDietStore,
  loadWeeklyDiet,
  saveWeeklyDiet,
  updateDayPlan,
  copyDayPlan,
  setDateOverride,
  sanitiseBlock,
  cloneBlocks,
  deepCloneBlocks,
  getEffectiveBlockApprovalStatus,
  isBlockScheduleActive,
  setBlockApprovalStatus,
  swapBlockWithAlternative,
  getBlockPhotos,
  getAllBlockReferencedPhotoIds,
  getLocalDateKey,
  dateKeyToDayKey,
  type StructuredDietBlock,
} from '../src/utils/dietStorage';
import {
  createPlannedBlockSnapshot,
  saveBlockVerification,
  loadAllDietVerifications,
  getDailyVerificationStats,
} from '../src/utils/dietVerificationStorage';
import {
  getFoodPhoto,
  cleanupOrphanPhotos,
  collectActivePhotoIds,
  isPhotoReferenced,
  type FoodPhotoMetadata,
} from '../src/utils/photoStorage';
import {
  MEAL_LIBRARY_STORAGE_KEY,
  loadMealLibraryStore,
  saveLibraryMeal,
  updateLibraryMeal,
  getLibraryMealById,
  listLibraryMeals,
  createLibraryMealFromBlock,
  applyLibraryMealToBlock,
  buildAlternativeFromLibraryMeal,
  attachExistingPhotoToLibraryMeal,
  recordLibraryMealUsed,
  deleteLibraryMeal,
  listReusableUploadedPhotos,
} from '../src/utils/mealLibraryStorage';
import { resetAllStats } from '../src/utils/resetStats';
import { loadScoreStore, resetScoreStore } from '../src/utils/scoringEngine';
import { loadSlips } from '../src/utils';
import { getNextPlannedBlock } from '../src/utils/homeSelectors';
import {
  resolveNextScheduledBlockForDate,
  evaluateBook1PracticeLoopGuidance,
  evaluateBook2PracticeLoopGuidance,
} from '../src/challenges/practiceLoopEngine';

// ── Test Harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function seedMockIndexedDbPhoto(id: string, dataUrl = `data:image/jpeg;base64,FAKE_${id}`): Promise<FoodPhotoMetadata> {
  const createdAt = '2026-11-21T09:00:00.000Z';
  idbPhotoRecords.set(id, {
    id,
    dataUrl,
    mimeType: 'image/jpeg',
    createdAt,
    width: 800,
    height: 600,
  });
  return {
    id,
    createdAt,
    mimeType: 'image/jpeg',
  };
}

function resetTestEnvironment(): void {
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();
  idbPhotoRecords.clear();
  resetScoreStore();
}

async function runTests(): Promise<void> {
  console.log('======================================================================');
  console.log(' SDA FINAL COMPLETION — PHASE 1: MEAL LIBRARY & PHOTO SAFETY SUITE');
  console.log('======================================================================\n');

  // ── 1. Saving, Reloading & Filtering Personal Meal Library Meals ───────────
  console.log('1. Saving, Reloading, Updating & Corruption Recovery');
  resetTestEnvironment();

  const uploadedHeroMeta = await seedMockIndexedDbPhoto('photo_salmon_bowl');

  const savedMeal = saveLibraryMeal({
    name: '  Grilled Salmon & Quinoa Bowl  ',
    description: 'Post-workout structured lunch with olive oil greens',
    blockType: 'Lunch',
    mealType: 'lunch',
    foodCategories: ['protein', 'complex_carbs', 'vegetables', 'healthy_fats'],
    foodSelections: {
      protein: ['salmon'],
      complex_carbs: ['quinoa'],
      vegetables: ['broccoli', 'spinach'],
      healthy_fats: ['olive_oil'],
    },
    customFoods: {
      vegetables: ['Pickled red onion'],
    },
    foodQuantities: {
      'protein::salmon': { amount: 180, unit: 'gram', grams: 180 },
      'complex_carbs::quinoa': { amount: 1, unit: 'cup' },
      'custom::vegetables::Pickled red onion': { amount: 2, unit: 'custom', customUnit: 'tbsp' },
    },
    foodPhoto: uploadedHeroMeta,
    foodPhotos: [uploadedHeroMeta],
    tags: ['high-protein', 'omega-3', 'high-protein'],
    isFavorite: true,
  });

  assert(savedMeal.name === 'Grilled Salmon & Quinoa Bowl', 'Trims and saves custom meal name');
  assert(savedMeal.mealType === 'lunch', 'Preserves canonical mealType');
  assert(
    savedMeal.foodCategories.length === 4 && savedMeal.foodCategories.includes('protein'),
    'Preserves multi-select foodCategories'
  );
  assert(
    savedMeal.foodSelections?.protein?.[0] === 'salmon' &&
      savedMeal.foodSelections?.vegetables?.length === 2,
    'Preserves canonical foodSelections per category'
  );
  assert(
    savedMeal.customFoods?.vegetables?.[0] === 'Pickled red onion',
    'Preserves customFoods per category'
  );
  assert(
    savedMeal.foodQuantities?.['protein::salmon']?.amount === 180 &&
      savedMeal.foodQuantities?.['protein::salmon']?.unit === 'gram' &&
      savedMeal.foodQuantities?.['custom::vegetables::Pickled red onion']?.customUnit === 'tbsp',
    'Preserves foodQuantities map with units, customUnit, and grams'
  );
  assert(savedMeal.tags?.length === 2, 'Deduplicates organizational tags');
  assert(
    savedMeal.imageRef?.kind === 'uploaded_photo' &&
      savedMeal.imageRef?.photoId === 'photo_salmon_bowl',
    'Automatically links uploaded_photo imageRef to existing IndexedDB photo ID'
  );

  // Reload fresh from localStorage
  const reloaded = getLibraryMealById(savedMeal.id);
  assert(reloaded !== null && reloaded.id === savedMeal.id, 'Reloads saved meal from localStorage by ID');
  assert(
    reloaded?.foodQuantities?.['complex_carbs::quinoa']?.amount === 1,
    'Reloaded meal retains nested foodQuantities'
  );

  // Stock-asset meal + Soup portion
  const soupMeal = saveLibraryMeal({
    name: 'Hearty Lentil Vegetable Soup',
    mealType: 'dinner',
    foodCategories: ['soups', 'vegetables'],
    customFoods: { soups: ['Homemade Red Lentil Soup'] },
    soupPortion: 'large',
    imageRef: {
      kind: 'stock_asset',
      assetUrl: '/images/meals/dinner.jpg',
      stockKey: 'dinner',
    },
  });
  assert(soupMeal.soupPortion === 'large', 'Preserves soupPortion on library meal');
  assert(
    soupMeal.imageRef?.kind === 'stock_asset' &&
      soupMeal.imageRef?.assetUrl === '/images/meals/dinner.jpg',
    'Preserves stock_asset imageRef cleanly'
  );

  // Filtering & usage tracking
  assert(listLibraryMeals({ mealType: 'lunch' }).length === 1, 'Filters library meals by mealType');
  assert(listLibraryMeals({ favoritesOnly: true }).length === 1, 'Filters library meals by favoritesOnly');
  assert(listLibraryMeals({ query: 'pickled' }).length === 1, 'Searches library meals across customFoods');

  const used = recordLibraryMealUsed(savedMeal.id);
  assert(used?.useCount === 1 && typeof used.lastUsedAt === 'number', 'Increments useCount and sets lastUsedAt');

  const updated = updateLibraryMeal(savedMeal.id, { name: 'Wild Salmon & Quinoa Bowl' });
  assert(updated?.name === 'Wild Salmon & Quinoa Bowl', 'Updates existing library meal in-place without losing data');
  assert(updated?.foodPhoto?.id === 'photo_salmon_bowl', 'Update preserves existing photo reference');

  // Corrupted & legacy raw-array JSON resilience
  localStorage.setItem(MEAL_LIBRARY_STORAGE_KEY, '{not-valid-json');
  const recoveredCorrupt = loadMealLibraryStore();
  assert(
    recoveredCorrupt.version === 1 && Array.isArray(recoveredCorrupt.meals) && recoveredCorrupt.meals.length === 0,
    'Recovers safely from corrupted JSON without throwing'
  );

  localStorage.setItem(
    MEAL_LIBRARY_STORAGE_KEY,
    JSON.stringify([
      {
        name: 'Legacy Array Greek Yogurt',
        foodCategories: ['protein', 'fruits'],
        foodPhoto: uploadedHeroMeta,
      },
    ])
  );
  const recoveredLegacyArray = loadMealLibraryStore();
  assert(
    recoveredLegacyArray.meals.length === 1 &&
      recoveredLegacyArray.meals[0].foodPhotos?.[0]?.id === 'photo_salmon_bowl',
    'Backward-compatible loader normalizes legacy raw-array & single foodPhoto shape'
  );

  // ── 2. Shared Photo References & Zero IndexedDB Blob Duplication ───────────
  console.log('\n2. Shared IndexedDB Photo References (Zero Blob Duplication)');
  resetTestEnvironment();

  const sharedPhotoMeta = await seedMockIndexedDbPhoto('photo_shared_omelette');
  assert(idbPhotoRecords.size === 1, 'Seeded exactly 1 photo blob in IndexedDB');

  const sourceBlock: StructuredDietBlock = sanitiseBlock({
    id: 'blk_morning_1',
    startTime: '08:00',
    endTime: '08:30',
    type: 'Breakfast',
    mealType: 'breakfast',
    items: [],
    customText: 'Spinach & Feta Omelette',
    foodCategories: ['protein', 'vegetables'],
    foodSelections: { protein: ['eggs'], vegetables: ['spinach'] },
    foodPhotos: [sharedPhotoMeta],
    foodPhoto: sharedPhotoMeta,
  });

  const libFromBlock = createLibraryMealFromBlock(sourceBlock, {
    name: 'Signature Spinach Omelette',
  });
  const appliedBlock1 = applyLibraryMealToBlock(libFromBlock, {
    startTime: '08:30',
    endTime: '09:00',
    approvalStatus: 'accepted',
  });
  const appliedBlock2 = applyLibraryMealToBlock(libFromBlock, {
    startTime: '09:00',
    endTime: '09:30',
  });
  const altOption = buildAlternativeFromLibraryMeal(libFromBlock);

  const secondLibMeal = saveLibraryMeal({
    name: 'Weekend Omelette Plate',
    mealType: 'breakfast',
    foodCategories: ['protein'],
  });
  const secondWithSharedPhoto = attachExistingPhotoToLibraryMeal(secondLibMeal.id, sharedPhotoMeta);

  assert(
    idbPhotoRecords.size === 1,
    'Reusing photo across block -> library -> 2 scheduled blocks -> alternative -> 2nd library meal keeps IndexedDB blob count at 1'
  );
  assert(
    appliedBlock1.libraryMealId === libFromBlock.id &&
      appliedBlock1.foodPhoto?.id === 'photo_shared_omelette' &&
      altOption.foodPhoto?.id === 'photo_shared_omelette' &&
      secondWithSharedPhoto?.foodPhoto?.id === 'photo_shared_omelette',
    'All derived blocks, alternatives, and library meals point to the same IndexedDB photoId'
  );

  // Save appliedBlock1 into active diet schedule and verify listReusableUploadedPhotos deduplicates
  const weekly = updateDayPlan(loadWeeklyDiet(), 'mon', d => ({
    ...d,
    blocks: [appliedBlock1, appliedBlock2],
  }));
  saveWeeklyDiet(weekly);

  const reusablePhotos = listReusableUploadedPhotos();
  assert(
    reusablePhotos.length === 1 && reusablePhotos[0].id === 'photo_shared_omelette',
    'listReusableUploadedPhotos returns deduplicated uploaded photo metadata across stores'
  );

  // ── 3. Photo Deletion & Stats-Reset Protection ─────────────────────────────
  console.log('\n3. Photo Deletion & Stats-Reset Protection');
  resetTestEnvironment();

  const photoLibraryOnly = await seedMockIndexedDbPhoto('photo_lib_only');
  const photoSharedScheduleAndLib = await seedMockIndexedDbPhoto('photo_shared_sched_lib');
  const photoAltOnly = await seedMockIndexedDbPhoto('photo_alt_only');
  const photoDateOverrideOnly = await seedMockIndexedDbPhoto('photo_override_only');
  const photoTrueOrphan = await seedMockIndexedDbPhoto('photo_true_orphan');

  const libOnlyMeal = saveLibraryMeal({
    name: 'Saved Berry Protein Bowl',
    mealType: 'breakfast',
    foodCategories: ['protein', 'fruits'],
    foodPhoto: photoLibraryOnly,
  });

  const sharedLibMeal = saveLibraryMeal({
    name: 'Shared Chicken Avocado Salad',
    mealType: 'lunch',
    foodCategories: ['protein', 'healthy_fats', 'vegetables'],
    foodPhoto: photoSharedScheduleAndLib,
  });

  const mondayBlockWithAlt: StructuredDietBlock = sanitiseBlock({
    id: 'blk_mon_lunch',
    startTime: '12:30',
    endTime: '13:00',
    type: 'Lunch',
    items: [],
    customText: 'Shared Chicken Avocado Salad',
    foodCategories: ['protein', 'healthy_fats', 'vegetables'],
    libraryMealId: sharedLibMeal.id,
    foodPhoto: photoSharedScheduleAndLib,
    foodPhotos: [photoSharedScheduleAndLib],
    alternatives: [
      {
        id: 'alt_tuna_plate',
        name: 'Tuna Olive Plate',
        foodCategories: ['protein'],
        foodPhoto: photoAltOnly,
        foodPhotos: [photoAltOnly],
      },
    ],
  });

  let dietWithRefs = updateDayPlan(loadWeeklyDiet(), 'mon', d => ({
    ...d,
    blocks: [mondayBlockWithAlt],
  }));
  dietWithRefs = setDateOverride(dietWithRefs, '2026-11-25', {
    dayKey: 'wed',
    dayOfWeek: 2,
    mode: 'structured',
    blocks: [
      sanitiseBlock({
        id: 'blk_override_1',
        startTime: '18:00',
        endTime: '18:30',
        type: 'Dinner',
        items: [],
        customText: 'Special Override Dinner',
        foodCategories: ['protein'],
        imageRef: {
          kind: 'uploaded_photo',
          photoId: photoDateOverrideOnly.id,
          photoMeta: photoDateOverrideOnly,
        },
      }),
    ],
  });
  saveWeeklyDiet(dietWithRefs);

  // Simulate StructuredDietScreen 3-argument call after removing mondayBlockWithAlt's photo from schedule:
  // Even if dietStore had zero references to `photo_lib_only`, 3-arg `isPhotoReferenced` MUST protect it!
  const currentDietStore = loadDietStore();
  const currentVerifs = loadAllDietVerifications();
  assert(
    isPhotoReferenced('photo_lib_only', currentDietStore, currentVerifs) === true,
    '3-argument isPhotoReferenced() protects photo referenced only by Personal Meal Library'
  );
  assert(
    isPhotoReferenced('photo_alt_only', currentDietStore, currentVerifs) === true,
    'isPhotoReferenced() protects photo referenced only inside block.alternatives'
  );
  assert(
    isPhotoReferenced('photo_override_only', currentDietStore, currentVerifs) === true,
    'isPhotoReferenced() protects photo referenced only inside dateOverrides / imageRef'
  );
  assert(
    isPhotoReferenced('photo_true_orphan', currentDietStore, currentVerifs) === false,
    'isPhotoReferenced() returns false for unreferenced orphan photo'
  );

  // Deleting sharedLibMeal while mondayBlockWithAlt STILL references photo_shared_sched_lib
  const delSharedRes = await deleteLibraryMeal(sharedLibMeal.id);
  assert(
    delSharedRes.deleted === true &&
      delSharedRes.preservedPhotoIds.includes('photo_shared_sched_lib') &&
      delSharedRes.deletedPhotoIds.length === 0,
    'deleteLibraryMeal() preserves shared photo when still referenced by a scheduled block'
  );
  assert(
    (await getFoodPhoto('photo_shared_sched_lib')) !== null,
    'Shared photo blob still exists in IndexedDB after deleting library entry'
  );

  // Run resetAllStats(): must preserve Personal Meal Library + its photo while cleaning true orphan!
  const resetRes = resetAllStats({ resetLifetimeScore: false });
  // Allow async cleanupOrphanPhotos microtasks to settle
  await new Promise(r => setTimeout(r, 20));

  assert(resetRes.success === true, 'resetAllStats() succeeds cleanly');
  assert(
    getLibraryMealById(libOnlyMeal.id) !== null,
    'resetAllStats() preserves Personal Meal Library entries'
  );
  assert(
    (await getFoodPhoto('photo_lib_only')) !== null,
    'resetAllStats() preserves IndexedDB photo referenced only by Personal Meal Library'
  );
  assert(
    (await getFoodPhoto('photo_alt_only')) !== null,
    'resetAllStats() preserves IndexedDB photo referenced only by an alternative meal'
  );
  assert(
    (await getFoodPhoto('photo_override_only')) !== null,
    'resetAllStats() preserves IndexedDB photo referenced inside dateOverrides'
  );
  assert(
    (await getFoodPhoto('photo_true_orphan')) === null,
    'resetAllStats() cleans up true unreferenced orphan photo from IndexedDB'
  );

  // Now delete libOnlyMeal when nothing else references photo_lib_only -> should clean up photo_lib_only!
  const delExclusiveRes = await deleteLibraryMeal(libOnlyMeal.id);
  assert(
    delExclusiveRes.deleted === true &&
      delExclusiveRes.deletedPhotoIds.includes('photo_lib_only') &&
      (await getFoodPhoto('photo_lib_only')) === null,
    'deleteLibraryMeal() deletes IndexedDB photo when zero references remain anywhere'
  );

  // Also verify cleanupOrphanPhotos(new Set()) protects Meal Library photos even if caller passed an empty Set
  const safetyPhoto = await seedMockIndexedDbPhoto('photo_safety_guard');
  saveLibraryMeal({
    name: 'Protected Library Snack',
    mealType: 'snack',
    foodCategories: ['snacks'],
    foodPhoto: safetyPhoto,
  });
  await cleanupOrphanPhotos(new Set());
  assert(
    (await getFoodPhoto('photo_safety_guard')) !== null,
    'cleanupOrphanPhotos() automatically protects persisted Personal Meal Library photos'
  );

  // ── 4. Backward Compatibility for Legacy Blocks & Stores ───────────────────
  console.log('\n4. Backward Compatibility (Legacy Blocks Without approvalStatus)');
  resetTestEnvironment();

  const rawLegacyStoreV2 = {
    version: 2,
    planName: 'Existing User Diet',
    days: [
      {
        dayKey: 'mon',
        dayOfWeek: 0,
        mode: 'structured',
        blocks: [
          {
            id: 'legacy_blk_1',
            startTime: '08:00',
            endTime: '08:30',
            type: 'Breakfast',
            items: ['Eggs', 'Oatmeal'],
            customText: 'Eggs and oats',
          },
        ],
      },
    ],
  };
  localStorage.setItem('resume-ability-diet', JSON.stringify(rawLegacyStoreV2));

  const migratedStore = loadDietStore();
  const migratedMonBlock = migratedStore.profiles
    .find(p => p.id === migratedStore.activeProfileId)!
    .diet.days.find(d => d.dayKey === 'mon')!.blocks[0];

  assert(
    migratedMonBlock.id === 'legacy_blk_1' && migratedMonBlock.approvalStatus === undefined,
    'Legacy block loads cleanly without injecting unwanted approvalStatus property'
  );
  assert(
    getEffectiveBlockApprovalStatus(migratedMonBlock) === 'accepted',
    'Legacy block without approvalStatus is treated as accepted'
  );
  assert(
    isBlockScheduleActive(migratedMonBlock) === true,
    'Legacy block without approvalStatus remains active in schedule'
  );

  // ── 5. Cloning & Snapshot Isolation ────────────────────────────────────────
  console.log('\n5. Data Cloning & Snapshot Isolation');

  const richBlock: StructuredDietBlock = sanitiseBlock({
    id: 'blk_rich_1',
    startTime: '13:00',
    endTime: '13:30',
    type: 'Lunch',
    mealType: 'lunch',
    items: ['Salmon'],
    customText: 'Salmon & Rice',
    foodCategories: ['protein', 'complex_carbs'],
    foodSelections: { protein: ['salmon'], complex_carbs: ['rice'] },
    foodQuantities: { 'protein::salmon': { amount: 200, unit: 'gram' } },
    libraryMealId: 'meal_lib_abc123',
    approvalStatus: 'pending',
    imageRef: {
      kind: 'uploaded_photo',
      photoId: 'photo_rich_main',
      photoMeta: { id: 'photo_rich_main', createdAt: '2026-11-21T00:00:00Z', mimeType: 'image/jpeg' },
    },
    alternatives: [
      {
        id: 'alt_1',
        name: 'Turkey & Sweet Potato',
        mealType: 'lunch',
        foodCategories: ['protein', 'complex_carbs'],
        foodSelections: { protein: ['turkey_breast'] },
        libraryMealId: 'meal_lib_turkey',
        imageRef: {
          kind: 'uploaded_photo',
          photoId: 'photo_rich_alt',
        },
      },
    ],
  });

  const allRefIds = getAllBlockReferencedPhotoIds(richBlock);
  assert(
    allRefIds.includes('photo_rich_main') && allRefIds.includes('photo_rich_alt'),
    'getAllBlockReferencedPhotoIds collects both primary and alternative photo IDs'
  );

  const stableClone = cloneBlocks([richBlock])[0];
  assert(
    stableClone.id === richBlock.id &&
      stableClone.libraryMealId === 'meal_lib_abc123' &&
      stableClone.approvalStatus === 'pending' &&
      stableClone.alternatives?.[0]?.id === 'alt_1' &&
      stableClone.imageRef?.photoId === 'photo_rich_main',
    'cloneBlocks preserves stable ID and all Phase 1 fields'
  );

  // Mutate clone and verify original richBlock is untouched
  stableClone.alternatives![0].name = 'MUTATED';
  stableClone.foodQuantities!['protein::salmon'].amount = 999;
  assert(
    richBlock.alternatives![0].name === 'Turkey & Sweet Potato' &&
      richBlock.foodQuantities!['protein::salmon'].amount === 200,
    'cloneBlocks isolates nested alternatives and foodQuantities from mutation'
  );

  const deepClone = deepCloneBlocks([richBlock])[0];
  assert(
    deepClone.id !== richBlock.id &&
      deepClone.alternatives?.[0]?.id !== richBlock.alternatives?.[0]?.id &&
      deepClone.libraryMealId === 'meal_lib_abc123' &&
      deepClone.approvalStatus === 'pending' &&
      deepClone.imageRef?.photoId === 'photo_rich_main' &&
      deepClone.alternatives?.[0]?.imageRef?.photoId === 'photo_rich_alt',
    'deepCloneBlocks generates fresh block & alternative IDs while preserving shared photo IDs'
  );

  // copyDayPlan preserves Phase 1 fields across weekdays
  let copyWeekly = updateDayPlan(loadWeeklyDiet(), 'mon', d => ({ ...d, blocks: [richBlock] }));
  copyWeekly = copyDayPlan(copyWeekly, 'mon', ['tue']);
  const tueBlock = copyWeekly.days.find(d => d.dayKey === 'tue')!.blocks[0];
  assert(
    tueBlock.id !== richBlock.id &&
      tueBlock.libraryMealId === 'meal_lib_abc123' &&
      tueBlock.alternatives?.length === 1,
    'copyDayPlan deep-clones Phase 1 fields to target weekdays cleanly'
  );

  const snapshot = createPlannedBlockSnapshot(richBlock);
  assert(
    snapshot.libraryMealId === 'meal_lib_abc123' &&
      snapshot.approvalStatus === 'pending' &&
      snapshot.alternatives?.length === 1 &&
      snapshot.imageRef?.photoId === 'photo_rich_main',
    'createPlannedBlockSnapshot captures libraryMealId, approvalStatus, alternatives, and imageRef'
  );

  // ── 6. Separation of Pre-Meal Approval vs Post-Meal Verification / Scoring ─
  console.log('\n6. Pre-Meal Approval vs Post-Meal Verification & Scoring Separation');
  resetTestEnvironment();

  const todayDateKey = getLocalDateKey(new Date(2026, 10, 21, 10, 0, 0)); // 2026-11-21 10:00 local
  const todayDayKey = dateKeyToDayKey(todayDateKey);

  const morningAccepted: StructuredDietBlock = sanitiseBlock({
    id: 'blk_today_1',
    startTime: '08:00',
    endTime: '08:30',
    type: 'Breakfast',
    items: ['Eggs'],
    customText: 'Poached Eggs',
    foodCategories: ['protein'],
    // approvalStatus intentionally omitted => legacy accepted
  });

  const middayProposed: StructuredDietBlock = sanitiseBlock({
    id: 'blk_today_2',
    startTime: '12:30',
    endTime: '13:00',
    type: 'Lunch',
    items: ['Chicken'],
    customText: 'Proposed Grilled Chicken',
    foodCategories: ['protein'],
    approvalStatus: 'pending',
    alternatives: [
      {
        id: 'alt_salmon_wrap',
        name: 'Salmon Lettuce Wrap',
        mealType: 'lunch',
        foodCategories: ['protein', 'vegetables'],
        libraryMealId: 'meal_lib_salmon_wrap',
      },
    ],
  });

  const eveningProposed: StructuredDietBlock = sanitiseBlock({
    id: 'blk_today_3',
    startTime: '19:00',
    endTime: '19:30',
    type: 'Dinner',
    items: ['Steak'],
    customText: 'Proposed Steak',
    foodCategories: ['protein'],
    approvalStatus: 'pending',
  });

  const scoreEventsBefore = loadScoreStore().events.length;

  // Reject middayProposed & swap eveningProposed with alternative
  const rejectedMidday = setBlockApprovalStatus(middayProposed, 'rejected');
  const swappedEvening = swapBlockWithAlternative(eveningProposed, {
    id: 'alt_fish_tacos',
    name: 'White Fish Bowl',
    mealType: 'dinner',
    foodCategories: ['protein', 'vegetables'],
    libraryMealId: 'meal_lib_white_fish',
  });

  assert(
    rejectedMidday.approvalStatus === 'rejected' && !isBlockScheduleActive(rejectedMidday),
    'Rejected proposed block has approvalStatus="rejected" and is inactive in schedule'
  );
  assert(
    Boolean(
      swappedEvening.id === eveningProposed.id &&
        swappedEvening.startTime === '19:00' &&
        swappedEvening.approvalStatus === 'modified' &&
        swappedEvening.libraryMealId === 'meal_lib_white_fish' &&
        swappedEvening.alternatives?.some(a => a.name.includes('Proposed Steak'))
    ),
    'swapBlockWithAlternative preserves block ID/time, applies alternative, keeps previous option, and marks modified'
  );
  assert(
    Object.keys(loadAllDietVerifications()).length === 0 &&
      loadSlips().length === 0 &&
      loadScoreStore().events.length === scoreEventsBefore,
    'Rejecting or swapping proposed meals creates ZERO verification entries, ZERO slips, and ZERO XP changes'
  );

  // Persist schedule for todayDateKey and test Home & Practice Loop selectors at 11:00 AM
  let activeDiet = updateDayPlan(loadWeeklyDiet(), todayDayKey, d => ({
    ...d,
    mode: 'structured',
    blocks: [morningAccepted, rejectedMidday, swappedEvening],
  }));
  activeDiet = setDateOverride(activeDiet, todayDateKey, {
    dayKey: todayDayKey,
    dayOfWeek: 5,
    mode: 'structured',
    blocks: [morningAccepted, rejectedMidday, swappedEvening],
  });
  saveWeeklyDiet(activeDiet);

  const nowAt11Am = new Date(2026, 10, 21, 11, 0, 0);
  const homeNext = getNextPlannedBlock(activeDiet.dateOverrides![todayDateKey], 11 * 60);
  assert(
    homeNext !== null && homeNext.block.id === 'blk_today_3',
    'Home getNextPlannedBlock skips rejected 12:30 meal and advances to 19:00 modified meal'
  );

  const loopNext = resolveNextScheduledBlockForDate({ now: nowAt11Am });
  assert(
    loopNext !== null && loopNext.blockId === 'blk_today_3',
    'Practice Loop resolveNextScheduledBlockForDate skips rejected 12:30 meal and resolves 19:00 modified meal'
  );

  const b1Guidance = evaluateBook1PracticeLoopGuidance({ now: nowAt11Am });
  const b2Guidance = evaluateBook2PracticeLoopGuidance({ now: nowAt11Am });
  assert(
    b1Guidance.plannedBlocksCount === 2 && b2Guidance.plannedBlocksCount === 2,
    'Book 1 & Book 2 Practice Loops exclude rejected proposed blocks from active plannedBlocksCount (2 active of 3)'
  );

  // Post-meal verification still works independently on accepted/modified blocks
  const verif = saveBlockVerification({
    plannedBlock: swappedEvening,
    status: 'on-track',
    detailedOutcome: 'on_track',
    dateKey: todayDateKey,
  });
  const statsAfter = getDailyVerificationStats(2, todayDateKey, ['blk_today_1', 'blk_today_3']);
  assert(
    verif.status === 'on-track' &&
      verif.plannedSnapshot.approvalStatus === 'modified' &&
      statsAfter.onTrackCount === 1 &&
      statsAfter.slipCount === 0,
    'Post-meal On Track verification works independently and snapshots pre-meal approval metadata'
  );

  // Clean up test storage
  collectActivePhotoIds({ store: loadDietStore(), verifications: loadAllDietVerifications() });

  console.log('\n======================================================================');
  console.log(` SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
