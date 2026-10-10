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

export interface NextPlannedBlockResult {
  block: StructuredDietBlock;
  /** 'current' = now is within the block window; 'upcoming' = starts later today. */
  status: 'current' | 'upcoming';
}

/**
 * Returns the current or next meal/beverage block for the given day plan.
 * Ignores structure-only windows (Micro-Fasting, Kitchen Closed), blocks with
 * invalid times, and non-structured days. Returns null when nothing remains.
 */
export function getNextPlannedBlock(
  day: StructuredDietDay | null | undefined,
  nowMinutes: number
): NextPlannedBlockResult | null {
  if (!day || day.mode !== 'structured' || !Array.isArray(day.blocks)) return null;

  const candidates = day.blocks
    .filter((b) => b && !NON_MEAL_BLOCK_TYPES.has(String(b.type || '').trim().toLowerCase()))
    .map((b) => ({ b, start: parseTimeToMinutes(b.startTime), end: parseTimeToMinutes(b.endTime) }))
    .filter((x): x is { b: StructuredDietBlock; start: number; end: number | null } => x.start !== null)
    .sort((a, b) => a.start - b.start);

  for (const c of candidates) {
    const end = c.end !== null && c.end > c.start ? c.end : c.start;
    if (nowMinutes >= c.start && nowMinutes < end) {
      return { block: c.b, status: 'current' };
    }
    if (c.start > nowMinutes) {
      return { block: c.b, status: 'upcoming' };
    }
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
