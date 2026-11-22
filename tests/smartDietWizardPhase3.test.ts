/**
 * Super Diet-Ability — Final Completion Phase 3 Automated Test Suite
 * Smart Structured Diet Wizard (Engine, Persistence, Overnight Routine, Restrictions,
 * Library/Photo Reuse, Individual Review, Safe Saving, EN/ES/NL Parity & Loop Sync)
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
  getActiveProfile,
  getDayPlan,
  getDayPlanForDate,
  getLocalDateKey,
  loadDietStore,
  loadWeeklyDiet,
  saveWeeklyDiet,
  setActiveProfile,
  setBlockApprovalStatus,
  snapshotHistoryDate,
  swapBlockWithAlternative,
} from '../src/utils/dietStorage';
import { loadAllDietVerifications } from '../src/utils/dietVerificationStorage';
import type { FoodPhotoMetadata } from '../src/utils/photoStorage';
import { isPhotoReferenced } from '../src/utils/photoStorage';
import { saveLibraryMeal } from '../src/utils/mealLibraryStorage';
import { resolveBuiltInMealText, resolveMealStockPhoto } from '../src/utils/mealStockPhotos';
import {
  SMART_WIZARD_STORAGE_KEY,
  applyWizardPlanSafely,
  computeDefaultSlotsForRoutine,
  createDefaultWizardProfile,
  generatePersonalizedWizardPlan,
  isOvernightWakeSleep,
  loadSmartWizardProfile,
  saveSmartWizardProfile,
  summarizeWizardApprovals,
  validateRoutineSlots,
} from '../src/utils/smartDietWizardEngine';
import { loadSlips } from '../src/utils';
import { loadScoreStore } from '../src/utils/scoringEngine';
import { getNextPlannedBlock } from '../src/utils/homeSelectors';
import {
  evaluateBook1PracticeLoopGuidance,
  evaluateBook2PracticeLoopGuidance,
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
  console.log('=== SDA Final Completion Phase 3: Smart Diet Wizard Test Suite ===\n');

  // ---------------------------------------------------------------------------
  // 1. EN / ES / NL Translation Parity for All Phase 3 Wizard Keys
  // ---------------------------------------------------------------------------
  console.log('1. EN / ES / NL Wizard Localization Parity');
  {
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es).sort();
    const nlKeys = Object.keys(nl).sort();
    assert(
      enKeys.length === esKeys.length && enKeys.length === nlKeys.length,
      `EN (${enKeys.length}), ES (${esKeys.length}), and NL (${nlKeys.length}) have identical key counts`
    );

    const wizKeys = enKeys.filter(k => k.startsWith('wiz_'));
    assert(wizKeys.length >= 165, `All ${wizKeys.length} Phase 3 Smart Wizard keys exist`);
    for (const k of wizKeys) {
      const ev = (en as unknown as Record<string, unknown>)[k];
      const sv = (es as unknown as Record<string, unknown>)[k];
      const nv = (nl as unknown as Record<string, unknown>)[k];
      if (
        typeof ev !== 'string' ||
        !ev.trim() ||
        typeof sv !== 'string' ||
        !sv.trim() ||
        typeof nv !== 'string' ||
        !nv.trim()
      ) {
        throw new Error(`Empty translation for Wizard key: ${k}`);
      }
    }
    assert(true, `Verified non-empty EN, ES, and NL translations for all ${wizKeys.length} Wizard keys`);
  }

  // ---------------------------------------------------------------------------
  // 2. Wizard Preference Persistence & Corruption Recovery
  // ---------------------------------------------------------------------------
  console.log('\n2. Preference Persistence & Corruption Recovery');
  {
    resetAll();
    const def = createDefaultWizardProfile();
    def.preferences.proteins = ['fish', 'plant_based'];
    def.preferences.carbs = ['quinoa', 'oats'];
    def.preferences.restrictions = ['dairy_free', 'nut_free'];
    def.preferences.foodsToAvoid = 'mushrooms, shellfish';
    def.preferences.customPreferencesNote = 'Prefer warm dinners';
    def.foodAccess = ['meal_prep', 'bring_to_work'];
    def.lastStep = 3;

    saveSmartWizardProfile(def);
    const reloaded = loadSmartWizardProfile();
    assert(
      JSON.stringify(reloaded.preferences.proteins) === JSON.stringify(['fish', 'plant_based']) &&
        reloaded.preferences.foodsToAvoid === 'mushrooms, shellfish' &&
        reloaded.lastStep === 3,
      'Wizard preferences, food access, and step state persist and reload accurately'
    );

    (globalThis as any).localStorage.setItem(SMART_WIZARD_STORAGE_KEY, '{broken_json');
    const recovered = loadSmartWizardProfile();
    assert(
      recovered.routine.mealCount === 3 && recovered.foodAccess.length > 0,
      'Wizard loader recovers safely from corrupted localStorage JSON'
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Daily Routine Validation, Meal Counts & Overnight Shift Support
  // ---------------------------------------------------------------------------
  console.log('\n3. Daily Routine Non-Overlap Validation & Overnight Schedule Support');
  {
    for (const cnt of [2, 3, 4, 5] as const) {
      const slots = computeDefaultSlotsForRoutine('06:30', '22:30', cnt, 'work');
      const v = validateRoutineSlots(slots, '06:30');
      assert(slots.length === cnt && v.valid, `Daytime ${cnt}-meal schedule spaces cleanly with zero overlaps`);
    }

    // Overnight / night-shift worker: wakes 18:00, sleeps 08:00 next morning
    assert(isOvernightWakeSleep('18:00', '08:00'), 'Detects overnight 18:00 -> 08:00 wake/sleep schedule');
    const nightSlots = computeDefaultSlotsForRoutine('18:00', '08:00', 4, 'work');
    const nightValid = validateRoutineSlots(nightSlots, '18:00');
    assert(
      nightSlots.length === 4 && nightValid.valid,
      `Overnight shift schedule generates 4 non-overlapping meals across midnight (${nightSlots
        .map(s => `${s.startTime}-${s.endTime}`)
        .join(', ')})`
    );

    // Overlapping slots must be rejected
    const overlapping = [
      { id: 's1', mealType: 'breakfast' as const, startTime: '08:00', endTime: '08:45', location: 'home' as const },
      { id: 's2', mealType: 'lunch' as const, startTime: '08:30', endTime: '09:00', location: 'work' as const },
    ];
    const ovCheck = validateRoutineSlots(overlapping, '06:30');
    assert(
      !ovCheck.valid && ovCheck.overlappingIndices !== null,
      'validateRoutineSlots detects and blocks overlapping meal windows'
    );

    // Zero-duration invalid slot must be rejected
    const zeroDur = [
      { id: 's1', mealType: 'lunch' as const, startTime: '12:30', endTime: '12:30', location: 'work' as const },
    ];
    assert(!validateRoutineSlots(zeroDur, '06:30').valid, 'validateRoutineSlots rejects zero-duration meal block');
  }

  // ---------------------------------------------------------------------------
  // 4. Meal Generation: Restrictions, Library Reuse, Photos & Weekend Rhythm
  // ---------------------------------------------------------------------------
  console.log('\n4. Personalized Meal Generation, Restrictions, Library Photo Reuse & Weekend Modes');
  {
    resetAll();
    const userPhoto: FoodPhotoMetadata = {
      id: 'wiz_user_photo_1',
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
    };
    idbPhotoRecords.set(userPhoto.id, { ...userPhoto, dataUrl: 'data:image/jpeg;base64,USER_TOFU' });

    const savedVeganLunch = saveLibraryMeal({
      name: 'Homemade Lemon Quinoa Bowl',
      mealType: 'lunch',
      foodCategories: ['protein', 'complex_carbs', 'vegetables'],
      foodSelections: { protein: ['tofu'], complex_carbs: ['quinoa'], vegetables: ['spinach'] },
      foodPhotos: [userPhoto],
      isFavorite: true,
    });

    const p = createDefaultWizardProfile();
    p.preferences.proteins = ['plant_based'];
    p.preferences.carbs = ['quinoa', 'oats'];
    p.preferences.restrictions = ['vegetarian', 'dairy_free', 'gluten_free', 'nut_free'];
    p.preferences.foodsToAvoid = 'tomato';
    p.routine.mealCount = 4;
    p.routine.slots = computeDefaultSlotsForRoutine('07:00', '22:30', 4, 'work');
    p.routine.weekendMode = 'later_shifted';
    p.routine.includeOvernightFastingWindow = true;
    p.foodAccess = ['meal_prep', 'bring_to_work'];

    const plan = generatePersonalizedWizardPlan(p);
    assert(
      plan.weekdayBlocks.length === 5,
      '4 meals + overnight kitchen_closed window generates 5 proposed blocks'
    );
    assert(
      plan.weekdayBlocks.every(b => b.approvalStatus === 'pending'),
      'All generated Wizard blocks start in pending review status'
    );

    // Lunch should reuse user's matching vegan/GF/DF/NF Personal Meal Library entry & its uploaded photo!
    const proposedLunch = plan.weekdayBlocks[1];
    assert(
      proposedLunch.libraryMealId === savedVeganLunch.id &&
        proposedLunch.foodPhotos?.[0]?.id === userPhoto.id &&
        idbPhotoRecords.size === 1,
      'Wizard reuses matching Personal Meal Library meal and shared IndexedDB photo with zero blob duplication'
    );

    // Check strict restriction compliance across all generated meals
    for (const blk of plan.weekdayBlocks) {
      if (blk.type === 'kitchen_closed') continue;
      const joined = JSON.stringify(blk).toLowerCase();
      assert(
        !joined.includes('chicken') &&
          !joined.includes('salmon') &&
          !joined.includes('beef') &&
          !joined.includes('greek_yogurt') &&
          !joined.includes('almonds') &&
          !joined.includes('whole_grain_bread') &&
          !joined.includes('tomato'),
        `Generated block "${blk.customText}" strictly respects vegetarian + DF + GF + NF + avoided "tomato"`
      );
      assert(
        resolveMealStockPhoto(blk).startsWith('/images/meals/'),
        `Generated block "${blk.customText}" has realistic stock photography fallback`
      );
      assert(
        Boolean(blk.alternatives && blk.alternatives.length > 0 && blk.accessSuitability),
        `Generated block "${blk.customText}" includes backup option and food access suitability (${blk.accessSuitability})`
      );
    }

    assert(
      plan.weekendBlocks[0].startTime !== plan.weekdayBlocks[0].startTime,
      `Later-shifted weekend mode shifts weekend meal times (${plan.weekdayBlocks[0].startTime} -> ${plan.weekendBlocks[0].startTime})`
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Individual Meal Review + Safe Saving (New Profile, Today Only, Selected Weekdays)
  //    + Existing Plan Preservation + Today & Book 1 / Book 2 Synchronization
  // ---------------------------------------------------------------------------
  console.log('\n5. Individual Meal Review, Safe Saving & Today / Book 1 / Book 2 Sync');
  {
    resetAll();
    // Seed existing user plan + historical snapshot + user photo to verify 100% preservation!
    const existingPhoto: FoodPhotoMetadata = {
      id: 'existing_plan_photo',
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg',
    };
    idbPhotoRecords.set(existingPhoto.id, { ...existingPhoto, dataUrl: 'data:image/jpeg;base64,ORIG' });

    let origWeekly = loadWeeklyDiet();
    origWeekly.days[0].blocks[0].customText = 'User Existing Monday Breakfast';
    origWeekly.days[0].blocks[0].foodPhotos = [existingPhoto];
    origWeekly = snapshotHistoryDate(origWeekly, '2026-11-15', origWeekly.days[0]);
    saveWeeklyDiet(origWeekly);
    const origProfileId = getActiveProfile(loadDietStore()).id;

    // Generate a 3-meal Wizard plan: Accept #1, Swap Backup on #2 (Modified), Reject #3
    const prof = createDefaultWizardProfile();
    const generated = generatePersonalizedWizardPlan(prof);
    const reviewed = [...generated.weekdayBlocks];
    reviewed[0] = { ...setBlockApprovalStatus(reviewed[0], 'accepted'), accessSuitability: reviewed[0].accessSuitability };
    reviewed[1] = {
      ...swapBlockWithAlternative(reviewed[1], reviewed[1].alternatives![0].id, {
        keepPreviousAsAlternative: true,
        nextApprovalStatus: 'modified',
      }),
      accessSuitability: reviewed[1].accessSuitability,
    };
    reviewed[2] = { ...setBlockApprovalStatus(reviewed[2], 'rejected'), accessSuitability: reviewed[2].accessSuitability };

    const summary = summarizeWizardApprovals(reviewed);
    assert(
      summary.acceptedCount === 1 &&
        summary.modifiedCount === 1 &&
        summary.rejectedCount === 1 &&
        summary.pendingCount === 0,
      'summarizeWizardApprovals tracks Accepted (1), Modified (1), Rejected (1), Pending (0)'
    );

    // 5a. Safe Save Mode 1: Save as New Custom Structure Goal Profile
    const newProfRes = applyWizardPlanSafely({
      destination: 'new_profile',
      weekdayBlocks: reviewed,
      weekendBlocks: generated.weekendBlocks,
      weekendMode: 'same_as_weekdays',
      profileName: 'Workday Smart Structure',
    });

    assert(
      newProfRes.destination === 'new_profile' && newProfRes.savedBlocksCount === 2,
      'Saved new custom profile with 2 active blocks (rejected 3rd meal omitted cleanly)'
    );
    assert(
      loadSlips().length === 0 &&
        loadScoreStore().events.length === 0 &&
        Object.keys(loadAllDietVerifications()).length === 0,
      'Saving Wizard structure with a rejected meal creates ZERO slips, ZERO verifications, and ZERO XP penalties'
    );

    // Verify original profile & its historical snapshot + uploaded photo were NEVER overwritten!
    const storeAfterNew = loadDietStore();
    const origProfileStillIntact = storeAfterNew.profiles.find(p => p.id === origProfileId)!;
    assert(
      origProfileStillIntact.diet.days[0].blocks[0].customText === 'User Existing Monday Breakfast' &&
        Boolean(origProfileStillIntact.diet.historySnapshots?.['2026-11-15']) &&
        isPhotoReferenced('existing_plan_photo', storeAfterNew, loadAllDietVerifications()),
      'Original Moderate Fat Loss plan, historical snapshot, and uploaded photo remain 100% untouched'
    );

    // Verify Today & Book 1 / Book 2 Practice Loops synchronize immediately with the new active profile!
    const nowAt10Am = new Date(2026, 10, 22, 10, 0, 0);
    const todayKey = getLocalDateKey(nowAt10Am);
    const homeNext = getNextPlannedBlock(getDayPlanForDate(loadWeeklyDiet(), todayKey), 10 * 60);
    const b1 = evaluateBook1PracticeLoopGuidance({ now: nowAt10Am, t: en as unknown as Record<string, any> });
    const b2 = evaluateBook2PracticeLoopGuidance({ now: nowAt10Am, t: en as unknown as Record<string, any> });
    assert(
      homeNext !== null &&
        b1.plannedBlocksCount === 2 &&
        b2.plannedBlocksCount === 2 &&
        b1.nextScheduledBlock?.startTime === '12:30',
      'Today Home & Book 1 / Book 2 Practice Loops synchronize immediately with saved 2-meal Wizard plan'
    );

    // 5b. Switch back to original profile and test Safe Save Mode 2: Today Only
    setActiveProfile(origProfileId);
    const todayRes = applyWizardPlanSafely({
      destination: 'today_only',
      weekdayBlocks: reviewed,
      todayDateKey: '2026-11-22',
    });
    const afterTodayOnly = loadWeeklyDiet();
    assert(
      todayRes.destination === 'today_only' &&
        afterTodayOnly.dateOverrides?.['2026-11-22']?.blocks.length === 2 &&
        afterTodayOnly.days[0].blocks[0].customText === 'User Existing Monday Breakfast',
      'Apply to Today Only sets dateOverride for Today while leaving recurring weekday templates untouched'
    );

    // 5c. Test Safe Save Mode 3: Selected Weekdays Only (e.g. Tue & Thu)
    applyWizardPlanSafely({
      destination: 'selected_weekdays',
      weekdayBlocks: reviewed,
      selectedWeekdays: ['tue', 'thu'],
      alsoApplyToToday: false,
    });
    const afterSelected = loadWeeklyDiet();
    assert(
      getDayPlan(afterSelected, 'tue').blocks.length === 2 &&
        getDayPlan(afterSelected, 'thu').blocks.length === 2 &&
        getDayPlan(afterSelected, 'mon').blocks[0].customText === 'User Existing Monday Breakfast' &&
        getDayPlan(afterSelected, 'wed').blocks.length === 4,
      'Apply to Selected Weekdays updates only Tue & Thu while preserving Mon, Wed, Fri, Sat, Sun'
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Phase 3 Final Visual Polish: Dish-Accurate Photos & Built-In Localization
  // ---------------------------------------------------------------------------
  console.log('\n6. Dish-Accurate Photography & Built-In vs Custom Meal Localization');
  {
    assert(
      resolveMealStockPhoto({ customText: 'wiz_meal_overnight_oats', items: ['Oatmeal', 'Berries'] }) ===
        '/images/meals/overnight-oats.jpg',
      'Berry & Seed Overnight Oats resolves strictly to /images/meals/overnight-oats.jpg (not eggs/avocado)'
    );
    assert(
      resolveMealStockPhoto({ customText: 'sdb_builtin_ex_greek_yogurt_bowl', items: ['Greek Yogurt', 'Oatmeal', 'Berries'] }) ===
        '/images/meals/greek-yogurt-bowl.jpg',
      'Greek Yogurt Bowl resolves strictly to /images/meals/greek-yogurt-bowl.jpg'
    );
    assert(
      resolveMealStockPhoto({ customText: 'wiz_meal_avocado_egg_toast', items: ['Eggs', 'Avocado', 'Whole Wheat Bread'] }) ===
        '/images/meals/avocado-egg-toast.jpg',
      'Eggs & Avocado Whole-Grain Plate resolves strictly to /images/meals/avocado-egg-toast.jpg'
    );
    assert(
      resolveMealStockPhoto({ foodSelections: { protein: ['tofu'], complex_carbs: ['quinoa'] } }) ===
        '/images/meals/plant-tofu-quinoa-bowl.jpg',
      'Plant-based Tofu & Quinoa meals resolve strictly to /images/meals/plant-tofu-quinoa-bowl.jpg (no meat/cheese)'
    );
    assert(
      resolveMealStockPhoto({ foodSelections: { protein: ['beef'], complex_carbs: ['sweet_potato'] } }) ===
        '/images/meals/beef-sweet-potato.jpg',
      'Lean Beef, Sweet Potato & Green Beans resolves strictly to /images/meals/beef-sweet-potato.jpg'
    );
    assert(
      resolveMealStockPhoto({ foodSelections: { protein: ['fish'], vegetables: ['asparagus', 'zucchini'] } }) ===
        '/images/meals/white-fish-greens.jpg',
      'Baked White Fish & Steamed Vegetables resolves strictly to /images/meals/white-fish-greens.jpg'
    );
    assert(
      resolveMealStockPhoto({ foodSelections: { fruits: ['apple', 'berries'], vegetables: ['cucumber'], healthy_fats: ['seeds'] } }) ===
        '/images/meals/fresh-fruit-veggie-snack.jpg',
      'Nut-free Fresh Fruit & Crisp Veggie Snack resolves strictly to /images/meals/fresh-fruit-veggie-snack.jpg'
    );

    // Built-in Chef's Grilled Chicken & Quinoa Bowl translates cleanly across EN / ES / NL
    assert(
      resolveBuiltInMealText('wiz_meal_chefs_chicken_quinoa', en as any) ===
        "Chef's Grilled Chicken & Quinoa Bowl" &&
        resolveBuiltInMealText('wiz_meal_chefs_chicken_quinoa', es as any) ===
          'Bol del Chef de Pollo a la Plancha y Quinua' &&
        resolveBuiltInMealText('wiz_meal_chefs_chicken_quinoa', nl as any) ===
          'Gegrilde Kip- & Quinoakom van de Chef',
      "Built-in Chef's Grilled Chicken & Quinoa Bowl localizes across EN, ES, and NL"
    );
    assert(
      resolveBuiltInMealText("Chef's Grilled Chicken & Quinoa Bowl", es as any, {
        isUserCustomMeal: false,
      }) === 'Bol del Chef de Pollo a la Plancha y Quinua' &&
        resolveBuiltInMealText("Chef's Grilled Chicken & Quinoa Bowl", nl as any, {
          isUserCustomMeal: false,
        }) === 'Gegrilde Kip- & Quinoakom van de Chef',
      "Legacy built-in English title Chef's Grilled Chicken & Quinoa Bowl translates when not a user custom meal"
    );
    assert(
      resolveBuiltInMealText('wiz_meal_overnight_oats', nl as any) ===
        'Koude Havermout met Bessen & Zaden',
      'Dutch overnight oats title uses natural Dutch ("Koude Havermout met Bessen & Zaden")'
    );
    assert(
      resolveBuiltInMealText('My Custom Homemade Sunday Bowl', es as any, {
        isUserCustomMeal: true,
      }) === 'My Custom Homemade Sunday Bowl' &&
        resolveBuiltInMealText('My Custom Homemade Sunday Bowl', nl as any, {
          isUserCustomMeal: true,
        }) === 'My Custom Homemade Sunday Bowl',
      'User-created custom meal names are preserved verbatim in their original language'
    );
  }

  console.log(`\n=== ALL ${passed} PHASE 3 WIZARD ASSERTIONS PASSED (${failed} failed) ===`);
}

runTests().catch(err => {
  console.error('\nPhase 3 Wizard test execution failed:', err);
  (globalThis as any).process?.exit?.(1);
});
