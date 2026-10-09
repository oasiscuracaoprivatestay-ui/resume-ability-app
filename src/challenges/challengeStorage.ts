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

import type { ChallengeInstance, ChallengeStore, ChallengeInvitationState, SnoozeOptionDays } from './types';

export const CHALLENGE_STORAGE_KEY = 'resume-ability-challenges';
export const CHALLENGE_UPDATED_EVENT = 'resume-ability:challenge-updated';

/** Default cooldown between invitation prompts: 24 hours (ms) */
export const CHALLENGE_INVITATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function createDefaultStore(): ChallengeStore {
  return {
    version: 1,
    activeChallenge: null,
    history: [],
    invitation: {
      snoozeUntil: null,
      lastPromptAt: null,
    },
  };
}

/**
 * Normalizes invitation state with deterministic defaults (Phase 41C).
 */
export function normalizeInvitationState(raw: any): ChallengeInvitationState {
  if (!raw || typeof raw !== 'object') {
    return { snoozeUntil: null, lastPromptAt: null };
  }
  return {
    snoozeUntil: typeof raw.snoozeUntil === 'number' && Number.isFinite(raw.snoozeUntil) ? raw.snoozeUntil : null,
    lastPromptAt: typeof raw.lastPromptAt === 'number' && Number.isFinite(raw.lastPromptAt) ? raw.lastPromptAt : null,
  };
}

/**
 * Normalizes a ChallengeInstance to guarantee backward compatibility (Phase 41B).
 * Legacy challenges without reminder fields are safely enriched with deterministic defaults:
 * reminderEnabled -> false
 * reminderFrequency -> '1x'
 * reminderTimes -> []
 */
export function normalizeChallengeInstance(raw: any): ChallengeInstance {
  const reminderEnabled = typeof raw.reminderEnabled === 'boolean' ? raw.reminderEnabled : false;
  const validFrequencies = ['1x', '2x', '3x', 'custom'];
  const reminderFrequency = validFrequencies.includes(raw.reminderFrequency)
    ? raw.reminderFrequency
    : '1x';
  const reminderTimes = Array.isArray(raw.reminderTimes)
    ? raw.reminderTimes.filter((t: any) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t))
    : [];

  // Phase 41E: Normalize check-ins and practice progress
  const checkIns = Array.isArray(raw.checkIns) ? raw.checkIns : [];
  const totalCheckInsCount = typeof raw.totalCheckInsCount === 'number'
    ? raw.totalCheckInsCount
    : checkIns.length;
  const lastCheckInDateKey = typeof raw.lastCheckInDateKey === 'string'
    ? raw.lastCheckInDateKey
    : undefined;

  return {
    ...raw,
    reminderEnabled,
    reminderFrequency,
    reminderTimes,
    checkIns,
    totalCheckInsCount,
    lastCheckInDateKey,
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
        ? normalizeChallengeInstance(parsed.activeChallenge)
        : null,
      history: Array.isArray(parsed.history)
        ? parsed.history.map(normalizeChallengeInstance)
        : [],
      invitation: normalizeInvitationState(parsed.invitation),
    };
  } catch {
    return createDefaultStore();
  }
}

/**
 * Persists the challenge store and dispatches update event.
 * Returns true if saved successfully, false on storage quota or error.
 */
export function saveChallengeStore(store: ChallengeStore): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    localStorage.setItem(CHALLENGE_STORAGE_KEY, JSON.stringify(store));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHALLENGE_UPDATED_EVENT));
    }
    return true;
  } catch {
    // Fail gracefully on storage quota issues
    return false;
  }
}

/**
 * Retrieves the currently active challenge if any.
 */
export function getActiveChallenge(): ChallengeInstance | null {
  const store = loadChallengeStore();
  return store.activeChallenge;
}

export const loadActiveChallenge = getActiveChallenge;

/**
 * Sets or clears the active challenge.
 * Returns true if saved successfully, false on error.
 */
export function saveActiveChallenge(challenge: ChallengeInstance | null): boolean {
  const store = loadChallengeStore();
  store.activeChallenge = challenge;
  return saveChallengeStore(store);
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
 * Returns true if saved successfully, false on error.
 */
export function archiveChallenge(challenge: ChallengeInstance): boolean {
  const store = loadChallengeStore();
  // Filter out any existing instance with the same ID before prepending
  store.history = [challenge, ...store.history.filter(c => c.id !== challenge.id)];
  if (store.activeChallenge?.id === challenge.id) {
    store.activeChallenge = null;
  }
  return saveChallengeStore(store);
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

// ── Challenge Invitation & Snooze Logic (Phase 41C) ───────────────────────────

/**
 * Retrieves the current challenge invitation & snooze state.
 */
export function getChallengeInvitationState(): ChallengeInvitationState {
  const store = loadChallengeStore();
  return store.invitation || { snoozeUntil: null, lastPromptAt: null };
}

/**
 * Snoozes the challenge invitation for a specified duration in days,
 * or applies standard 24h cooldown if days is 'not_now'.
 */
export function setChallengeInvitationSnooze(option: SnoozeOptionDays | 'not_now', now = Date.now()): void {
  const store = loadChallengeStore();
  let snoozeDurationMs: number;

  if (option === 'not_now') {
    snoozeDurationMs = CHALLENGE_INVITATION_COOLDOWN_MS; // 24 hours
  } else {
    snoozeDurationMs = option * 24 * 60 * 60 * 1000;
  }

  const snoozeUntil = now + snoozeDurationMs;
  store.invitation = {
    snoozeUntil,
    lastPromptAt: now,
  };
  saveChallengeStore(store);
}

/**
 * Records that the invitation was intentionally surfaced to the user.
 * Prevents re-prompting on rapid re-renders.
 */
export function markChallengeInvitationPrompted(now = Date.now()): void {
  const store = loadChallengeStore();
  store.invitation = {
    snoozeUntil: store.invitation?.snoozeUntil ?? null,
    lastPromptAt: now,
  };
  saveChallengeStore(store);
}

/**
 * Pure deterministic eligibility check for the challenge invitation card.
 *
 * Rules:
 * 1. Must NOT have an active challenge (`activeChallenge === null`).
 * 2. Must NOT be currently snoozed (`snoozeUntil === null` OR `now >= snoozeUntil`).
 * 3. Must satisfy the anti-nagging cooldown:
 *    - At least 24 hours since `lastPromptAt` (unless never prompted).
 * 4. Must satisfy challenge conclusion cooldown:
 *    - At least 24 hours since the most recent challenge completed/cancelled in history.
 */
export function canShowChallengeInvitation(now = Date.now()): boolean {
  const store = loadChallengeStore();

  // Rule 1: Never show if an active challenge exists
  if (store.activeChallenge && store.activeChallenge.status === 'active') {
    return false;
  }

  const invitation = store.invitation || { snoozeUntil: null, lastPromptAt: null };

  // Rule 2: Never show if snooze is in the future
  if (invitation.snoozeUntil !== null && now < invitation.snoozeUntil) {
    return false;
  }

  // Rule 3: Anti-nagging cooldown (24h since last prompted / dismissed)
  if (invitation.lastPromptAt !== null && (now - invitation.lastPromptAt) < CHALLENGE_INVITATION_COOLDOWN_MS) {
    return false;
  }

  // Rule 4: Challenge conclusion cooldown (24h since last challenge ended)
  if (store.history && store.history.length > 0) {
    const latestHistory = store.history[0];
    const concludedAt = latestHistory.completedAt || latestHistory.cancelledAt || latestHistory.createdAt;
    if (concludedAt && (now - concludedAt) < CHALLENGE_INVITATION_COOLDOWN_MS) {
      return false;
    }
  }

  return true;
}
