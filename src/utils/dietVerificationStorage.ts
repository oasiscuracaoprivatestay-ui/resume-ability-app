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

import type { DayKey, StructuredDietBlock, MealTypeKey } from './dietStorage';
import { getLocalTodayKey, getBlockPhotos, calculateEndTimeFromStart } from './dietStorage';
import type { FoodCategoryKey } from '../data/dietData';
import type { FoodPhotoMetadata } from './photoStorage';
import type { FoodQuantitiesMap, FoodItemQuantity, SoupPortionKey } from '../data/foodOptions';
import { reconcileDietScoreEvent } from './scoringEngine';

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
  | 'twenty_percent_off_track'
  | 'near_slip'
  | 'structured_slip'
  | 'unstructured_slip';

export const ALL_DETAILED_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
  'twenty_percent_off_track',
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

export const ON_TRACK_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
  'twenty_percent_off_track',
] as const;

export const SLIP_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

export type DietRecordType = 'food' | 'neutral';

export interface PlannedBlockSnapshot {
  startTime: string;
  endTime: string;
  type: string;
  items: string[];
  customText?: string;
  mealType?: MealTypeKey;
  foodCategories?: FoodCategoryKey[];
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  foodQuantities?: FoodQuantitiesMap;
  soupPortion?: SoupPortionKey;
  entryQuantity?: FoodItemQuantity;
  customQuantity?: string;
  quantity?: string;
  recordType?: DietRecordType;
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
}

export type DriftState = 'none' | 'started' | 'drifting' | 'stopped';

export interface DietBlockVerification {
  id: string;
  dateKey: string;           // Local "YYYY-MM-DD"
  plannedBlockId: string;
  plannedSnapshot: PlannedBlockSnapshot;
  status: DietVerificationStatus;
  detailedOutcome?: DetailedBlockOutcome; // Optional for backward compatibility with legacy records
  isResumed?: boolean;                    // Measured separately from slip outcome
  resumedAt?: number;                     // Epoch ms when marked resumed
  // Phase 26D: Drift lifecycle
  driftState?: DriftState;                // 'none' | 'started' | 'drifting' | 'stopped'
  driftStartedAt?: number;               // Epoch ms when Start Drift was initiated
  driftStoppedAt?: number;               // Epoch ms when Stopped Drifting was initiated
  driftUpdatedAt?: number;               // Epoch ms of last drift state transition
  mealType?: MealTypeKey;                 // Phase 7B: preserved meal type
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>; // Phase 7C
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;    // Phase 7C
  foodQuantities?: FoodQuantitiesMap;     // Phase 28: planned/original food quantities
  actualItems?: string[];
  actualFoodCategories?: FoodCategoryKey[];
  actualFoodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  actualCustomFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  actualFoodQuantities?: FoodQuantitiesMap; // Phase 28: actual consumed food quantities
  actualCustomText?: string;
  entryQuantity?: FoodItemQuantity;       // Phase 30: direct/overall entry quantity
  customQuantity?: string;                // Phase 30: optional free-text quantity fallback
  quantity?: string;                      // Phase 31C: flexible optional quantity (e.g. for neutral log)
  soupPortion?: SoupPortionKey;           // Phase 31A: optional quick soup portion size
  actualSoupPortion?: SoupPortionKey;     // Phase 31A: actual soup portion consumed
  startTime?: string;                     // Phase 30: start time override/spec
  endTime?: string;                       // Phase 30: end time override/spec
  recordType?: DietRecordType;            // Phase 31C: 'food' | 'neutral' (default 'food')
  foodPhoto?: FoodPhotoMetadata;          // Phase 6: optional photo attached to this eating event
  foodPhotos?: FoodPhotoMetadata[];       // Phase 6B: multi-photo support
  isUnplanned?: boolean;                  // Phase 26A: true when logged without a pre-existing planned block
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
 * Creates a clean snapshot of a planned block for verification records.
 */
export function createPlannedBlockSnapshot(plannedBlock: StructuredDietBlock): PlannedBlockSnapshot {
  const plannedPhotos = getBlockPhotos(plannedBlock);
  return {
    startTime: plannedBlock.startTime,
    endTime: plannedBlock.endTime,
    type: plannedBlock.type,
    items: Array.isArray(plannedBlock.items) ? [...plannedBlock.items] : [],
    customText: plannedBlock.customText,
    mealType: plannedBlock.mealType,
    foodCategories: Array.isArray(plannedBlock.foodCategories)
      ? [...plannedBlock.foodCategories]
      : undefined,
    foodSelections: plannedBlock.foodSelections
      ? JSON.parse(JSON.stringify(plannedBlock.foodSelections))
      : undefined,
    customFoods: plannedBlock.customFoods
      ? JSON.parse(JSON.stringify(plannedBlock.customFoods))
      : undefined,
    foodQuantities: plannedBlock.foodQuantities
      ? JSON.parse(JSON.stringify(plannedBlock.foodQuantities))
      : undefined,
    soupPortion: plannedBlock.soupPortion,
    foodPhoto: plannedPhotos[0],
    foodPhotos: plannedPhotos.length > 0 ? [...plannedPhotos] : undefined,
  };
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
  driftState?: DriftState;
  actualItems?: string[];
  actualFoodCategories?: FoodCategoryKey[];
  actualFoodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  actualCustomFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  actualCustomText?: string;
  foodQuantities?: FoodQuantitiesMap;
  actualFoodQuantities?: FoodQuantitiesMap;
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

  // Preserve existing snapshot if updating, or capture fresh snapshot on first save
  // When updating an existing verification, refresh snapshot's food quantities/selections if plannedBlock updated them
  const plannedSnapshot: PlannedBlockSnapshot = existingIdx >= 0
    ? {
        ...daily.entries[existingIdx].plannedSnapshot,
        foodQuantities: params.plannedBlock.foodQuantities
          ? JSON.parse(JSON.stringify(params.plannedBlock.foodQuantities))
          : daily.entries[existingIdx].plannedSnapshot.foodQuantities,
        foodSelections: params.plannedBlock.foodSelections
          ? JSON.parse(JSON.stringify(params.plannedBlock.foodSelections))
          : daily.entries[existingIdx].plannedSnapshot.foodSelections,
        customFoods: params.plannedBlock.customFoods
          ? JSON.parse(JSON.stringify(params.plannedBlock.customFoods))
          : daily.entries[existingIdx].plannedSnapshot.customFoods,
        soupPortion: params.plannedBlock.soupPortion ?? daily.entries[existingIdx].plannedSnapshot.soupPortion,
      }
    : createPlannedBlockSnapshot(params.plannedBlock);

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

  // Non-destructive photo resolution: distinguish omitted (undefined) from intentionally cleared ([] or null/"")
  let assignedPhotos: FoodPhotoMetadata[] | undefined;
  if (params.foodPhotos !== undefined) {
    // Explicitly provided: non-empty array sets photos; empty array intentionally clears photos
    assignedPhotos = params.foodPhotos.length > 0 ? [...params.foodPhotos] : undefined;
  } else if (params.foodPhoto !== undefined) {
    // Single photo explicitly provided (truthy sets, falsy clears)
    assignedPhotos = params.foodPhoto ? [params.foodPhoto] : undefined;
  } else if (existingIdx >= 0) {
    // Omitted: preserve existing verification's photos
    assignedPhotos = daily.entries[existingIdx].foodPhotos
      ?? (daily.entries[existingIdx].foodPhoto ? [daily.entries[existingIdx].foodPhoto!] : undefined);
  } else {
    // Omitted on new record: inherit from planned snapshot
    assignedPhotos = plannedSnapshot.foodPhotos;
  }
  const assignedPhoto = assignedPhotos && assignedPhotos.length > 0 ? assignedPhotos[0] : undefined;

  // Non-destructive customText: distinguish omitted (undefined) from intentionally cleared ("" or null)
  let actualCustomText: string | undefined;
  if (params.actualCustomText !== undefined) {
    const trimmed = params.actualCustomText?.trim();
    actualCustomText = trimmed ? trimmed : undefined;
  } else if (existingIdx >= 0) {
    actualCustomText = daily.entries[existingIdx].actualCustomText;
  } else {
    actualCustomText = params.plannedBlock.customText?.trim() || undefined;
  }

  // Non-destructive items: distinguish omitted (undefined) from intentionally cleared ([])
  let actualItems: string[] | undefined;
  if (params.actualItems !== undefined) {
    actualItems = params.actualItems.length > 0 ? [...params.actualItems] : undefined;
  } else if (existingIdx >= 0) {
    actualItems = daily.entries[existingIdx].actualItems;
  } else {
    actualItems = params.plannedBlock.items && params.plannedBlock.items.length > 0
      ? [...params.plannedBlock.items]
      : undefined;
  }

  // Non-destructive categories: distinguish omitted (undefined) from intentionally cleared ([])
  let actualFoodCategories: FoodCategoryKey[] | undefined;
  if (params.actualFoodCategories !== undefined) {
    actualFoodCategories = params.actualFoodCategories.length > 0 ? [...params.actualFoodCategories] : undefined;
  } else if (existingIdx >= 0) {
    actualFoodCategories = daily.entries[existingIdx].actualFoodCategories;
  } else {
    actualFoodCategories = params.plannedBlock.foodCategories && params.plannedBlock.foodCategories.length > 0
      ? [...params.plannedBlock.foodCategories]
      : undefined;
  }

  // Non-destructive food selections: distinguish omitted (undefined) from intentionally cleared ({})
  let actualFoodSelections: Partial<Record<FoodCategoryKey, string[]>> | undefined;
  if (params.actualFoodSelections !== undefined) {
    actualFoodSelections = params.actualFoodSelections && Object.keys(params.actualFoodSelections).length > 0
      ? { ...params.actualFoodSelections }
      : undefined;
  } else if (existingIdx >= 0) {
    actualFoodSelections = daily.entries[existingIdx].actualFoodSelections;
  } else {
    actualFoodSelections = params.plannedBlock.foodSelections
      ? { ...params.plannedBlock.foodSelections }
      : undefined;
  }

  // Non-destructive custom foods: distinguish omitted (undefined) from intentionally cleared ({})
  let actualCustomFoods: Partial<Record<FoodCategoryKey, string[]>> | undefined;
  if (params.actualCustomFoods !== undefined) {
    actualCustomFoods = params.actualCustomFoods && Object.keys(params.actualCustomFoods).length > 0
      ? { ...params.actualCustomFoods }
      : undefined;
  } else if (existingIdx >= 0) {
    actualCustomFoods = daily.entries[existingIdx].actualCustomFoods;
  } else {
    actualCustomFoods = params.plannedBlock.customFoods
      ? { ...params.plannedBlock.customFoods }
      : undefined;
  }

  // Non-destructive food quantities: distinguish omitted (undefined) from intentionally cleared ({})
  let actualFoodQuantities: FoodQuantitiesMap | undefined;
  if (params.actualFoodQuantities !== undefined) {
    actualFoodQuantities = params.actualFoodQuantities && Object.keys(params.actualFoodQuantities).length > 0
      ? { ...params.actualFoodQuantities }
      : undefined;
  } else if (params.foodQuantities !== undefined) {
    actualFoodQuantities = params.foodQuantities && Object.keys(params.foodQuantities).length > 0
      ? { ...params.foodQuantities }
      : undefined;
  } else if (params.plannedBlock.foodQuantities !== undefined) {
    actualFoodQuantities = params.plannedBlock.foodQuantities && Object.keys(params.plannedBlock.foodQuantities).length > 0
      ? { ...params.plannedBlock.foodQuantities }
      : undefined;
  } else if (existingIdx >= 0) {
    actualFoodQuantities = daily.entries[existingIdx].actualFoodQuantities
      ?? daily.entries[existingIdx].foodQuantities;
  } else {
    actualFoodQuantities = undefined;
  }

  // Preserve compatible detailedOutcome if omitted
  const resolvedDetailedOutcome = params.detailedOutcome !== undefined
    ? params.detailedOutcome
    : (existingIdx >= 0 && (
        (params.status === 'on-track' && ON_TRACK_OUTCOMES.includes(daily.entries[existingIdx].detailedOutcome as any)) ||
        (params.status === 'slip' && SLIP_OUTCOMES.includes(daily.entries[existingIdx].detailedOutcome as any))
      )
        ? daily.entries[existingIdx].detailedOutcome
        : (params.status === 'on-track' ? 'on_track' : 'structured_slip')
      );

  const newEntry: DietBlockVerification = {
    id: verificationId,
    dateKey,
    plannedBlockId: params.plannedBlock.id,
    plannedSnapshot,
    status: params.status,
    detailedOutcome: resolvedDetailedOutcome,
    isResumed,
    resumedAt,
    driftState: params.driftState ?? (existingIdx >= 0 ? daily.entries[existingIdx].driftState : undefined),
    driftStartedAt: existingIdx >= 0 ? daily.entries[existingIdx].driftStartedAt : undefined,
    driftStoppedAt: existingIdx >= 0 ? daily.entries[existingIdx].driftStoppedAt : undefined,
    driftUpdatedAt: existingIdx >= 0 ? daily.entries[existingIdx].driftUpdatedAt : undefined,
    mealType: params.plannedBlock.mealType ?? (existingIdx >= 0 ? daily.entries[existingIdx].mealType : undefined),
    foodSelections: params.plannedBlock.foodSelections ?? (existingIdx >= 0 ? daily.entries[existingIdx].foodSelections : undefined),
    customFoods: params.plannedBlock.customFoods ?? (existingIdx >= 0 ? daily.entries[existingIdx].customFoods : undefined),
    foodQuantities: params.plannedBlock.foodQuantities ?? (existingIdx >= 0 ? daily.entries[existingIdx].foodQuantities : undefined),
    soupPortion: params.plannedBlock.soupPortion ?? (existingIdx >= 0 ? daily.entries[existingIdx].soupPortion : undefined),
    actualSoupPortion: params.plannedBlock.soupPortion ?? (existingIdx >= 0 ? daily.entries[existingIdx].actualSoupPortion : undefined),
    actualItems,
    actualFoodCategories,
    actualFoodSelections,
    actualCustomFoods,
    actualFoodQuantities,
    actualCustomText,
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
 * Update food quantities for an existing verification entry (planned or unplanned) in place.
 * Autosaves to storage and returns the updated entry, or null if not found.
 * Does NOT alter status, outcome, timestamps, photos, or generate score events.
 */
export function updateVerificationQuantities(
  blockIdOrPlannedBlockId: string,
  quantities: FoodQuantitiesMap,
  dateKey: string = getLocalDateKey()
): DietBlockVerification | null {
  const all = loadAllDietVerifications();
  let targetDateKey = dateKey;
  let daily = all[targetDateKey];

  let idx = daily?.entries.findIndex(
    e => e.plannedBlockId === blockIdOrPlannedBlockId || e.id === blockIdOrPlannedBlockId
  ) ?? -1;

  if (idx === -1) {
    // Search all dates if not found in given dateKey
    for (const [dk, d] of Object.entries(all)) {
      const foundIdx = d.entries.findIndex(
        e => e.plannedBlockId === blockIdOrPlannedBlockId || e.id === blockIdOrPlannedBlockId
      );
      if (foundIdx !== -1) {
        targetDateKey = dk;
        daily = d;
        idx = foundIdx;
        break;
      }
    }
  }

  if (!daily || idx === -1) return null;

  const existing = daily.entries[idx];
  const cleanedQuantities = Object.keys(quantities).length > 0 ? { ...quantities } : undefined;

  const updatedEntry: DietBlockVerification = {
    ...existing,
    actualFoodQuantities: cleanedQuantities,
    foodQuantities: cleanedQuantities,
    plannedSnapshot: existing.plannedSnapshot
      ? {
          ...existing.plannedSnapshot,
          foodQuantities: cleanedQuantities ? JSON.parse(JSON.stringify(cleanedQuantities)) : undefined,
        }
      : existing.plannedSnapshot,
  };

  const nextEntries = daily.entries.map((e, i) => (i === idx ? updatedEntry : e));
  all[targetDateKey] = {
    ...daily,
    entries: nextEntries,
  };

  saveAllDietVerifications(all);
  return updatedEntry;
}

export interface UpdateFoodLogUpdates {
  description?: string;
  customText?: string;
  foodCategories?: FoodCategoryKey[];
  outcome?: DetailedBlockOutcome;
  status?: DietVerificationStatus;
  mealType?: MealTypeKey;
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  foodPhotos?: FoodPhotoMetadata[];
  foodQuantities?: FoodQuantitiesMap;
  soupPortion?: SoupPortionKey;
  // Phase 30 additions
  isUnplanned?: boolean;
  targetDateKey?: string;
  startTime?: string;
  endTime?: string;
  isResumed?: boolean;
  entryQuantity?: FoodItemQuantity;
  customQuantity?: string;
  quantity?: string;
  // Phase 31C addition
  recordType?: DietRecordType;
}

/**
 * Move a verification record from one date to another without leaving duplicates.
 */
export function moveVerificationRecord(
  plannedBlockId: string,
  fromDateKey: string,
  toDateKey: string
): DietBlockVerification | null {
  if (fromDateKey === toDateKey) {
    const all = loadAllDietVerifications();
    return all[fromDateKey]?.entries.find(e => e.plannedBlockId === plannedBlockId || e.id === plannedBlockId) ?? null;
  }
  const all = loadAllDietVerifications();
  const sourceDay = all[fromDateKey];
  if (!sourceDay) return null;
  const idx = sourceDay.entries.findIndex(e => e.plannedBlockId === plannedBlockId || e.id === plannedBlockId);
  if (idx === -1) return null;

  const [record] = sourceDay.entries.splice(idx, 1);
  record.dateKey = toDateKey;

  if (!all[toDateKey]) {
    all[toDateKey] = {
      version: 1,
      dateKey: toDateKey,
      dayKey: getLocalTodayKey(),
      sourcePlanName: sourceDay.sourcePlanName,
      profileId: sourceDay.profileId,
      profileName: sourceDay.profileName,
      entries: [],
    };
  }
  all[toDateKey].entries.push(record);
  saveAllDietVerifications(all);
  return record;
}

/**
 * Update an existing food log (or verified block) in-place.
 * Updates description, categories, outcomes, selections, custom foods, photos, quantities,
 * date moving (without duplicate records), and reconciles score events.
 */
export function updateUnplannedFoodLog(
  plannedBlockId: string,
  updates: UpdateFoodLogUpdates,
  dateKey: string = getLocalDateKey()
): DietBlockVerification | null {
  const all = loadAllDietVerifications();
  let sourceDateKey = dateKey;
  let daily = all[sourceDateKey];

  let idx = daily?.entries.findIndex(
    e => e.plannedBlockId === plannedBlockId || e.id === plannedBlockId
  ) ?? -1;

  if (idx === -1) {
    for (const [dk, d] of Object.entries(all)) {
      const foundIdx = d.entries.findIndex(
        e => e.plannedBlockId === plannedBlockId || e.id === plannedBlockId
      );
      if (foundIdx !== -1) {
        sourceDateKey = dk;
        daily = d;
        idx = foundIdx;
        break;
      }
    }
  }

  if (!daily || idx === -1) return null;

  const existing = daily.entries[idx];
  const cleanedQuantities = updates.foodQuantities && Object.keys(updates.foodQuantities).length > 0
    ? { ...updates.foodQuantities }
    : undefined;

  const isNowUnplanned = updates.isUnplanned !== undefined ? updates.isUnplanned : existing.isUnplanned;
  const nextIsResumed = updates.isResumed !== undefined ? updates.isResumed : existing.isResumed;
  const nextStartTime = updates.startTime || existing.startTime || existing.plannedSnapshot.startTime;
  const nextEndTime = updates.endTime || existing.endTime || existing.plannedSnapshot.endTime;
  const nextRecordType: DietRecordType = updates.recordType !== undefined
    ? updates.recordType
    : (existing.recordType || 'food');

  const destinationDateKey = updates.targetDateKey && updates.targetDateKey.trim() !== ''
    ? updates.targetDateKey
    : sourceDateKey;

  const nextDescription = updates.description !== undefined
    ? updates.description
    : updates.customText !== undefined
    ? updates.customText
    : existing.actualCustomText;

  const nextQuantity = updates.quantity !== undefined
    ? updates.quantity
    : updates.customQuantity !== undefined
    ? updates.customQuantity
    : (existing.quantity || existing.customQuantity);

  const updatedEntry: DietBlockVerification = {
    ...existing,
    dateKey: destinationDateKey,
    recordType: nextRecordType,
    status: updates.status !== undefined ? updates.status : existing.status,
    detailedOutcome: updates.outcome !== undefined ? updates.outcome : existing.detailedOutcome,
    mealType: updates.mealType !== undefined ? updates.mealType : existing.mealType,
    isUnplanned: isNowUnplanned,
    isResumed: nextIsResumed,
    resumedAt: nextIsResumed ? (existing.resumedAt || Date.now()) : undefined,
    startTime: nextStartTime,
    endTime: nextEndTime,
    entryQuantity: updates.entryQuantity !== undefined ? updates.entryQuantity : existing.entryQuantity,
    customQuantity: nextQuantity,
    quantity: nextQuantity,
    soupPortion: updates.soupPortion !== undefined ? updates.soupPortion : existing.soupPortion,
    actualSoupPortion: updates.soupPortion !== undefined ? updates.soupPortion : existing.actualSoupPortion,
    actualFoodCategories: updates.foodCategories !== undefined ? updates.foodCategories : existing.actualFoodCategories,
    actualFoodSelections: updates.foodSelections !== undefined ? updates.foodSelections : existing.actualFoodSelections,
    actualCustomFoods: updates.customFoods !== undefined ? updates.customFoods : existing.actualCustomFoods,
    actualCustomText: nextDescription,
    actualFoodQuantities: cleanedQuantities !== undefined ? cleanedQuantities : existing.actualFoodQuantities,
    foodQuantities: cleanedQuantities !== undefined ? cleanedQuantities : existing.foodQuantities,
    foodPhotos: updates.foodPhotos !== undefined ? updates.foodPhotos : existing.foodPhotos,
    foodPhoto: updates.foodPhotos !== undefined
      ? (updates.foodPhotos.length > 0 ? updates.foodPhotos[0] : undefined)
      : existing.foodPhoto,
    plannedSnapshot: {
      ...existing.plannedSnapshot,
      startTime: nextStartTime,
      endTime: nextEndTime,
      customText: nextDescription,
      mealType: updates.mealType !== undefined ? updates.mealType : existing.plannedSnapshot.mealType,
      foodCategories: updates.foodCategories !== undefined ? updates.foodCategories : existing.plannedSnapshot.foodCategories,
      foodSelections: updates.foodSelections !== undefined ? updates.foodSelections : existing.plannedSnapshot.foodSelections,
      customFoods: updates.customFoods !== undefined ? updates.customFoods : existing.plannedSnapshot.customFoods,
      foodQuantities: cleanedQuantities !== undefined
        ? (cleanedQuantities ? JSON.parse(JSON.stringify(cleanedQuantities)) : undefined)
        : existing.plannedSnapshot.foodQuantities,
      soupPortion: updates.soupPortion !== undefined ? updates.soupPortion : existing.plannedSnapshot.soupPortion,
      entryQuantity: updates.entryQuantity !== undefined ? updates.entryQuantity : existing.plannedSnapshot.entryQuantity,
      customQuantity: nextQuantity,
      quantity: nextQuantity,
      recordType: nextRecordType,
      foodPhotos: updates.foodPhotos !== undefined ? updates.foodPhotos : existing.plannedSnapshot.foodPhotos,
    },
  };

  if (destinationDateKey !== sourceDateKey) {
    // Remove from source date bucket
    daily.entries.splice(idx, 1);
    all[sourceDateKey] = { ...daily };

    // Insert into destination date bucket
    if (!all[destinationDateKey]) {
      all[destinationDateKey] = {
        version: 1,
        dateKey: destinationDateKey,
        dayKey: getLocalTodayKey(),
        sourcePlanName: daily.sourcePlanName,
        profileId: daily.profileId,
        profileName: daily.profileName,
        entries: [],
      };
    }
    all[destinationDateKey].entries.push(updatedEntry);
  } else {
    // Same date in-place update
    daily.entries[idx] = updatedEntry;
    all[sourceDateKey] = { ...daily };
  }

  saveAllDietVerifications(all);

  // Reconcile scoring (only for food records, never for neutral logs)
  if (nextRecordType !== 'neutral' && existing.recordType !== 'neutral') {
    try {
      const oldSourceId = existing.isUnplanned
        ? `diet_unplanned_${sourceDateKey}_${existing.plannedBlockId}`
        : `diet_block_${sourceDateKey}_${existing.plannedBlockId}`;
      const newSourceId = isNowUnplanned
        ? `diet_unplanned_${destinationDateKey}_${existing.plannedBlockId}`
        : `diet_block_${destinationDateKey}_${existing.plannedBlockId}`;
      const newActivityType = updates.outcome === 'twenty_percent_off_track'
        ? 'DIET_TWENTY_PERCENT_OFF_TRACK'
        : updates.status === 'on-track'
        ? 'DIET_ON_TRACK'
        : 'SLIP_REPORTED';

      reconcileDietScoreEvent({
        oldSourceId,
        newSourceId,
        newDateKey: destinationDateKey,
        newActivityType,
        profileId: daily.profileId,
        profileName: daily.profileName,
      });
    } catch (err) {
      console.error('Error reconciling diet score on update:', err);
    }
  }

  return updatedEntry;
}

/**
 * Checks if a verification record is an eligible slip for Drift.
 *
 * Eligible:
 *   - structured_slip
 *   - unstructured_slip
 *   - legacy actual slip records where detailedOutcome is unavailable
 *
 * Ineligible:
 *   - on_track, adjusted_on_track, twenty_percent_off_track, planned_unstructured, near_slip
 */
export function isEligibleSlipForDrift(record: DietBlockVerification): boolean {
  if (record.detailedOutcome) {
    return (
      record.detailedOutcome === 'structured_slip' ||
      record.detailedOutcome === 'unstructured_slip'
    );
  }
  return record.status === 'slip';
}

/**
 * Updates the Drift lifecycle state for a verified block or unplanned food log.
 *
 * Rules:
 *   - Only eligible slips can enter Drift. Non-slips cannot enter Drift.
 *   - Initial eligible slip has drift state 'none'.
 *   - Valid transitions:
 *       none -> started
 *       started -> drifting | stopped
 *       drifting -> drifting | stopped
 *       stopped -> stopped (or no-op)
 *   - Independent of isResumed (neither overwrites nor couples to resume).
 *   - Independent of original slip outcome (preserves detailedOutcome).
 *   - Timestamps: driftStartedAt preserved from first entry into started; driftStoppedAt set upon reaching stopped.
 */
export function setBlockDriftState(
  plannedBlockId: string,
  nextState: DriftState,
  dateKey = getLocalDateKey()
): DietBlockVerification | null {
  const all = loadAllDietVerifications();
  const daily = all[dateKey];
  if (!daily) return null;

  const idx = daily.entries.findIndex(e => e.plannedBlockId === plannedBlockId);
  if (idx < 0) return null;

  const current = daily.entries[idx];
  if (!isEligibleSlipForDrift(current)) {
    return null; // Ineligible records cannot enter Drift
  }

  const currentState: DriftState = current.driftState || 'none';
  if (currentState === nextState && nextState !== 'drifting') {
    return current;
  }

  // Enforce transition rules
  if (currentState === 'none' && nextState !== 'started') {
    return null; // Must start before drifting or stopping
  }
  if (currentState === 'stopped' && nextState !== 'stopped') {
    // Already stopped drifting
    return current;
  }

  const now = Date.now();
  let driftStartedAt = current.driftStartedAt;
  let driftStoppedAt = current.driftStoppedAt;

  if (nextState === 'started') {
    driftStartedAt = driftStartedAt || now;
  } else if (nextState === 'drifting') {
    driftStartedAt = driftStartedAt || now;
  } else if (nextState === 'stopped') {
    driftStartedAt = driftStartedAt || now;
    driftStoppedAt = now;
  }

  const updatedEntry: DietBlockVerification = {
    ...current,
    driftState: nextState,
    driftStartedAt,
    driftStoppedAt,
    driftUpdatedAt: now,
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

/**
 * Params for logging food that happened WITHOUT a pre-existing planned block.
 * Phase 26A: Flexible / in-the-moment food logging.
 */
export interface UnplannedFoodLogParams {
  /** Free-text description of what was eaten / recorded */
  description?: string;
  customText?: string;
  /** Food categories consumed */
  foodCategories?: FoodCategoryKey[];
  /** Detailed structural outcome — classifies eating event without planning (optional for neutral logs) */
  detailedOutcome?: DetailedBlockOutcome;
  /** Top-level status derived from the outcome (defaults to 'on-track' for neutral logs) */
  status?: DietVerificationStatus;
  /** Optional meal type */
  mealType?: MealTypeKey;
  /** Specific food selections from submenus (e.g. { fruits: ['banana'] }) */
  foodSelections?: Partial<Record<FoodCategoryKey, string[]>>;
  /** Custom foods entered */
  customFoods?: Partial<Record<FoodCategoryKey, string[]>>;
  /** Food quantities entered */
  foodQuantities?: FoodQuantitiesMap;
  /** Phase 31A: Optional quick soup portion */
  soupPortion?: SoupPortionKey;
  /** Overall / entry quantity */
  entryQuantity?: FoodItemQuantity;
  /** Free-text custom quantity */
  customQuantity?: string;
  quantity?: string;
  /** Photo attachments */
  foodPhoto?: FoodPhotoMetadata;
  foodPhotos?: FoodPhotoMetadata[];
  /** Phase 31C: Record type ('food' | 'neutral', defaults to 'food') */
  recordType?: DietRecordType;
  /** Optional rough time range the eating happened (if omitted, automatically set to current time) */
  startTime?: string;
  endTime?: string;
  /** Planned vs Unplanned flag (defaults to true if unspecified) */
  isUnplanned?: boolean;
  /** Optional Resume flag for slips */
  isResumed?: boolean;
  /** Profile isolation */
  profileId?: string;
  profileName?: string;
  sourcePlanName?: string;
  /** Date to log against (defaults to today) */
  dateKey?: string;
  date?: string;
}

/**
 * Save a food event that happened directly from the food log.
 * Supports planning in advance, logging in the moment, or logging post-hoc.
 *
 * Design decisions:
 * - Creates a synthetic plannedBlockId with prefix `unplanned_` to guarantee
 *   no collision with real block UUIDs.
 * - Sets isUnplanned based on parameter (default true).
 * - Automatically generates timestamps (startTime, endTime) from current local time if not provided.
 * - Supports full feature parity: food categories, specific food submenus,
 *   custom foods, meal types, direct/custom quantity, and multi-photo attachments.
 * - Scoring is handled by the caller (same as saveBlockVerification).
 * - 20% OFF TRACK, near_slip, etc. all work identically as for planned blocks.
 * - Resume Rate denominator rules are identical (structured_slip / unstructured_slip only).
 *
 * Returns the saved DietBlockVerification record.
 */
export function saveUnplannedFoodLog(params: UnplannedFoodLogParams): DietBlockVerification {
  const dateKey = params.dateKey ?? params.date ?? getLocalDateKey();
  const all = loadAllDietVerifications();
  const daily = all[dateKey] ?? {
    version: 1 as const,
    dateKey,
    dayKey: getLocalTodayKey(),
    sourcePlanName: params.sourcePlanName,
    profileId: params.profileId,
    profileName: params.profileName,
    entries: [],
  };

  // Generate a stable synthetic block ID for this event.
  const syntheticBlockId = `unplanned_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const verificationId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 10)
      : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // Automatic timestamp generation from current local time if not provided
  const now = new Date();
  const autoTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const startTime = params.startTime || autoTime;
  const endTime = params.endTime || calculateEndTimeFromStart(startTime, 30);
  const recordType: DietRecordType = params.recordType || 'food';
  const descText = (params.description || params.customText || '').trim();
  const rawQuantity = params.quantity || params.customQuantity;
  const entryStatus: DietVerificationStatus = params.status || 'on-track';

  const rawPhotos = params.foodPhotos
    ?? (params.foodPhoto ? [params.foodPhoto] : undefined);
  const assignedPhotos = rawPhotos && rawPhotos.length > 0 ? rawPhotos : undefined;
  const assignedPhoto = assignedPhotos && assignedPhotos.length > 0 ? assignedPhotos[0] : undefined;

  const isUnplanned = params.isUnplanned !== undefined ? params.isUnplanned : true;
  const isResumed = params.isResumed === true;

  // Build snapshot from what the user described.
  const plannedSnapshot: PlannedBlockSnapshot = {
    startTime,
    endTime,
    type: params.mealType || 'custom',
    mealType: params.mealType,
    items: [],
    customText: descText || undefined,
    foodCategories: params.foodCategories ? [...params.foodCategories] : undefined,
    foodSelections: params.foodSelections ? JSON.parse(JSON.stringify(params.foodSelections)) : undefined,
    customFoods: params.customFoods ? JSON.parse(JSON.stringify(params.customFoods)) : undefined,
    foodQuantities: params.foodQuantities ? JSON.parse(JSON.stringify(params.foodQuantities)) : undefined,
    soupPortion: params.soupPortion,
    entryQuantity: params.entryQuantity,
    customQuantity: rawQuantity,
    quantity: rawQuantity,
    recordType,
    foodPhoto: assignedPhoto,
    foodPhotos: assignedPhotos,
  };

  const newEntry: DietBlockVerification = {
    id: verificationId,
    dateKey,
    plannedBlockId: syntheticBlockId,
    plannedSnapshot,
    recordType,
    status: entryStatus,
    detailedOutcome: params.detailedOutcome,
    isResumed,
    resumedAt: isResumed ? Date.now() : undefined,
    mealType: params.mealType,
    foodSelections: params.foodSelections ? { ...params.foodSelections } : undefined,
    customFoods: params.customFoods ? { ...params.customFoods } : undefined,
    foodQuantities: params.foodQuantities ? { ...params.foodQuantities } : undefined,
    soupPortion: params.soupPortion,
    actualSoupPortion: params.soupPortion,
    entryQuantity: params.entryQuantity,
    customQuantity: rawQuantity,
    quantity: rawQuantity,
    startTime,
    endTime,
    actualFoodCategories: params.foodCategories ? [...params.foodCategories] : undefined,
    actualFoodSelections: params.foodSelections ? { ...params.foodSelections } : undefined,
    actualCustomFoods: params.customFoods ? { ...params.customFoods } : undefined,
    actualFoodQuantities: params.foodQuantities ? { ...params.foodQuantities } : undefined,
    actualCustomText: descText || undefined,
    foodPhoto: assignedPhoto,
    foodPhotos: assignedPhotos,
    isUnplanned,
    verifiedAt: Date.now(),
  };

  const updatedDaily: DailyDietVerification = {
    ...daily,
    sourcePlanName: params.sourcePlanName ?? daily.sourcePlanName,
    profileId: params.profileId ?? daily.profileId,
    profileName: params.profileName ?? daily.profileName,
    entries: [...daily.entries, newEntry],
  };

  all[dateKey] = updatedDaily;
  saveAllDietVerifications(all);
  return newEntry;
}

// ── Resume & Structure Statistics Foundation ──────────────────────────────────

/**
 * Returns whether a record is an eligible slip record for resume tracking.
 *
 * RESUME RATE DENOMINATOR DEFINITION:
 * The denominator consists strictly of true slip events that require behavioral recovery:
 *   - 'structured_slip' (True slip with containment)
 *   - 'unstructured_slip' (True slip without containment)
 *   - legacy records where status === 'slip' and no detailedOutcome is set (backward compatibility)
 *
 * EXCLUSIONS FROM DENOMINATOR:
 *   - 'twenty_percent_off_track' (NOT a slip; intentional flexibility, must never reduce Resume Rate)
 *   - 'near_slip' (Stopped before crossing boundary; no slip occurred to resume from)
 *   - 'on_track', 'adjusted_on_track', 'planned_unstructured' (Positive non-slip outcomes)
 *   - legacy 'on-track' records
 */
export function isEligibleSlipRecord(record: DietBlockVerification): boolean {
  if (record.recordType === 'neutral') return false;
  if (record.detailedOutcome) {
    return (
      record.detailedOutcome === 'structured_slip' ||
      record.detailedOutcome === 'unstructured_slip'
    );
  }
  // Legacy record fallback: legacy slip with no detailed outcome is eligible
  return record.status === 'slip';
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
 * Structured eating includes: on_track, adjusted_on_track, twenty_percent_off_track, near_slip, structured_slip, or legacy on-track.
 * Unstructured eating includes: planned_unstructured, unstructured_slip.
 */
export function isStructuredOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  status?: DietVerificationStatus,
  recordType?: DietRecordType
): boolean {
  if (recordType === 'neutral') return false;
  if (detailedOutcome) {
    return (
      detailedOutcome === 'on_track' ||
      detailedOutcome === 'adjusted_on_track' ||
      detailedOutcome === 'twenty_percent_off_track' ||
      detailedOutcome === 'near_slip' ||
      detailedOutcome === 'structured_slip'
    );
  }
  // Legacy record fallback: legacy on-track is structured
  return status === 'on-track';
}

export function isUnstructuredOutcome(
  detailedOutcome?: DetailedBlockOutcome,
  _status?: DietVerificationStatus,
  recordType?: DietRecordType
): boolean {
  if (recordType === 'neutral') return false;
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
  const foodRecords = records.filter(r => r.recordType !== 'neutral');
  let structuredCount = 0;
  let unstructuredCount = 0;

  for (const r of foodRecords) {
    if (isStructuredOutcome(r.detailedOutcome, r.status, r.recordType)) {
      structuredCount++;
    } else if (isUnstructuredOutcome(r.detailedOutcome, r.status, r.recordType)) {
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

  // Deduplicate by plannedBlockId, excluding neutral records
  const uniqueMap = new Map<string, DietBlockVerification>();
  for (const entry of daily.entries) {
    if (entry.recordType === 'neutral') continue;
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


