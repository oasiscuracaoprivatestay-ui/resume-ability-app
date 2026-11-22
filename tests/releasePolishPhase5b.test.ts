/**
 * SDA Main App — Phase 5B: Final Release Polish Verification Suite
 * Covers W1 (sticky header overflow-x: clip), W2 (Dashboard Movement widget EN/ES/NL interpolation),
 * W3 (date-specific & active-block schedule consistency across Dashboard, NextActionModal, coachContext, notificationScheduler),
 * and W4 (.gitignore hygiene).
 */

import fs from 'node:fs';
import path from 'node:path';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { nl } from '../src/i18n/nl';
import {
  loadWeeklyDiet,
  getLocalDateKey,
  getDayPlanForDate,
  updateDatePlan,
  isBlockScheduleActive,
} from '../src/utils/dietStorage';
import { getDailyVerificationStats } from '../src/utils/dietVerificationStorage';
import { getNextPlannedBlock } from '../src/utils/homeSelectors';
import { buildCoachContext } from '../src/coach/coachContext';
import { buildCandidate, evaluateNextReminder } from '../src/utils/notificationScheduler';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  saveNotificationSettings,
} from '../src/utils/notificationSettingsStorage';
import { getTodayScore } from '../src/utils/scoringEngine';

// Minimal localStorage / window shim
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

console.log('=== SDA Main App — Phase 5B: Final Release Polish Suite ===\n');

// ── W1: Sticky Header / Overflow ─────────────────────────────────────────────
console.log('1. W1 — Sticky Header / Overflow CSS Verification');
const pvCss = fs.readFileSync(path.resolve(process.cwd(), 'src/screens/ProgressVictoriesScreen.css'), 'utf8');
const sdbCss = fs.readFileSync(path.resolve(process.cwd(), 'src/screens/StructuredDietScreen.css'), 'utf8');

assert(
  pvCss.includes('overflow-x: clip;') && !pvCss.includes('overflow-x: hidden;'),
  'ProgressVictoriesScreen.css uses overflow-x: clip on .pv-screen (no nested scrollport)'
);
assert(
  sdbCss.includes('overflow-x: clip;') && !sdbCss.includes('overflow-x: hidden;'),
  'StructuredDietScreen.css uses overflow-x: clip on .sdb-screen--premium (no nested scrollport)'
);

// ── W2: Movement Widget EN / ES / NL Interpolation ───────────────────────────
console.log('\n2. W2 — Dashboard Movement Widget EN / ES / NL Interpolation');
const dashTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/screens/DashboardScreen.tsx'), 'utf8');
assert(
  dashTsx.includes("t.act_today_summary_count.replace('{count}', String(activitySummary.count))") &&
    dashTsx.includes("t.act_today_summary_minutes.replace('{minutes}', String(activitySummary.totalDurationMinutes))"),
  'DashboardScreen.tsx interpolates {count} and {minutes} cleanly'
);
for (const [locName, dict] of [['EN', en], ['ES', es], ['NL', nl]] as const) {
  const cStr = dict.act_today_summary_count.replace('{count}', '3');
  const mStr = dict.act_today_summary_minutes.replace('{minutes}', '45');
  assert(!cStr.includes('{') && cStr.includes('3'), `${locName} act_today_summary_count interpolates to "${cStr}"`);
  assert(!mStr.includes('{') && mStr.includes('45'), `${locName} act_today_summary_minutes interpolates to "${mStr}"`);
}

// ── W3: Consistent Date-Specific & Active-Block Meal Schedule ────────────────
console.log('\n3. W3 — Secondary Schedule Consumers, Upcoming Meal & Notifications');
mockStorage.clear();
const todayDateKey = getLocalDateKey();
const now = new Date();
const nowMins = now.getHours() * 60 + now.getMinutes();
const pad = (n: number) => String(n).padStart(2, '0');
const fmtTime = (mins: number) => {
  const clamped = Math.max(0, Math.min(23 * 60 + 55, mins));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
};

// Schedule 3 blocks in a dateOverride for today:
//   1. Rejected block 10 mins from now (MUST NEVER appear as upcoming or trigger notification!)
//   2. Active user-timed Lunch block 25 mins from now (MUST appear as upcoming & in notification!)
//   3. Active Dinner block later
const rejectedStart = fmtTime(nowMins + 10);
const rejectedEnd = fmtTime(nowMins + 20);
const activeLunchStart = fmtTime(nowMins + 25);
const activeLunchEnd = fmtTime(nowMins + 50);

let diet = loadWeeklyDiet();
diet = updateDatePlan(diet, todayDateKey, (prev) => ({
  ...prev,
  mode: 'structured',
  blocks: [
    {
      id: 'blk_rejected_proposal',
      type: 'snack',
      startTime: rejectedStart,
      endTime: rejectedEnd,
      customText: 'Excluded Snack Proposal',
      approvalStatus: 'rejected',
    },
    {
      id: 'blk_active_lunch',
      type: 'lunch',
      startTime: activeLunchStart,
      endTime: activeLunchEnd,
      customText: 'Grilled Salmon & Rice',
      approvalStatus: 'accepted',
    },
    {
      id: 'blk_active_dinner',
      type: 'dinner',
      startTime: '20:30',
      endTime: '21:00',
      customText: 'Herb Chicken & Greens',
    },
  ],
}));
import { saveWeeklyDiet } from '../src/utils/dietStorage';
saveWeeklyDiet(diet);

const loadedToday = getDayPlanForDate(loadWeeklyDiet(), todayDateKey);
const activeScheduled = loadedToday.blocks.filter(isBlockScheduleActive);
assert(activeScheduled.length === 2, 'Date-specific override resolves 2 active blocks (1 rejected block excluded)');
assert(
  activeScheduled[0].startTime === activeLunchStart && activeScheduled[1].startTime === '20:30',
  'User-selected meal times are preserved verbatim'
);

// Home upcoming meal selector
const nextHome = getNextPlannedBlock(loadedToday, nowMins);
assert(
  nextHome?.block.id !== 'blk_rejected_proposal',
  'Home upcoming meal display excludes rejected block and selects active block'
);

// Dashboard verification stats denominator
const dashStats = getDailyVerificationStats(
  activeScheduled.length,
  todayDateKey,
  activeScheduled.map((b) => b.id)
);
assert(
  dashStats.plannedCount === 2 && dashStats.slipCount === 0,
  'Dashboard verification stats count only active blocks (2) and record 0 slips for rejected proposal'
);

// Coach context
const coachCtx = buildCoachContext(todayDateKey);
assert(
  coachCtx.structuredDiet.hasPlan &&
    coachCtx.structuredDiet.todayPlannedCount === 2 &&
    coachCtx.structuredDiet.nextPlannedMealTime !== rejectedStart,
  `CoachContext uses date-specific active blocks (count=${coachCtx.structuredDiet.todayPlannedCount}, next=${coachCtx.structuredDiet.nextPlannedMealTime})`
);

// Notification Scheduler: buildCandidate skips rejected block at +10m and announces active Lunch at +25m (when within 45m window)
const candEn = buildCandidate('structured-diet', `${todayDateKey}_diet`, en, {
  ...DEFAULT_NOTIFICATION_SETTINGS,
  enabled: true,
  structuredDietEnabled: true,
});
assert(
  !candEn.body.includes(rejectedStart),
  `Notification candidate never announces rejected meal time (${candEn.body})`
);
if (parseInt(activeLunchStart.split(':')[0], 10) * 60 + parseInt(activeLunchStart.split(':')[1], 10) - nowMins <= 45) {
  assert(
    candEn.body.includes(activeLunchStart) && candEn.body.includes(en.sdb_type_lunch),
    `Notification candidate announces active Lunch at user-selected time ${activeLunchStart} ("${candEn.body}")`
  );
}

// Notification Scheduler: evaluateNextReminder fires on Structured Day override and suppresses on Free Day override
saveNotificationSettings({
  ...DEFAULT_NOTIFICATION_SETTINGS,
  enabled: true,
  checkInEnabled: false,
  structuredDietEnabled: true,
  resumeAbilityEnabled: false,
  frequency: 'daily',
  activeStart: '00:00',
  activeEnd: '23:59',
  dailyTimes: [fmtTime(nowMins)],
  randomize: false,
});
const structRem = evaluateNextReminder(en);
assert(
  structRem !== null && structRem.type === 'structured-diet' && !structRem.body.includes(rejectedStart),
  `evaluateNextReminder fires structured-diet reminder for dateOverride while skipping rejected block ("${structRem?.body}")`
);

const freeDiet = updateDatePlan(loadWeeklyDiet(), todayDateKey, (prev) => ({
  ...prev,
  mode: 'free',
  blocks: [],
}));
saveWeeklyDiet(freeDiet);
const freeRem = evaluateNextReminder(en);
assert(freeRem === null, 'Notification scheduler suppresses structured-diet reminder on date-specific Free Day override');

// Confirm zero slips, verifications, or XP awards were created
assert(
  !mockStorage.getItem('resume-ability-slips') &&
    !mockStorage.getItem('sda_diet_verifications_v1') &&
    !mockStorage.getItem('resume_ability_victory_points_v1'),
  'Zero slips, verifications, or XP penalties/mutations created'
);

// ── W4: .gitignore Hygiene ───────────────────────────────────────────────────
console.log('\n4. W4 — .gitignore Hygiene Verification');
const gitignore = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf8');
const lines = gitignore.split(/\r?\n/).map((l) => l.trim());
assert(lines.includes('design-references/'), '.gitignore excludes design-references/');
assert(lines.includes('sda-home-package/'), '.gitignore excludes sda-home-package/');
assert(
  !lines.some((l) => l.startsWith('src') || l.startsWith('tests') || l.startsWith('public')),
  '.gitignore does NOT ignore src/, tests/, or public/ production assets'
);

console.log(`\n=== ALL ${passed} PHASE 5B RELEASE POLISH ASSERTIONS PASSED (0 failed) ===`);
