/**
 * Daily balance / slip tracking.
 * Each calendar day gets its own record keyed by ISO date string (YYYY-MM-DD).
 * Previous days are preserved; only the active day is mutated.
 */

export interface DayRecord {
  date: string;        // YYYY-MM-DD
  balanceCount: number;
  slipCount: number;
}

const STORAGE_KEY = 'resume-ability-balance';

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function loadAll(): Record<string, DayRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DayRecord>) : {};
  } catch {
    return {};
  }
}

function saveAll(records: Record<string, DayRecord>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns today's record, creating a fresh one if the day has rolled over. */
export function loadToday(): DayRecord {
  const key = todayKey();
  const all = loadAll();
  if (all[key]) return all[key];
  // New day — create a fresh record without losing history
  const fresh: DayRecord = { date: key, balanceCount: 0, slipCount: 0 };
  all[key] = fresh;
  saveAll(all);
  return fresh;
}

/** Increment the balance count for today. Returns the updated record. */
export function recordBalance(): DayRecord {
  const key = todayKey();
  const all = loadAll();
  const today = all[key] ?? { date: key, balanceCount: 0, slipCount: 0 };
  today.balanceCount += 1;
  all[key] = today;
  saveAll(all);
  return today;
}

/** Increment the slip count for today. Returns the updated record. */
export function recordSlip(): DayRecord {
  const key = todayKey();
  const all = loadAll();
  const today = all[key] ?? { date: key, balanceCount: 0, slipCount: 0 };
  today.slipCount += 1;
  all[key] = today;
  saveAll(all);
  return today;
}

/** Daily score = balanceCount - slipCount */
export function dailyScore(record: DayRecord): number {
  return record.balanceCount - record.slipCount;
}
