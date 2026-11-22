/**
 * SDA Final Completion — Phase 4: Challenge Action Cards Final Polish
 * Automated Verification Suite (Localization, JSX Card Order, CSS Typography & Challenge Engine Regressions)
 */

import fs from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  startChallenge,
  getActiveChallenge,
  getChallengeHistory,
  recordChallengeCheckIn,
  calculateChallengePracticeStats,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
  evaluateBook1PracticeLoopGuidance,
  evaluateBook2PracticeLoopGuidance,
  getSelectedPracticeLoopBook,
  setSelectedPracticeLoopBook,
  isDuplicateConsecutiveResume,
} from '../src/challenges';

// Minimal localStorage / window shim for Node execution
const memStore = new Map<string, string>();
const mockStorage: Storage = {
  get length() {
    return memStore.size;
  },
  clear() {
    memStore.clear();
  },
  getItem(key: string) {
    return memStore.has(key) ? memStore.get(key)! : null;
  },
  key(index: number) {
    return Array.from(memStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    memStore.delete(key);
  },
  setItem(key: string, value: string) {
    memStore.set(key, String(value));
  },
};

(globalThis as Record<string, unknown>).localStorage = mockStorage;
(globalThis as Record<string, unknown>).sessionStorage = mockStorage;
if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
  (globalThis as Record<string, unknown>).window = {
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

let passed = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  passed++;
  console.log(`  ✓ ${msg}`);
}

console.log('=== SDA Final Completion Phase 4: Challenge Action Cards Suite ===\n');

// 1. Localization Verification (EN / ES / NL)
console.log('1. EN / ES / NL Challenge Action Card Labels');
assert(en.pl_action_recommit_title === 'I Am On Track', 'EN top-left title is Title Case "I Am On Track"');
assert(en.pl_action_recommit_sub === 'Re-Commit / Re-Pledge', 'EN top-left subtitle preserved ("Re-Commit / Re-Pledge")');
assert(en.pl_action_resumed_title === 'I Resumed', 'EN top-right title preserved ("I Resumed")');
assert(en.pl_action_resumed_sub === 'Back on structure', 'EN top-right subtitle preserved ("Back on structure")');
assert(en.pl_action_slipped_title === 'I Slipped', 'EN bottom-left title preserved ("I Slipped")');
assert(en.pl_action_slipped_sub === 'Report a slip', 'EN bottom-left subtitle preserved ("Report a slip")');
assert(en.pl_action_drifting_title === 'I Am Drifting', 'EN bottom-right title preserved ("I Am Drifting")');
assert(en.pl_action_drifting_sub === 'Report time off structure', 'EN bottom-right subtitle preserved ("Report time off structure")');

assert(es.pl_action_recommit_title === 'Voy por Buen Camino' && es.pl_action_recommit_sub === 'Re-Compromiso / Re-Promesa', 'ES I Am On Track labels preserved');
assert(es.pl_action_resumed_title === 'He Retomado' && es.pl_action_resumed_sub === 'De vuelta a la estructura', 'ES I Resumed labels preserved');
assert(es.pl_action_slipped_title === 'Tuve un Desliz' && es.pl_action_slipped_sub === 'Registrar un desliz', 'ES I Slipped labels preserved');
assert(es.pl_action_drifting_title === 'Me Estoy Desviando' && es.pl_action_drifting_sub === 'Tiempo fuera de estructura', 'ES I Am Drifting labels preserved');

assert(nl.pl_action_recommit_title === 'Ik Ben op Koers' && nl.pl_action_recommit_sub === 'Herbevestig / Herbeloof', 'NL I Am On Track labels preserved');
assert(nl.pl_action_resumed_title === 'Ik Heb Hervat' && nl.pl_action_resumed_sub === 'Terug op structuur', 'NL I Resumed labels preserved');
assert(nl.pl_action_slipped_title === 'Ik Ben Uitgegleden' && nl.pl_action_slipped_sub === 'Meld een uitglijder', 'NL I Slipped labels preserved');
assert(nl.pl_action_drifting_title === 'Ik Dwaal Af' && nl.pl_action_drifting_sub === 'Tijd buiten structuur melden', 'NL I Am Drifting labels preserved');

// Preserve Home ChallengeHero label untouched
assert(en.home_in_control === 'I Am on Track', 'Home ChallengeHero label (home_in_control) untouched');

// 2. JSX Order & Handler Preservation in ChallengesScreen.tsx
console.log('\n2. Book 1 & Book 2 Action Grid Order and Handlers');
const challengesTsx = fs.readFileSync(
  path.resolve(process.cwd(), 'src/screens/ChallengesScreen.tsx'),
  'utf8'
);
const idxRecommit = challengesTsx.indexOf('id="btn-pl-recommit"');
const idxResumed = challengesTsx.indexOf('id="btn-pl-resumed"');
const idxSlipped = challengesTsx.indexOf('id="btn-pl-slipped"');
const idxDrifting = challengesTsx.indexOf('id="btn-pl-drifting"');

assert(idxRecommit > 0 && idxResumed > 0 && idxSlipped > 0 && idxDrifting > 0, 'All 4 Book 1 Challenge action buttons exist');
assert(
  idxRecommit < idxResumed && idxResumed < idxSlipped && idxSlipped < idxDrifting,
  'Book 1 2x2 order is strictly: 1. I Am On Track (top-left) -> 2. I Resumed (top-right) -> 3. I Slipped (bottom-left) -> 4. I Am Drifting (bottom-right)'
);

const book1Slice = challengesTsx.slice(idxRecommit - 150, idxDrifting + 650);
assert(book1Slice.includes("onClick={() => onNavigate('recommit')}"), 'I Am On Track preserves onNavigate("recommit") handler');
assert(book1Slice.includes("onClick={() => openCheckInModal('resumed')}"), 'I Resumed preserves openCheckInModal("resumed") handler');
assert(book1Slice.includes("onClick={() => openCheckInModal('slip')}"), 'I Slipped preserves openCheckInModal("slip") handler');
assert(book1Slice.includes("onClick={() => openCheckInModal('off-structure-aware')}"), 'I Am Drifting preserves openCheckInModal("off-structure-aware") handler');

// Book 2 action buttons remain intact
assert(
  challengesTsx.includes('id="btn-b2-food-readiness"') &&
    challengesTsx.includes('id="btn-b2-early-drift"') &&
    challengesTsx.includes('id="btn-b2-adjustment"') &&
    challengesTsx.includes('id="btn-b2-anchors"'),
  'Book 2 Loss-Maintenance 4 action cards remain intact'
);

// 3. CSS Typography Consistency Check
console.log('\n3. CSS Typography Rules');
const challengesCss = fs.readFileSync(
  path.resolve(process.cwd(), 'src/screens/ChallengesScreen.css'),
  'utf8'
);
assert(
  !challengesCss.includes('Great Vibes') && !challengesCss.includes('--sda-font-script'),
  'ChallengesScreen.css applies zero cursive/script overrides to I Am On Track'
);
assert(
  challengesCss.includes('.challenges-screen--premium-hub .sda-pl-action-title') &&
    !challengesCss.includes('#btn-pl-recommit .sda-pl-action-title'),
  'All 4 Challenge action titles share identical .sda-pl-action-title typography rule with zero per-card font overrides'
);

// 4. Challenge Durations (1, 3, 7, 30, 90), Check-In Flows, Book 1/2 Practice Loops & History Preservation
console.log('\n4. Challenge Durations (1, 3, 7, 30, 90), Check-Ins & Practice Loops');
mockStorage.clear();
assert(
  JSON.stringify(RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations) === JSON.stringify([1, 3, 7, 30, 90]),
  'Supported Challenge durations remain [1, 3, 7, 30, 90]'
);

for (const dur of [1, 3, 7, 30, 90] as const) {
  mockStorage.clear();
  const created = startChallenge('resume-ability', dur);
  assert(Boolean(created && created.id), `Started ${dur}-day challenge cleanly`);
  const active = getActiveChallenge();
  assert(active?.durationDays === dur && active?.currentDay === 1, `${dur}-day challenge reports accurate durationDays=${dur} and currentDay=1`);
}

// Record check-ins for slip -> resumed -> off-structure-aware on active 90-day challenge
const slipRes = recordChallengeCheckIn({ status: 'slip' });
assert(slipRes.status === 'saved', 'Slip check-in records cleanly on active challenge');
const resumedRes = recordChallengeCheckIn({ status: 'resumed' });
assert(resumedRes.status === 'saved', 'Resumed check-in records cleanly on active challenge');
assert(
  isDuplicateConsecutiveResume(getActiveChallenge()),
  'Consecutive duplicate Resume guard remains active right after a Resumed check-in'
);
const driftRes = recordChallengeCheckIn({ status: 'off-structure-aware' });
assert(driftRes.status === 'saved', 'Drifting (off-structure-aware) check-in records cleanly on active challenge');

const activeAfter = getActiveChallenge()!;
const stats = calculateChallengePracticeStats(activeAfter);
assert(stats.todayCheckedIn && stats.totalCheckIns === 3, 'Practice stats accurately count all 3 recorded check-ins without duplicates');
assert(getChallengeHistory().length === 0, 'Active challenge history remains clean');

// Book 1 & Book 2 Practice Loop Guidance
const b1 = evaluateBook1PracticeLoopGuidance({ activeChallenge: activeAfter });
assert(Boolean(b1 && b1.stateKind), `Book 1 Practice Loop guidance evaluates cleanly (state=${b1.stateKind})`);

setSelectedPracticeLoopBook('book2_loss_maintenance');
assert(getSelectedPracticeLoopBook() === 'book2_loss_maintenance', 'Book 2 Practice Loop selection persists');
const b2 = evaluateBook2PracticeLoopGuidance({ activeChallenge: activeAfter });
assert(Boolean(b2 && b2.stateKind), `Book 2 Practice Loop guidance evaluates cleanly (state=${b2.stateKind})`);
setSelectedPracticeLoopBook('book1_resume_ability');

console.log(`\n=== ALL ${passed} PHASE 4 UNIT & ENGINE ASSERTIONS PASSED (0 failed) ===`);
