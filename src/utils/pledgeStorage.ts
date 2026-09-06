/**
 * Pledge / Commitment storage — Phase 6A
 *
 * Stores the user's commitment data:
 *   reasons               — "Why I'm doing this" (multiple user-entered strings)
 *   nonNegotiables        — up to MAX_NON_NEGOTIABLES personal rules
 *   nonNegotiableReviewCount — persistent all-time total of completed reviews
 *   lastNonNegotiableReviewAt — ISO timestamp of the last review
 *
 * Pattern: one localStorage key, typed interface, safe defaults, backward-compatible.
 * Never throws on read — always returns a valid object.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PledgeData {
  reasons: string[];
  nonNegotiables: string[];
  nonNegotiableReviewCount: number;
  lastNonNegotiableReviewAt: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_NON_NEGOTIABLES = 7;

const STORAGE_KEY = 'resume-ability-pledge';

const DEFAULT_DATA: PledgeData = {
  reasons: [],
  nonNegotiables: [],
  nonNegotiableReviewCount: 0,
  lastNonNegotiableReviewAt: null,
};

// ── Core persistence ──────────────────────────────────────────────────────────

/**
 * Load pledge data from localStorage.
 * Merges with defaults for backward compatibility — users with no data
 * or data from before this feature get all-empty safe defaults.
 */
export function loadPledge(): PledgeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA };
    const parsed = JSON.parse(raw) as Partial<PledgeData>;
    return {
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.filter(r => typeof r === 'string') : [],
      nonNegotiables: Array.isArray(parsed.nonNegotiables)
        ? parsed.nonNegotiables.filter(n => typeof n === 'string').slice(0, MAX_NON_NEGOTIABLES)
        : [],
      nonNegotiableReviewCount:
        typeof parsed.nonNegotiableReviewCount === 'number' && parsed.nonNegotiableReviewCount >= 0
          ? parsed.nonNegotiableReviewCount
          : 0,
      lastNonNegotiableReviewAt:
        typeof parsed.lastNonNegotiableReviewAt === 'string'
          ? parsed.lastNonNegotiableReviewAt
          : null,
    };
  } catch {
    return { ...DEFAULT_DATA };
  }
}

/** Persist pledge data. Safe to call frequently — just serialises to localStorage. */
export function savePledge(data: PledgeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota exceeded or private-mode restriction — fail silently.
  }
}

// ── Review win tracking ───────────────────────────────────────────────────────

/**
 * Record a completed non-negotiable review.
 * Increments the persistent count and updates the timestamp.
 * Returns the updated PledgeData.
 *
 * Duplicate prevention is the caller's responsibility
 * (CheckInScreen uses reviewedRef to guard this).
 */
export function recordNonNegotiableReview(): PledgeData {
  const data = loadPledge();
  data.nonNegotiableReviewCount += 1;
  data.lastNonNegotiableReviewAt = new Date().toISOString();
  savePledge(data);
  return data;
}

/** Quick read of the total non-negotiable review count. */
export function getNonNegotiableReviewCount(): number {
  return loadPledge().nonNegotiableReviewCount;
}
