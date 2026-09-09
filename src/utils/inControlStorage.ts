/**
 * Dedicated storage for "I Am in Control" events and positive Commit events.
 *
 * Stored separately from slips and check-ins for Phase 8 scoring and metrics.
 */

export interface InControlEvent {
  id: string;
  timestamp: number;
}

export interface CommitEvent {
  id: string;
  timestamp: number;
  source: 'in-control';
  inControlEventId?: string;
}

const IN_CONTROL_KEY = 'resume-ability-in-control-events';
const COMMIT_KEY = 'resume-ability-commit-events';

// ── In-Control Events ────────────────────────────────────────────────────────

export function loadInControlEvents(): InControlEvent[] {
  try {
    const raw = localStorage.getItem(IN_CONTROL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InControlEvent[];
  } catch {
    return [];
  }
}

/**
 * Persist an InControlEvent with duplicate prevention.
 */
export function saveInControlEvent(event: InControlEvent): boolean {
  const events = loadInControlEvents();

  // Guard against duplicate event IDs
  if (events.some((e) => e.id === event.id)) {
    return false;
  }

  events.push(event);
  try {
    localStorage.setItem(IN_CONTROL_KEY, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

export function clearInControlEvents(): void {
  try {
    localStorage.removeItem(IN_CONTROL_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}

// ── Positive Commit Events ───────────────────────────────────────────────────

export function loadCommitEvents(): CommitEvent[] {
  try {
    const raw = localStorage.getItem(COMMIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CommitEvent[];
  } catch {
    return [];
  }
}

/**
 * Persist a CommitEvent with duplicate prevention.
 * Guards against recording multiple Commit events for the same inControlEventId or same ID.
 */
export function saveCommitEvent(event: CommitEvent): boolean {
  const events = loadCommitEvents();

  // Guard against duplicate commit for the same in-control session
  if (event.inControlEventId && events.some((e) => e.inControlEventId === event.inControlEventId)) {
    return false;
  }

  // Guard against duplicate event IDs
  if (events.some((e) => e.id === event.id)) {
    return false;
  }

  events.push(event);
  try {
    localStorage.setItem(COMMIT_KEY, JSON.stringify(events));
    return true;
  } catch {
    return false;
  }
}

export function clearCommitEvents(): void {
  try {
    localStorage.removeItem(COMMIT_KEY);
  } catch {
    // Fail silently in private/restricted storage mode
  }
}
