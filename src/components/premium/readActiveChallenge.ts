/**
 * Super Diet-Ability — Read-only active Challenge accessor (Phase 2)
 *
 * The existing `syncCurrentChallenge()` persists the derived instance on every
 * call, which re-dispatches CHALLENGE_UPDATED_EVENT synchronously. Calling it
 * from a CHALLENGE_UPDATED_EVENT listener therefore re-enters the listener.
 * Premium Home components use this accessor instead: it reads the stored
 * instance and derives current progress WITHOUT saving it.
 *
 * Note: `deriveChallengeProgress` keeps its existing semantics — if the
 * Challenge end date has passed it completes and archives the Challenge
 * exactly as the engine already does elsewhere.
 */

import {
  getActiveChallenge,
  deriveChallengeProgress,
  type ChallengeInstance,
} from '../../challenges';

export function readActiveChallenge(): ChallengeInstance | null {
  try {
    const stored = getActiveChallenge();
    if (!stored || stored.status !== 'active') return null;
    const derived = deriveChallengeProgress(stored);
    return derived.status === 'active' ? derived : null;
  } catch {
    return null;
  }
}
