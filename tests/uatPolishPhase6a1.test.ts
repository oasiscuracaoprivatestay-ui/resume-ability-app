/**
 * Super Diet-Ability — Phase 6A.1: Final UAT Polish Verification Suite
 *
 * Covers the three targeted UAT warning fixes:
 * - W-UAT-1: Meal Library cross-slot category preservation (Lunch -> Dinner & Dinner -> Lunch,
 *            including Smart Diet Wizard integration, photo/ingredient/alternative preservation,
 *            and zero mutation of original saved library entry).
 * - W-UAT-2: Dutch mobile day-type selector wrapping rules scoped cleanly to [lang="nl"]
 *            while preserving EN and ES layouts.
 * - W-UAT-3: Challenge Welcome Popup synchronization via CHALLENGE_UPDATED_EVENT & session ID scoping.
 */

import fs from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  getBlockPrimaryDescription,
  swapBlockWithAlternative,
  type StructuredDietBlock,
} from '../src/utils/dietStorage';
import { getBlockTypeDisplay, getNextPlannedBlock } from '../src/utils/homeSelectors';
import {
  applyLibraryMealToBlock,
  buildAlternativeFromLibraryMeal,
  getLibraryMealById,
  saveLibraryMeal,
} from '../src/utils/mealLibraryStorage';
import { loadAllDietVerifications } from '../src/utils/dietVerificationStorage';
import { loadScoreStore } from '../src/utils/scoringEngine';
import {
  canShowActiveChallengeWelcomePopup,
  markChallengeWelcomeShownThisSession,
  setChallengeWelcomeAutoShowEnabled,
  wasChallengeWelcomeShownThisSession,
  CHALLENGE_WELCOME_SESSION_KEY,
  CHALLENGE_UPDATED_EVENT,
  startChallenge,
  cancelActiveChallenge,
  getActiveChallenge,
  clearChallengeStore,
} from '../src/challenges';

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

const dispatchedEvents: string[] = [];
(globalThis as any).localStorage = makeStorage(lsMap);
(globalThis as any).sessionStorage = makeStorage(ssMap);
(globalThis as any).window = {
  localStorage: (globalThis as any).localStorage,
  sessionStorage: (globalThis as any).sessionStorage,
  dispatchEvent(ev: { type: string }) {
    dispatchedEvents.push(ev.type);
    return true;
  },
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
function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  passed++;
  console.log(`  ✓ ${message}`);
}

console.log('=== SDA Main App — Phase 6A.1: Final UAT Polish Suite ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// 1. W-UAT-1: Meal Library Cross-Slot Category Preservation (Lunch <-> Dinner)
// ─────────────────────────────────────────────────────────────────────────────
console.log('1. W-UAT-1 — Meal Library Cross-Slot Category Preservation');
lsMap.clear();
ssMap.clear();

const scoreCountBefore = loadScoreStore().events.length;

const savedLunchMeal = saveLibraryMeal({
  name: 'Lemon Herb Chicken & Quinoa Lunchbox',
  description: 'Chicken, quinoa, cucumber, olive oil',
  blockType: 'lunch',
  mealType: 'lunch',
  foodCategories: ['protein', 'carbs', 'vegetables'],
  foodSelections: {
    protein: ['chicken'],
    carbs: ['quinoa'],
    vegetables: ['cucumber'],
  },
  foodPhoto: {
    id: 'photo_lunch_shared_1',
    createdAt: '2026-11-22T12:00:00.000Z',
    mimeType: 'image/jpeg',
  },
});

const savedDinnerMeal = saveLibraryMeal({
  name: 'Herb-Baked Salmon & Broccoli',
  description: 'Salmon fillet, steamed broccoli, brown rice',
  blockType: 'dinner',
  mealType: 'dinner',
  foodCategories: ['protein', 'vegetables', 'carbs'],
  foodSelections: {
    protein: ['fish'],
    vegetables: ['broccoli'],
    carbs: ['rice'],
  },
  foodPhoto: {
    id: 'photo_dinner_shared_2',
    createdAt: '2026-11-22T18:00:00.000Z',
    mimeType: 'image/jpeg',
  },
});

// 1A. Lunch -> Dinner slot reuse
const targetDinnerSlot: StructuredDietBlock = {
  id: 'slot_dinner_2000',
  startTime: '20:00',
  endTime: '20:30',
  type: 'dinner',
  mealType: 'dinner',
  items: [],
  customText: 'Original Dinner Placeholder',
  approvalStatus: 'accepted',
  alternatives: [
    {
      id: 'alt_existing_omelette',
      name: 'Spinach Omelette',
      type: 'dinner',
      mealType: 'dinner',
    },
  ],
};

const appliedLunchToDinner = applyLibraryMealToBlock(savedLunchMeal, {
  id: targetDinnerSlot.id,
  startTime: targetDinnerSlot.startTime,
  endTime: targetDinnerSlot.endTime,
  type: targetDinnerSlot.type,
  mealType: targetDinnerSlot.mealType,
  approvalStatus: 'modified',
  alternatives: targetDinnerSlot.alternatives,
});

assert(
  appliedLunchToDinner.startTime === '20:00' && appliedLunchToDinner.endTime === '20:30',
  'Lunch -> Dinner preserves target Dinner scheduled time (20:00–20:30)'
);
assert(
  appliedLunchToDinner.type === 'dinner' && appliedLunchToDinner.mealType === 'dinner',
  `Lunch -> Dinner preserves target slot category ("dinner"), never inheriting "lunch" (got type=${appliedLunchToDinner.type}, mealType=${appliedLunchToDinner.mealType})`
);
assert(
  getBlockTypeDisplay(appliedLunchToDinner, en) === en.sdb_type_dinner &&
    getBlockTypeDisplay(appliedLunchToDinner, es) === es.sdb_type_dinner &&
    getBlockTypeDisplay(appliedLunchToDinner, nl) === nl.sdb_type_dinner,
  `Lunch -> Dinner displays localized Dinner category across EN (${en.sdb_type_dinner}) / ES (${es.sdb_type_dinner}) / NL (${nl.sdb_type_dinner})`
);
assert(
  getBlockPrimaryDescription(appliedLunchToDinner, en) === 'Lemon Herb Chicken & Quinoa Lunchbox' &&
    appliedLunchToDinner.foodSelections?.protein?.includes('chicken') &&
    appliedLunchToDinner.foodPhoto?.id === 'photo_lunch_shared_1' &&
    appliedLunchToDinner.alternatives?.length === 1 &&
    appliedLunchToDinner.alternatives[0].id === 'alt_existing_omelette',
  'Lunch -> Dinner preserves selected meal name, ingredients, shared photo ID, and target slot alternatives'
);

// 1B. Dinner -> Lunch slot reuse
const targetLunchSlot: StructuredDietBlock = {
  id: 'slot_lunch_1230',
  startTime: '12:30',
  endTime: '13:00',
  type: 'lunch',
  mealType: 'lunch',
  items: [],
  customText: 'Original Lunch Placeholder',
  approvalStatus: 'pending',
  alternatives: [
    {
      id: 'alt_existing_wrap',
      name: 'Tuna Wrap',
      type: 'lunch',
      mealType: 'lunch',
    },
  ],
};

const appliedDinnerToLunch = applyLibraryMealToBlock(savedDinnerMeal, {
  id: targetLunchSlot.id,
  startTime: targetLunchSlot.startTime,
  endTime: targetLunchSlot.endTime,
  type: targetLunchSlot.type,
  mealType: targetLunchSlot.mealType,
  approvalStatus: 'modified',
  alternatives: targetLunchSlot.alternatives,
});

assert(
  appliedDinnerToLunch.startTime === '12:30' && appliedDinnerToLunch.endTime === '13:00',
  'Dinner -> Lunch preserves target Lunch scheduled time (12:30–13:00)'
);
assert(
  appliedDinnerToLunch.type === 'lunch' && appliedDinnerToLunch.mealType === 'lunch',
  `Dinner -> Lunch preserves target slot category ("lunch"), never inheriting "dinner" (got type=${appliedDinnerToLunch.type}, mealType=${appliedDinnerToLunch.mealType})`
);
assert(
  getBlockTypeDisplay(appliedDinnerToLunch, en) === 'Lunch' &&
    getBlockPrimaryDescription(appliedDinnerToLunch, en) === 'Herb-Baked Salmon & Broccoli' &&
    appliedDinnerToLunch.foodPhoto?.id === 'photo_dinner_shared_2' &&
    appliedDinnerToLunch.alternatives?.[0]?.id === 'alt_existing_wrap',
  'Dinner -> Lunch preserves selected meal name, ingredients, shared photo ID, and target slot alternatives'
);

// 1C. Verify original saved library entries were NOT mutated
const reloadedLunchLib = getLibraryMealById(savedLunchMeal.id)!;
const reloadedDinnerLib = getLibraryMealById(savedDinnerMeal.id)!;
assert(
  reloadedLunchLib.mealType === 'lunch' &&
    reloadedLunchLib.blockType === 'lunch' &&
    reloadedDinnerLib.mealType === 'dinner' &&
    reloadedDinnerLib.blockType === 'dinner',
  'Original saved library entries remain completely unmutated after cross-slot reuse'
);

// 1D. Cross-slot alternative swap also preserves target slot category
const altFromLunchOnDinner = buildAlternativeFromLibraryMeal(savedLunchMeal, {
  type: targetDinnerSlot.type,
  mealType: targetDinnerSlot.mealType,
});
const dinnerWithAddedAlt: StructuredDietBlock = {
  ...targetDinnerSlot,
  alternatives: [altFromLunchOnDinner],
};
const swappedDinner = swapBlockWithAlternative(dinnerWithAddedAlt, altFromLunchOnDinner.id);
assert(
  swappedDinner.type === 'dinner' &&
    swappedDinner.mealType === 'dinner' &&
    swappedDinner.startTime === '20:00',
  'Adding & swapping a Lunch library meal as an alternative on a Dinner slot preserves Dinner category & time'
);

// 1E. Browse mode (no target slot type provided) still inherits library meal's own category
const insertedViaBrowse = applyLibraryMealToBlock(savedLunchMeal, {
  startTime: '13:15',
  endTime: '13:45',
});
assert(
  insertedViaBrowse.mealType === 'lunch',
  'Browse mode insertion (no existing target slot) retains library meal category ("lunch")'
);

// 1F. Home Next Meal & Scoring / Verification untouched
const nextRes = getNextPlannedBlock(
  { dayKey: 'sun', dayOfWeek: 0, mode: 'structured', blocks: [appliedDinnerToLunch, appliedLunchToDinner] },
  19 * 60
);
assert(
  nextRes?.block.id === 'slot_dinner_2000' && getBlockTypeDisplay(nextRes.block, en) === 'Dinner',
  'Home getNextPlannedBlock resolves 20:00 reused meal with category "Dinner"'
);
assert(
  Object.keys(loadAllDietVerifications()).length === 0 &&
    loadScoreStore().events.length === scoreCountBefore,
  'Cross-slot library meal reuse preserves planning-only behavior (zero slips, zero score changes)'
);

// 1G. SmartDietWizardModal & StructuredDietScreen wiring check
const wizSrc = fs.readFileSync(
  path.resolve('src/components/SmartDietWizardModal.tsx'),
  'utf8'
);
const sdbSrc = fs.readFileSync(
  path.resolve('src/screens/StructuredDietScreen.tsx'),
  'utf8'
);
assert(
  wizSrc.includes('type: b.type,') &&
    wizSrc.includes('mealType: b.mealType,') &&
    !wizSrc.includes('type: meal.mealType || b.type'),
  'SmartDietWizardModal passes target slot b.type and b.mealType to applyLibraryMealToBlock'
);
assert(
  sdbSrc.includes('type: targetBlock.type,') &&
    sdbSrc.includes('mealType: targetBlock.mealType,'),
  'StructuredDietScreen passes targetBlock.type and targetBlock.mealType to applyLibraryMealToBlock'
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. W-UAT-2: Dutch Mobile Day-Type Selector Wrapping Rules
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. W-UAT-2 — Dutch Mobile Day-Type Selector Wrapping');
const sdbCss = fs.readFileSync(
  path.resolve('src/screens/StructuredDietScreen.css'),
  'utf8'
);
assert(
  sdbSrc.includes('className="sdb-mode-cards-grid"') && sdbSrc.includes('lang={lang}'),
  'StructuredDietScreen attaches lang={lang} attribute to .sdb-mode-cards-grid'
);
assert(
  sdbCss.includes('.sdb-mode-cards-grid[lang="nl"] .sdb-mode-card-title') &&
    sdbCss.includes('word-break: normal !important'),
  'StructuredDietScreen.css prevents mid-word breaking on Dutch day-type titles while scoping strictly to [lang="nl"]'
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. W-UAT-3: Challenge Welcome Popup Synchronization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. W-UAT-3 — Challenge Welcome Popup Synchronization');
clearChallengeStore();
ssMap.clear();
setChallengeWelcomeAutoShowEnabled(true);

// 3A. No active challenge (e.g., Duration Selection Modal open or Cancelled) -> never eligible
assert(
  getActiveChallenge() === null && canShowActiveChallengeWelcomePopup(getActiveChallenge()) === false,
  'Welcome popup is NOT eligible when no active Challenge exists (Duration Modal open or Cancelled)'
);

// 3B. Confirming a 30-day Challenge -> dispatches CHALLENGE_UPDATED_EVENT and is eligible once
dispatchedEvents.length = 0;
const ch30 = startChallenge('resume-ability', 30, '2026-11-22');
assert(
  dispatchedEvents.includes(CHALLENGE_UPDATED_EVENT) &&
    canShowActiveChallengeWelcomePopup(ch30) === true,
  `Newly confirmed 30-day Challenge dispatches ${CHALLENGE_UPDATED_EVENT} and is eligible for Welcome Popup`
);

// 3C. Dismissing popup marks session for ch30.id -> prevents duplicate popup for ch30
markChallengeWelcomeShownThisSession(ch30.id);
assert(
  wasChallengeWelcomeShownThisSession(ch30.id) === true &&
    canShowActiveChallengeWelcomePopup(ch30) === false,
  'Dismissed 30-day Welcome Popup is marked for session and never duplicates for the same Challenge'
);

// 3D. Active 30-day Challenge remains completely intact (never reset or overwritten by popup logic)
assert(
  getActiveChallenge()?.id === ch30.id && getActiveChallenge()?.durationDays === 30,
  'Popup session tracking never resets or overwrites the active 30-day Challenge'
);

// 3E. Cancelling active 30-day Challenge -> never eligible after Cancel
cancelActiveChallenge('UAT cancel');
assert(
  getActiveChallenge() === null && canShowActiveChallengeWelcomePopup(getActiveChallenge()) === false,
  'After cancelling Challenge, Welcome Popup is immediately ineligible'
);

// 3F. Confirming a new 90-day Challenge in the same session -> eligible with new 90-day Challenge ID!
const ch90 = startChallenge('resume-ability', 90, '2026-11-22');
assert(
  ch90.id !== ch30.id &&
    wasChallengeWelcomeShownThisSession(ch90.id) === false &&
    canShowActiveChallengeWelcomePopup(ch90) === true,
  'Newly confirmed 90-day Challenge with fresh ID synchronizes cleanly and is eligible'
);

// 3G. Backward compatibility with legacy boolean 'true' session flag & opt-out preference
ssMap.set(CHALLENGE_WELCOME_SESSION_KEY, 'true');
assert(
  canShowActiveChallengeWelcomePopup(ch90) === false,
  'Legacy sessionStorage "true" value remains honored without regression'
);
ssMap.clear();
setChallengeWelcomeAutoShowEnabled(false);
assert(
  canShowActiveChallengeWelcomePopup(ch90) === false,
  '"Don\'t show automatically on app launch" opt-out preference remains honored'
);
setChallengeWelcomeAutoShowEnabled(true);

const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
assert(
  appSrc.includes('window.addEventListener(CHALLENGE_UPDATED_EVENT, handleChallengeUpdated)'),
  'App.tsx subscribes ActiveChallengeWelcomeModal synchronization to CHALLENGE_UPDATED_EVENT'
);

console.log(`\n=== ALL ${passed} PHASE 6A.1 POLISH ASSERTIONS PASSED (0 failed) ===`);
