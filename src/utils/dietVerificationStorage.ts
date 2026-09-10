/**
 * Structured Diet Daily Verification Storage — Phase 11
 *
 * Stores daily verification states for planned diet blocks:
 *   - Status: 'on-track' | 'slip'
 *   - Planned snapshot (startTime, endTime, type, items, customText)
 *   - Actual consumed items / custom notes (if slip or differing)
 *   - Timestamp
 *
 * Dedicated namespace: 'resume-ability-diet-verifications'
 * Completely separate from the weekly plan storage ('resume-ability-diet').
 * Deterministic local date handling (YYYY-MM-DD), never uses UTC date shifts.
 */

import type { DayKey, StructuredDietBlock } from './dietStorage';
import { getLocalTodayKey } from './dietStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DietVerificationStatus = 'on-track' | 'slip';

export interface PlannedBlockSnapshot {
  startTime: string;
  endTime: string;
  type: string;
  items: string[];
  customText?: string;
}

export interface DietBlockVerification {
  id: string;
  dateKey: string;           // Local "YYYY-MM-DD"
  plannedBlockId: string;
  plannedSnapshot: PlannedBlockSnapshot;
  status: DietVerificationStatus;
  actualItems?: string[];
  actualCustomText?: string;
  verifiedAt: number;        // Epoch ms
}

export interface DailyDietVerification {
  version: 1;
  dateKey: string;
  dayKey: DayKey;
  sourcePlanName?: string;
  entries: DietBlockVerification[];
}

export interface DailyVerificationStats {
  plannedCount: number;
  reportedCount: number;
  onTrackCount: number;
  slipCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'resume-ability-diet-verifications';

// ── Local date helper ─────────────────────────────────────────────────────────

/**
 * Returns the stable local date key formatted as "YYYY-MM-DD".
 * Never uses UTC or toISOString() to prevent day shifts across timezones.
 */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Load all stored daily verifications map from localStorage.
 * Format: Record<dateKey, DailyDietVerification>
 */
export function loadAllDietVerifications(): Record<string, DailyDietVerification> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: Record<string, DailyDietVerification> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (val && typeof val === 'object' && isValidDailyVerification(val)) {
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Persist the daily verifications map to localStorage.
 */
export function saveAllDietVerifications(data: Record<string, DailyDietVerification>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private mode restriction — fail silently
  }
}

/**
 * Get daily verification record for a specific local date key.
 */
export function getDailyDietVerification(dateKey = getLocalDateKey()): DailyDietVerification | null {
  const all = loadAllDietVerifications();
  return all[dateKey] ?? null;
}

/**
 * Get or create daily verification record for today.
 */
export function getTodayDietVerification(): DailyDietVerification {
  const dateKey = getLocalDateKey();
  const all = loadAllDietVerifications();
  const existing = all[dateKey];
  if (existing) return existing;

  const todayRecord: DailyDietVerification = {
    version: 1,
    dateKey,
    dayKey: getLocalTodayKey(),
    entries: [],
  };
  return todayRecord;
}

/**
 * Save or update a single planned block verification for a given date (defaults to today).
 * Updates existing entry if plannedBlockId already exists on that date, preventing duplicates.
 */
export function saveBlockVerification(params: {
  plannedBlock: StructuredDietBlock;
  status: DietVerificationStatus;
  actualItems?: string[];
  actualCustomText?: string;
  sourcePlanName?: string;
  dateKey?: string;
}): DietBlockVerification {
  const dateKey = params.dateKey ?? getLocalDateKey();
  const all = loadAllDietVerifications();
  const daily = all[dateKey] ?? {
    version: 1,
    dateKey,
    dayKey: getLocalTodayKey(),
    sourcePlanName: params.sourcePlanName,
    entries: [],
  };

  const existingIdx = daily.entries.findIndex(
    e => e.plannedBlockId === params.plannedBlock.id
  );

  const verificationId = existingIdx >= 0
    ? daily.entries[existingIdx].id
    : (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 10)
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  // Preserve existing snapshot if updating, or capture fresh snapshot on first save
  const plannedSnapshot: PlannedBlockSnapshot = existingIdx >= 0
    ? daily.entries[existingIdx].plannedSnapshot
    : {
        startTime: params.plannedBlock.startTime,
        endTime: params.plannedBlock.endTime,
        type: params.plannedBlock.type,
        items: Array.isArray(params.plannedBlock.items) ? [...params.plannedBlock.items] : [],
        customText: params.plannedBlock.customText,
      };

  const newEntry: DietBlockVerification = {
    id: verificationId,
    dateKey,
    plannedBlockId: params.plannedBlock.id,
    plannedSnapshot,
    status: params.status,
    actualItems: params.actualItems ? [...params.actualItems] : undefined,
    actualCustomText: params.actualCustomText?.trim() || undefined,
    verifiedAt: Date.now(),
  };

  let nextEntries: DietBlockVerification[];
  if (existingIdx >= 0) {
    nextEntries = daily.entries.map((e, i) => (i === existingIdx ? newEntry : e));
  } else {
    nextEntries = [...daily.entries, newEntry];
  }

  const updatedDaily: DailyDietVerification = {
    ...daily,
    sourcePlanName: params.sourcePlanName ?? daily.sourcePlanName,
    entries: nextEntries,
  };

  all[dateKey] = updatedDaily;
  saveAllDietVerifications(all);

  return newEntry;
}

/**
 * Remove verification status for a planned block (Clear Status).
 */
export function clearBlockVerification(
  plannedBlockId: string,
  dateKey = getLocalDateKey(),
): void {
  const all = loadAllDietVerifications();
  const daily = all[dateKey];
  if (!daily) return;

  const nextEntries = daily.entries.filter(e => e.plannedBlockId !== plannedBlockId);
  if (nextEntries.length === daily.entries.length) return;

  all[dateKey] = {
    ...daily,
    entries: nextEntries,
  };
  saveAllDietVerifications(all);
}

/**
 * Calculate verification statistics for a specific date given planned block count.
 */
export function getDailyVerificationStats(
  plannedBlocksCount: number,
  dateKey = getLocalDateKey(),
): DailyVerificationStats {
  const daily = getDailyDietVerification(dateKey);
  if (!daily || daily.entries.length === 0) {
    return {
      plannedCount: plannedBlocksCount,
      reportedCount: 0,
      onTrackCount: 0,
      slipCount: 0,
    };
  }

  // Deduplicate by plannedBlockId
  const uniqueMap = new Map<string, DietBlockVerification>();
  for (const entry of daily.entries) {
    uniqueMap.set(entry.plannedBlockId, entry);
  }

  let onTrackCount = 0;
  let slipCount = 0;

  for (const entry of uniqueMap.values()) {
    if (entry.status === 'on-track') onTrackCount++;
    else if (entry.status === 'slip') slipCount++;
  }

  return {
    plannedCount: plannedBlocksCount,
    reportedCount: onTrackCount + slipCount,
    onTrackCount,
    slipCount,
  };
}

// ── Validation Helpers ────────────────────────────────────────────────────────

function isValidDailyVerification(v: unknown): v is DailyDietVerification {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.dateKey === 'string' &&
    Array.isArray(obj.entries) &&
    obj.entries.every(isValidVerificationEntry)
  );
}

function isValidVerificationEntry(e: unknown): e is DietBlockVerification {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.plannedBlockId === 'string' &&
    (obj.status === 'on-track' || obj.status === 'slip') &&
    typeof obj.verifiedAt === 'number'
  );
}
