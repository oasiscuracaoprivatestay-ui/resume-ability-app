/**
 * Dedicated Non-Negotiable Review event storage — Phase 8
 *
 * Stores ReviewEvent records separately so historical daily Resume-Ability
 * scores can be reconstructed deterministically.
 */

export interface ReviewEvent {
  id: string;
  timestamp: number;
}

const STORAGE_KEY = 'resume-ability-review-events';

export function loadReviewEvents(): ReviewEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReviewEvent[];
  } catch {
    return [];
  }
}

/**
 * Persist a ReviewEvent with duplicate prevention.
 */
export function saveReviewEvent(event: ReviewEvent): boolean {
  const events = loadReviewEvents();

  // Guard against duplicate event IDs
  if (events.some((e) => e.id === event.id)) {
    return false;
  }

  events.push(event);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

export function clearReviewEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}
