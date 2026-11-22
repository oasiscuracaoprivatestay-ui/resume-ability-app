/**
 * SDA Main App — Phase 5C: Challenge Duration Confirmation Unit & Regression Suite
 */

import fs from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  CHALLENGE_OPEN_DURATION_MODAL_KEY,
  CHALLENGE_PREFERRED_DURATION_KEY,
  getPreferredChallengeDuration,
  savePreferredChallengeDuration,
  startChallenge,
  getActiveChallenge,
  cancelActiveChallenge,
  getChallengeHistory,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
} from '../src/challenges';

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

console.log('=== SDA Main App — Phase 5C: Challenge Duration Confirmation Suite ===\n');

// 1. EN / ES / NL Localization Parity & Required Copy
console.log('1. EN / ES / NL Localization Verification');
const enKeys = Object.keys(en);
const esKeys = Object.keys(es);
const nlKeys = Object.keys(nl);
assert(
  enKeys.length === esKeys.length && enKeys.length === nlKeys.length,
  `Dictionary parity preserved across EN (${enKeys.length}), ES (${esKeys.length}), and NL (${nlKeys.length})`
);
assert(en.ch_dur_modal_title === 'Start a New Challenge', 'EN modal title matches "Start a New Challenge"');
assert(en.ch_dur_modal_sub === 'Choose your challenge duration.', 'EN modal subtitle matches "Choose your challenge duration."');
assert(
  en.ch_dur_opt_1 === '1 Day' &&
    en.ch_dur_opt_3 === '3 Days' &&
    en.ch_dur_opt_7 === '7 Days' &&
    en.ch_dur_opt_30 === '30 Days' &&
    en.ch_dur_opt_90 === '90 Days',
  'EN duration labels match 1 Day, 3 Days, 7 Days, 30 Days, 90 Days'
);
assert(
  es.ch_dur_modal_title === 'Iniciar un Nuevo Desafío' &&
    es.ch_dur_opt_1 === '1 Día' &&
    es.ch_dur_opt_90 === '90 Días',
  'ES modal & duration translations verified'
);
assert(
  nl.ch_dur_modal_title === 'Start een Nieuwe Uitdaging' &&
    nl.ch_dur_opt_1 === '1 Dag' &&
    nl.ch_dur_opt_90 === '90 Dagen',
  'NL modal & duration translations verified'
);

// 2. Duration Preference Storage & Safety
console.log('\n2. Duration Preference Storage & Validation');
mockStorage.clear();
assert(getPreferredChallengeDuration() === null, 'Default preferred duration is null when unset');
assert(Boolean(CHALLENGE_OPEN_DURATION_MODAL_KEY && CHALLENGE_PREFERRED_DURATION_KEY), 'Storage keys defined');

for (const d of RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations) {
  savePreferredChallengeDuration(d);
  assert(getPreferredChallengeDuration() === d, `Persists and reloads preferred duration ${d}d`);
}
mockStorage.setItem(CHALLENGE_PREFERRED_DURATION_KEY, '999');
assert(getPreferredChallengeDuration() === null, 'Rejects unsupported stored duration values safely');

// 3. Active Challenge Protection & All 5 Durations Lifecycle
console.log('\n3. Active Challenge Protection & 5 Duration Lifecycles');
mockStorage.clear();
for (const d of [1, 3, 7, 30, 90] as const) {
  const inst = startChallenge('resume-ability', d);
  assert(
    inst.durationDays === d && inst.currentDay === 1 && inst.daysRemaining === d - 1,
    `Confirmed ${d}-day Challenge persists durationDays=${d}, currentDay=1, daysRemaining=${d - 1}`
  );
  // Attempting to call startChallenge while active throws rather than silently overwriting
  let blockedOverwrite = false;
  try {
    startChallenge('resume-ability', 7);
  } catch {
    blockedOverwrite = true;
  }
  assert(blockedOverwrite && getActiveChallenge()?.id === inst.id, `Active ${d}-day Challenge cannot be silently overwritten`);
  cancelActiveChallenge('Completed test cycle');
}
assert(getChallengeHistory().length === 5, 'All 5 test Challenges archived cleanly in Challenge history');

// 4. Entry Point Wiring Verification
console.log('\n4. Entry Point Wiring Verification');
const chTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/screens/ChallengesScreen.tsx'), 'utf8');
const heroTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/components/premium/ChallengeHero.tsx'), 'utf8');
const pvTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/screens/ProgressVictoriesScreen.tsx'), 'utf8');
assert(chTsx.includes('<ChallengeDurationConfirmModal'), 'ChallengesScreen renders ChallengeDurationConfirmModal');
assert(
  chTsx.includes('openDurationConfirmModal(selectedDuration)'),
  'Start Challenge Wizard HoldCommitButton routes through openDurationConfirmModal'
);
assert(heroTsx.includes('CHALLENGE_OPEN_DURATION_MODAL_KEY'), 'Home ChallengeHero invite CTAs set CHALLENGE_OPEN_DURATION_MODAL_KEY');
assert(pvTsx.includes('CHALLENGE_OPEN_DURATION_MODAL_KEY'), 'ProgressVictoriesScreen Start Challenge CTA sets CHALLENGE_OPEN_DURATION_MODAL_KEY');

console.log(`\n=== ALL ${passed} PHASE 5C UNIT & STORAGE ASSERTIONS PASSED (0 failed) ===`);
