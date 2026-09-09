/**
 * Structured Diet Storage — Phase 6B
 *
 * Stores the user's single active structured diet plan:
 *   name          — user-given plan name
 *   blocks[]      — ordered list of time blocks
 *
 * Each block has:
 *   id            — unique identifier
 *   startTime     — 24h "HH:MM" string (e.g. "08:00")
 *   endTime       — 24h "HH:MM" string (e.g. "09:30")
 *   type          — block/meal type label
 *   items[]       — selected food/structure items
 *   customText    — free-text custom note (optional)
 *
 * Pattern: one localStorage key, typed interface, safe defaults,
 * backward-compatible. Never throws on read.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StructuredDietBlock {
  id: string;
  startTime: string;   // 24h "HH:MM"
  endTime: string;     // 24h "HH:MM"
  type: string;        // from BLOCK_TYPES or 'Custom'
  items: string[];     // selected from FOOD_OPTIONS
  customText: string;  // free-text; empty string if not set
}

export interface StructuredDietPlan {
  name: string;
  blocks: StructuredDietBlock[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-diet';

const DEFAULT_PLAN: StructuredDietPlan = {
  name: 'My Structured Diet',
  blocks: [],
};

// ── Core persistence ──────────────────────────────────────────────────────────

/**
 * Load the active diet plan from localStorage.
 * Merges with defaults for backward compatibility.
 */
export function loadDietPlan(): StructuredDietPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAN, blocks: [] };
    const parsed = JSON.parse(raw) as Partial<StructuredDietPlan>;
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim()
        : DEFAULT_PLAN.name,
      blocks: Array.isArray(parsed.blocks)
        ? parsed.blocks.filter(isValidBlock).map(sanitiseBlock)
        : [],
    };
  } catch {
    return { ...DEFAULT_PLAN, blocks: [] };
  }
}

/** Persist the active diet plan. Safe to call frequently. */
export function saveDietPlan(plan: StructuredDietPlan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently.
  }
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
