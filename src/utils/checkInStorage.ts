/**
 * Daily Check-In storage.
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-checkins';

// ── Private helpers ───────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
function localDateKey(): string {
  const d = new Date();
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

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

/** Returns only the check-in records whose date matches today. */
export function getTodayCheckIns(): CheckInRecord[] {
  const today = localDateKey();
  return getCheckIns().filter((r) => r.date === today);
}

/** Returns the most recent check-in record, or null if none exist. */
export function getLatestCheckIn(): CheckInRecord | null {
  const all = getCheckIns();
  return all.length > 0 ? all[all.length - 1] : null;
}
