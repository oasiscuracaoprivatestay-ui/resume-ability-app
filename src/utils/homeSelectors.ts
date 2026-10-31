/**
 * Super Diet-Ability — Premium Home Selectors (Phase 2)
 *
 * Pure, side-effect-free helpers used by the redesigned Home screen.
 * They NEVER write to storage, never record score events, and only use
 * type-level imports so they can be unit-tested in isolation.
 */

import type { StructuredDietBlock, StructuredDietDay } from './dietStorage';
import type { ChallengeDayProgress } from '../challenges/types';

/** Block types that represent structure windows, not meals or beverages. */
const NON_MEAL_BLOCK_TYPES = new Set(['micro_fasting', 'kitchen_closed']);

/** Parses "HH:MM" into minutes since midnight, or null if invalid. */
export function parseTimeToMinutes(value: string | undefined | null): number | null {
  if (!value || typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface GetNextPlannedBlockOptions {
  /** Block IDs that have already been verified for today (will be skipped). */
  completedBlockIds?: Set<string> | string[];
  /** Yesterday's day plan, used to inspect overnight blocks that carried over. */
  yesterdayDay?: StructuredDietDay | null;
  /** Block IDs that were verified in yesterday's verification record. */
  yesterdayCompletedBlockIds?: Set<string> | string[];
}

/**
 * Determines whether a StructuredDietBlock represents a beverage or protein shake.
 * Supports:
 * - Direct block types ('beverages', 'protein_shake')
 * - Blocks categorized exclusively under food category 'beverages'
 */
export function isBeverageBlock(block: StructuredDietBlock | null | undefined): boolean {
  if (!block) return false;
  const type = String(block.type || '').trim().toLowerCase();
  if (type === 'beverages' || type === 'protein_shake') return true;
  if (Array.isArray(block.foodCategories) && block.foodCategories.length > 0) {
    return block.foodCategories.every((c) => c === 'beverages');
  }
  return false;
}

/**
 * Returns a localized or readable display label for a block's type (e.g. "Breakfast", "Beverages").
 */
export function getBlockTypeDisplay(
  block: StructuredDietBlock | null | undefined,
  t?: Record<string, any>
): string {
  if (!block) return '';
  let key = String(block.mealType || '').trim().toLowerCase();
  if (!key || key === 'other') {
    key = String(block.type || '').trim().toLowerCase();
  }
  if (t) {
    const trans = t[`sdb_type_${key}`];
    if (trans && typeof trans === 'string') return trans;
  }
  const raw = block.mealType || block.type || '';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ') : '';
}

export interface NextPlannedBlockResult {
  block: StructuredDietBlock;
  /** 'current' = now is within the block window; 'upcoming' = starts later today. */
  status: 'current' | 'upcoming';
  /** True if the block originated from yesterday's schedule and extends past midnight. */
  isCarriedOver?: boolean;
}

/**
 * Returns the current or next meal/beverage block for the given day plan.
 * Ignores structure-only windows (Micro-Fasting, Kitchen Closed), blocks with
 * invalid times, and non-structured days. Returns null when nothing remains.
 */
export function getNextPlannedBlock(
  day: StructuredDietDay | null | undefined,
  nowMinutes: number,
  options?: GetNextPlannedBlockOptions
): NextPlannedBlockResult | null {
  const completed = new Set(options?.completedBlockIds ?? []);
  const yesterdayCompleted = new Set(options?.yesterdayCompletedBlockIds ?? []);

  // 1. Check carried-over overnight blocks from yesterday (e.g. 23:00 to 01:30)
  if (
    options?.yesterdayDay &&
    options.yesterdayDay.mode === 'structured' &&
    Array.isArray(options.yesterdayDay.blocks)
  ) {
    const yesterdayCandidates = options.yesterdayDay.blocks
      .filter((b) => b && !NON_MEAL_BLOCK_TYPES.has(String(b.type || '').trim().toLowerCase()))
      .filter((b) => !yesterdayCompleted.has(b.id) && !completed.has(b.id))
      .map((b) => ({
        b,
        start: parseTimeToMinutes(b.startTime),
        end: parseTimeToMinutes(b.endTime),
      }))
      .filter((x): x is { b: StructuredDietBlock; start: number; end: number } => (
        x.start !== null && x.end !== null && x.end < x.start
      ));

    const activeYesterday = yesterdayCandidates
      .filter((c) => nowMinutes < c.end)
      .sort((a, b) => a.end - b.end || a.b.id.localeCompare(b.b.id));

    if (activeYesterday.length > 0) {
      return { block: activeYesterday[0].b, status: 'current', isCarriedOver: true };
    }
  }

  // 2. Evaluate today's scheduled blocks
  if (!day || day.mode !== 'structured' || !Array.isArray(day.blocks)) return null;

  const candidates = day.blocks
    .filter((b) => b && !NON_MEAL_BLOCK_TYPES.has(String(b.type || '').trim().toLowerCase()))
    .filter((b) => !completed.has(b.id))
    .map((b) => {
      const start = parseTimeToMinutes(b.startTime);
      const end = parseTimeToMinutes(b.endTime);
      const isOvernight = start !== null && end !== null && end < start;
      const effectiveEnd = isOvernight
        ? 1440
        : end !== null && start !== null && end > start
        ? end
        : (start !== null ? start + 30 : 0);
      return { b, start, end, isOvernight, effectiveEnd };
    })
    .filter((x): x is { b: StructuredDietBlock; start: number; end: number | null; isOvernight: boolean; effectiveEnd: number } => x.start !== null)
    .sort((a, b) => (
      a.start - b.start ||
      (a.effectiveEnd ?? 0) - (b.effectiveEnd ?? 0) ||
      a.b.id.localeCompare(b.b.id)
    ));

  // Find currently active blocks
  const activeCandidates = candidates.filter((c) => {
    if (c.isOvernight) {
      return nowMinutes >= c.start;
    }
    return nowMinutes >= c.start && nowMinutes < c.effectiveEnd;
  });

  if (activeCandidates.length > 0) {
    return { block: activeCandidates[0].b, status: 'current' };
  }

  // If none active, find earliest upcoming block
  const upcomingCandidates = candidates.filter((c) => c.start > nowMinutes);
  if (upcomingCandidates.length > 0) {
    return { block: upcomingCandidates[0].b, status: 'upcoming' };
  }

  return null;
}

/**
 * Selects a window of challenge days for the compact hero day strip.
 * - Never shows days outside the challenge (no invented days).
 * - Short challenges (1/3 days) show only their own days.
 * - Longer challenges show `size` days, keeping today positioned near the
 *   middle while clamping to the challenge start and end.
 */
export function getHeroWeekWindow(
  days: ChallengeDayProgress[],
  size = 7
): ChallengeDayProgress[] {
  if (!Array.isArray(days) || days.length === 0) return [];
  if (days.length <= size) return days.slice();

  let todayIdx = days.findIndex((d) => d.isToday);
  if (todayIdx === -1) {
    // Fallback: last past day (e.g. reference date beyond end), else first day.
    const lastPast = days.map((d) => d.isPast).lastIndexOf(true);
    todayIdx = lastPast === -1 ? 0 : lastPast;
  }

  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(todayIdx - half, days.length - size));
  return days.slice(start, start + size);
}

/** Converts a YYYY-MM-DD key into a local Date (no UTC shift). */
export function dateKeyToLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Interpolates `{name}` placeholders in localized templates. */
export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.keys(values).reduce(
    (acc, key) => acc.split(`{${key}}`).join(String(values[key])),
    template
  );
}
