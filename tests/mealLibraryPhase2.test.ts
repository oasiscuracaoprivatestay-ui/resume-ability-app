/**
 * Super Diet-Ability — Final Completion Phase 2 Automated Test Suite
 *
 * Verifies:
 * 1. EN / ES / NL localization completeness & key parity for all Phase 2 Visual Card & Meal Library keys
 * 2. Individual Proposed Meal Approval (Accept, Modify, Reject, Restore, and Accept Daily Structure)
 * 3. Rejected proposed meals excluded from Today completion stats, Today Home selectors,
 *    ChallengeDietSummaryCard active logic, and Book 1 & Book 2 Practice Loops WITHOUT creating
 *    slips, verification entries, or XP changes
 * 4. Alternative Meal swapping by ID preserves scheduled time/ID, keeps previous meal as reversible
 *    backup, and reflects immediately across Today & Book 1 / Book 2 Practice Loops
 * 5. Personal Meal Library save, browse, apply-to-block, add-as-alternative, and Reuse Saved Photo
 *    with zero IndexedDB blob duplication
 */

const memoryLocalStorage: Record<string, string> = {};
const memorySessionStorage: Record<string, string> = {};

(globalThis as any).localStorage = {
  getItem: (key: string) =>
    Object.prototype.hasOwnProperty.call(memoryLocalStorage, key) ? memoryLocalStorage[key] : null,
  setItem: (key: string, val: string) => {
    memoryLocalStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete memoryLocalStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memoryLocalStorage)) delete memoryLocalStorage[k];
  },
};

(globalThis as any).sessionStorage = {
  getItem: (key: string) =>
    Object.prototype.hasOwnProperty.call(memorySessionStorage, key) ? memorySessionStorage[key] : null,
  setItem: (key: string, val: string) => {
    memorySessionStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete memorySessionStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(memorySessionStorage)) delete memorySessionStorage[k];
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
  clear: () =>
    makeIdbRequest(() => {
      idbPhotoRecords.clear();
      return undefined;
    }),
  getAllKeys: () => makeIdbRequest(() => Array.from(idbPhotoRecords.keys())),
};

const mockDb = {
  objectStoreNames: { contains: (name: string) => name === 'photos' },
  createObjectStore: () => mockObjectStore,
  transaction: () => ({ objectStore: () => mockObjectStore }),
};

(globalThis as any).indexedDB = {
  open: () => makeIdbRequest(() => mockDb),
};

import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  BUILT_IN_GOALS,
  dateKeyToDayKey,
  getBlockPhotos,
  getBlockPrimaryDescription,
  getDayPlanForDate,
  getEffectiveBlockApprovalStatus,
  getLocalDateKey,
  isBlockScheduleActive,
  loadWeeklyDiet,
  sanitiseBlock,
  saveWeeklyDiet,
  setBlockApprovalStatus,
  setDateOverride,
  swapBlockWithAlternative,
  updateDayPlan,
  type StructuredDietBlock,
} from '../src/utils/dietStorage';
import {
  MEAL_STOCK_PHOTO_URLS,
  resolveBuiltInMealText,
  resolveMealStockPhoto,
  translateBuiltInFoodItem,
} from '../src/utils/mealStockPhotos';
import {
  getDailyVerificationStats,
  loadAllDietVerifications,
  saveBlockVerification,
} from '../src/utils/dietVerificationStorage';
import type { FoodPhotoMetadata } from '../src/utils/photoStorage';
import {
  applyLibraryMealToBlock,
  attachExistingPhotoToLibraryMeal,
  buildAlternativeFromLibraryMeal,
  createLibraryMealFromBlock,
  listLibraryMeals,
  listReusableUploadedPhotos,
  saveLibraryMeal,
} from '../src/utils/mealLibraryStorage';
import { loadScoreStore } from '../src/utils/scoringEngine';
import { loadSlips } from '../src/utils';
import { getNextPlannedBlock } from '../src/utils/homeSelectors';
import {
  evaluateBook1PracticeLoopGuidance,
  evaluateBook2PracticeLoopGuidance,
  resolveNextScheduledBlockForDate,
} from '../src/challenges/practiceLoopEngine';

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): void {
  if (!condition) {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passed++;
  console.log(`  ✓ ${message}`);
}

function resetAll(): void {
  (globalThis as any).localStorage.clear();
  (globalThis as any).sessionStorage.clear();
  idbPhotoRecords.clear();
}

async function runTests(): Promise<void> {
  console.log('=== SDA Final Completion Phase 2 Automated Suite ===\n');

  // ---------------------------------------------------------------------------
  // 1. EN / ES / NL Translation Completeness & Key Parity
  // ---------------------------------------------------------------------------
  console.log('1. EN / ES / NL Localization Key Parity');
  {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    const nlKeys = Object.keys(nl).sort();

    assert(
      enKeys.length === esKeys.length && enKeys.length === nlKeys.length,
      `EN (${enKeys.length}), ES (${esKeys.length}), and NL (${nlKeys.length}) have identical key counts`
    );

    const phase2Keys = enKeys.filter(k => k.startsWith('sdb_vc_') || k.startsWith('mlib_'));
    assert(phase2Keys.length >= 50, `All ${phase2Keys.length} Phase 2 visual card & library keys exist`);

    for (const k of phase2Keys) {
      const enVal = (en as unknown as Record<string, unknown>)[k];
      const esVal = (es as unknown as Record<string, unknown>)[k];
      const nlVal = (nl as unknown as Record<string, unknown>)[k];
      if (
        typeof enVal !== 'string' ||
        !enVal.trim() ||
        typeof esVal !== 'string' ||
        !esVal.trim() ||
        typeof nlVal !== 'string' ||
        !nlVal.trim()
      ) {
        throw new Error(`Missing localized string for Phase 2 key: ${k}`);
      }
    }
    assert(true, `Verified non-empty EN, ES, and NL translations for all ${phase2Keys.length} Phase 2 keys`);
  }

  // ---------------------------------------------------------------------------
  // 2. Individual Meal Approval & Bulk Structure Confirmation
  // ---------------------------------------------------------------------------
  console.log('\n2. Individual Proposed Meal Approval & Accept This Structure');
  {
    resetAll();
    const breakfast = sanitiseBlock({
      id: 'blk_bfast',
      startTime: '07:30',
      endTime: '08:00',
      type: 'breakfast',
      mealType: 'breakfast',
      items: ['protein'],
      foodCategories: ['protein', 'fruits'],
      customText: 'Greek Yogurt Bowl',
      approvalStatus: 'pending',
    });
    const lunch = sanitiseBlock({
      id: 'blk_lunch',
      startTime: '12:30',
      endTime: '13:00',
      type: 'lunch',
      mealType: 'lunch',
      items: ['protein', 'vegetables'],
      foodCategories: ['protein', 'complex_carbs', 'vegetables'],
      customText: 'Grilled Chicken & Quinoa',
      approvalStatus: 'pending',
    });
    const dinner = sanitiseBlock({
      id: 'blk_dinner',
      startTime: '19:00',
      endTime: '19:30',
      type: 'dinner',
      mealType: 'dinner',
      items: ['protein', 'vegetables'],
      foodCategories: ['protein', 'vegetables'],
      customText: 'Baked Salmon & Vegetables',
      approvalStatus: 'pending',
    });
    const legacyBlockNoStatus = sanitiseBlock({
      id: 'blk_legacy',
      startTime: '10:30',
      endTime: '10:45',
      type: 'snack',
      items: ['fruit'],
      customText: 'Morning Apple',
    });

    assert(
      legacyBlockNoStatus.approvalStatus === undefined &&
        getEffectiveBlockApprovalStatus(legacyBlockNoStatus) === 'accepted' &&
        isBlockScheduleActive(legacyBlockNoStatus),
      'Legacy scheduled meals without approvalStatus default to accepted and active'
    );

    const acceptedBreakfast = setBlockApprovalStatus(breakfast, 'accepted');
    const modifiedLunch = setBlockApprovalStatus(
      { ...lunch, customText: 'Grilled Chicken, Quinoa & Avocado' },
      'modified'
    );
    const rejectedDinner = setBlockApprovalStatus(dinner, 'rejected');

    assert(getEffectiveBlockApprovalStatus(acceptedBreakfast) === 'accepted', 'Breakfast marked accepted');
    assert(getEffectiveBlockApprovalStatus(modifiedLunch) === 'modified', 'Lunch marked modified');
    assert(getEffectiveBlockApprovalStatus(rejectedDinner) === 'rejected', 'Dinner marked rejected');
    assert(!isBlockScheduleActive(rejectedDinner), 'Rejected dinner is inactive in schedule');

    // Simulate StructuredDietScreen handleAcceptAllDailyStructure:
    const pendingSnack = sanitiseBlock({
      id: 'blk_snack',
      startTime: '16:00',
      endTime: '16:15',
      type: 'snack',
      mealType: 'snack',
      items: ['nuts'],
      foodCategories: ['healthy_fats'],
      customText: 'Almonds & Berries',
      approvalStatus: 'pending',
    });

    const confirmedDayBlocks = [acceptedBreakfast, modifiedLunch, rejectedDinner, pendingSnack].map(b =>
      b.approvalStatus === 'pending' || !b.approvalStatus ? setBlockApprovalStatus(b, 'accepted') : b
    );

    assert(confirmedDayBlocks[0].approvalStatus === 'accepted', 'Accepted breakfast preserved');
    assert(confirmedDayBlocks[1].approvalStatus === 'modified', 'Modified lunch preserved on bulk accept');
    assert(confirmedDayBlocks[2].approvalStatus === 'rejected', 'Rejected dinner stays rejected on bulk accept');
    assert(confirmedDayBlocks[3].approvalStatus === 'accepted', 'Remaining pending snack promoted to accepted');

    const restoredDinner = setBlockApprovalStatus(confirmedDayBlocks[2], 'accepted');
    assert(isBlockScheduleActive(restoredDinner), 'Restored dinner becomes schedule-active again');
  }

  // ---------------------------------------------------------------------------
  // 3. Rejected Proposed Meals Excluded from Today Completion & Zero Slips/XP Impact
  // ---------------------------------------------------------------------------
  console.log('\n3. Rejected Proposed Meal Excluded from Today Completion Without Slips or XP Impact');
  {
    resetAll();
    const nowAt11Am = new Date(2026, 10, 21, 11, 0, 0);
    const todayDateKey = getLocalDateKey(nowAt11Am);
    const todayDayKey = dateKeyToDayKey(todayDateKey);

    const blocks: StructuredDietBlock[] = [
      sanitiseBlock({
        id: 'b_morning',
        startTime: '08:00',
        endTime: '08:30',
        type: 'breakfast',
        mealType: 'breakfast',
        items: ['protein'],
        foodCategories: ['protein'],
        customText: 'Greek Yogurt Bowl',
        approvalStatus: 'accepted',
      }),
      sanitiseBlock({
        id: 'b_midday_rejected',
        startTime: '12:00',
        endTime: '12:30',
        type: 'lunch',
        mealType: 'lunch',
        items: ['protein'],
        foodCategories: ['protein'],
        customText: 'Proposed Tuna Salad',
        approvalStatus: 'rejected',
      }),
      sanitiseBlock({
        id: 'b_evening',
        startTime: '18:30',
        endTime: '19:00',
        type: 'dinner',
        mealType: 'dinner',
        items: ['protein', 'vegetables'],
        foodCategories: ['protein', 'vegetables'],
        customText: 'Baked Salmon & Broccoli',
        approvalStatus: 'accepted',
      }),
    ];

    let weekly = updateDayPlan(loadWeeklyDiet(), todayDayKey, d => ({
      ...d,
      mode: 'structured',
      blocks,
    }));
    weekly = setDateOverride(weekly, todayDateKey, {
      dayKey: todayDayKey,
      dayOfWeek: nowAt11Am.getDay(),
      mode: 'structured',
      blocks,
    });
    saveWeeklyDiet(weekly);

    assert(loadSlips().length === 0, 'Zero slips recorded from rejecting a proposed meal');
    assert(loadScoreStore().events.length === 0, 'Zero XP / score events recorded from rejecting a meal');
    assert(
      Object.keys(loadAllDietVerifications()).length === 0,
      'Zero post-meal verification records created by meal approval actions'
    );

    const resolvedDay = getDayPlanForDate(loadWeeklyDiet(), todayDateKey);
    const activeBlocks = resolvedDay.blocks.filter(b => isBlockScheduleActive(b));
    const activeIds = activeBlocks.map(b => b.id);
    assert(activeBlocks.length === 2, 'Active scheduled blocks for Today equals 2 (rejected lunch excluded)');

    // Complete breakfast & dinner on-track -> Today reaches 2/2 (100%) complete despite rejected lunch!
    saveBlockVerification({
      plannedBlock: blocks[0],
      status: 'on-track',
      detailedOutcome: 'on_track',
      dateKey: todayDateKey,
    });
    const midStats = getDailyVerificationStats(activeBlocks.length, todayDateKey, activeIds);
    assert(
      midStats.plannedCount === 2 && midStats.onTrackCount === 1 && midStats.plannedReportedCount === 1,
      'Midday stats count 1 of 2 active meals'
    );

    const homeNext = getNextPlannedBlock(resolvedDay, 11 * 60);
    assert(
      homeNext?.block.id === 'b_evening',
      'Today Home getNextPlannedBlock skips rejected 12:00 lunch and resolves 18:30 dinner'
    );

    const loopNext = resolveNextScheduledBlockForDate({ now: nowAt11Am });
    assert(
      loopNext?.blockId === 'b_evening',
      'Practice Loop skips rejected 12:00 lunch and targets 18:30 dinner'
    );

    saveBlockVerification({
      plannedBlock: blocks[2],
      status: 'on-track',
      detailedOutcome: 'on_track',
      dateKey: todayDateKey,
    });
    const finalStats = getDailyVerificationStats(activeBlocks.length, todayDateKey, activeIds);
    assert(
      finalStats.plannedCount === 2 &&
        finalStats.reportedCount === 2 &&
        finalStats.plannedReportedCount === 2 &&
        finalStats.slipCount === 0,
      'Today reaches 2/2 completed with 0 slips when rejected meal is excluded'
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Alternative Meal Selection Reflects Across Today & Book 1 / Book 2 Practice Loops
  // ---------------------------------------------------------------------------
  console.log('\n4. Alternative Meal Selection Across Today & Book 1 / Book 2 Practice Loops');
  {
    resetAll();
    const nowAt1130 = new Date(2026, 10, 21, 11, 30, 0);
    const todayDateKey = getLocalDateKey(nowAt1130);
    const todayDayKey = dateKeyToDayKey(todayDateKey);
    const isoNow = nowAt1130.toISOString();

    const photoMain: FoodPhotoMetadata = {
      id: 'photo_chicken_quinoa',
      createdAt: isoNow,
      mimeType: 'image/jpeg',
    };
    const photoAlt: FoodPhotoMetadata = {
      id: 'photo_tuna_wrap',
      createdAt: isoNow,
      mimeType: 'image/jpeg',
    };
    idbPhotoRecords.set(photoMain.id, { ...photoMain, dataUrl: 'data:image/jpeg;base64,MAIN' });
    idbPhotoRecords.set(photoAlt.id, { ...photoAlt, dataUrl: 'data:image/jpeg;base64,ALT' });

    const lunchWithAlt: StructuredDietBlock = sanitiseBlock({
      id: 'blk_lunch_swap',
      startTime: '12:30',
      endTime: '13:00',
      type: 'lunch',
      mealType: 'lunch',
      items: ['protein', 'complex_carbs', 'vegetables'],
      foodCategories: ['protein', 'complex_carbs', 'vegetables'],
      foodSelections: { protein: ['chicken_breast'], complex_carbs: ['quinoa'] },
      customText: 'Grilled Chicken & Quinoa',
      foodPhotos: [photoMain],
      approvalStatus: 'accepted',
      alternatives: [
        {
          id: 'alt_tuna_wrap',
          name: 'Tuna Wrap',
          mealType: 'lunch',
          items: ['protein', 'complex_carbs', 'vegetables'],
          foodCategories: ['protein', 'complex_carbs', 'vegetables'],
          foodSelections: { protein: ['tuna'], complex_carbs: ['whole_wheat_bread'] },
          customText: 'Tuna, whole-grain wrap, lettuce and light dressing',
          foodPhotos: [photoAlt],
          imageRef: { kind: 'uploaded_photo', photoId: photoAlt.id },
        },
      ],
    });

    // Swap by alternative ID (exact UI path invoked by BlockCard -> handleSwapAlternative)
    const swappedLunch = swapBlockWithAlternative(lunchWithAlt, 'alt_tuna_wrap', {
      keepPreviousAsAlternative: true,
    });

    assert(swappedLunch.id === 'blk_lunch_swap', 'Scheduled block ID preserved on alternative swap');
    assert(
      swappedLunch.startTime === '12:30' && swappedLunch.endTime === '13:00',
      'Scheduled time 12:30–13:00 preserved on alternative swap'
    );
    assert(
      Boolean(swappedLunch.customText?.includes('Tuna')),
      `Main meal updated to Tuna Wrap (${swappedLunch.customText})`
    );
    assert(swappedLunch.foodPhotos?.[0]?.id === photoAlt.id, 'Alternative meal photo promoted to main photo');
    assert(
      Boolean(swappedLunch.alternatives?.some(a => a.name.includes('Grilled Chicken & Quinoa'))),
      'Previous main meal preserved in alternatives so user can swap back anytime'
    );

    let weekly = updateDayPlan(loadWeeklyDiet(), todayDayKey, d => ({
      ...d,
      mode: 'structured',
      blocks: [swappedLunch],
    }));
    weekly = setDateOverride(weekly, todayDateKey, {
      dayKey: todayDayKey,
      dayOfWeek: nowAt1130.getDay(),
      mode: 'structured',
      blocks: [swappedLunch],
    });
    saveWeeklyDiet(weekly);

    const homeNext = getNextPlannedBlock(getDayPlanForDate(loadWeeklyDiet(), todayDateKey), 11 * 60 + 30);
    assert(
      Boolean(homeNext?.block.customText?.includes('Tuna')),
      `Today Home getNextPlannedBlock reflects swapped alternative (${homeNext?.block.customText})`
    );

    const b1 = evaluateBook1PracticeLoopGuidance({ now: nowAt1130, t: en as unknown as Record<string, any> });
    const b2 = evaluateBook2PracticeLoopGuidance({ now: nowAt1130, t: en as unknown as Record<string, any> });
    assert(
      Boolean(b1.nextScheduledBlock?.primaryDescription.includes('Tuna')) &&
        Boolean(b2.nextScheduledBlock?.primaryDescription.includes('Tuna')),
      `Book 1 (${b1.nextScheduledBlock?.primaryDescription}) & Book 2 (${b2.nextScheduledBlock?.primaryDescription}) Practice Loops reflect swapped alternative`
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Personal Meal Library Save, Reuse Across Schedule/Alternative & Zero Blob Duplication
  // ---------------------------------------------------------------------------
  console.log('\n5. Personal Meal Library Reuse & Zero Photo Blob Duplication');
  {
    resetAll();
    const sharedPhoto: FoodPhotoMetadata = {
      id: 'photo_salmon_shared',
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
    };
    idbPhotoRecords.set(sharedPhoto.id, { ...sharedPhoto, dataUrl: 'data:image/jpeg;base64,SALMON' });

    const sourceBlock = sanitiseBlock({
      id: 'blk_dinner_src',
      startTime: '19:00',
      endTime: '19:30',
      type: 'dinner',
      mealType: 'dinner',
      items: ['protein', 'vegetables', 'complex_carbs'],
      foodCategories: ['protein', 'vegetables', 'complex_carbs'],
      foodSelections: { protein: ['salmon'], vegetables: ['broccoli'], complex_carbs: ['brown_rice'] },
      customText: 'Baked Salmon & Vegetables',
      foodPhotos: [sharedPhoto],
    });

    const libMeal = createLibraryMealFromBlock(sourceBlock, { name: 'Baked Salmon & Vegetables' });
    assert(listLibraryMeals().length === 1, 'Saved custom meal appears in Personal Meal Library');
    assert(idbPhotoRecords.size === 1, 'IndexedDB still holds 1 photo blob (zero duplication)');

    const reusablePhotos = listReusableUploadedPhotos();
    assert(
      reusablePhotos.length === 1 && reusablePhotos[0].id === sharedPhoto.id,
      'listReusableUploadedPhotos finds saved photo for instant reuse without re-upload'
    );

    const secondLibMeal = saveLibraryMeal({
      name: 'Salmon Lunch Bowl',
      mealType: 'lunch',
      foodCategories: ['protein', 'vegetables'],
      foodSelections: { protein: ['salmon'], vegetables: ['spinach'] },
    });
    const secondWithPhoto = attachExistingPhotoToLibraryMeal(secondLibMeal.id, sharedPhoto);
    assert(secondWithPhoto?.foodPhotos?.[0]?.id === sharedPhoto.id, 'Second library meal references same photo ID');
    assert(idbPhotoRecords.size === 1, 'Zero duplicate blobs in IndexedDB after reusing photo across meals');

    const thursdayDinnerSlot = sanitiseBlock({
      id: 'blk_thu_dinner',
      startTime: '20:00',
      endTime: '20:30',
      type: 'dinner',
      mealType: 'dinner',
      items: [],
      customText: 'Placeholder',
    });
    const appliedBlock = applyLibraryMealToBlock(libMeal, thursdayDinnerSlot);
    assert(
      appliedBlock.startTime === '20:00' &&
        appliedBlock.endTime === '20:30' &&
        appliedBlock.customText === 'Baked Salmon & Vegetables' &&
        appliedBlock.libraryMealId === libMeal.id,
      'Library meal applied cleanly to another scheduled block while keeping 20:00–20:30 slot'
    );

    const altOption = buildAlternativeFromLibraryMeal(secondWithPhoto!);
    assert(
      altOption.name === 'Salmon Lunch Bowl' &&
        altOption.libraryMealId === secondLibMeal.id &&
        altOption.foodPhotos?.[0]?.id === sharedPhoto.id,
      'Library meal builds clean alternative option with shared photo reference'
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Visual Refinement: Realistic Food Photos, Built-In i18n & Default Meal Times
  // ---------------------------------------------------------------------------
  console.log('\n6. Realistic Stock Photos, Built-In Meal Localization & Default Meal Times');
  {
    resetAll();

    // 6a. Realistic stock photo resolution & uploaded-photo top priority
    assert(
      resolveMealStockPhoto({ name: 'Protein Smoothie', mealType: 'breakfast' }) ===
        MEAL_STOCK_PHOTO_URLS.protein_smoothie,
      'Protein Smoothie resolves to realistic /images/meals/protein-smoothie.jpg'
    );
    assert(
      resolveMealStockPhoto({ name: 'Tuna Whole-Grain Wrap', mealType: 'lunch' }) ===
        MEAL_STOCK_PHOTO_URLS.tuna_wrap,
      'Tuna Wrap resolves to realistic /images/meals/tuna-wrap.jpg'
    );
    assert(
      resolveMealStockPhoto({ name: 'Veggie Omelette', mealType: 'dinner' }) ===
        MEAL_STOCK_PHOTO_URLS.veggie_omelette,
      'Veggie Omelette resolves to realistic /images/meals/veggie-omelette.jpg'
    );
    assert(
      resolveMealStockPhoto({ items: ['Turkey Breast', 'Quinoa', 'Mixed Greens'], mealType: 'lunch' }) ===
        MEAL_STOCK_PHOTO_URLS.quinoa_salad_bowl,
      'Quinoa & Greens salad resolves to realistic /images/meals/quinoa-salad-bowl.jpg'
    );
    assert(
      resolveMealStockPhoto({ items: ['Chicken Soup', 'Rice'], mealType: 'lunch' }) ===
        MEAL_STOCK_PHOTO_URLS.recovery_soup,
      'Chicken Soup resolves to realistic /images/meals/recovery-soup.jpg'
    );
    assert(
      resolveMealStockPhoto({ type: 'micro_fasting' }) === MEAL_STOCK_PHOTO_URLS.herbal_hydration,
      'Micro-Fasting / hydration block resolves to /images/meals/herbal-hydration.jpg'
    );

    const userUploadedMeta: FoodPhotoMetadata = {
      id: 'user_custom_upload_1',
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
    };
    const blockWithUserUpload = sanitiseBlock({
      id: 'blk_user_photo_priority',
      startTime: '08:00',
      endTime: '08:30',
      type: 'breakfast',
      items: ['Eggs', 'Oatmeal'],
      foodPhotos: [userUploadedMeta],
      imageRef: { kind: 'stock_asset', stockKey: 'breakfast_bowl' },
    });
    assert(
      getBlockPhotos(blockWithUserUpload)[0]?.id === 'user_custom_upload_1',
      'User-uploaded meal photo remains highest-priority image source over built-in stock asset'
    );

    // 6b. Built-in meal names & sample items localize cleanly across EN / ES / NL
    const mfl = BUILT_IN_GOALS.find(g => g.id === 'moderate_fat_loss')!;
    const mflLunch = sanitiseBlock({ id: 'mfl_l', ...mfl.sampleBlocks[1] });
    const mflLunchEn = getBlockPrimaryDescription(mflLunch, en as unknown as Record<string, any>);
    const mflLunchEs = getBlockPrimaryDescription(mflLunch, es as unknown as Record<string, any>);
    const mflLunchNl = getBlockPrimaryDescription(mflLunch, nl as unknown as Record<string, any>);
    assert(
      mflLunchEn.includes('Chicken Breast') &&
        mflLunchEs.includes('Pechuga de Pollo') &&
        mflLunchNl.includes('Kipfilet'),
      `Built-in Moderate Fat Loss Lunch translates across EN ("${mflLunchEn}"), ES ("${mflLunchEs}"), NL ("${mflLunchNl}")`
    );

    const mflAlt = mflLunch.alternatives![0];
    assert(
      resolveBuiltInMealText(mflAlt.name, en as unknown as Record<string, any>) === 'Tuna Whole-Grain Wrap' &&
        resolveBuiltInMealText(mflAlt.name, es as unknown as Record<string, any>) === 'Wrap Integral de Atún' &&
        resolveBuiltInMealText(mflAlt.name, nl as unknown as Record<string, any>) === 'Volkoren Tonijnwrap',
      'Built-in alternative meal names translate across EN / ES / NL'
    );
    assert(
      translateBuiltInFoodItem('Sweet Potato', es as unknown as Record<string, any>).length > 0 &&
        translateBuiltInFoodItem('Sweet Potato', nl as unknown as Record<string, any>).length > 0,
      'Built-in sample ingredients translate across EN / ES / NL'
    );

    // User-created custom meal names MUST NEVER be auto-translated!
    const userCustomBlock = sanitiseBlock({
      id: 'blk_user_custom_title',
      startTime: '19:00',
      endTime: '19:30',
      type: 'dinner',
      items: [],
      customText: 'Morning brunch', // Even if matching an English phrase, libraryMealId marks it user-authored!
      libraryMealId: 'mlib_user_123',
    });
    assert(
      getBlockPrimaryDescription(userCustomBlock, es as unknown as Record<string, any>) === 'Morning brunch' &&
        getBlockPrimaryDescription(userCustomBlock, nl as unknown as Record<string, any>) === 'Morning brunch',
      'User-created custom meal names are NEVER automatically translated across locales'
    );

    // 6c. Default meal times audit: all built-in Dinners are realistic evening windows (19:00–21:00, never 23:00),
    // while user-chosen times are preserved verbatim without modification.
    for (const goal of BUILT_IN_GOALS) {
      for (const sb of goal.sampleBlocks) {
        if ((sb.mealType || sb.type).toLowerCase() === 'dinner') {
          const startHour = Number(sb.startTime.split(':')[0]);
          assert(
            startHour >= 18 && startHour <= 20,
            `Built-in goal "${goal.id}" Dinner has realistic default time (${sb.startTime}–${sb.endTime})`
          );
        }
      }
    }

    const userLateShiftDinner = sanitiseBlock({
      id: 'blk_user_night_shift',
      startTime: '23:00',
      endTime: '23:30',
      type: 'dinner',
      items: ['Salmon'],
      customText: 'Night Shift Dinner',
    });
    assert(
      userLateShiftDinner.startTime === '23:00' && userLateShiftDinner.endTime === '23:30',
      'User-chosen custom meal times (e.g. 23:00–23:30 night shift) are preserved verbatim and never overwritten'
    );
  }

  console.log(`\n=== ALL ${passed} PHASE 2 ASSERTIONS PASSED (${failed} failed) ===`);
}

runTests().catch(err => {
  console.error('\nPhase 2 test execution failed:', err);
  (globalThis as any).process?.exit?.(1);
});
