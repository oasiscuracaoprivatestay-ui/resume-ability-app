/**
 * Automated Verification Script for Reset All Stats
 */

// Mock browser localStorage
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

(global as any).window = {
  dispatchEvent: () => true,
};

import { resetAllStats } from '../src/utils/resetStats';
import { loadPledge, savePledge } from '../src/utils/pledgeStorage';
import { getCheckIns, getTotalCheckInCount, saveCheckIn } from '../src/utils/checkInStorage';
import { loadSlips, saveSlip } from '../src/utils';
import { loadRecommitEvents, saveRecommitEvent } from '../src/utils/recommitStorage';
import { loadInControlEvents, saveInControlEvent, loadCommitEvents, saveCommitEvent } from '../src/utils/inControlStorage';
import { loadReviewEvents, saveReviewEvent } from '../src/utils/reviewStorage';
import { loadAllDietVerifications, saveAllDietVerifications } from '../src/utils/dietVerificationStorage';
import { loadWeeklyDiet, saveWeeklyDiet } from '../src/utils/dietStorage';
import { loadNotificationSettings, saveNotificationSettings } from '../src/utils/notificationSettingsStorage';
import { calculateDailyResumeAbilityScore } from '../src/utils/dailyScore';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ ${message}`);
  }
}

console.log('── Setting up pre-reset state ──');

// 1. Setup preserved config
savePledge({
  reasons: ['Energy for kids', 'Clear mind for work'],
  nonNegotiables: ['No sugar after 8pm', '16h fasting window'],
  nonNegotiableReviewCount: 14,
  lastNonNegotiableReviewAt: new Date(Date.now() - 3600000).toISOString(),
});

saveWeeklyDiet({
  version: 2,
  planName: 'Sergio Weekly Plan',
  days: [
    {
      dayKey: 'mon',
      dayOfWeek: 0,
      mode: 'structured',
      blocks: [
        {
          id: 'block-1',
          startTime: '12:00',
          endTime: '13:00',
          type: 'Lunch',
          items: ['Salad', 'Grilled Chicken'],
          customText: 'Healthy greens',
        },
      ],
    },
    { dayKey: 'tue', dayOfWeek: 1, mode: 'structured', blocks: [] },
    { dayKey: 'wed', dayOfWeek: 2, mode: 'structured', blocks: [] },
    { dayKey: 'thu', dayOfWeek: 3, mode: 'structured', blocks: [] },
    { dayKey: 'fri', dayOfWeek: 4, mode: 'structured', blocks: [] },
    { dayKey: 'sat', dayOfWeek: 5, mode: 'unstructured', blocks: [] },
    { dayKey: 'sun', dayOfWeek: 6, mode: 'unstructured', blocks: [] },
  ],
});

saveNotificationSettings({
  version: 1,
  enabled: true,
  checkInEnabled: true,
  structuredDietEnabled: true,
  resumeAbilityEnabled: true,
  frequency: 'twice-daily',
  activeStart: '09:00',
  activeEnd: '20:00',
  dailyTimes: ['09:30', '17:30'],
  randomize: false,
  showWhy: true,
});

localStorage.setItem('resume-ability-audio-mode', 'with-audio');
localStorage.setItem('resume-ability-lang', 'es');
localStorage.setItem('resume-ability-notification-state', JSON.stringify({
  lastReminderAt: Date.now() - 10000,
  lastDismissedAt: 0,
  deliveredKeysToday: { 'rem-1': Date.now() },
  dateKey: '2026-09-10',
}));

// 2. Setup Activity / Stats to be reset
saveCheckIn('on-structure');
saveCheckIn('near-slip');

const now = Date.now();
saveSlip({
  id: 'slip-1',
  timestamp: now - 1800000,
  context: 'stress',
  recoverySeconds: 120,
  notes: 'Stress craving',
});

saveRecommitEvent({
  id: 'recommit-1',
  timestamp: now - 1200000,
  slipId: 'slip-1',
});

saveInControlEvent({
  id: 'in-ctrl-1',
  timestamp: now - 900000,
});

saveCommitEvent({
  id: 'commit-1',
  timestamp: now - 850000,
  source: 'in-control',
  inControlEventId: 'in-ctrl-1',
});

saveReviewEvent({
  id: 'review-1',
  timestamp: now - 600000,
});

const todayKey = '2026-09-10';
saveAllDietVerifications({
  [todayKey]: {
    version: 1,
    dateKey: todayKey,
    dayKey: 'mon',
    entries: [
      {
        id: 'verif-1',
        dateKey: todayKey,
        plannedBlockId: 'block-1',
        plannedSnapshot: {
          startTime: '12:00',
          endTime: '13:00',
          type: 'Lunch',
          items: ['Salad'],
        },
        status: 'on-track',
        verifiedAt: now - 300000,
      },
    ],
  },
});

// Calculate score BEFORE reset
const preScore = calculateDailyResumeAbilityScore({
  checkIns: getCheckIns(),
  slips: loadSlips(),
  recommits: loadRecommitEvents(),
  inControlEvents: loadInControlEvents(),
  commitEvents: loadCommitEvents(),
  reviewEvents: loadReviewEvents(),
});

console.log(`Pre-reset Daily Score: ${preScore.score} (raw points: ${preScore.rawPoints})`);
assert(preScore.score > 0, 'Pre-reset score is positive');
assert(getTotalCheckInCount() === 2, 'Pre-reset check-in count is 2');
assert(loadSlips().length === 1, 'Pre-reset slips count is 1');
assert(loadPledge().nonNegotiableReviewCount === 14, 'Pre-reset review count is 14');

console.log('\n── Executing resetAllStats() ──');
resetAllStats();

console.log('\n── Asserting statistical data was reset ──');
const postScore = calculateDailyResumeAbilityScore({
  checkIns: getCheckIns(),
  slips: loadSlips(),
  recommits: loadRecommitEvents(),
  inControlEvents: loadInControlEvents(),
  commitEvents: loadCommitEvents(),
  reviewEvents: loadReviewEvents(),
});

assert(postScore.score === 0, 'Daily Resume-Ability Score is strictly 0');
assert(postScore.rawPoints === 0, 'Raw points are strictly 0');
assert(postScore.feedbackKey === 'no_activity', 'Feedback key is no_activity');
assert(getCheckIns().length === 0, 'Check-in list is empty');
assert(getTotalCheckInCount() === 0, 'Total check-in count is 0');
assert(loadSlips().length === 0, 'Slip history is empty');
assert(loadRecommitEvents().length === 0, 'Recommit events are empty');
assert(loadInControlEvents().length === 0, 'In-control events are empty');
assert(loadCommitEvents().length === 0, 'Commit events are empty');
assert(loadReviewEvents().length === 0, 'Review events are empty');
assert(Object.keys(loadAllDietVerifications()).length === 0, 'Diet verifications are empty');

const postPledge = loadPledge();
assert(postPledge.nonNegotiableReviewCount === 0, 'Non-negotiable review count reset to 0');
assert(postPledge.lastNonNegotiableReviewAt === null, 'Last review timestamp reset to null');
assert(localStorage.getItem('resume-ability-balance') === null, 'Legacy balance storage cleared');
assert(localStorage.getItem('resume-ability-notification-state') === null, 'Transient notification state cleared');

console.log('\n── Asserting configuration was strictly preserved ──');
assert(postPledge.reasons.length === 2, 'Why reasons length preserved');
assert(postPledge.reasons[0] === 'Energy for kids', 'Why reason 1 preserved');
assert(postPledge.reasons[1] === 'Clear mind for work', 'Why reason 2 preserved');
assert(postPledge.nonNegotiables.length === 2, 'Non-negotiables count preserved');
assert(postPledge.nonNegotiables[0] === 'No sugar after 8pm', 'Non-negotiable 1 preserved');
assert(postPledge.nonNegotiables[1] === '16h fasting window', 'Non-negotiable 2 preserved');

const postDiet = loadWeeklyDiet();
assert(postDiet.planName === 'Sergio Weekly Plan', 'Diet planName preserved');
assert(postDiet.days[0].blocks.length === 1, 'Diet Monday blocks preserved');
assert(postDiet.days[0].blocks[0].items[0] === 'Salad', 'Diet Monday meal item preserved');
assert(postDiet.days[5].mode === 'unstructured', 'Diet Saturday unstructured mode preserved');

const postNotif = loadNotificationSettings();
assert(postNotif.enabled === true, 'Notification enabled preserved');
assert(postNotif.frequency === 'twice-daily', 'Notification frequency preserved');
assert(postNotif.activeStart === '09:00', 'Notification activeStart preserved');
assert(postNotif.showWhy === true, 'Notification showWhy preserved');

assert(localStorage.getItem('resume-ability-audio-mode') === 'with-audio', 'Audio mode preserved');
assert(localStorage.getItem('resume-ability-lang') === 'es', 'Language preserved');

console.log('\n── Testing new activity recorded after reset ──');
saveCheckIn('on-structure');
assert(getCheckIns().length === 1, 'New check-in recorded successfully');
assert(getTotalCheckInCount() === 1, 'Check-in count starts cleanly from 1');

const newScore = calculateDailyResumeAbilityScore({
  checkIns: getCheckIns(),
  slips: loadSlips(),
  recommits: loadRecommitEvents(),
  inControlEvents: loadInControlEvents(),
  commitEvents: loadCommitEvents(),
  reviewEvents: loadReviewEvents(),
});
assert(newScore.score === 25, 'New check-in on structure awards 25 points (15 + 10 bonus)');
assert(newScore.breakdown.checkIns === 15, 'Breakdown checkIns = 15');
assert(newScore.breakdown.onStructure === 10, 'Breakdown onStructure = 10');

console.log('\n── Testing malformed storage resilience ──');
localStorage.setItem('resume-ability-slips', '{BAD_JSON');
localStorage.setItem('resume-ability-checkins', 'NOT_AN_ARRAY');
localStorage.setItem('resume-ability-recommit-events', '{{CORRUPT');

resetAllStats();

assert(loadSlips().length === 0, 'Corrupted slips cleared safely');
assert(getCheckIns().length === 0, 'Corrupted check-ins cleared safely');
assert(loadRecommitEvents().length === 0, 'Corrupted recommits cleared safely');
assert(loadPledge().reasons[0] === 'Energy for kids', 'Preserved reasons still intact after corrupt reset');

console.log('\n🎉 ALL RESET STATS REGRESSION TESTS PASSED (100% SUCCESS)!\n');
