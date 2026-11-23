/**
 * Super Diet-Ability — Alternative Food or Beverage Field Verification Suite
 *
 * Verifies:
 * 1. Saving a scheduled meal/beverage WITHOUT an alternative (optional).
 * 2. Saving a scheduled meal/beverage WITH an alternative (both saved on same block; primary never overwritten).
 * 3. Persistence across reload (`saveWeeklyDiet` -> `loadWeeklyDiet` / `getDayPlanForDate` / `createPlannedBlockSnapshot`).
 * 4. Existing legacy meal entries without an alternative continue working normally.
 * 5. Editing or removing the alternative without deleting the primary meal or time block.
 * 6. Future Smart Structured Diet Wizard reusability (`alternativeText` <-> `alternatives` synchronization).
 * 7. EN / ES / NL localization parity and Practice Loop (`resolveNextScheduledBlockForDate`) integration.
 */

import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  applyAlternativeTextToBlock,
  cloneBlocks,
  createCustomProfile,
  deepCloneBlocks,
  generateBlockId,
  getBlockAlternativeDescription,
  getBlockPrimaryDescription,
  getDayPlanForDate,
  getLocalDateKey,
  getLocalTodayKey,
  loadDietStore,
  loadWeeklyDiet,
  removeBlockAlternative,
  sanitiseBlock,
  saveWeeklyDiet,
  setActiveProfile,
  swapBlockWithAlternative,
  updateDatePlan,
  updateDayPlan,
  type StructuredDietBlock,
} from '../src/utils/dietStorage';
import { createPlannedBlockSnapshot } from '../src/utils/dietVerificationStorage';
import { resolveNextScheduledBlockForDate } from '../src/challenges/practiceLoopEngine';

// Minimal localStorage / sessionStorage / window shim
const lsMap = new Map<string, string>();
const ssMap = new Map<string, string>();

const makeStorage = (map: Map<string, string>): Storage => ({
  get length() {
    return map.size;
  },
  clear() {
    map.clear();
  },
  getItem(key: string) {
    return map.has(key) ? map.get(key)! : null;
  },
  key(index: number) {
    return Array.from(map.keys())[index] ?? null;
  },
  removeItem(key: string) {
    map.delete(key);
  },
  setItem(key: string, value: string) {
    map.set(key, String(value));
  },
});

(globalThis as any).localStorage = makeStorage(lsMap);
(globalThis as any).sessionStorage = makeStorage(ssMap);
(globalThis as any).window = {
  localStorage: (globalThis as any).localStorage,
  sessionStorage: (globalThis as any).sessionStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, opts?: any) {
    this.type = type;
    this.detail = opts?.detail;
  }
};

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  passed++;
  console.log(`  ✓ ${msg}`);
}

console.log('\n=== SDA Main App — Alternative Food or Beverage Field Suite ===\n');

// 1. Localization Verification
console.log('1. EN / ES / NL Localization & Exact Copy Verification');
assert(
  Object.keys(en).length === Object.keys(es).length &&
    Object.keys(en).length === Object.keys(nl).length,
  `Dictionary key parity preserved across EN (${Object.keys(en).length}), ES (${Object.keys(es).length}), NL (${Object.keys(nl).length})`
);
assert(
  en.next_action_alt_meal_label === 'Alternative Food or Beverage (Optional)',
  `EN label matches exact specification: "${en.next_action_alt_meal_label}"`
);
assert(
  en.next_action_alt_meal_placeholder === 'e.g., Plain water instead of coconut water',
  `EN placeholder matches exact specification: "${en.next_action_alt_meal_placeholder}"`
);
assert(
  en.next_action_alt_meal_hint ===
    'Choose a backup option in case your planned food or beverage is unavailable.',
  `EN helper text matches exact specification: "${en.next_action_alt_meal_hint}"`
);
assert(
  en.meal_planned_prefix === 'Planned:' && en.meal_alternative_prefix === 'Alternative:',
  'EN Planned/Alternative prefixes verified'
);
assert(
  Boolean(es.next_action_alt_meal_label && es.next_action_alt_meal_placeholder && es.next_action_alt_meal_hint) &&
    Boolean(nl.next_action_alt_meal_label && nl.next_action_alt_meal_placeholder && nl.next_action_alt_meal_hint),
  'ES and NL translations present and non-empty'
);

// 2. Saving WITHOUT an Alternative (Optional) & Legacy Entry Compatibility
console.log('\n2. Saving Without an Alternative & Existing Entry Compatibility');
const legacyBlock: StructuredDietBlock = {
  id: generateBlockId(),
  startTime: '08:00',
  endTime: '08:30',
  type: 'Breakfast',
  items: ['eggs', 'spinach'],
  customText: 'Scrambled Eggs & Spinach',
  foodCategories: ['proteins', 'vegetables'],
};
const savedNoAlt = applyAlternativeTextToBlock(legacyBlock, '   ');
assert(
  savedNoAlt.customText === 'Scrambled Eggs & Spinach' &&
    savedNoAlt.alternativeText === undefined &&
    savedNoAlt.alternatives === undefined &&
    getBlockAlternativeDescription(savedNoAlt, en) === '',
  'Meal saved without alternative keeps alternativeText undefined and primary intact'
);
assert(
  getBlockPrimaryDescription(legacyBlock, en) === 'Scrambled Eggs & Spinach' &&
    getBlockAlternativeDescription(legacyBlock, en) === '',
  'Existing entries without an alternative continue working normally'
);

// 3. Saving WITH an Alternative & Reload Persistence
console.log('\n3. Saving With an Alternative & Reload Persistence');
lsMap.clear();
const todayDateKey = getLocalDateKey();
const todayDayKey = getLocalTodayKey();
const initialDiet = loadWeeklyDiet();
const preExistingCount = getDayPlanForDate(initialDiet, todayDateKey).blocks.length;

const beverageBlockBase: StructuredDietBlock = {
  id: 'blk_coconut_water_test',
  startTime: '15:15',
  endTime: '15:45',
  type: 'Beverage',
  items: ['Coconut water'],
  customText: 'Coconut water',
  foodCategories: ['beverages'],
};
const beverageWithAlt = applyAlternativeTextToBlock(beverageBlockBase, 'Plain water');
assert(
  beverageWithAlt.customText === 'Coconut water' &&
    beverageWithAlt.alternativeText === 'Plain water' &&
    Array.isArray(beverageWithAlt.alternatives) &&
    beverageWithAlt.alternatives[0]?.name === 'Plain water',
  'Primary ("Coconut water") and Alternative ("Plain water") associated on same block without overwriting primary'
);

const updatedDiet = updateDatePlan(
  initialDiet,
  todayDateKey,
  (d) => ({
    ...d,
    blocks: [...d.blocks, beverageWithAlt],
  }),
  { dayKey: todayDayKey }
);
saveWeeklyDiet(updatedDiet);

// Simulate fresh reload from localStorage
const reloadedDiet = loadWeeklyDiet();
const reloadedToday = getDayPlanForDate(reloadedDiet, todayDateKey);
assert(
  reloadedToday.blocks.length === preExistingCount + 1,
  `Existing meal entries preserved (${preExistingCount} original + 1 added = ${reloadedToday.blocks.length})`
);
const reloadedBlock = reloadedToday.blocks.find((b) => b.id === 'blk_coconut_water_test')!;
assert(
  Boolean(reloadedBlock) &&
    getBlockPrimaryDescription(reloadedBlock, en) === 'Coconut water' &&
    getBlockAlternativeDescription(reloadedBlock, en) === 'Plain water' &&
    reloadedBlock.alternativeText === 'Plain water',
  'Both Planned ("Coconut water") and Alternative ("Plain water") persist cleanly after reloading storage'
);

// Verify Practice Loop consumer resolves both primary and alternative
const nextInfo = resolveNextScheduledBlockForDate({
  now: new Date(`${todayDateKey}T15:00:00`),
  t: en,
});
assert(
  nextInfo?.blockId === 'blk_coconut_water_test' &&
    nextInfo?.primaryDescription === 'Coconut water' &&
    nextInfo?.alternativeDescription === 'Plain water',
  'Practice Loop engine resolves both primaryDescription and alternativeDescription'
);

// Verify verification snapshot captures alternativeText
const snap = createPlannedBlockSnapshot(reloadedBlock);
assert(
  snap.customText === 'Coconut water' && snap.alternativeText === 'Plain water',
  'PlannedBlockSnapshot preserves both primary customText and alternativeText'
);

// 4. Editing & Removing the Alternative Without Deleting Primary Meal or Time Block
console.log('\n4. Editing & Removing Alternative Safely');
const editedAltBlock = applyAlternativeTextToBlock(reloadedBlock, 'Sparkling mineral water');
assert(
  editedAltBlock.id === reloadedBlock.id &&
    editedAltBlock.startTime === '15:15' &&
    editedAltBlock.endTime === '15:45' &&
    editedAltBlock.customText === 'Coconut water' &&
    editedAltBlock.alternativeText === 'Sparkling mineral water' &&
    getBlockAlternativeDescription(editedAltBlock, en) === 'Sparkling mineral water',
  'Editing alternative updates backup option without altering primary meal or time window'
);

const clearedViaEmptyString = applyAlternativeTextToBlock(editedAltBlock, '');
assert(
  clearedViaEmptyString.id === reloadedBlock.id &&
    clearedViaEmptyString.startTime === '15:15' &&
    clearedViaEmptyString.customText === 'Coconut water' &&
    clearedViaEmptyString.alternativeText === undefined &&
    clearedViaEmptyString.alternatives === undefined &&
    getBlockAlternativeDescription(clearedViaEmptyString, en) === '',
  'Clearing alternative via empty string removes alternative while keeping primary meal and time block intact'
);

const removedViaHelper = removeBlockAlternative(
  editedAltBlock,
  editedAltBlock.alternatives?.[0]?.id
);
assert(
  removedViaHelper.customText === 'Coconut water' &&
    removedViaHelper.alternativeText === undefined &&
    removedViaHelper.alternatives === undefined,
  'removeBlockAlternative() removes alternative cleanly while preserving primary meal and block'
);

// Verify swapping primary <-> alternative updates alternativeText cleanly
const swapped = swapBlockWithAlternative(beverageWithAlt, beverageWithAlt.alternatives![0].id, {
  keepPreviousAsAlternative: true,
});
assert(
  swapped.customText === 'Plain water' &&
    swapped.alternativeText === 'Coconut water' &&
    getBlockAlternativeDescription(swapped, en) === 'Coconut water',
  'swapBlockWithAlternative() promotes alternative to primary and moves previous primary into alternativeText'
);

// 5. Future Wizard Reusability & Clone Isolation
console.log('\n5. Future Wizard Reusability & Clone Safety');
const wizardSeededBlock = sanitiseBlock({
  id: 'wiz_future_block_1',
  startTime: '12:30',
  endTime: '13:00',
  type: 'Lunch',
  items: ['Grilled salmon, quinoa'],
  customText: 'Grilled salmon & quinoa',
  alternativeText: 'Tuna whole-grain wrap',
});
assert(
  wizardSeededBlock.alternativeText === 'Tuna whole-grain wrap' &&
    Array.isArray(wizardSeededBlock.alternatives) &&
    wizardSeededBlock.alternatives[0]?.name === 'Tuna whole-grain wrap' &&
    getBlockAlternativeDescription(wizardSeededBlock, en) === 'Tuna whole-grain wrap',
  'Future Wizard block setting alternativeText automatically populates structured alternatives & display helper'
);

const clonedList = cloneBlocks([wizardSeededBlock]);
const deepClonedList = deepCloneBlocks([wizardSeededBlock]);
assert(
  clonedList[0].alternativeText === 'Tuna whole-grain wrap' &&
    deepClonedList[0].alternativeText === 'Tuna whole-grain wrap' &&
    deepClonedList[0].id !== wizardSeededBlock.id,
  'cloneBlocks() and deepCloneBlocks() preserve alternativeText cleanly'
);

// 6. Byte-for-Byte Preservation of Saved Custom & Legacy Diet Plans
console.log('\n6. Byte-for-Byte Preservation of Saved Custom & Legacy Diet Plans');
lsMap.clear();
// Create a saved user custom profile containing legacy blocks WITHOUT any alternative field
const savedCustom = createCustomProfile({
  name: 'My Saved Weekday Plan',
  description: 'Saved prior plan without alternative fields',
});
let seededCustomDiet = loadWeeklyDiet(); // createCustomProfile sets activeProfileId = savedCustom.id
seededCustomDiet = updateDayPlan(seededCustomDiet, 'mon', (d) => ({
  ...d,
  mode: 'structured',
  blocks: [
    {
      id: 'legacy_mon_breakfast',
      startTime: '08:00',
      endTime: '08:30',
      type: 'Breakfast',
      items: ['eggs', 'spinach'],
      customText: 'Scrambled Eggs & Spinach',
      foodCategories: ['proteins', 'vegetables'],
    },
    {
      id: 'legacy_mon_lunch',
      startTime: '13:00',
      endTime: '13:30',
      type: 'Lunch',
      items: ['chicken', 'quinoa'],
      customText: 'Grilled Chicken & Quinoa',
      foodCategories: ['proteins', 'complex_carbs'],
    },
  ],
}));
saveWeeklyDiet(seededCustomDiet);

// Switch active profile to 'moderate_fat_loss' so 'My Saved Weekday Plan' is a previously saved profile
setActiveProfile('moderate_fat_loss');

const storeBefore = loadDietStore();
const savedCustomBeforeJson = JSON.stringify(
  storeBefore.profiles.find((p) => p.id === savedCustom.id)
);
const otherBuiltInsBeforeJson = JSON.stringify(
  storeBefore.profiles.filter((p) => p.id !== 'moderate_fat_loss' && p.id !== savedCustom.id)
);
const activeDietBefore = loadWeeklyDiet();
const recurringDaysBeforeJson = JSON.stringify(activeDietBefore.days);
const preExistingTodayBlocksBeforeJson = JSON.stringify(
  getDayPlanForDate(activeDietBefore, todayDateKey).blocks
);

// Now add, edit, and save a block WITH an alternative on the active profile ('moderate_fat_loss')
let activeUpdated = updateDatePlan(
  activeDietBefore,
  todayDateKey,
  (d) => ({
    ...d,
    blocks: [
      ...d.blocks,
      applyAlternativeTextToBlock(
        {
          id: 'blk_active_test_bev',
          startTime: '15:30',
          endTime: '16:00',
          type: 'Beverage',
          items: ['Coconut water'],
          customText: 'Coconut water',
        },
        'Plain water'
      ),
    ],
  }),
  { dayKey: todayDayKey }
);
saveWeeklyDiet(activeUpdated);

const storeAfter = loadDietStore();
const savedCustomAfterJson = JSON.stringify(
  storeAfter.profiles.find((p) => p.id === savedCustom.id)
);
const otherBuiltInsAfterJson = JSON.stringify(
  storeAfter.profiles.filter((p) => p.id !== 'moderate_fat_loss' && p.id !== savedCustom.id)
);
assert(
  savedCustomAfterJson === savedCustomBeforeJson,
  'Previously saved custom diet plan ("My Saved Weekday Plan") preserved 100% byte-for-byte unchanged'
);
assert(
  otherBuiltInsAfterJson === otherBuiltInsBeforeJson,
  'All 5 inactive built-in diet profiles preserved 100% byte-for-byte unchanged'
);

const activeDietAfter = loadWeeklyDiet();
assert(
  JSON.stringify(activeDietAfter.days) === recurringDaysBeforeJson,
  'Active profile recurring Mon-Sun weekly templates preserved 100% byte-for-byte unchanged'
);
const todayAfterBlocks = getDayPlanForDate(activeDietAfter, todayDateKey).blocks;
const preExistingTodayBlocksAfterJson = JSON.stringify(
  todayAfterBlocks.filter((b) => b.id !== 'blk_active_test_bev')
);
assert(
  preExistingTodayBlocksAfterJson === preExistingTodayBlocksBeforeJson,
  'Pre-existing meal blocks on Today preserved 100% byte-for-byte unchanged'
);

// Switch back to the saved legacy custom profile and verify it loads, displays, and saves cleanly without alternatives
setActiveProfile(savedCustom.id);
const loadedLegacyCustom = loadWeeklyDiet();
const monBlocks = loadedLegacyCustom.days.find((d) => d.dayKey === 'mon')!.blocks;
assert(
  monBlocks.length === 2 &&
    getBlockPrimaryDescription(monBlocks[0], en) === 'Scrambled Eggs & Spinach' &&
    getBlockAlternativeDescription(monBlocks[0], en) === '' &&
    !('alternativeText' in monBlocks[0]) &&
    !('alternatives' in monBlocks[0]),
  'Existing diet plan without alternative fields loads and displays normally without injecting unwanted properties'
);

const resavedLegacyCustom = updateDayPlan(loadedLegacyCustom, 'mon', (d) => ({
  ...d,
  blocks: d.blocks.map((b) =>
    b.id === 'legacy_mon_breakfast' ? { ...b, startTime: '08:15', endTime: '08:45' } : b
  ),
}));
saveWeeklyDiet(resavedLegacyCustom);
const reloadedResavedMon = loadWeeklyDiet().days.find((d) => d.dayKey === 'mon')!.blocks;
assert(
  reloadedResavedMon.length === 2 &&
    reloadedResavedMon[0].startTime === '08:15' &&
    getBlockPrimaryDescription(reloadedResavedMon[0], en) === 'Scrambled Eggs & Spinach' &&
    getBlockAlternativeDescription(reloadedResavedMon[0], en) === '' &&
    !('alternativeText' in reloadedResavedMon[0]),
  'Existing diet plan without alternative fields edits and re-saves normally'
);

console.log(`\n=== ALL ${passed} ALTERNATIVE FIELD ASSERTIONS PASSED (0 failed) ===\n`);
