/**
 * SDA Practice Loop Persistence & Book 2 (Loss-Maintenance) Domain Storage — Phase 5B.2
 *
 * Minimal, versioned, local-first storage for:
 * 1. Selected Practice Loop Book (`book1_resume_ability` | `book2_loss_maintenance`)
 * 2. Book 2 Food Readiness checks & practical preparation actions (by local dateKey)
 * 3. Book 2 Early Signs of Drift acknowledgments & planned responses (strictly non-Slip, zero XP side effects)
 * 4. Book 2 "Test One Adjustment" active single-adjustment record & reviewed history
 *
 * Strict Data-Integrity Invariants:
 * - Never writes to or duplicates `resume-ability-slips`, `resume-ability-checkins`,
 *   `resume-ability-challenges`, `resume-ability-diet`, or `resume-ability-90day-journey`.
 * - Switching between Book 1 and Book 2 never erases or resets challenge, 90-day journey,
 *   check-in, review, or Book 2 records.
 * - Never modifies the user's Structured Diet plan automatically.
 */

import { getLocalDateKey } from '../utils/dietStorage';
import type { PracticeLoopBookId } from './practiceLoopEngine';

export const PRACTICE_LOOP_STORAGE_KEY = 'resume-ability-practice-loop-v1';
export const PRACTICE_LOOP_UPDATED_EVENT = 'sda-practice-loop-updated';

export type FoodReadinessStatus = 'needs_prep' | 'action_planned' | 'ready';

export type FoodReadinessGapKind =
  | 'missing_ingredient'
  | 'meal_not_prepped'
  | 'away_or_busy'
  | 'unsure_what_to_eat';

export type FoodReadinessActionKind =
  | 'prep_simple_whole_food'
  | 'gather_missing_item'
  | 'use_backup_option'
  | 'confirm_planned_block';

export interface FoodReadinessRecord {
  dateKey: string;
  targetBlockId?: string;
  targetBlockSummary?: string;
  status: FoodReadinessStatus;
  gapKind?: FoodReadinessGapKind;
  gapNote?: string;
  selectedAction?: FoodReadinessActionKind;
  actionNote?: string;
  updatedAt: number;
}

export type EarlyDriftStatus = 'acknowledged' | 'addressed';

export type EarlyDriftSignalKind =
  | 'grazing_urge'
  | 'schedule_slipping'
  | 'portion_creep'
  | 'stress_fatigue'
  | 'environment_temptation';

export type EarlyDriftResponseKind =
  | 'anchor_next_block'
  | 'pause_15_min'
  | 'check_food_readiness'
  | 'revisit_non_negotiables';

export interface EarlyDriftRecord {
  dateKey: string;
  status: EarlyDriftStatus;
  signalKind: EarlyDriftSignalKind;
  note?: string;
  plannedResponse?: EarlyDriftResponseKind;
  acknowledgedAt: number;
  addressedAt?: number;
}

export type AdjustmentCategory =
  | 'meal_timing'
  | 'food_readiness'
  | 'portion_satiety'
  | 'evening_boundary'
  | 'custom';

export type AdjustmentStatus = 'testing' | 'kept' | 'retired';

export interface MaintenanceAdjustmentRecord {
  id: string;
  createdDateKey: string;
  category: AdjustmentCategory;
  description: string;
  reason?: string;
  status: AdjustmentStatus;
  lastReviewedDateKey?: string;
  reviewOutcomeNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PracticeLoopStoreV1 {
  version: 1;
  selectedBookId: PracticeLoopBookId;
  foodReadinessByDate: Record<string, FoodReadinessRecord>;
  earlyDriftByDate: Record<string, EarlyDriftRecord>;
  activeAdjustment: MaintenanceAdjustmentRecord | null;
  adjustmentHistory: MaintenanceAdjustmentRecord[];
  lastStructureContinuedDateKey?: string;
}

function getDefaultStore(): PracticeLoopStoreV1 {
  return {
    version: 1,
    selectedBookId: 'book1_resume_ability',
    foodReadinessByDate: {},
    earlyDriftByDate: {},
    activeAdjustment: null,
    adjustmentHistory: [],
  };
}

function dispatchPracticeLoopUpdated(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PRACTICE_LOOP_UPDATED_EVENT));
  }
}

export function loadPracticeLoopStore(): PracticeLoopStoreV1 {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return getDefaultStore();
  }
  try {
    const raw = localStorage.getItem(PRACTICE_LOOP_STORAGE_KEY);
    if (!raw) return getDefaultStore();
    const parsed = JSON.parse(raw) as Partial<PracticeLoopStoreV1> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return getDefaultStore();
    }
    const selectedBookId: PracticeLoopBookId =
      parsed.selectedBookId === 'book2_loss_maintenance'
        ? 'book2_loss_maintenance'
        : 'book1_resume_ability';

    return {
      version: 1,
      selectedBookId,
      foodReadinessByDate:
        parsed.foodReadinessByDate && typeof parsed.foodReadinessByDate === 'object'
          ? parsed.foodReadinessByDate
          : {},
      earlyDriftByDate:
        parsed.earlyDriftByDate && typeof parsed.earlyDriftByDate === 'object'
          ? parsed.earlyDriftByDate
          : {},
      activeAdjustment:
        parsed.activeAdjustment && typeof parsed.activeAdjustment === 'object'
          ? parsed.activeAdjustment
          : null,
      adjustmentHistory: Array.isArray(parsed.adjustmentHistory)
        ? parsed.adjustmentHistory
        : [],
      lastStructureContinuedDateKey:
        typeof parsed.lastStructureContinuedDateKey === 'string'
          ? parsed.lastStructureContinuedDateKey
          : undefined,
    };
  } catch {
    return getDefaultStore();
  }
}

export function savePracticeLoopStore(store: PracticeLoopStoreV1): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(PRACTICE_LOOP_STORAGE_KEY, JSON.stringify(store));
    dispatchPracticeLoopUpdated();
    return true;
  } catch {
    return false;
  }
}

// ── Book Selection (Non-destructive switching) ────────────────────────────────

export function getSelectedPracticeLoopBook(): PracticeLoopBookId {
  return loadPracticeLoopStore().selectedBookId;
}

export function setSelectedPracticeLoopBook(bookId: PracticeLoopBookId): PracticeLoopBookId {
  const store = loadPracticeLoopStore();
  store.selectedBookId = bookId;
  savePracticeLoopStore(store);
  return bookId;
}

// ── Food Readiness ────────────────────────────────────────────────────────────

export function getFoodReadinessForDate(dateKey = getLocalDateKey()): FoodReadinessRecord | null {
  const store = loadPracticeLoopStore();
  return store.foodReadinessByDate[dateKey] || null;
}

export function saveFoodReadinessRecord(params: {
  dateKey?: string;
  targetBlockId?: string;
  targetBlockSummary?: string;
  status: FoodReadinessStatus;
  gapKind?: FoodReadinessGapKind;
  gapNote?: string;
  selectedAction?: FoodReadinessActionKind;
  actionNote?: string;
}): FoodReadinessRecord {
  const dateKey = params.dateKey || getLocalDateKey();
  const store = loadPracticeLoopStore();
  const record: FoodReadinessRecord = {
    dateKey,
    targetBlockId: params.targetBlockId,
    targetBlockSummary: params.targetBlockSummary,
    status: params.status,
    gapKind: params.status === 'ready' ? undefined : params.gapKind,
    gapNote: params.status === 'ready' ? undefined : (params.gapNote || '').trim() || undefined,
    selectedAction: params.selectedAction,
    actionNote: (params.actionNote || '').trim() || undefined,
    updatedAt: Date.now(),
  };
  store.foodReadinessByDate[dateKey] = record;
  savePracticeLoopStore(store);
  return record;
}

// ── Early Signs of Drift (Strictly Non-Slip, Zero XP Side Effects) ────────────

export function getEarlyDriftForDate(dateKey = getLocalDateKey()): EarlyDriftRecord | null {
  const store = loadPracticeLoopStore();
  return store.earlyDriftByDate[dateKey] || null;
}

export function saveEarlyDriftRecord(params: {
  dateKey?: string;
  signalKind: EarlyDriftSignalKind;
  note?: string;
  plannedResponse?: EarlyDriftResponseKind;
}): EarlyDriftRecord {
  const dateKey = params.dateKey || getLocalDateKey();
  const store = loadPracticeLoopStore();
  const existing = store.earlyDriftByDate[dateKey];
  const now = Date.now();
  const status: EarlyDriftStatus = params.plannedResponse ? 'addressed' : 'acknowledged';

  const record: EarlyDriftRecord = {
    dateKey,
    status,
    signalKind: params.signalKind,
    note: (params.note || '').trim() || undefined,
    plannedResponse: params.plannedResponse,
    acknowledgedAt: existing?.acknowledgedAt || now,
    addressedAt: params.plannedResponse ? now : undefined,
  };
  store.earlyDriftByDate[dateKey] = record;
  savePracticeLoopStore(store);
  return record;
}

// ── Test One Adjustment (Single Active Adjustment Guard) ─────────────────────

export function getActiveMaintenanceAdjustment(): MaintenanceAdjustmentRecord | null {
  const store = loadPracticeLoopStore();
  if (store.activeAdjustment && store.activeAdjustment.status === 'testing') {
    return store.activeAdjustment;
  }
  return null;
}

export function getMaintenanceAdjustmentHistory(): MaintenanceAdjustmentRecord[] {
  return loadPracticeLoopStore().adjustmentHistory;
}

/**
 * Records ONE specific adjustment to test. If an active adjustment already exists,
 * updates it in place (unless `replaceExisting` archives the previous one) so multiple
 * simultaneous adjustments are never accumulated by default.
 */
export function saveOneMaintenanceAdjustment(params: {
  category: AdjustmentCategory;
  description: string;
  reason?: string;
  dateKey?: string;
}): MaintenanceAdjustmentRecord | null {
  const cleanDesc = (params.description || '').trim();
  if (!cleanDesc) return null;

  const dateKey = params.dateKey || getLocalDateKey();
  const now = Date.now();
  const store = loadPracticeLoopStore();

  if (store.activeAdjustment && store.activeAdjustment.status === 'testing') {
    const updated: MaintenanceAdjustmentRecord = {
      ...store.activeAdjustment,
      category: params.category,
      description: cleanDesc,
      reason: (params.reason || '').trim() || undefined,
      updatedAt: now,
    };
    store.activeAdjustment = updated;
    savePracticeLoopStore(store);
    return updated;
  }

  const created: MaintenanceAdjustmentRecord = {
    id: `b2adj_${now}_${Math.random().toString(36).slice(2, 6)}`,
    createdDateKey: dateKey,
    category: params.category,
    description: cleanDesc,
    reason: (params.reason || '').trim() || undefined,
    status: 'testing',
    createdAt: now,
    updatedAt: now,
  };
  store.activeAdjustment = created;
  savePracticeLoopStore(store);
  return created;
}

/**
 * Reviews the currently active adjustment (`testing` = keep testing another week;
 * `kept` or `retired` = concludes test and archives record to `adjustmentHistory`).
 */
export function reviewActiveMaintenanceAdjustment(params: {
  decision: 'testing' | 'kept' | 'retired';
  outcomeNote?: string;
  dateKey?: string;
}): MaintenanceAdjustmentRecord | null {
  const store = loadPracticeLoopStore();
  const current = store.activeAdjustment;
  if (!current) return null;

  const dateKey = params.dateKey || getLocalDateKey();
  const now = Date.now();

  const updated: MaintenanceAdjustmentRecord = {
    ...current,
    status: params.decision,
    lastReviewedDateKey: dateKey,
    reviewOutcomeNote: (params.outcomeNote || '').trim() || current.reviewOutcomeNote,
    updatedAt: now,
  };

  if (params.decision === 'testing') {
    store.activeAdjustment = updated;
  } else {
    store.activeAdjustment = null;
    store.adjustmentHistory = [
      updated,
      ...store.adjustmentHistory.filter((item) => item.id !== updated.id),
    ];
  }

  savePracticeLoopStore(store);
  return updated;
}

export function recordContinueExistingStructure(dateKey = getLocalDateKey()): void {
  const store = loadPracticeLoopStore();
  store.lastStructureContinuedDateKey = dateKey;
  savePracticeLoopStore(store);
}

/**
 * Clears transient Book 2 activity logs during a full statistics reset while
 * preserving the user's selected Practice Loop book preference.
 */
export function clearBook2PracticeActivity(): void {
  const store = loadPracticeLoopStore();
  const reset: PracticeLoopStoreV1 = {
    version: 1,
    selectedBookId: store.selectedBookId,
    foodReadinessByDate: {},
    earlyDriftByDate: {},
    activeAdjustment: null,
    adjustmentHistory: [],
  };
  savePracticeLoopStore(reset);
}
