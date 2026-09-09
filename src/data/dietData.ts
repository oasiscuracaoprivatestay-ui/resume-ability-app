/**
 * Diet Builder Data — Phase 6B
 *
 * Centralised configuration for block types, food/structure options,
 * and 30-minute time slots. Keeping data out of components follows
 * the same pattern as SLIP_CONTEXT_ICONS in types.ts.
 */

// ── Block types ───────────────────────────────────────────────────────────────
// i18n keys are defined in the Translations interface (sdb_ prefix).
// The value here is the internal storage string, also used as an i18n key suffix.

export const BLOCK_TYPE_KEYS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'beverages',
  'protein_shake',
  'micro_fasting',
  'kitchen_closed',
  'custom',
] as const;

export type BlockTypeKey = (typeof BLOCK_TYPE_KEYS)[number];

export const BLOCK_TYPE_ICONS: Record<BlockTypeKey, string> = {
  breakfast:      '🌅',
  lunch:          '☀️',
  dinner:         '🌙',
  snack:          '🍎',
  beverages:      '☕',
  protein_shake:  '💪',
  micro_fasting:  '⏳',
  kitchen_closed: '🔒',
  custom:         '✏️',
};

// ── Food / structure options ──────────────────────────────────────────────────

export const FOOD_OPTION_KEYS = [
  'unsweetened_beverages',
  'black_coffee',
  'tea',
  'herbal_drink',
  'protein_shake',
  'protein_rich_food',
  'vegetables',
  'minimal_carbs',
  'micro_fasting',
  'kitchen_closed',
] as const;

export type FoodOptionKey = (typeof FOOD_OPTION_KEYS)[number];

// ── 30-minute time slots ──────────────────────────────────────────────────────

/** All 48 half-hour slots in 12-hour display format. Internal value is 24h "HH:MM". */
export interface TimeSlot {
  value: string;   // "00:00" ... "23:30"
  label: string;   // "12:00 AM" ... "11:30 PM"
}

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const value = `${hh}:${mm}`;

      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${period}`;

      slots.push({ value, label });
    }
  }
  return slots;
}

export const TIME_SLOTS: TimeSlot[] = buildTimeSlots();

/** Convert internal 24h "HH:MM" to display label. */
export function formatTime(value: string): string {
  const slot = TIME_SLOTS.find(s => s.value === value);
  return slot?.label ?? value;
}
