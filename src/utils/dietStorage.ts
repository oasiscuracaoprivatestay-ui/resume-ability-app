/**
 * Structured Diet Storage — Phase 10 (Weekly / Daily Planning)
 *
 * Upgraded from single-plan (v1) to weekly plan (v2).
 * Stores a 7-day schedule (Mon..Sun) where each day has its own
 * mode ('structured' | 'unstructured') and independent blocks[].
 *
 * Pattern: one localStorage key ('resume-ability-diet'), typed interface,
 * versioned (version: 2), safe defaults, idempotent backward-compatible migration.
 * Never throws on read.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type DayMode = 'structured' | 'unstructured';

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface StructuredDietBlock {
  id: string;
  startTime: string;   // 24h "HH:MM"
  endTime: string;     // 24h "HH:MM"
  type: string;        // from BLOCK_TYPES or 'Custom'
  items: string[];     // selected from FOOD_OPTIONS
  customText: string;  // free-text; empty string if not set
}

export interface StructuredDietDay {
  dayKey: DayKey;
  dayOfWeek: number;   // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  mode: DayMode;
  blocks: StructuredDietBlock[];
}

export interface WeeklyStructuredDiet {
  version: 2;
  planName: string;
  days: StructuredDietDay[];
}

// Legacy v1 interface for backward compatibility
export interface StructuredDietPlan {
  name: string;
  blocks: StructuredDietBlock[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-diet';
export const DEFAULT_PLAN_NAME = 'My Structured Diet';

export function createDefaultWeeklyDiet(planName = DEFAULT_PLAN_NAME): WeeklyStructuredDiet {
  return {
    version: 2,
    planName,
    days: DAY_KEYS.map((dayKey, idx) => ({
      dayKey,
      dayOfWeek: idx,
      mode: 'structured',
      blocks: [],
    })),
  };
}

// ── Block cloning & ID generation ─────────────────────────────────────────────

/**
 * Generate a short unique block ID.
 * Uses crypto.randomUUID() where available, falls back to Date.now() + random.
 */
export function generateBlockId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

/**
 * Deep-clone a list of blocks, assigning brand new unique IDs to each block
 * to guarantee no identity collisions and zero reference sharing between days.
 */
export function deepCloneBlocks(blocks: StructuredDietBlock[]): StructuredDietBlock[] {
  return blocks.map(b => ({
    id: generateBlockId(),
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    items: Array.isArray(b.items) ? [...b.items] : [],
    customText: typeof b.customText === 'string' ? b.customText : '',
  }));
}

// ── Core persistence & idempotent migration ───────────────────────────────────

/**
 * Load the weekly diet plan from localStorage.
 * Detects legacy v1 data ({ name, blocks }) and safely migrates it to v2:
 * duplicating the existing plan across all 7 days with fresh independent block IDs.
 * If data is missing or malformed, safely returns default weekly diet.
 */
export function loadWeeklyDiet(): WeeklyStructuredDiet {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultWeeklyDiet();
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultWeeklyDiet();
    }

    // Check if already version 2
    if (parsed.version === 2 && Array.isArray(parsed.days)) {
      const planName = typeof parsed.planName === 'string' && parsed.planName.trim()
        ? parsed.planName.trim()
        : DEFAULT_PLAN_NAME;

      const rawDays = parsed.days as Record<string, unknown>[];
      const days: StructuredDietDay[] = DAY_KEYS.map((dayKey, idx) => {
        const found = rawDays.find(d => d && typeof d === 'object' && d.dayKey === dayKey);
        if (!found) {
          return {
            dayKey,
            dayOfWeek: idx,
            mode: 'structured',
            blocks: [],
          };
        }
        const mode: DayMode = found.mode === 'unstructured' ? 'unstructured' : 'structured';
        const blocks = Array.isArray(found.blocks)
          ? (found.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
          : [];
        return {
          dayKey,
          dayOfWeek: idx,
          mode,
          blocks,
        };
      });

      return {
        version: 2,
        planName,
        days,
      };
    }

    // Backward-compatible migration from v1 (single StructuredDietPlan)
    const legacyName = typeof parsed.name === 'string' && parsed.name.trim()
      ? parsed.name.trim()
      : DEFAULT_PLAN_NAME;

    const legacyBlocks = Array.isArray(parsed.blocks)
      ? (parsed.blocks as unknown[]).filter(isValidBlock).map(sanitiseBlock)
      : [];

    // Duplicate legacy plan across all 7 days with deep-cloned blocks & fresh IDs
    const migratedDays: StructuredDietDay[] = DAY_KEYS.map((dayKey, idx) => ({
      dayKey,
      dayOfWeek: idx,
      mode: 'structured',
      blocks: deepCloneBlocks(legacyBlocks),
    }));

    const migrated: WeeklyStructuredDiet = {
      version: 2,
      planName: legacyName,
      days: migratedDays,
    };

    // Persist migrated structure immediately so subsequent reads are v2
    saveWeeklyDiet(migrated);
    return migrated;
  } catch {
    return createDefaultWeeklyDiet();
  }
}

/** Persist the weekly diet plan. Safe to call frequently. */
export function saveWeeklyDiet(diet: WeeklyStructuredDiet): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(diet));
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently.
  }
}

// ── Day accessors & mutators ──────────────────────────────────────────────────

/** Get the plan for a specific day from a WeeklyStructuredDiet. */
export function getDayPlan(diet: WeeklyStructuredDiet, dayKey: DayKey): StructuredDietDay {
  const day = diet.days.find(d => d.dayKey === dayKey);
  if (day) return day;
  const idx = DAY_KEYS.indexOf(dayKey);
  return {
    dayKey,
    dayOfWeek: idx >= 0 ? idx : 0,
    mode: 'structured',
    blocks: [],
  };
}

/** Update a single day's plan within the weekly structure. */
export function updateDayPlan(
  diet: WeeklyStructuredDiet,
  dayKey: DayKey,
  updater: (day: StructuredDietDay) => StructuredDietDay,
): WeeklyStructuredDiet {
  const nextDays = diet.days.map(d => {
    if (d.dayKey !== dayKey) return d;
    return updater({ ...d });
  });
  return { ...diet, days: nextDays };
}

/** Set the mode ('structured' | 'unstructured') for a specific day. */
export function setDayMode(
  diet: WeeklyStructuredDiet,
  dayKey: DayKey,
  mode: DayMode,
): WeeklyStructuredDiet {
  return updateDayPlan(diet, dayKey, d => ({ ...d, mode }));
}

/**
 * Copy a day's plan (blocks and mode) to one or more target days.
 * Target days receive independent deep copies of blocks with new IDs.
 */
export function copyDayPlan(
  diet: WeeklyStructuredDiet,
  sourceKey: DayKey,
  targetKeys: DayKey[],
): WeeklyStructuredDiet {
  const sourceDay = getDayPlan(diet, sourceKey);
  const targets = new Set(targetKeys.filter(k => k !== sourceKey));
  if (targets.size === 0) return diet;

  const nextDays = diet.days.map(d => {
    if (!targets.has(d.dayKey)) return d;
    return {
      ...d,
      mode: sourceDay.mode,
      blocks: deepCloneBlocks(sourceDay.blocks),
    };
  });

  return { ...diet, days: nextDays };
}

/**
 * Get device's current local calendar day as a DayKey ('mon' .. 'sun').
 * Based entirely on local time, zero UTC assumptions.
 */
export function getLocalTodayKey(): DayKey {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const map: Record<number, DayKey> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[jsDay] ?? 'mon';
}

// ── Legacy adapters (for backward compatibility if called) ────────────────────

export function loadDietPlan(): StructuredDietPlan {
  const weekly = loadWeeklyDiet();
  const todayKey = getLocalTodayKey();
  const today = getDayPlan(weekly, todayKey);
  return {
    name: weekly.planName,
    blocks: today.blocks,
  };
}

export function saveDietPlan(plan: StructuredDietPlan): void {
  const weekly = loadWeeklyDiet();
  const todayKey = getLocalTodayKey();
  const updated = updateDayPlan(
    { ...weekly, planName: plan.name },
    todayKey,
    d => ({ ...d, blocks: plan.blocks }),
  );
  saveWeeklyDiet(updated);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidBlock(b: unknown): b is StructuredDietBlock {
  if (!b || typeof b !== 'object') return false;
  const block = b as Record<string, unknown>;
  return (
    typeof block.id === 'string' &&
    typeof block.startTime === 'string' &&
    typeof block.endTime === 'string' &&
    typeof block.type === 'string'
  );
}

function sanitiseBlock(b: StructuredDietBlock): StructuredDietBlock {
  return {
    id: b.id,
    startTime: b.startTime,
    endTime: b.endTime,
    type: b.type,
    items: Array.isArray(b.items) ? b.items.filter(i => typeof i === 'string') : [],
    customText: typeof b.customText === 'string' ? b.customText : '',
  };
}

/**
 * Returns true if the block spans midnight (overnight range).
 * An overnight block has endTime <= startTime numerically.
 */
export function isOvernightBlock(block: Pick<StructuredDietBlock, 'startTime' | 'endTime'>): boolean {
  return timeToMinutes(block.endTime) <= timeToMinutes(block.startTime);
}

/** Convert "HH:MM" to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Sort blocks in display order:
 * - Same-day blocks by startTime ascending
 * - Overnight blocks appear at the end (they start in the evening)
 *   but are sorted among themselves by startTime
 */
export function sortBlocks(blocks: StructuredDietBlock[]): StructuredDietBlock[] {
  return [...blocks].sort((a, b) => {
    const aMin = timeToMinutes(a.startTime);
    const bMin = timeToMinutes(b.startTime);
    const aOver = isOvernightBlock(a);
    const bOver = isOvernightBlock(b);
    // Non-overnight before overnight
    if (!aOver && bOver) return -1;
    if (aOver && !bOver) return 1;
    return aMin - bMin;
  });
}
