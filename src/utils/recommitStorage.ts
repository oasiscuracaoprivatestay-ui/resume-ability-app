/**
 * Dedicated Re-Commit event storage — Phase 7D
 *
 * Stores Re-Commit events separately from slip records so they can later be
 * used for Daily Resume-Ability score calculation and dashboard metrics.
 */

export interface RecommitEvent {
  id: string;
  timestamp: number;
  slipId?: string;
}

const STORAGE_KEY = 'resume-ability-recommit-events';

export function loadRecommitEvents(): RecommitEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecommitEvent[];
  } catch {
    return [];
  }
}

/**
 * Persist a RecommitEvent with duplicate prevention.
 * If a slipId is provided, prevents recording multiple recommits for the same slip.
 */
export function saveRecommitEvent(event: RecommitEvent): boolean {
  const events = loadRecommitEvents();

  // Guard against duplicate recording for the same slip session
  if (event.slipId && events.some((e) => e.slipId === event.slipId)) {
    return false;
  }

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

export function clearRecommitEvents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}
