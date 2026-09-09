import type { CheckInRecord } from './checkInStorage';
import type { SlipRecord } from '../types';
import type { RecommitEvent } from './recommitStorage';
import type { InControlEvent, CommitEvent } from './inControlStorage';
import type { ReviewEvent } from './reviewStorage';

export interface ScoreInputs {
  checkIns: CheckInRecord[];
  slips: SlipRecord[];
  recommits: RecommitEvent[];
  inControlEvents: InControlEvent[];
  commitEvents: CommitEvent[];
  reviewEvents: ReviewEvent[];
}

export interface ScoreBreakdown {
  checkIns: number;
  onStructure: number;
  nearSlip: number;
  slipReporting: number;
  recommit: number;
  recoveryChain: number;
  inControl: number;
  commit: number;
  reviews: number;
}

export interface ScoreActivity {
  eligibleCheckIns: number;
  eligibleOnStructure: number;
  eligibleNearSlip: number;
  eligibleSlips: number;
  eligibleRecommits: number;
  recoveryChains: number;
  eligibleInControl: number;
  eligibleCommits: number;
  eligibleReviews: number;
}

export type ScoreFeedbackKey =
  | 'high_recovery'
  | 'strong_structure'
  | 'slips_no_recommit'
  | 'low_engagement'
  | 'no_activity';

export interface DailyScoreResult {
  score: number;       // clamped to 0–100
  rawPoints: number;   // total eligible points before clamping
  breakdown: ScoreBreakdown;
  activity: ScoreActivity;
  feedbackKey: ScoreFeedbackKey;
}

// ── Anti-gaming Spacing Constants ─────────────────────────────────────────────
const CHECK_IN_MIN_SPACING_MS = 5 * 60 * 1000;    // 5 minutes
const IN_CONTROL_MIN_SPACING_MS = 15 * 60 * 1000;  // 15 minutes
const SLIP_DEBOUNCE_MS = 60 * 1000;               // 60 seconds

/**
 * Calculates the Daily Resume-Ability Score for a given local calendar date.
 *
 * Deterministic, side-effect free, and DST-safe.
 */
export function calculateDailyResumeAbilityScore(
  inputs: ScoreInputs,
  targetTimestamp?: number,
): DailyScoreResult {
  const target = new Date(targetTimestamp ?? Date.now());
  const year = target.getFullYear();
  const month = target.getMonth();
  const date = target.getDate();

  // Local calendar boundaries using half-open interval [startOfToday, startOfTomorrow)
  const startOfToday = new Date(year, month, date).getTime();
  const startOfTomorrow = new Date(year, month, date + 1).getTime();

  // ── 1. Daily Check-Ins & Bonuses ─────────────────────────────────────────────
  // Parse, filter, and sort check-ins chronologically
  const dayCheckIns: { record: CheckInRecord; ts: number }[] = [];
  for (const c of inputs.checkIns) {
    const ts = Date.parse(c.timestamp);
    if (!isNaN(ts) && ts >= startOfToday && ts < startOfTomorrow) {
      dayCheckIns.push({ record: c, ts });
    }
  }
  dayCheckIns.sort((a, b) => a.ts - b.ts);

  let eligibleCheckIns = 0;
  let eligibleOnStructure = 0;
  let eligibleNearSlip = 0;
  let checkInPoints = 0;
  let onStructurePoints = 0;
  let nearSlipPoints = 0;
  let lastEligibleCheckInTime: number | null = null;

  for (const { record, ts } of dayCheckIns) {
    const isSpaced =
      lastEligibleCheckInTime === null ||
      ts - lastEligibleCheckInTime >= CHECK_IN_MIN_SPACING_MS;

    if (isSpaced && eligibleCheckIns < 2) {
      eligibleCheckIns++;
      lastEligibleCheckInTime = ts;

      // First check-in: +15, Second check-in: +10
      checkInPoints += eligibleCheckIns === 1 ? 15 : 10;

      // Bonus eligibility is strictly tied to a score-eligible Check-In
      if (record.status === 'on-structure' && eligibleOnStructure < 2) {
        eligibleOnStructure++;
        onStructurePoints += 10;
      } else if (record.status === 'near-slip' && eligibleNearSlip < 2) {
        eligibleNearSlip++;
        nearSlipPoints += 15;
      }
    }
  }

  // ── 2. Honest Slip Reports ───────────────────────────────────────────────────
  // 60-second debounce against the last score-eligible slip. Max 3 rewarded slips (+5 each).
  const daySlips: SlipRecord[] = [];
  for (const s of inputs.slips) {
    if (
      typeof s.timestamp === 'number' &&
      s.timestamp >= startOfToday &&
      s.timestamp < startOfTomorrow
    ) {
      daySlips.push(s);
    }
  }
  daySlips.sort((a, b) => a.timestamp - b.timestamp);

  let eligibleSlips = 0;
  let slipPoints = 0;
  let lastEligibleSlipTime: number | null = null;
  const eligibleSlipIds = new Set<string>();

  for (const s of daySlips) {
    const isSpaced =
      lastEligibleSlipTime === null ||
      s.timestamp - lastEligibleSlipTime >= SLIP_DEBOUNCE_MS;

    if (isSpaced) {
      lastEligibleSlipTime = s.timestamp;
      eligibleSlipIds.add(s.id);

      if (eligibleSlips < 3) {
        eligibleSlips++;
        slipPoints += 5;
      }
    }
  }

  // ── 3. Re-Commit Events ──────────────────────────────────────────────────────
  // Max 3 rewarded Re-Commits (+15 each)
  const dayRecommits: RecommitEvent[] = [];
  for (const r of inputs.recommits) {
    if (
      typeof r.timestamp === 'number' &&
      r.timestamp >= startOfToday &&
      r.timestamp < startOfTomorrow
    ) {
      dayRecommits.push(r);
    }
  }
  dayRecommits.sort((a, b) => a.timestamp - b.timestamp);

  let eligibleRecommits = 0;
  let recommitPoints = 0;
  for (let i = 0; i < Math.min(dayRecommits.length, 3); i++) {
    eligibleRecommits++;
    recommitPoints += 15;
  }

  // ── 4. Complete Recovery Chain (+10 each, max 3) ─────────────────────────────
  // Awarded when RecommitEvent.slipId matches a real SlipRecord on the same local calendar day.
  // 1-to-1 matching: each slip and each recommit may participate at most once.
  let recoveryChains = 0;
  let recoveryChainPoints = 0;
  const matchedSlipIds = new Set<string>();

  for (const r of dayRecommits) {
    if (recoveryChains >= 3) break;
    if (r.slipId && !matchedSlipIds.has(r.slipId)) {
      // Check if slip exists on the same local calendar day
      const matchingSlip = daySlips.find((s) => s.id === r.slipId);
      if (matchingSlip) {
        matchedSlipIds.add(r.slipId);
        recoveryChains++;
        recoveryChainPoints += 10;
      }
    }
  }

  // ── 5. I Am in Control Reports ───────────────────────────────────────────────
  // 15-minute spacing. 1st: +10, 2nd: +5. Max 2 rewarded per day (max 15 pts).
  const dayInControl: InControlEvent[] = [];
  for (const ic of inputs.inControlEvents) {
    if (
      typeof ic.timestamp === 'number' &&
      ic.timestamp >= startOfToday &&
      ic.timestamp < startOfTomorrow
    ) {
      dayInControl.push(ic);
    }
  }
  dayInControl.sort((a, b) => a.timestamp - b.timestamp);

  let eligibleInControl = 0;
  let inControlPoints = 0;
  let lastEligibleInControlTime: number | null = null;

  for (const ic of dayInControl) {
    const isSpaced =
      lastEligibleInControlTime === null ||
      ic.timestamp - lastEligibleInControlTime >= IN_CONTROL_MIN_SPACING_MS;

    if (isSpaced && eligibleInControl < 2) {
      eligibleInControl++;
      lastEligibleInControlTime = ic.timestamp;
      inControlPoints += eligibleInControl === 1 ? 10 : 5;
    }
  }

  // ── 6. Positive Commit (Hold) ────────────────────────────────────────────────
  // Max 1 rewarded per day (+10 pts)
  const dayCommits = inputs.commitEvents.filter(
    (c) =>
      typeof c.timestamp === 'number' &&
      c.timestamp >= startOfToday &&
      c.timestamp < startOfTomorrow,
  );
  const eligibleCommits = dayCommits.length > 0 ? 1 : 0;
  const commitPoints = eligibleCommits > 0 ? 10 : 0;

  // ── 7. Non-Negotiable Review ─────────────────────────────────────────────────
  // Max 1 rewarded per day (+10 pts)
  const dayReviews = inputs.reviewEvents.filter(
    (rev) =>
      typeof rev.timestamp === 'number' &&
      rev.timestamp >= startOfToday &&
      rev.timestamp < startOfTomorrow,
  );
  const eligibleReviews = dayReviews.length > 0 ? 1 : 0;
  const reviewPoints = eligibleReviews > 0 ? 10 : 0;

  // ── 8. Total Score Calculation ───────────────────────────────────────────────
  const rawPoints =
    checkInPoints +
    onStructurePoints +
    nearSlipPoints +
    slipPoints +
    recommitPoints +
    recoveryChainPoints +
    inControlPoints +
    commitPoints +
    reviewPoints;

  const score = Math.min(100, Math.max(0, rawPoints));

  // ── 9. Dynamic Behavioral Feedback ───────────────────────────────────────────
  let feedbackKey: ScoreFeedbackKey;
  if (recoveryChains > 0 || (daySlips.length > 0 && eligibleRecommits > 0)) {
    feedbackKey = 'high_recovery';
  } else if (daySlips.length > 0 && eligibleRecommits === 0) {
    feedbackKey = 'slips_no_recommit';
  } else if (score >= 40 && daySlips.length === 0) {
    feedbackKey = 'strong_structure';
  } else if (score > 0) {
    feedbackKey = 'low_engagement';
  } else {
    feedbackKey = 'no_activity';
  }

  return {
    score,
    rawPoints,
    breakdown: {
      checkIns: checkInPoints,
      onStructure: onStructurePoints,
      nearSlip: nearSlipPoints,
      slipReporting: slipPoints,
      recommit: recommitPoints,
      recoveryChain: recoveryChainPoints,
      inControl: inControlPoints,
      commit: commitPoints,
      reviews: reviewPoints,
    },
    activity: {
      eligibleCheckIns,
      eligibleOnStructure,
      eligibleNearSlip,
      eligibleSlips,
      eligibleRecommits,
      recoveryChains,
      eligibleInControl,
      eligibleCommits,
      eligibleReviews,
    },
    feedbackKey,
  };
}
