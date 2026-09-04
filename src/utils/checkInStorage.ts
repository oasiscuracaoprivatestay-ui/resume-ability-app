/**
 * Daily Check-In storage + analytics helpers.
 * Records are stored as an append-only array under a single localStorage key.
 * Each record captures the status, a full ISO timestamp, and a local date key
 * so the app can filter by day without timezone ambiguity.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckInStatus = 'on-structure' | 'near-slip' | 'slip';

export interface CheckInRecord {
  id: string;
  status: CheckInStatus;
  timestamp: string;   // ISO 8601 — e.g. "2026-09-03T17:15:00.000Z"
  date: string;        // local YYYY-MM-DD — used for today-filtering
}

export interface StatusCounts {
  'on-structure': number;
  'near-slip': number;
  'slip': number;
  total: number;
}

export interface StatusPercentages {
  'on-structure': number;  // 0–100, rounded
  'near-slip': number;
  'slip': number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-checkins';

// ── Private helpers ───────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
function localDateKey(): string {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the YYYY-MM-DD date key for `n` days ago (local time). */
function nDaysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Core persistence ──────────────────────────────────────────────────────────

/** Load all stored check-in records (all time). Returns [] on parse failure. */
export function getCheckIns(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CheckInRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * Append a new check-in record for the given status.
 * Never overwrites — always pushes to the existing array.
 * Returns the newly created record.
 */
export function saveCheckIn(status: CheckInStatus): CheckInRecord {
  const record: CheckInRecord = {
    id:        generateId(),
    status,
    timestamp: new Date().toISOString(),
    date:      localDateKey(),
  };
  const all = getCheckIns();
  all.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return record;
}

// ── Date-range queries ────────────────────────────────────────────────────────

/** Returns only the check-in records whose date matches today. */
export function getTodayCheckIns(): CheckInRecord[] {
  const today = localDateKey();
  return getCheckIns().filter((r) => r.date === today);
}

/**
 * Returns check-ins from the last N calendar days (inclusive of today).
 * Uses the stored local date key for correct timezone handling.
 */
export function getCheckInsLastNDays(n: number): CheckInRecord[] {
  const cutoff = nDaysAgoKey(n - 1);   // e.g. n=7 → 6 days ago (7 days total incl. today)
  return getCheckIns().filter((r) => r.date >= cutoff);
}

/** Returns the most recent check-in record, or null if none exist. */
export function getLatestCheckIn(): CheckInRecord | null {
  const all = getCheckIns();
  return all.length > 0 ? all[all.length - 1] : null;
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

/**
 * Counts each status in an array of records.
 * Safe to call with an empty array — returns zeros.
 */
export function getStatusCounts(records: CheckInRecord[]): StatusCounts {
  const counts: StatusCounts = { 'on-structure': 0, 'near-slip': 0, 'slip': 0, total: 0 };
  for (const r of records) {
    counts[r.status] += 1;
    counts.total += 1;
  }
  return counts;
}

/**
 * Calculates percentage share of each status.
 * When total is zero, all percentages are 0 (no division by zero).
 * Values are rounded integers that sum to ≤ 100 (largest-remainder not needed at MVP).
 */
export function getStatusPercentages(counts: StatusCounts): StatusPercentages {
  if (counts.total === 0) {
    return { 'on-structure': 0, 'near-slip': 0, 'slip': 0 };
  }
  return {
    'on-structure': Math.round((counts['on-structure'] / counts.total) * 100),
    'near-slip':    Math.round((counts['near-slip']    / counts.total) * 100),
    'slip':         Math.round((counts['slip']          / counts.total) * 100),
  };
}

/**
 * Returns the dominant status key in `counts`, or null when total is 0
 * or there is a tie for the top position.
 */
export function getDominantStatus(counts: StatusCounts): CheckInStatus | null {
  if (counts.total === 0) return null;
  const entries: [CheckInStatus, number][] = [
    ['on-structure', counts['on-structure']],
    ['near-slip',    counts['near-slip']],
    ['slip',         counts['slip']],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  // Tie: top two share the same count
  if (entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}
