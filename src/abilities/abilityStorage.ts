/**
 * Super Diet-Ability — Seven Diet-Abilities Dedicated Storage (Phase 42)
 *
 * Dedicated storage namespace: 'resume-ability-seven-abilities'
 *
 * Responsibilities:
 * - Stores versioned domain-level state specific to the Seven Abilities (e.g. explicit doctrine exploration records).
 * - Never duplicates mutable counters or operational data that belongs to canonical stores.
 * - Handles SSR, private browsing, JSON corruption, and storage quota errors safely.
 */

import type { CanonicalDietAbilityId, DietAbilitiesStore } from './types';

export const SEVEN_ABILITIES_STORAGE_KEY = 'resume-ability-seven-abilities';

const DEFAULT_STORE: DietAbilitiesStore = {
  version: 1,
  updatedAt: 0,
  doctrineExploration: {},
};

export function loadAbilitiesStore(): DietAbilitiesStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_STORE, doctrineExploration: { ...DEFAULT_STORE.doctrineExploration } };
  }

  try {
    const raw = localStorage.getItem(SEVEN_ABILITIES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STORE, doctrineExploration: { ...DEFAULT_STORE.doctrineExploration } };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return { ...DEFAULT_STORE, doctrineExploration: { ...DEFAULT_STORE.doctrineExploration } };
    }

    const doctrineExploration =
      parsed.doctrineExploration && typeof parsed.doctrineExploration === 'object'
        ? parsed.doctrineExploration
        : {};

    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      doctrineExploration,
    };
  } catch {
    return { ...DEFAULT_STORE, doctrineExploration: { ...DEFAULT_STORE.doctrineExploration } };
  }
}

export function saveAbilitiesStore(store: DietAbilitiesStore): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const payload: DietAbilitiesStore = {
      version: 1,
      updatedAt: Date.now(),
      doctrineExploration: store.doctrineExploration || {},
    };
    localStorage.setItem(SEVEN_ABILITIES_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[SevenAbilitiesStorage] Failed to save abilities store:', err);
    return false;
  }
}

export interface MarkDoctrineResult {
  success: boolean;
  alreadyMarked: boolean;
  exploredAt: number;
}

/**
 * Explicitly marks an ability's doctrine as explored by the user.
 * Idempotent: repeated calls succeed without altering the original timestamp.
 * Returns MarkDoctrineResult with success status.
 */
export function markDoctrineExplored(
  abilityId: CanonicalDietAbilityId,
  timestamp: number = Date.now()
): MarkDoctrineResult {
  const store = loadAbilitiesStore();
  const existing = store.doctrineExploration[abilityId];

  if (existing?.explored) {
    return {
      success: true,
      alreadyMarked: true,
      exploredAt: existing.exploredAt || timestamp,
    };
  }

  store.doctrineExploration[abilityId] = {
    explored: true,
    exploredAt: timestamp,
  };

  const saved = saveAbilitiesStore(store);
  if (!saved) {
    return {
      success: false,
      alreadyMarked: false,
      exploredAt: 0,
    };
  }

  return {
    success: true,
    alreadyMarked: false,
    exploredAt: timestamp,
  };
}

/**
 * Returns the recorded doctrine exploration details or null if unreviewed.
 */
export function getDoctrineExplorationRecord(
  abilityId: CanonicalDietAbilityId
): { explored: boolean; exploredAt?: number } | null {
  const store = loadAbilitiesStore();
  const record = store.doctrineExploration[abilityId];
  return record && record.explored ? record : null;
}

/**
 * Checks if an ability's doctrine has been explicitly marked as explored.
 */
export function isDoctrineExplored(abilityId: CanonicalDietAbilityId): boolean {
  const store = loadAbilitiesStore();
  return Boolean(store.doctrineExploration[abilityId]?.explored);
}

/**
 * Resets the abilities store to its default empty state.
 */
export function resetAbilitiesStore(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(SEVEN_ABILITIES_STORAGE_KEY);
  } catch {
    // ignore
  }
}
