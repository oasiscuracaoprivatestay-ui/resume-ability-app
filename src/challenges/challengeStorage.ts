/**
 * SDA Ability Challenges System — Persistent Storage Layer (Phase 37)
 *
 * Manages versioned local persistence for active challenges and challenge history.
 * Namespaced under 'resume-ability-challenges' in localStorage.
 *
 * Guarantees:
 * - Single active challenge at any time.
 * - Completed/cancelled challenges are archived to history.
 * - Emits 'resume-ability:challenge-updated' window events on change for reactive UI.
 */

import type { ChallengeInstance, ChallengeStore } from './types';

export const CHALLENGE_STORAGE_KEY = 'resume-ability-challenges';
export const CHALLENGE_UPDATED_EVENT = 'resume-ability:challenge-updated';

function createDefaultStore(): ChallengeStore {
  return {
    version: 1,
    activeChallenge: null,
    history: [],
  };
}

/**
 * Loads the challenge store from localStorage with schema validation.
 */
export function loadChallengeStore(): ChallengeStore {
  if (typeof localStorage === 'undefined') {
    return createDefaultStore();
  }

  try {
    const raw = localStorage.getItem(CHALLENGE_STORAGE_KEY);
    if (!raw) return createDefaultStore();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultStore();
    }

    return {
      version: 1,
      activeChallenge: (parsed.activeChallenge && typeof parsed.activeChallenge === 'object')
        ? parsed.activeChallenge
        : null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return createDefaultStore();
  }
}

/**
 * Persists the challenge store and dispatches update event.
 */
export function saveChallengeStore(store: ChallengeStore): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(store));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHALLENGE_UPDATED_EVENT));
    }
  } catch {
    // Fail gracefully on storage quota issues
  }
}

/**
 * Retrieves the currently active challenge if any.
 */
export function getActiveChallenge(): ChallengeInstance | null {
  const store = loadChallengeStore();
  return store.activeChallenge;
}

/**
 * Sets or clears the active challenge.
 */
export function saveActiveChallenge(challenge: ChallengeInstance | null): void {
  const store = loadChallengeStore();
  store.activeChallenge = challenge;
  saveChallengeStore(store);
}

/**
 * Retrieves historical challenges (completed and cancelled).
 */
export function getChallengeHistory(): ChallengeInstance[] {
  const store = loadChallengeStore();
  return store.history;
}

/**
 * Archives a challenge instance into history.
 */
export function archiveChallenge(challenge: ChallengeInstance): void {
  const store = loadChallengeStore();
  // Filter out any existing instance with the same ID before prepending
  store.history = [challenge, ...store.history.filter(c => c.id !== challenge.id)];
  if (store.activeChallenge?.id === challenge.id) {
    store.activeChallenge = null;
  }
  saveChallengeStore(store);
}

/**
 * Clears challenge store (for test runners and debug resets).
 */
export function clearChallengeStore(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(CHALLENGE_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHALLENGE_UPDATED_EVENT));
    }
  } catch {
    // Ignore
  }
}
