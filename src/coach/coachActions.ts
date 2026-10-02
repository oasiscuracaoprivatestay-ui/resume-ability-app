/**
 * SDA AI Coach — Action Proposal Contracts (Phase 33)
 *
 * Confirmation-First Principle:
 * ─────────────────────────────────────────────────────────────────────────────
 * AI interpretation NEVER equals automatic app mutation.
 *
 * Future flow (Phase 35+):
 *   User message
 *   → AI interpretation
 *   → Structured CoachActionProposal
 *   → User Confirmation Modal / Card
 *   → Existing App Storage Function (e.g. recordUnplannedFoodLog)
 *   → App Result Verification
 *   → Coach Response
 *
 * In Phase 33:
 * STRICTLY NO EXECUTION. Proposals can be represented in memory and rendered
 * as preview cards in the UI, but MUST NEVER mutate app state.
 */

import type { CoachActionProposal, CoachActionType } from './types';
import { ACTIVE_ABILITY_ID } from './types';

/**
 * Creates a structured action proposal contract.
 */
export function createActionProposal(
  type: CoachActionType,
  payload: Record<string, unknown>,
  humanReadableSummary: string,
  confidence = 0.95
): CoachActionProposal {
  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ability: ACTIVE_ABILITY_ID,
    type,
    confidence,
    requiresConfirmation: true, // Always true for state writes
    payload,
    humanReadableSummary,
  };
}

/**
 * Explicit guard ensuring Phase 33 does not execute actions.
 */
export function executeActionProposal(): never {
  throw new Error('Action execution is strictly disabled in Phase 33. Actions will be enabled in a future phase.');
}
