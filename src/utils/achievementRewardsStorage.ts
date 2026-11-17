/**
 * Super Diet-Ability — Motivation & Rewards Storage & Verified Achievement Selector (Phase 5C.2)
 *
 * Architectural Guarantees:
 * 1. NO second achievement or XP engine: Verified achievements are derived read-only
 *    from the authoritative local stores:
 *    - Resume events: `resume-ability-challenges` (checkIns where status === 'resumed')
 *      and `resume-ability-checkins` (status === 'resumed'), deduplicated by stable `id`.
 *    - Daily Re-Pledges: `resume-ability-recommit-events` (`RecommitEvent.id`).
 *    - 90-Day Milestone Reviews: `resume-ability-90day-journey` (`milestoneReviews`,
 *      created ONLY upon explicit user submission — never upon merely reaching or opening a day).
 *    - Confirmed Challenge Completions: `resume-ability-challenges` (`status === 'completed'`
 *      with valid `id`, `endDate`, `durationDays`, and finite `completedAt > 0`).
 * 2. Strict Validation: Any historical record lacking a reliable identity, valid date,
 *    or confirmed completion timestamp is omitted rather than guessed or fabricated.
 * 3. Private Achievement Notes & Book Context: Stored locally in `sda_achievement_rewards_v1`
 *    keyed by deterministic `achievementId`. Editing notes never creates duplicate achievements
 *    and never awards XP. Switching between Book 1 and Book 2 never deletes history or notes.
 */

import {
  loadChallengeStore,
   CHALLENGE_UPDATED_EVENT,
} from '../challenges/challengeStorage';
import {
  SUPPORTED_CHALLENGE_DURATIONS,
  type ChallengeInstance,
} from '../challenges/types';
import {
  loadNinetyDayJourneyStore,
  NINETY_DAY_MILESTONES,
  NINETY_DAY_JOURNEY_UPDATED_EVENT,
  type NinetyDayMilestoneDay,
} from '../challenges/ninetyDayJourneyStorage';
import type { PracticeLoopBookId } from '../challenges/practiceLoopEngine';
import { getCheckIns } from './checkInStorage';
import { loadRecommitEvents } from './recommitStorage';

export const ACHIEVEMENT_REWARDS_STORAGE_KEY = 'sda_achievement_rewards_v1';
export const ACHIEVEMENT_REWARDS_UPDATED_EVENT = 'sda-achievement-rewards-updated';
export const MAX_ACHIEVEMENT_NOTE_LENGTH = 280;

export type AchievementKind =
  | 'resume'
  | 'repledge'
  | 'milestone_90d'
  | 'challenge_completed';

export interface AchievementNoteRecord {
  achievementId: string;
  noteText: string;
  createdAt: number;
  updatedAt: number;
}

export interface AchievementRewardsStoreV1 {
  version: 1;
  notesById: Record<string, AchievementNoteRecord>;
  bookContextById: Record<string, PracticeLoopBookId>;
}

export interface VerifiedAchievementItem {
  id: string; // Deterministic stable ID (e.g., ach_resume_..., ach_repledge_..., ach_ms90_..., ach_challenge_...)
  sourceRecordId: string;
  kind: AchievementKind;
  dateKey: string; // Local YYYY-MM-DD
  timestamp: number; // Epoch ms for deterministic chronological sorting
  milestoneDay?: NinetyDayMilestoneDay;
  challengeDurationDays?: number;
  bookContext?: PracticeLoopBookId;
  note: AchievementNoteRecord | null;
}

function getEmptyStore(): AchievementRewardsStoreV1 {
  return {
    version: 1,
    notesById: {},
    bookContextById: {},
  };
}

function isValidDateKey(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function epochToLocalDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidBookId(val: unknown): val is PracticeLoopBookId {
  return val === 'book1_resume_ability' || val === 'book2_loss_maintenance';
}

function dispatchRewardsUpdated(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(ACHIEVEMENT_REWARDS_UPDATED_EVENT));
  }
}

// ── Deterministic Achievement ID Builders ────────────────────────────────────

export function buildResumeAchievementId(checkInId: string): string {
  return `ach_resume_${checkInId.trim()}`;
}

export function buildRepledgeAchievementId(recommitId: string): string {
  return `ach_repledge_${recommitId.trim()}`;
}

export function buildMilestoneAchievementId(
  journeyStartDate: string,
  milestoneDay: NinetyDayMilestoneDay
): string {
  return `ach_ms90_${journeyStartDate.trim()}_d${milestoneDay}`;
}

export function buildChallengeCompletedAchievementId(challengeId: string): string {
  return `ach_challenge_${challengeId.trim()}`;
}

// ── Persistence for Private Notes & Book Context ─────────────────────────────

export function loadAchievementRewardsStore(): AchievementRewardsStoreV1 {
  if (typeof localStorage === 'undefined') {
    return getEmptyStore();
  }

  try {
    const raw = localStorage.getItem(ACHIEVEMENT_REWARDS_STORAGE_KEY);
    if (!raw) return getEmptyStore();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return getEmptyStore();
    }

    const notesById: Record<string, AchievementNoteRecord> = {};
    if (parsed.notesById && typeof parsed.notesById === 'object') {
      for (const [key, val] of Object.entries(parsed.notesById)) {
        if (!key || !val || typeof val !== 'object') continue;
        const rec = val as Record<string, unknown>;
        if (typeof rec.noteText !== 'string') continue;
        const trimmed = rec.noteText.trim().slice(0, MAX_ACHIEVEMENT_NOTE_LENGTH);
        if (!trimmed) continue;
        const createdAt =
          typeof rec.createdAt === 'number' && Number.isFinite(rec.createdAt)
            ? rec.createdAt
            : Date.now();
        const updatedAt =
          typeof rec.updatedAt === 'number' && Number.isFinite(rec.updatedAt)
            ? rec.updatedAt
            : createdAt;
        notesById[key] = {
          achievementId: key,
          noteText: trimmed,
          createdAt,
          updatedAt,
        };
      }
    }

    const bookContextById: Record<string, PracticeLoopBookId> = {};
    if (parsed.bookContextById && typeof parsed.bookContextById === 'object') {
      for (const [key, val] of Object.entries(parsed.bookContextById)) {
        if (key && isValidBookId(val)) {
          bookContextById[key] = val;
        }
      }
    }

    return {
      version: 1,
      notesById,
      bookContextById,
    };
  } catch {
    return getEmptyStore();
  }
}

export function saveAchievementRewardsStore(store: AchievementRewardsStoreV1): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(ACHIEVEMENT_REWARDS_STORAGE_KEY, JSON.stringify(store));
    dispatchRewardsUpdated();
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves, updates, or clears a personal note against a stable achievement identifier.
 * Never duplicates achievements and never modifies XP/score stores.
 */
export function saveAchievementNote(
  achievementId: string,
  rawNoteText: string
): { saved: boolean; note: AchievementNoteRecord | null } {
  const cleanId = (achievementId || '').trim();
  if (!cleanId) {
    return { saved: false, note: null };
  }

  const store = loadAchievementRewardsStore();
  const trimmed = (rawNoteText || '').trim().slice(0, MAX_ACHIEVEMENT_NOTE_LENGTH);
  const now = Date.now();

  if (!trimmed) {
    if (store.notesById[cleanId]) {
      delete store.notesById[cleanId];
      const ok = saveAchievementRewardsStore(store);
      return { saved: ok, note: null };
    }
    return { saved: true, note: null };
  }

  const existing = store.notesById[cleanId];
  const record: AchievementNoteRecord = existing
    ? {
        ...existing,
        noteText: trimmed,
        updatedAt: now,
      }
    : {
        achievementId: cleanId,
        noteText: trimmed,
        createdAt: now,
        updatedAt: now,
      };

  store.notesById[cleanId] = record;
  const ok = saveAchievementRewardsStore(store);
  return { saved: ok, note: ok ? record : existing ?? null };
}

export function getAchievementNote(achievementId: string): AchievementNoteRecord | null {
  const cleanId = (achievementId || '').trim();
  if (!cleanId) return null;
  const store = loadAchievementRewardsStore();
  return store.notesById[cleanId] ?? null;
}

/**
 * Records which Practice Loop book was active when an achievement was earned.
 * Preserved across subsequent Book 1 <-> Book 2 switches.
 */
export function recordAchievementBookContext(
  achievementId: string,
  bookId: PracticeLoopBookId
): void {
  const cleanId = (achievementId || '').trim();
  if (!cleanId || !isValidBookId(bookId)) return;
  const store = loadAchievementRewardsStore();
  if (store.bookContextById[cleanId] === bookId) return;
  store.bookContextById[cleanId] = bookId;
  saveAchievementRewardsStore(store);
}

export function clearAchievementRewardsStore(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(ACHIEVEMENT_REWARDS_STORAGE_KEY);
    dispatchRewardsUpdated();
  } catch {
    // Ignore storage errors in restricted environments
  }
}

// ── Verified Achievement Derivation (Read-Only Aggregation) ──────────────────

export function getVerifiedAchievements(
  sortOrder: 'desc' | 'asc' = 'desc'
): VerifiedAchievementItem[] {
  const rewardsStore = loadAchievementRewardsStore();
  const byId = new Map<string, VerifiedAchievementItem>();

  // 1. Resume Events — aggregate across challenge check-ins + canonical check-ins, deduplicating by checkIn ID
  try {
    const challengeStore = loadChallengeStore();
    const allChallenges: ChallengeInstance[] = [];
    if (challengeStore.activeChallenge) {
      allChallenges.push(challengeStore.activeChallenge);
    }
    if (Array.isArray(challengeStore.history)) {
      allChallenges.push(...challengeStore.history);
    }

    const seenResumeSourceIds = new Set<string>();

    for (const ch of allChallenges) {
      if (!ch || !Array.isArray(ch.checkIns)) continue;
      for (const ci of ch.checkIns) {
        if (!ci || ci.status !== 'resumed') continue;
        const srcId = typeof ci.id === 'string' ? ci.id.trim() : '';
        if (!srcId || seenResumeSourceIds.has(srcId)) continue;
        if (!isValidDateKey(ci.dateKey)) continue;
        if (typeof ci.timestamp !== 'number' || !Number.isFinite(ci.timestamp) || ci.timestamp <= 0) {
          continue;
        }
        seenResumeSourceIds.add(srcId);
        const achId = buildResumeAchievementId(srcId);
        byId.set(achId, {
          id: achId,
          sourceRecordId: srcId,
          kind: 'resume',
          dateKey: ci.dateKey,
          timestamp: ci.timestamp,
          bookContext: rewardsStore.bookContextById[achId] ?? 'book1_resume_ability',
          note: rewardsStore.notesById[achId] ?? null,
        });
      }
    }

    // Also include standalone 'resumed' check-ins from CheckInScreen not already matched by actionId
    const canonicalCheckIns = getCheckIns();
    for (const rec of canonicalCheckIns) {
      if (!rec || rec.status !== 'resumed') continue;
      const srcId = typeof rec.id === 'string' ? rec.id.trim() : '';
      if (!srcId || seenResumeSourceIds.has(srcId)) continue;
      if (!isValidDateKey(rec.date)) continue;
      const parsedTs = typeof rec.timestamp === 'string' ? Date.parse(rec.timestamp) : NaN;
      if (!Number.isFinite(parsedTs) || parsedTs <= 0) continue;
      seenResumeSourceIds.add(srcId);
      const achId = buildResumeAchievementId(srcId);
      byId.set(achId, {
        id: achId,
        sourceRecordId: srcId,
        kind: 'resume',
        dateKey: rec.date,
        timestamp: parsedTs,
        bookContext: rewardsStore.bookContextById[achId] ?? 'book1_resume_ability',
        note: rewardsStore.notesById[achId] ?? null,
      });
    }

    // 4. Confirmed Challenge Completions — require explicit completed status, valid duration, endDate, and completedAt
    const seenChallengeIds = new Set<string>();
    for (const ch of allChallenges) {
      if (!ch || ch.status !== 'completed') continue;
      const chId = typeof ch.id === 'string' ? ch.id.trim() : '';
      if (!chId || seenChallengeIds.has(chId)) continue;
      if (!SUPPORTED_CHALLENGE_DURATIONS.includes(ch.durationDays)) continue;
      if (!isValidDateKey(ch.endDate)) continue;
      if (
        typeof ch.completedAt !== 'number' ||
        !Number.isFinite(ch.completedAt) ||
        ch.completedAt <= 0
      ) {
        // Omit legacy or ambiguous records lacking reliable completion timestamp
        continue;
      }
      seenChallengeIds.add(chId);
      const achId = buildChallengeCompletedAchievementId(chId);
      byId.set(achId, {
        id: achId,
        sourceRecordId: chId,
        kind: 'challenge_completed',
        dateKey: epochToLocalDateKey(ch.completedAt),
        timestamp: ch.completedAt,
        challengeDurationDays: ch.durationDays,
        bookContext: rewardsStore.bookContextById[achId],
        note: rewardsStore.notesById[achId] ?? null,
      });
    }
  } catch {
    // Fail safely on corrupted challenge data
  }

  // 2. Daily Re-Pledges — from `resume-ability-recommit-events`
  try {
    const recommits = loadRecommitEvents();
    if (Array.isArray(recommits)) {
      for (const ev of recommits) {
        if (!ev || typeof ev !== 'object') continue;
        const evId = typeof ev.id === 'string' ? ev.id.trim() : '';
        if (!evId) continue;
        if (typeof ev.timestamp !== 'number' || !Number.isFinite(ev.timestamp) || ev.timestamp <= 0) {
          continue;
        }
        const achId = buildRepledgeAchievementId(evId);
        if (byId.has(achId)) continue;
        byId.set(achId, {
          id: achId,
          sourceRecordId: evId,
          kind: 'repledge',
          dateKey: epochToLocalDateKey(ev.timestamp),
          timestamp: ev.timestamp,
          bookContext: rewardsStore.bookContextById[achId],
          note: rewardsStore.notesById[achId] ?? null,
        });
      }
    }
  } catch {
    // Fail safely
  }

  // 3. Completed 90-Day Milestone Reviews — strictly explicit reviews from `resume-ability-90day-journey`
  try {
    const journeyStore = loadNinetyDayJourneyStore();
    const validDays = new Set<number>(NINETY_DAY_MILESTONES);
    for (const rev of journeyStore.milestoneReviews) {
      if (!rev || !validDays.has(rev.milestoneDay)) continue;
      if (!isValidDateKey(rev.journeyStartDate) || !isValidDateKey(rev.dateKey)) continue;
      if (
        typeof rev.completedAt !== 'number' ||
        !Number.isFinite(rev.completedAt) ||
        rev.completedAt <= 0
      ) {
        continue;
      }
      const achId = buildMilestoneAchievementId(rev.journeyStartDate, rev.milestoneDay);
      if (byId.has(achId)) continue;
      byId.set(achId, {
        id: achId,
        sourceRecordId: `${rev.journeyStartDate}_d${rev.milestoneDay}`,
        kind: 'milestone_90d',
        dateKey: rev.dateKey,
        timestamp: rev.completedAt,
        milestoneDay: rev.milestoneDay,
        bookContext: rewardsStore.bookContextById[achId],
        note: rewardsStore.notesById[achId] ?? null,
      });
    }
  } catch {
    // Fail safely
  }

  const list = Array.from(byId.values());
  list.sort((a, b) => {
    const diff = sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    if (diff !== 0) return diff;
    return sortOrder === 'desc' ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
  });

  return list;
}

export const ACHIEVEMENT_SOURCE_EVENTS = [
  CHALLENGE_UPDATED_EVENT,
  NINETY_DAY_JOURNEY_UPDATED_EVENT,
  ACHIEVEMENT_REWARDS_UPDATED_EVENT,
] as const;
