/**
 * Super Diet-Ability — Exercise & Activity Storage Engine (Phase 43)
 *
 * Manages versioned local persistence for physical activity records.
 * Namespaced under 'resume-ability-activities' in localStorage.
 *
 * Guarantees:
 * - Local-first persistence; no network or cloud calls.
 * - Score-neutral: 0 XP awarded, 0 points side effects.
 * - Completely isolated from Challenge completion, slips, recovery rate, and check-ins.
 * - Challenge association is strictly opt-in and validated against active challenges upon creation.
 * - Historical associations are strictly preserved even if the challenge completes or cancels.
 * - Pure error handling: fails gracefully without corrupting existing data or reporting false success.
 */

import { getLocalDateKey } from '../utils/dietStorage';
import { getActiveChallenge } from '../challenges/challengeStorage';
import {
  ACTIVITY_STORAGE_KEY,
  ACTIVITIES_UPDATED_EVENT,
  type ActivityRecord,
  type ActivityStore,
  type CreateActivityInput,
  type DailyActivitySummary,
  type StorageOperationResult,
  type UpdateActivityInput,
} from './types';
import {
  calculateChallengeActivityCount,
  calculateDailyActivitySummary,
  formatCurrentLocalTime,
  isValidCategory,
  isValidDateKey,
  isValidDuration,
  isValidIntensity,
  isValidTime,
  sortActivities,
  validateCreateActivityInput,
  validateUpdateActivityInput,
} from './activityEngine';

/**
 * Creates an empty default activity store structure.
 */
function createDefaultStore(): ActivityStore {
  return {
    version: 1,
    activities: [],
  };
}

/**
 * Normalizes a single raw activity record from storage.
 * Returns null if the record is fundamentally corrupted or invalid.
 */
export function normalizeActivityRecord(raw: unknown): ActivityRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const item = raw as Record<string, unknown>;

  if (typeof item.id !== 'string' || item.id.trim() === '') return null;
  if (!isValidCategory(item.category)) return null;
  if (!isValidDuration(item.durationMinutes)) return null;
  if (!isValidDateKey(item.dateKey)) return null;
  if (!isValidTime(item.time)) return null;

  const customName =
    typeof item.customName === 'string' && item.customName.trim().length > 0
      ? item.customName.trim().slice(0, 50)
      : undefined;

  const notes =
    typeof item.notes === 'string' && item.notes.trim().length > 0
      ? item.notes.trim().slice(0, 300)
      : undefined;

  const intensity = isValidIntensity(item.intensity) && item.intensity ? item.intensity : undefined;

  const timestamp =
    typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)
      ? item.timestamp
      : Date.now();

  const createdAt =
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
      ? item.createdAt
      : timestamp;

  const updatedAt =
    typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
      ? item.updatedAt
      : createdAt;

  const associatedChallengeId =
    typeof item.associatedChallengeId === 'string' && item.associatedChallengeId.trim().length > 0
      ? item.associatedChallengeId.trim()
      : undefined;

  return {
    id: item.id.trim(),
    category: item.category,
    customName,
    durationMinutes: item.durationMinutes,
    intensity,
    notes,
    dateKey: item.dateKey,
    time: item.time,
    timestamp,
    createdAt,
    updatedAt,
    associatedChallengeId,
    schemaVersion: 1,
  };
}

/**
 * Checks whether the activity store in localStorage exists but is fundamentally corrupted
 * (invalid JSON syntax, not an object, or unsupported version).
 * Used to safeguard existing unreadable data from destructive overwrites during mutations.
 */
export function isActivityStorageCorrupted(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    let raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem('sda_activity_records_v1');
    }
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return true;
    if (parsed.version !== 1) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Loads and parses the versioned activity store from localStorage.
 * Handles missing storage, corrupted JSON, and schema version changes safely.
 * Does NOT overwrite corrupted localStorage contents.
 */
export function loadActivityStore(): ActivityStore {
  if (typeof localStorage === 'undefined') {
    return createDefaultStore();
  }

  try {
    let raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) {
      // Compatibility fallback: check alternative namespace if present
      raw = localStorage.getItem('sda_activity_records_v1');
    }
    if (!raw) {
      return createDefaultStore();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[ActivityStorage] Store content is not an object. Falling back to default store.');
      return createDefaultStore();
    }

    if (parsed.version !== 1) {
      console.warn(`[ActivityStorage] Unsupported store schema version: ${parsed.version}. Falling back to default store.`);
      return createDefaultStore();
    }

    const activitiesRaw = Array.isArray(parsed.activities) ? parsed.activities : [];
    const seenIds = new Set<string>();
    const validActivities: ActivityRecord[] = [];

    for (const rawItem of activitiesRaw) {
      const normalized = normalizeActivityRecord(rawItem);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        validActivities.push(normalized);
      }
    }

    return {
      version: 1,
      activities: sortActivities(validActivities),
    };
  } catch (err) {
    console.error('[ActivityStorage] Failed to parse activity store:', err);
    // Safe read-only fallback without overwriting existing data
    return createDefaultStore();
  }
}

/**
 * Persists the activity store to localStorage and dispatches change event.
 * Returns true if successful, false if storage write fails (e.g. quota exceeded).
 */
export function saveActivityStore(store: ActivityStore): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const payload = JSON.stringify({
      version: 1,
      activities: sortActivities(store.activities),
    });

    localStorage.setItem(ACTIVITY_STORAGE_KEY, payload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACTIVITIES_UPDATED_EVENT));
    }
    return true;
  } catch (err) {
    console.error('[ActivityStorage] Storage write failed (possible quota error):', err);
    return false;
  }
}

/**
 * Creates a new physical activity record.
 * Validates inputs, validates optional challenge association, and persists deterministically.
 */
export function createActivity(input: CreateActivityInput): StorageOperationResult<ActivityRecord> {
  const validationError = validateCreateActivityInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Validate optional Challenge association
  if (input.associatedChallengeId) {
    const activeChallenge = getActiveChallenge();
    if (
      !activeChallenge ||
      activeChallenge.id !== input.associatedChallengeId ||
      activeChallenge.status !== 'active'
    ) {
      return {
        success: false,
        error: 'Associated challenge must be an existing, currently active challenge.',
      };
    }
  }

  // Safeguard against destructive overwriting of unreadable/corrupted storage
  if (isActivityStorageCorrupted()) {
    return {
      success: false,
      error: 'Cannot save activity: storage data is corrupted or unreadable. Operation aborted to preserve existing records.',
    };
  }

  const store = loadActivityStore();
  const dateKey = input.dateKey || getLocalDateKey();
  const time = input.time || formatCurrentLocalTime();
  const timestamp = input.timestamp ?? Date.now();
  const now = Date.now();

  const customName =
    input.customName && input.customName.trim().length > 0
      ? input.customName.trim().slice(0, 50)
      : undefined;

  const notes =
    input.notes && input.notes.trim().length > 0
      ? input.notes.trim().slice(0, 300)
      : undefined;

  const intensity = input.intensity || undefined;
  const associatedChallengeId = input.associatedChallengeId || undefined;

  // Handle explicit or generated ID
  const rand = Math.random().toString(36).slice(2, 10);
  const id = input.id && input.id.trim().length > 0 ? input.id.trim() : `act_${timestamp}_${rand}`;

  // Check for duplicate ID
  const existingIndex = store.activities.findIndex((a) => a.id === id);
  if (existingIndex !== -1) {
    const existing = store.activities[existingIndex];
    // If identical payload, report duplicate idempotent success
    const isIdentical =
      existing.category === input.category &&
      existing.durationMinutes === input.durationMinutes &&
      existing.dateKey === dateKey &&
      existing.time === time &&
      existing.customName === customName &&
      existing.notes === notes &&
      existing.intensity === intensity &&
      existing.associatedChallengeId === associatedChallengeId;

    if (isIdentical) {
      return { success: true, data: existing, isDuplicate: true };
    }

    return {
      success: false,
      error: `Activity with ID "${id}" already exists with different data.`,
    };
  }

  const newRecord: ActivityRecord = {
    id,
    category: input.category,
    customName,
    durationMinutes: input.durationMinutes,
    intensity,
    notes,
    dateKey,
    time,
    timestamp,
    createdAt: now,
    updatedAt: now,
    associatedChallengeId,
    schemaVersion: 1,
  };

  store.activities.push(newRecord);
  const saved = saveActivityStore(store);

  if (!saved) {
    return {
      success: false,
      error: 'Failed to persist activity to local storage.',
    };
  }

  return { success: true, data: newRecord };
}

/**
 * Retrieves a single activity record by ID.
 */
export function getActivityById(id: string): ActivityRecord | null {
  if (!id) return null;
  const store = loadActivityStore();
  const found = store.activities.find((act) => act.id === id);
  return found ? { ...found } : null;
}

/**
 * Returns all activities in deterministic order (most recent first).
 */
export function listActivities(): ActivityRecord[] {
  return loadActivityStore().activities;
}

/**
 * Returns activities for a specific calendar date (YYYY-MM-DD).
 */
export function listActivitiesForDate(dateKey: string): ActivityRecord[] {
  if (!isValidDateKey(dateKey)) return [];
  const store = loadActivityStore();
  return store.activities.filter((act) => act.dateKey === dateKey);
}

/**
 * Returns activities within an inclusive date range [startDateKey, endDateKey].
 */
export function listActivitiesForDateRange(startDateKey: string, endDateKey: string): ActivityRecord[] {
  if (!isValidDateKey(startDateKey) || !isValidDateKey(endDateKey)) return [];
  const store = loadActivityStore();
  return store.activities.filter((act) => act.dateKey >= startDateKey && act.dateKey <= endDateKey);
}

/**
 * Updates an existing activity record.
 * Preserves id and createdAt. Updates updatedAt only if real changes occur.
 */
export function updateActivity(
  id: string,
  updates: UpdateActivityInput
): StorageOperationResult<ActivityRecord> {
  if (!id) {
    return { success: false, error: 'Activity ID is required for update.' };
  }

  const validationError = validateUpdateActivityInput(updates);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Safeguard against destructive overwriting of unreadable/corrupted storage
  if (isActivityStorageCorrupted()) {
    return {
      success: false,
      error: 'Cannot update activity: storage data is corrupted or unreadable. Operation aborted to preserve existing records.',
    };
  }

  const store = loadActivityStore();
  const index = store.activities.findIndex((act) => act.id === id);

  if (index === -1) {
    return { success: false, error: `Activity with ID "${id}" was not found.` };
  }

  const existing = store.activities[index];

  // Validate Challenge association modification if explicitly changed
  let newChallengeId: string | undefined = existing.associatedChallengeId;
  if (updates.associatedChallengeId !== undefined) {
    if (updates.associatedChallengeId === null || updates.associatedChallengeId === '') {
      newChallengeId = undefined; // Unlink
    } else {
      // If newly linking to a challenge or changing challenge ID, validate active status
      if (updates.associatedChallengeId !== existing.associatedChallengeId) {
        const activeChallenge = getActiveChallenge();
        if (
          !activeChallenge ||
          activeChallenge.id !== updates.associatedChallengeId ||
          activeChallenge.status !== 'active'
        ) {
          return {
            success: false,
            error: 'Associated challenge must be an existing, currently active challenge.',
          };
        }
      }
      newChallengeId = updates.associatedChallengeId;
    }
  }

  // Derive new values
  const newCategory = updates.category !== undefined ? updates.category : existing.category;
  const newDuration = updates.durationMinutes !== undefined ? updates.durationMinutes : existing.durationMinutes;
  const newDateKey = updates.dateKey !== undefined ? updates.dateKey : existing.dateKey;
  const newTime = updates.time !== undefined ? updates.time : existing.time;
  const newTimestamp = updates.timestamp !== undefined ? updates.timestamp : existing.timestamp;

  const newCustomName =
    updates.customName !== undefined
      ? updates.customName === null || updates.customName.trim().length === 0
        ? undefined
        : updates.customName.trim().slice(0, 50)
      : existing.customName;

  const newNotes =
    updates.notes !== undefined
      ? updates.notes === null || updates.notes.trim().length === 0
        ? undefined
        : updates.notes.trim().slice(0, 300)
      : existing.notes;

  const newIntensity =
    updates.intensity !== undefined
      ? updates.intensity === null
        ? undefined
        : updates.intensity
      : existing.intensity;

  // Check if anything actually changed
  const hasChanges =
    newCategory !== existing.category ||
    newDuration !== existing.durationMinutes ||
    newDateKey !== existing.dateKey ||
    newTime !== existing.time ||
    newTimestamp !== existing.timestamp ||
    newCustomName !== existing.customName ||
    newNotes !== existing.notes ||
    newIntensity !== existing.intensity ||
    newChallengeId !== existing.associatedChallengeId;

  if (!hasChanges) {
    // Return existing record with existing updatedAt
    return { success: true, data: existing };
  }

  const updatedRecord: ActivityRecord = {
    ...existing,
    category: newCategory,
    durationMinutes: newDuration,
    customName: newCustomName,
    notes: newNotes,
    intensity: newIntensity,
    dateKey: newDateKey,
    time: newTime,
    timestamp: newTimestamp,
    associatedChallengeId: newChallengeId,
    updatedAt: Date.now(),
  };

  store.activities[index] = updatedRecord;
  const saved = saveActivityStore(store);

  if (!saved) {
    return {
      success: false,
      error: 'Failed to persist updated activity to local storage.',
    };
  }

  return { success: true, data: updatedRecord };
}

/**
 * Deletes an activity record by ID.
 */
export function deleteActivity(id: string): StorageOperationResult<boolean> {
  if (!id) {
    return { success: false, error: 'Activity ID is required for deletion.' };
  }

  // Safeguard against destructive overwriting of unreadable/corrupted storage
  if (isActivityStorageCorrupted()) {
    return {
      success: false,
      error: 'Cannot delete activity: storage data is corrupted or unreadable. Operation aborted to preserve existing records.',
    };
  }

  const store = loadActivityStore();
  const index = store.activities.findIndex((act) => act.id === id);

  if (index === -1) {
    return { success: false, error: `Activity with ID "${id}" was not found.` };
  }

  store.activities.splice(index, 1);
  const saved = saveActivityStore(store);

  if (!saved) {
    return {
      success: false,
      error: 'Failed to persist deletion to local storage.',
    };
  }

  return { success: true, data: true };
}

/**
 * Calculates factual daily activity summary (count and total logged minutes).
 */
export function getDailyActivitySummary(dateKey: string): DailyActivitySummary {
  const activities = listActivitiesForDate(dateKey);
  return calculateDailyActivitySummary(activities, dateKey);
}

/**
 * Calculates factual total activities linked to a specific Challenge ID.
 */
export function getChallengeActivityCount(challengeId: string): number {
  const activities = listActivities();
  return calculateChallengeActivityCount(activities, challengeId);
}

/**
 * Clears all activity records.
 * Note: Not wired to Settings UI yet (reserved for Phase 43.4).
 */
export function clearAllActivities(): StorageOperationResult<boolean> {
  const store: ActivityStore = {
    version: 1,
    activities: [],
  };

  const saved = saveActivityStore(store);
  if (!saved) {
    return {
      success: false,
      error: 'Failed to clear activities from local storage.',
    };
  }

  // Clean up legacy compatibility key if present
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sda_activity_records_v1');
    }
  } catch {
    // ignore
  }

  return { success: true, data: true };
}
