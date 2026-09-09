import type { SlipRecord, SlipType, SlipContext } from '../types';

export type TrendDirection = 'up' | 'down' | 'stable' | 'insufficient-data';

export interface TargetSlipInfo {
  slipType: SlipType;
  context: SlipContext;
  nonNegotiableText?: string;
}

export interface SlipInsightsData {
  targetTodayCount: number;
  targetTrend: TrendDirection;
  overallTodayCount: number;
  overallTrend: TrendDirection;
  recentTargetCount: number;
  previousTargetCount: number;
  recentOverallCount: number;
  previousOverallCount: number;
}

/** Check if a slip matches the target slip item (cause or non-negotiable rule). */
export function isSlipMatchingTarget(slip: SlipRecord, target: TargetSlipInfo): boolean {
  if (target.slipType === 'non-negotiable') {
    return (
      slip.slipType === 'non-negotiable' &&
      slip.nonNegotiableText === target.nonNegotiableText
    );
  }
  // Slippery Zone slip (or legacy slip without slipType)
  return (
    (slip.slipType === 'slippery-zone' || !slip.slipType) &&
    slip.context === target.context
  );
}

/**
 * Compute today's counts and 14-day trend comparisons for a reported slip.
 * Uses local calendar day boundaries.
 */
export function computeSlipInsights(
  allSlips: SlipRecord[],
  target: TargetSlipInfo,
): SlipInsightsData {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  // Local calendar boundaries using half-open intervals [start, nextStart)
  // Today: [startOfToday, startOfTomorrow)
  const startOfToday = new Date(year, month, date).getTime();
  const startOfTomorrow = new Date(year, month, date + 1).getTime();

  // Recent 7 calendar days including today: [startOfRecent, startOfTomorrow)
  const startOfRecent = new Date(year, month, date - 6).getTime();

  // Previous 7 calendar days: [startOfPrevious, startOfRecent)
  const startOfPrevious = new Date(year, month, date - 13).getTime();

  let targetTodayCount = 0;
  let overallTodayCount = 0;

  let recentTargetCount = 0;
  let previousTargetCount = 0;
  let recentOverallCount = 0;
  let previousOverallCount = 0;

  const targetDaySet = new Set<string>();
  const overallDaySet = new Set<string>();

  for (const s of allSlips) {
    const isToday = s.timestamp >= startOfToday && s.timestamp < startOfTomorrow;
    const isRecent = s.timestamp >= startOfRecent && s.timestamp < startOfTomorrow;
    const isPrevious = s.timestamp >= startOfPrevious && s.timestamp < startOfRecent;

    const matchesTarget = isSlipMatchingTarget(s, target);

    if (isToday) {
      overallTodayCount++;
      if (matchesTarget) targetTodayCount++;
    }

    if (isRecent) {
      recentOverallCount++;
      const dayKey = new Date(s.timestamp).toDateString();
      overallDaySet.add(dayKey);

      if (matchesTarget) {
        recentTargetCount++;
        targetDaySet.add(dayKey);
      }
    } else if (isPrevious) {
      previousOverallCount++;
      const dayKey = new Date(s.timestamp).toDateString();
      overallDaySet.add(dayKey);

      if (matchesTarget) {
        previousTargetCount++;
        targetDaySet.add(dayKey);
      }
    }
  }

  // ── Calculate Target Trend ──
  // Guard: Do not infer a trend from a single event or insufficient data
  let targetTrend: TrendDirection;
  const totalTarget14d = recentTargetCount + previousTargetCount;
  if (totalTarget14d < 2 || targetDaySet.size < 2) {
    targetTrend = 'insufficient-data';
  } else if (recentTargetCount > previousTargetCount) {
    targetTrend = 'up';
  } else if (recentTargetCount < previousTargetCount) {
    targetTrend = 'down';
  } else {
    targetTrend = 'stable';
  }

  // ── Calculate Overall Trend ──
  // Guard: Require at least 3 slips across at least 2 distinct days in the 14-day window
  let overallTrend: TrendDirection;
  const totalOverall14d = recentOverallCount + previousOverallCount;
  if (totalOverall14d < 3 || overallDaySet.size < 2) {
    overallTrend = 'insufficient-data';
  } else if (recentOverallCount > previousOverallCount) {
    overallTrend = 'up';
  } else if (recentOverallCount < previousOverallCount) {
    overallTrend = 'down';
  } else {
    overallTrend = 'stable';
  }

  return {
    targetTodayCount,
    targetTrend,
    overallTodayCount,
    overallTrend,
    recentTargetCount,
    previousTargetCount,
    recentOverallCount,
    previousOverallCount,
  };
}
