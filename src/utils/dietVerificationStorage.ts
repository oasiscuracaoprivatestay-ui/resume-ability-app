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
import { getLocalTodayKey, getBlockPhotos } from './dietStorage';
import type { FoodCategoryKey } from '../data/dietData';
import type { FoodPhotoMetadata } from './photoStorage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DietVerificationStatus = 'on-track' | 'slip';

/**
 * Detailed outcome vocabulary for Phase 1.
 * First-level choice is ON TRACK or SLIP.
 * These detailed outcomes are selected within those categories.
 */
export type DetailedBlockOutcome =
  | 'on_track'
  | 'adjusted_on_track'
  | 'planned_unstructured'
  | 'near_slip'
  | 'structured_slip'
  | 'unstructured_slip';

export const ALL_DETAILED_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

export const ON_TRACK_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
] as const;

export const SLIP_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

export interface PlannedBlockSnapshot {
  startTime: string;
  endTime: string;
  type: string;
  items: string[];
  customText?: string;
  foodCategories?: FoodCategoryKey[];
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
}

export interface DietBlockVerification {
  id: string;
  dateKey: string;           // Local "YYYY-MM-DD"
  plannedBlockId: string;
  plannedSnapshot: PlannedBlockSnapshot;
  status: DietVerificationStatus;
  detailedOutcome?: DetailedBlockOutcome; // Optional for backward compatibility with legacy records
  isResumed?: boolean;                    // Measured separately from slip outcome
  resumedAt?: number;                     // Epoch ms when marked resumed
  actualItems?: string[];
  actualFoodCategories?: FoodCategoryKey[];
  actualCustomText?: string;
  foodPhoto?: FoodPhotoMetadata;          // Phase 6: optional photo attached to this eating event
  foodPhotos?: FoodPhotoMetadata[];       // Phase 6B: multi-photo support
  verifiedAt: number;        // Epoch ms
}

export interface DailyDietVerification {
  version: 1;
  dateKey: string;
  dayKey: DayKey;
  sourcePlanName?: string;
  profileId?: string;
  profileName?: string;
  entries: DietBlockVerification[];
}

export interface ResumeStats {
  resumeCount: number;
  eligibleCount: number;
  resumeRate: number; // 0 to 100 percentage
}

export interface StructureAwarenessStats {
  structuredCount: number;
  unstructuredCount: number;
  totalCount: number;
  structuredRate: number;
  unstructuredRate: number;
}

export interface DailyVerificationStats {
  plannedCount: number;
  reportedCount: number;
  onTrackCount: number;
  slipCount: number;
  resumeCount: number;
  eligibleSlipCount: number;
  resumeRate: number;
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
  detailedOutcome?: DetailedBlockOutcome;
  isResumed?: boolean;
  actualItems?: string[];
  actualFoodCategories?: FoodCategoryKey[];
  actualCustomText?: string;
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
  sourcePlanName?: string;
  profileId?: string;
  profileName?: string;
  dateKey?: string;
}): DietBlockVerification {
  const dateKey = params.dateKey ?? getLocalDateKey();
  const all = loadAllDietVerifications();
  const daily = all[dateKey] ?? {
    version: 1,
    dateKey,
    dayKey: getLocalTodayKey(),
    sourcePlanName: params.sourcePlanName,
    profileId: params.profileId,
    profileName: params.profileName,
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

  const plannedPhotos = getBlockPhotos(params.plannedBlock);

  // Preserve existing snapshot if updating, or capture fresh snapshot on first save
  const plannedSnapshot: PlannedBlockSnapshot = existingIdx >= 0
    ? daily.entries[existingIdx].plannedSnapshot
    : {
        startTime: params.plannedBlock.startTime,
        endTime: params.plannedBlock.endTime,
        type: params.plannedBlock.type,
        items: Array.isArray(params.plannedBlock.items) ? [...params.plannedBlock.items] : [],
        customText: params.plannedBlock.customText,
        foodCategories: Array.isArray(params.plannedBlock.foodCategories)
          ? [...params.plannedBlock.foodCategories]
          : undefined,
        foodPhoto: plannedPhotos[0],
        foodPhotos: plannedPhotos.length > 0 ? [...plannedPhotos] : undefined,
      };

  // Determine Resumed status: if changing to on-track, reset resumed; otherwise respect explicit param or keep existing
  let isResumed: boolean | undefined;
  let resumedAt: number | undefined;

  if (params.status === 'on-track') {
    isResumed = false;
    resumedAt = undefined;
  } else if (params.isResumed !== undefined) {
    isResumed = params.isResumed;
    resumedAt = params.isResumed
      ? (existingIdx >= 0 && daily.entries[existingIdx].resumedAt ? daily.entries[existingIdx].resumedAt : Date.now())
      : undefined;
  } else if (existingIdx >= 0) {
    isResumed = daily.entries[existingIdx].isResumed;
    resumedAt = daily.entries[existingIdx].resumedAt;
  }

  const rawAssignedPhotos = params.foodPhotos
    ?? (params.foodPhoto ? [params.foodPhoto] : undefined)
    ?? (existingIdx >= 0
        ? (daily.entries[existingIdx].foodPhotos ?? (daily.entries[existingIdx].foodPhoto ? [daily.entries[existingIdx].foodPhoto!] : undefined))
        : undefined)
    ?? (plannedPhotos.length > 0 ? plannedPhotos : undefined);

  const assignedPhotos = rawAssignedPhotos && rawAssignedPhotos.length > 0 ? rawAssignedPhotos : undefined;
  const assignedPhoto = assignedPhotos && assignedPhotos.length > 0 ? assignedPhotos[0] : undefined;

  const newEntry: DietBlockVerification = {
    id: verificationId,
    dateKey,
    plannedBlockId: params.plannedBlock.id,
    plannedSnapshot,
    status: params.status,
    detailedOutcome: params.detailedOutcome ?? (existingIdx >= 0 ? daily.entries[existingIdx].detailedOutcome : undefined),
    isResumed,
    resumedAt,
    actualItems: params.actualItems ? [...params.actualItems] : undefined,
    actualFoodCategories: params.actualFoodCategories ? [...params.actualFoodCategories] : undefined,
    actualCustomText: params.actualCustomText?.trim() || undefined,
    foodPhoto: assignedPhoto,
    foodPhotos: assignedPhotos,
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
    profileId: params.profileId ?? daily.profileId,
    profileName: params.profileName ?? daily.profileName,
    entries: nextEntries,
  };

  all[dateKey] = updatedDaily;
  saveAllDietVerifications(all);

  return newEntry;
}

/**
 * Toggles the Resumed status for an existing verification record.
 * Returns the updated record or null if not found.
 */
export function toggleBlockResumed(
  plannedBlockId: string,
  dateKey = getLocalDateKey()
): DietBlockVerification | null {
  const all = loadAllDietVerifications();
  const daily = all[dateKey];
  if (!daily) return null;

  const idx = daily.entries.findIndex(e => e.plannedBlockId === plannedBlockId);
  if (idx < 0) return null;

  const current = daily.entries[idx];
  const nextResumed = !current.isResumed;
  const updatedEntry: DietBlockVerification = {
    ...current,
    isResumed: nextResumed,
    resumedAt: nextResumed ? Date.now() : undefined,
  };

  daily.entries[idx] = updatedEntry;
  all[dateKey] = daily;
  saveAllDietVerifications(all);
  return updatedEntry;
}

/**
 * Explicitly sets the Resumed status for a verified block.
 */
export function setBlockResumed(
  plannedBlockId: string,
  isResumed: boolean,
  dateKey = getLocalDateKey()
): DietBlockVerification | null {
  const all = loadAllDietVerifications();
  const daily = all[dateKey];
  if (!daily) return null;

  const idx = daily.entries.findIndex(e => e.plannedBlockId === plannedBlockId);
  if (idx < 0) return null;

  const current = daily.entries[idx];
  const updatedEntry: DietBlockVerification = {
    ...current,
    isResumed,
    resumedAt: isResumed ? (current.resumedAt || Date.now()) : undefined,
  };

  daily.entries[idx] = updatedEntry;
  all[dateKey] = daily;
  saveAllDietVerifications(all);
  return updatedEntry;
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

// ── Resume & Structure Statistics Foundation ──────────────────────────────────

/**
 * Returns whether a record is an eligible slip record for resume tracking.
 * Includes both new detailed slip outcomes ('near_slip', 'structured_slip', 'unstructured_slip')
 * and legacy general slip records ('slip' without detailedOutcome).
 */
export function isEligibleSlipRecord(record: DietBlockVerification): boolean {
  if (record.status === 'slip') return true;
  if (record.detailedOutcome && (SLIP_OUTCOMES as readonly string[]).includes(record.detailedOutcome)) return true;
  return false;
}

/**
 * Calculates Resume statistics from a list of verification records.
 * Formula: (eligible slip records marked Resumed / total eligible slip records) * 100.
 * Reusable across Dashboard and future analytics.
 */
export function calculateResumeStats(records: DietBlockVerification[]): ResumeStats {
  const eligible = records.filter(isEligibleSlipRecord);
  const eligibleCount = eligible.length;
  const resumeCount = eligible.filter(r => r.isResumed === true).length;
  const resumeRate = eligibleCount > 0 ? Math.round((resumeCount / eligibleCount) * 100) : 0;
  return {
    resumeCount,
    eligibleCount,
    resumeRate,
  };
}

/**
 * Structured vs Unstructured categorization helpers for future analytics foundation.
 * Structured eating includes: on_track, adjusted_on_track, near_slip, structured_slip, or legacy on-track.
 * Unstructured eating includes: planned_unstructured, unstructured_slip.
 */
export function isStructuredOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  status?: DietVerificationStatus
): boolean {
  if (detailedOutcome) {
    return (
      detailedOutcome === 'on_track' ||
      detailedOutcome === 'adjusted_on_track' ||
      detailedOutcome === 'near_slip' ||
      detailedOutcome === 'structured_slip'
    );
  }
  // Legacy record fallback: legacy on-track is structured
  return status === 'on-track';
}

export function isUnstructuredOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  _status?: DietVerificationStatus
): boolean {
  if (detailedOutcome) {
    return (
      detailedOutcome === 'planned_unstructured' ||
      detailedOutcome === 'unstructured_slip'
    );
  }
  // Note: legacy slip with no detailed outcome is not assumed unstructured unless categorized
  return false;
}

/**
 * Calculates structured vs unstructured awareness statistics from verification records.
 */
export function calculateStructureStats(records: DietBlockVerification[]): StructureAwarenessStats {
  let structuredCount = 0;
  let unstructuredCount = 0;

  for (const r of records) {
    if (isStructuredOutcome(r.detailedOutcome, r.status)) {
      structuredCount++;
    } else if (isUnstructuredOutcome(r.detailedOutcome, r.status)) {
      unstructuredCount++;
    }
  }

  const totalCount = structuredCount + unstructuredCount;
  const structuredRate = totalCount > 0 ? Math.round((structuredCount / totalCount) * 100) : 0;
  const unstructuredRate = totalCount > 0 ? Math.round((unstructuredCount / totalCount) * 100) : 0;

  return {
    structuredCount,
    unstructuredCount,
    totalCount,
    structuredRate,
    unstructuredRate,
  };
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
      resumeCount: 0,
      eligibleSlipCount: 0,
      resumeRate: 0,
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

  const uniqueRecords = Array.from(uniqueMap.values());
  const resumeStats = calculateResumeStats(uniqueRecords);

  return {
    plannedCount: plannedBlocksCount,
    reportedCount: onTrackCount + slipCount,
    onTrackCount,
    slipCount,
    resumeCount: resumeStats.resumeCount,
    eligibleSlipCount: resumeStats.eligibleCount,
    resumeRate: resumeStats.resumeRate,
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
  const validStatus = obj.status === 'on-track' || obj.status === 'slip';
  const validDetailed =
    obj.detailedOutcome === undefined ||
    typeof obj.detailedOutcome === 'string';
  const validResumed =
    obj.isResumed === undefined || typeof obj.isResumed === 'boolean';
  return (
    typeof obj.id === 'string' &&
    typeof obj.plannedBlockId === 'string' &&
    validStatus &&
    validDetailed &&
    validResumed &&
    typeof obj.verifiedAt === 'number'
  );
}

/** Clear all stored daily diet verifications */
export function clearAllDietVerifications(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}


