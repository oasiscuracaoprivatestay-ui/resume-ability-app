/**
 * Super Diet-Ability — Progress & Victories Storage Domain (Phase 4)
 *
 * Implements a local-first, versioned, strictly isolated persistence layer for:
 * - Non-scale victories & weekly reflections
 * - Waist circumference tracking (primary physical metric)
 * - Progress photo metadata (linked to local IndexedDB photo store)
 * - Optional secondary metrics: Weight (kg/lbs) & Glucose/CGM readings
 *
 * Safety & Privacy Principles:
 * - 100% local persistence in localStorage and IndexedDB. Zero external network transfer.
 * - Non-clinical: zero medical diagnosis, clear disclaimers, no medical risk scores.
 * - Slips and check-ins remain untouched in their respective authoritative stores.
 * - Corrupted storage resilience: automatically recovers to valid state on parse failure.
 * - Integrates with centralized statistics reset.
 */

export type VictoryCategory =
  | 'clothing_fit'
  | 'energy'
  | 'sleep'
  | 'appetite'
  | 'fitness'
  | 'mindset'
  | 'other';

export interface VictoryRecord {
  id: string;
  dateKey: string; // YYYY-MM-DD
  category: VictoryCategory;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface WaistRecord {
  id: string;
  dateKey: string;
  valueCm: number; // Stored in normalized centimeters
  displayUnit: 'cm' | 'in';
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ProgressPhotoRecord {
  id: string;
  photoId: string; // References local IndexedDB photo record in DB_NAME
  dateKey: string;
  milestoneTag?: 'day_1' | 'day_30' | 'day_60' | 'day_90' | 'other';
  notes?: string;
  createdAt: number;
}

export interface WeightRecord {
  id: string;
  dateKey: string;
  valueKg: number; // Stored in normalized kilograms
  displayUnit: 'kg' | 'lbs';
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface GlucoseRecord {
  id: string;
  dateKey: string;
  readingType: 'fasting' | 'cgm_avg' | 'post_meal' | 'custom';
  valueMgDl: number; // Stored in mg/dL
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface WeeklyReflectionRecord {
  id: string;
  weekStartDateKey: string;
  reflectionText: string;
  biggestVictory: string;
  nextWeekFocus?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ProgressVictoriesStore {
  version: 1;
  victories: VictoryRecord[];
  waistRecords: WaistRecord[];
  photos: ProgressPhotoRecord[];
  weightRecords: WeightRecord[];
  glucoseRecords: GlucoseRecord[];
  weeklyReflections: WeeklyReflectionRecord[];
  preferredUnits: {
    waist: 'cm' | 'in';
    weight: 'kg' | 'lbs';
  };
}

export const PROGRESS_VICTORIES_STORAGE_KEY = 'sda_progress_victories_v1';
export const PROGRESS_VICTORIES_UPDATED_EVENT = 'sda-progress-victories-updated';

function getEmptyStore(): ProgressVictoriesStore {
  return {
    version: 1,
    victories: [],
    waistRecords: [],
    photos: [],
    weightRecords: [],
    glucoseRecords: [],
    weeklyReflections: [],
    preferredUnits: {
      waist: 'cm',
      weight: 'kg',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe Unit Conversions
// ─────────────────────────────────────────────────────────────────────────────

export function cmToInches(cm: number): number {
  if (!Number.isFinite(cm) || cm <= 0) return 0;
  return Math.round((cm / 2.54) * 10) / 10;
}

export function inchesToCm(inches: number): number {
  if (!Number.isFinite(inches) || inches <= 0) return 0;
  return Math.round(inches * 2.54 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  if (!Number.isFinite(lbs) || lbs <= 0) return 0;
  return Math.round((lbs / 2.20462) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function validateWaist(val: number, unit: 'cm' | 'in'): { valid: boolean; error?: string } {
  if (!Number.isFinite(val) || isNaN(val)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }
  const valCm = unit === 'in' ? inchesToCm(val) : val;
  // Reasonable human range: 35cm to 250cm (14in to 98in)
  if (valCm < 35 || valCm > 250) {
    return {
      valid: false,
      error: unit === 'in' ? 'Waist must be between 14 and 98 inches.' : 'Waist must be between 35 and 250 cm.',
    };
  }
  return { valid: true };
}

export function validateWeight(val: number, unit: 'kg' | 'lbs'): { valid: boolean; error?: string } {
  if (!Number.isFinite(val) || isNaN(val)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }
  const valKg = unit === 'lbs' ? lbsToKg(val) : val;
  // Reasonable human range: 25kg to 350kg (55lbs to 770lbs)
  if (valKg < 25 || valKg > 350) {
    return {
      valid: false,
      error: unit === 'lbs' ? 'Weight must be between 55 and 770 lbs.' : 'Weight must be between 25 and 350 kg.',
    };
  }
  return { valid: true };
}

export function validateGlucose(val: number): { valid: boolean; error?: string } {
  if (!Number.isFinite(val) || isNaN(val)) {
    return { valid: false, error: 'Please enter a valid number.' };
  }
  // Clinical reality range: 30 to 500 mg/dL
  if (val < 30 || val > 500) {
    return { valid: false, error: 'Glucose reading must be between 30 and 500 mg/dL.' };
  }
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Access
// ─────────────────────────────────────────────────────────────────────────────

export function loadProgressVictoriesStore(): ProgressVictoriesStore {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return getEmptyStore();
  }

  try {
    const raw = localStorage.getItem(PROGRESS_VICTORIES_STORAGE_KEY);
    if (!raw) return getEmptyStore();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      console.warn('[ProgressVictoriesStorage] Corrupted or invalid store schema, resetting to safe defaults.');
      return getEmptyStore();
    }

    return {
      version: 1,
      victories: Array.isArray(parsed.victories) ? parsed.victories : [],
      waistRecords: Array.isArray(parsed.waistRecords) ? parsed.waistRecords : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
      weightRecords: Array.isArray(parsed.weightRecords) ? parsed.weightRecords : [],
      glucoseRecords: Array.isArray(parsed.glucoseRecords) ? parsed.glucoseRecords : [],
      weeklyReflections: Array.isArray(parsed.weeklyReflections) ? parsed.weeklyReflections : [],
      preferredUnits: {
        waist: parsed.preferredUnits?.waist === 'in' ? 'in' : 'cm',
        weight: parsed.preferredUnits?.weight === 'lbs' ? 'lbs' : 'kg',
      },
    };
  } catch (err) {
    console.error('[ProgressVictoriesStorage] Failed to read from localStorage:', err);
    return getEmptyStore();
  }
}

export function saveProgressVictoriesStore(store: ProgressVictoriesStore): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    localStorage.setItem(PROGRESS_VICTORIES_STORAGE_KEY, JSON.stringify(store));
    dispatchUpdateEvent();
    return true;
  } catch (err) {
    console.error('[ProgressVictoriesStorage] Failed to save to localStorage:', err);
    return false;
  }
}

function dispatchUpdateEvent(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PROGRESS_VICTORIES_UPDATED_EVENT));
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

// 1. Victories
export function getVictories(): VictoryRecord[] {
  return loadProgressVictoriesStore().victories.sort((a, b) => b.createdAt - a.createdAt);
}

export function addVictory(params: {
  dateKey: string;
  category: VictoryCategory;
  title: string;
  description?: string;
}): VictoryRecord | null {
  const title = (params.title || '').trim();
  if (!title) return null;

  const store = loadProgressVictoriesStore();
  const record: VictoryRecord = {
    id: genId('vic'),
    dateKey: params.dateKey,
    category: params.category,
    title,
    description: (params.description || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.victories.unshift(record);
  return saveProgressVictoriesStore(store) ? record : null;
}

export function updateVictory(
  id: string,
  updates: Partial<Pick<VictoryRecord, 'category' | 'title' | 'description' | 'dateKey'>>
): VictoryRecord | null {
  const store = loadProgressVictoriesStore();
  const idx = store.victories.findIndex((v) => v.id === id);
  if (idx === -1) return null;

  const existing = store.victories[idx];
  const updated: VictoryRecord = {
    ...existing,
    ...updates,
    title: updates.title !== undefined ? updates.title.trim() : existing.title,
    description:
      updates.description !== undefined ? updates.description.trim() || undefined : existing.description,
    updatedAt: Date.now(),
  };

  if (!updated.title) return null;

  store.victories[idx] = updated;
  return saveProgressVictoriesStore(store) ? updated : null;
}

export function deleteVictory(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.victories.length;
  store.victories = store.victories.filter((v) => v.id !== id);
  if (store.victories.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 2. Waist Records
export function getWaistRecords(): WaistRecord[] {
  return loadProgressVictoriesStore().waistRecords.sort((a, b) => b.createdAt - a.createdAt);
}

export function addWaistRecord(params: {
  dateKey: string;
  value: number;
  unit: 'cm' | 'in';
  notes?: string;
}): WaistRecord | null {
  const check = validateWaist(params.value, params.unit);
  if (!check.valid) return null;

  const valueCm = params.unit === 'in' ? inchesToCm(params.value) : Math.round(params.value * 10) / 10;
  const store = loadProgressVictoriesStore();

  const record: WaistRecord = {
    id: genId('waist'),
    dateKey: params.dateKey,
    valueCm,
    displayUnit: params.unit,
    notes: (params.notes || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.waistRecords.unshift(record);
  store.preferredUnits.waist = params.unit;
  return saveProgressVictoriesStore(store) ? record : null;
}

export function updateWaistRecord(
  id: string,
  updates: { value?: number; unit?: 'cm' | 'in'; notes?: string; dateKey?: string }
): WaistRecord | null {
  const store = loadProgressVictoriesStore();
  const idx = store.waistRecords.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const existing = store.waistRecords[idx];
  const unit = updates.unit || existing.displayUnit;
  let valueCm = existing.valueCm;

  if (updates.value !== undefined) {
    const check = validateWaist(updates.value, unit);
    if (!check.valid) return null;
    valueCm = unit === 'in' ? inchesToCm(updates.value) : Math.round(updates.value * 10) / 10;
  }

  const updated: WaistRecord = {
    ...existing,
    valueCm,
    displayUnit: unit,
    dateKey: updates.dateKey || existing.dateKey,
    notes: updates.notes !== undefined ? updates.notes.trim() || undefined : existing.notes,
    updatedAt: Date.now(),
  };

  store.waistRecords[idx] = updated;
  return saveProgressVictoriesStore(store) ? updated : null;
}

export function deleteWaistRecord(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.waistRecords.length;
  store.waistRecords = store.waistRecords.filter((r) => r.id !== id);
  if (store.waistRecords.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 3. Progress Photos
export function getProgressPhotos(): ProgressPhotoRecord[] {
  return loadProgressVictoriesStore().photos.sort((a, b) => b.createdAt - a.createdAt);
}

export function addProgressPhoto(params: {
  photoId: string;
  dateKey: string;
  milestoneTag?: 'day_1' | 'day_30' | 'day_60' | 'day_90' | 'other';
  notes?: string;
}): ProgressPhotoRecord | null {
  if (!params.photoId) return null;

  const store = loadProgressVictoriesStore();
  const record: ProgressPhotoRecord = {
    id: genId('photo'),
    photoId: params.photoId,
    dateKey: params.dateKey,
    milestoneTag: params.milestoneTag || 'other',
    notes: (params.notes || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.photos.unshift(record);
  return saveProgressVictoriesStore(store) ? record : null;
}

export function deleteProgressPhoto(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.photos.length;
  store.photos = store.photos.filter((p) => p.id !== id);
  if (store.photos.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 4. Weight Records (Optional & Secondary)
export function getWeightRecords(): WeightRecord[] {
  return loadProgressVictoriesStore().weightRecords.sort((a, b) => b.createdAt - a.createdAt);
}

export function addWeightRecord(params: {
  dateKey: string;
  value: number;
  unit: 'kg' | 'lbs';
  notes?: string;
}): WeightRecord | null {
  const check = validateWeight(params.value, params.unit);
  if (!check.valid) return null;

  const valueKg = params.unit === 'lbs' ? lbsToKg(params.value) : Math.round(params.value * 10) / 10;
  const store = loadProgressVictoriesStore();

  const record: WeightRecord = {
    id: genId('wt'),
    dateKey: params.dateKey,
    valueKg,
    displayUnit: params.unit,
    notes: (params.notes || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.weightRecords.unshift(record);
  store.preferredUnits.weight = params.unit;
  return saveProgressVictoriesStore(store) ? record : null;
}

export function updateWeightRecord(
  id: string,
  updates: { value?: number; unit?: 'kg' | 'lbs'; notes?: string; dateKey?: string }
): WeightRecord | null {
  const store = loadProgressVictoriesStore();
  const idx = store.weightRecords.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const existing = store.weightRecords[idx];
  const unit = updates.unit || existing.displayUnit;
  let valueKg = existing.valueKg;

  if (updates.value !== undefined) {
    const check = validateWeight(updates.value, unit);
    if (!check.valid) return null;
    valueKg = unit === 'lbs' ? lbsToKg(updates.value) : Math.round(updates.value * 10) / 10;
  }

  const updated: WeightRecord = {
    ...existing,
    valueKg,
    displayUnit: unit,
    dateKey: updates.dateKey || existing.dateKey,
    notes: updates.notes !== undefined ? updates.notes.trim() || undefined : existing.notes,
    updatedAt: Date.now(),
  };

  store.weightRecords[idx] = updated;
  return saveProgressVictoriesStore(store) ? updated : null;
}

export function deleteWeightRecord(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.weightRecords.length;
  store.weightRecords = store.weightRecords.filter((r) => r.id !== id);
  if (store.weightRecords.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 5. Glucose / CGM Records (Educational / Non-Clinical)
export function getGlucoseRecords(): GlucoseRecord[] {
  return loadProgressVictoriesStore().glucoseRecords.sort((a, b) => b.createdAt - a.createdAt);
}

export function addGlucoseRecord(params: {
  dateKey: string;
  readingType: 'fasting' | 'cgm_avg' | 'post_meal' | 'custom';
  valueMgDl: number;
  notes?: string;
}): GlucoseRecord | null {
  const check = validateGlucose(params.valueMgDl);
  if (!check.valid) return null;

  const store = loadProgressVictoriesStore();
  const record: GlucoseRecord = {
    id: genId('glc'),
    dateKey: params.dateKey,
    readingType: params.readingType,
    valueMgDl: Math.round(params.valueMgDl),
    notes: (params.notes || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.glucoseRecords.unshift(record);
  return saveProgressVictoriesStore(store) ? record : null;
}

export function updateGlucoseRecord(
  id: string,
  updates: { valueMgDl?: number; readingType?: GlucoseRecord['readingType']; notes?: string; dateKey?: string }
): GlucoseRecord | null {
  const store = loadProgressVictoriesStore();
  const idx = store.glucoseRecords.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const existing = store.glucoseRecords[idx];
  let valueMgDl = existing.valueMgDl;

  if (updates.valueMgDl !== undefined) {
    const check = validateGlucose(updates.valueMgDl);
    if (!check.valid) return null;
    valueMgDl = Math.round(updates.valueMgDl);
  }

  const updated: GlucoseRecord = {
    ...existing,
    valueMgDl,
    readingType: updates.readingType || existing.readingType,
    dateKey: updates.dateKey || existing.dateKey,
    notes: updates.notes !== undefined ? updates.notes.trim() || undefined : existing.notes,
    updatedAt: Date.now(),
  };

  store.glucoseRecords[idx] = updated;
  return saveProgressVictoriesStore(store) ? updated : null;
}

export function deleteGlucoseRecord(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.glucoseRecords.length;
  store.glucoseRecords = store.glucoseRecords.filter((r) => r.id !== id);
  if (store.glucoseRecords.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 6. Weekly Reflections
export function getWeeklyReflections(): WeeklyReflectionRecord[] {
  return loadProgressVictoriesStore().weeklyReflections.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveWeeklyReflection(params: {
  weekStartDateKey: string;
  reflectionText: string;
  biggestVictory: string;
  nextWeekFocus?: string;
  id?: string;
}): WeeklyReflectionRecord | null {
  const reflectionText = (params.reflectionText || '').trim();
  const biggestVictory = (params.biggestVictory || '').trim();
  if (!reflectionText && !biggestVictory) return null;

  const store = loadProgressVictoriesStore();

  if (params.id) {
    const idx = store.weeklyReflections.findIndex((r) => r.id === params.id);
    if (idx !== -1) {
      const updated: WeeklyReflectionRecord = {
        ...store.weeklyReflections[idx],
        reflectionText,
        biggestVictory,
        nextWeekFocus: (params.nextWeekFocus || '').trim() || undefined,
        weekStartDateKey: params.weekStartDateKey || store.weeklyReflections[idx].weekStartDateKey,
        updatedAt: Date.now(),
      };
      store.weeklyReflections[idx] = updated;
      return saveProgressVictoriesStore(store) ? updated : null;
    }
  }

  const record: WeeklyReflectionRecord = {
    id: genId('refl'),
    weekStartDateKey: params.weekStartDateKey,
    reflectionText,
    biggestVictory,
    nextWeekFocus: (params.nextWeekFocus || '').trim() || undefined,
    createdAt: Date.now(),
  };

  store.weeklyReflections.unshift(record);
  return saveProgressVictoriesStore(store) ? record : null;
}

export function deleteWeeklyReflection(id: string): boolean {
  const store = loadProgressVictoriesStore();
  const initialLen = store.weeklyReflections.length;
  store.weeklyReflections = store.weeklyReflections.filter((r) => r.id !== id);
  if (store.weeklyReflections.length === initialLen) return false;
  return saveProgressVictoriesStore(store);
}

// 7. Preferred Units
export function getPreferredUnits(): ProgressVictoriesStore['preferredUnits'] {
  return loadProgressVictoriesStore().preferredUnits;
}

export function setPreferredUnits(units: Partial<ProgressVictoriesStore['preferredUnits']>): boolean {
  const store = loadProgressVictoriesStore();
  store.preferredUnits = {
    ...store.preferredUnits,
    ...units,
  };
  return saveProgressVictoriesStore(store);
}

// 8. Reset Integration
export function clearProgressVictories(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    const empty = getEmptyStore();
    localStorage.setItem(PROGRESS_VICTORIES_STORAGE_KEY, JSON.stringify(empty));
    dispatchUpdateEvent();
    return true;
  } catch (err) {
    console.error('[ProgressVictoriesStorage] Failed to clear progress & victories:', err);
    return false;
  }
}
