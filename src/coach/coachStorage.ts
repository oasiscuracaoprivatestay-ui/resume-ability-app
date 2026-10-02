/**
 * SDA AI Coach — Local Conversation Storage (Phase 33)
 *
 * Dedicated namespace: 'resume-ability-coach'
 *
 * Principles:
 * - Completely isolated from food logs and diet verification storage.
 * - Chat actions award strictly 0 score points.
 * - Safe fallback on corrupt / missing data.
 * - Schema versioned for future migrations.
 */

import type { CoachConversation, CoachMessage } from './types';
import { ACTIVE_ABILITY_ID } from './types';

export const COACH_STORAGE_KEY = 'resume-ability-coach';
export const CURRENT_COACH_SCHEMA_VERSION = 1;

export const DEFAULT_CONVERSATION: CoachConversation = {
  schemaVersion: CURRENT_COACH_SCHEMA_VERSION,
  ability: ACTIVE_ABILITY_ID,
  messages: [],
  updatedAt: Date.now(),
};

/**
 * Load the active conversation from localStorage.
 * Safely recovers on syntax error or schema mismatch.
 */
export function loadCoachConversation(): CoachConversation {
  try {
    const raw = localStorage.getItem(COACH_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONVERSATION, messages: [] };

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.messages)) {
      return { ...DEFAULT_CONVERSATION, messages: [] };
    }

    return {
      schemaVersion: parsed.schemaVersion || CURRENT_COACH_SCHEMA_VERSION,
      ability: parsed.ability || ACTIVE_ABILITY_ID,
      messages: parsed.messages.filter(
        (m: unknown): m is CoachMessage =>
          Boolean(m && typeof m === 'object' && 'id' in m && 'role' in m && 'text' in m)
      ),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return { ...DEFAULT_CONVERSATION, messages: [] };
  }
}

/**
 * Persist conversation to localStorage.
 */
export function saveCoachConversation(conv: CoachConversation): void {
  try {
    const toSave: CoachConversation = {
      ...conv,
      updatedAt: Date.now(),
    };
    localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Fail silently in quota-limited / private browser modes
  }
}

/**
 * Clear conversation history.
 */
export function clearCoachConversation(): void {
  try {
    localStorage.removeItem(COACH_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

/**
 * Convenience helper to append a single message and persist.
 */
export function appendCoachMessage(msg: CoachMessage): CoachConversation {
  const current = loadCoachConversation();
  const next: CoachConversation = {
    ...current,
    messages: [...current.messages, msg],
    updatedAt: Date.now(),
  };
  saveCoachConversation(next);
  return next;
}
