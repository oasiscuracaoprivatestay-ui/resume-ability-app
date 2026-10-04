/**
 * SDA AI Coach — Action Proposal Contracts & Safe Execution Adapter (Phase 39B)
 *
 * Confirmation-First Architecture:
 * ─────────────────────────────────────────────────────────────────────────────
 * AI interpretation NEVER equals automatic app mutation.
 *
 * Flow:
 *   User text / voice
 *   → Understanding
 *   → Structured CoachActionProposal
 *   → Validation
 *   → Visible Proposal Card
 *   → USER PRESSES CONFIRM
 *   → Deterministic Execution Adapter (executeActionProposal)
 *   → Existing Canonical App Write Function
 *   → Canonical Scoring / Analytics
 *   → Success State
 *
 * Strict Rules:
 * - Coach/LLM NEVER writes directly to localStorage.
 * - Coach/LLM NEVER calculates or supplies score points.
 * - Reuses canonical write paths (saveCheckIn, saveUnplannedFoodLog).
 * - Deduplication and idempotency enforced via proposal.id and receipts.
 */

import type { CoachActionProposal, CoachActionType, CoachExecutionResult } from './types';
import { ACTIVE_ABILITY_ID } from './types';
import { saveCheckIn, type CheckInStatus } from '../utils/checkInStorage';
import {
  saveUnplannedFoodLog,
  type DetailedBlockOutcome,
} from '../utils/dietVerificationStorage';
import { recordScoreEvent, type ScoreActivityType } from '../utils/scoringEngine';
import { getLocalDateKey } from '../utils/dietStorage';

// ── Constants & Configuration ─────────────────────────────────────────────────

export const PROPOSAL_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COACH_RECEIPT_STORAGE_KEY = 'resume-ability-coach-execution-receipts';

export const EXECUTABLE_ACTION_TYPES: readonly CoachActionType[] = [
  'LOG_CHECK_IN',
  'LOG_FOOD',
  'LOG_SLIP',
  'LOG_NEUTRAL',
] as const;

// ── Execution Receipts (Idempotency) ──────────────────────────────────────────

export interface CoachExecutionReceipt {
  proposalId: string;
  actionType: CoachActionType;
  executedAt: number;
  recordId?: string;
  pointsAwarded?: number;
}

export function loadExecutionReceipts(): Record<string, CoachExecutionReceipt> {
  try {
    const raw = localStorage.getItem(COACH_RECEIPT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveExecutionReceipt(receipt: CoachExecutionReceipt): void {
  try {
    const receipts = loadExecutionReceipts();
    receipts[receipt.proposalId] = receipt;
    localStorage.setItem(COACH_RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // Fail silently in quota-restricted environments
  }
}

export function clearExecutionReceipts(): void {
  try {
    localStorage.removeItem(COACH_RECEIPT_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}

// ── Proposal Factory ──────────────────────────────────────────────────────────

/**
 * Creates a structured action proposal contract.
 */
export function createActionProposal(
  type: CoachActionType,
  payload: Record<string, unknown>,
  humanReadableSummary: string,
  confidence = 0.95
): CoachActionProposal {
  const now = Date.now();
  return {
    id: `proposal-${now}-${Math.random().toString(36).slice(2, 7)}`,
    ability: ACTIVE_ABILITY_ID,
    type,
    confidence,
    requiresConfirmation: true, // Always true for state writes
    payload,
    humanReadableSummary,
    createdAt: now,
    executionStatus: 'pending',
  };
}

// ── Freshness & Age Helpers ───────────────────────────────────────────────────

export function getProposalCreationTimestamp(proposal: CoachActionProposal): number {
  if (typeof proposal.createdAt === 'number' && proposal.createdAt > 0) {
    return proposal.createdAt;
  }
  const match = proposal.id.match(/^proposal-(\d+)-/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Date.now();
}

export function isProposalExpired(proposal: CoachActionProposal): boolean {
  const created = getProposalCreationTimestamp(proposal);
  return Date.now() - created > PROPOSAL_MAX_AGE_MS;
}

// ── Core Safe Execution Adapter ───────────────────────────────────────────────

/**
 * Executes a user-confirmed Coach action proposal through canonical application write paths.
 * Enforces validation, trust boundaries, freshness, and idempotency.
 */
export async function executeActionProposal(
  proposal: CoachActionProposal
): Promise<CoachExecutionResult> {
  // 1. Freshness Check: Expire after 24 hours
  if (isProposalExpired(proposal)) {
    return {
      success: false,
      actionType: proposal.type,
      status: 'expired',
      message: 'This proposal has expired (>24 hours). Please create a new one.',
    };
  }

  // 2. Idempotency Check: Prevent duplicate execution
  const receipts = loadExecutionReceipts();
  const existingReceipt = receipts[proposal.id];
  if (existingReceipt) {
    return {
      success: true,
      actionType: existingReceipt.actionType,
      recordId: existingReceipt.recordId,
      pointsAwarded: existingReceipt.pointsAwarded ?? 0,
      status: 'already_executed',
      message: 'Action already executed.',
    };
  }

  // 3. Allowed Executable Action Types Whitelist
  if (!EXECUTABLE_ACTION_TYPES.includes(proposal.type)) {
    return {
      success: false,
      actionType: proposal.type,
      status: 'rejected',
      message: `Action type "${proposal.type}" is not supported for execution in Phase 39B.`,
    };
  }

  // 4. Trust Boundary / Anti-Injection Protection
  const payload = proposal.payload || {};
  const FORBIDDEN_AI_KEYS = ['score', 'points', 'pointsAwarded', 'overridePoints', 'activityType', 'sourceId'];
  for (const key of FORBIDDEN_AI_KEYS) {
    if (payload[key] !== undefined) {
      return {
        success: false,
        actionType: proposal.type,
        status: 'rejected',
        message: `Proposal contains invalid override property "${key}". Execution rejected for security.`,
      };
    }
  }

  // 5. Date & Time Format Validation
  if (typeof payload.date === 'string' && payload.date.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date.trim())) {
      return {
        success: false,
        actionType: proposal.type,
        status: 'rejected',
        message: `Invalid date format "${payload.date}". Expected YYYY-MM-DD.`,
      };
    }
  }
  if (typeof payload.startTime === 'string' && payload.startTime.trim()) {
    if (!/^\d{1,2}:\d{2}$/.test(payload.startTime.trim())) {
      return {
        success: false,
        actionType: proposal.type,
        status: 'rejected',
        message: `Invalid time format "${payload.startTime}". Expected HH:MM.`,
      };
    }
  }

  // 6. Action-Specific Canonical Dispatch
  try {
    switch (proposal.type) {
      case 'LOG_CHECK_IN': {
        const status = payload.status as CheckInStatus;
        const VALID_CHECKIN_STATUSES: CheckInStatus[] = ['on-structure', 'near-slip', 'slip'];
        if (!VALID_CHECKIN_STATUSES.includes(status)) {
          return {
            success: false,
            actionType: 'LOG_CHECK_IN',
            status: 'rejected',
            message: `Invalid check-in status: "${String(status)}". Expected one of: ${VALID_CHECKIN_STATUSES.join(', ')}.`,
          };
        }

        // Canonical write
        const checkInRecord = saveCheckIn(status);

        // Canonical scoring
        const scoreResult = recordScoreEvent({
          activityType: 'DAILY_CHECK_IN',
          sourceId: `coach_checkin_${proposal.id}`,
          metadata: { status, proposalId: proposal.id },
        });

        const receipt: CoachExecutionReceipt = {
          proposalId: proposal.id,
          actionType: 'LOG_CHECK_IN',
          executedAt: Date.now(),
          recordId: checkInRecord.id,
          pointsAwarded: scoreResult.pointsAwarded,
        };
        saveExecutionReceipt(receipt);

        return {
          success: true,
          actionType: 'LOG_CHECK_IN',
          recordId: checkInRecord.id,
          pointsAwarded: scoreResult.pointsAwarded,
          status: 'executed',
          message: `Recorded Daily Check-In (${status === 'on-structure' ? 'On Structure' : (status === 'near-slip' ? 'Near Slip' : 'Slip')}).`,
        };
      }

      case 'LOG_SLIP': {
        const rawOutcome = payload.outcome || payload.detailedOutcome;
        const VALID_SLIP_OUTCOMES: DetailedBlockOutcome[] = ['structured_slip', 'unstructured_slip'];
        if (!VALID_SLIP_OUTCOMES.includes(rawOutcome as DetailedBlockOutcome)) {
          return {
            success: false,
            actionType: 'LOG_SLIP',
            status: 'rejected',
            message: `Invalid or missing slip subtype: "${String(rawOutcome)}". True slip requires 'structured_slip' or 'unstructured_slip'.`,
          };
        }

        const detailedOutcome = rawOutcome as DetailedBlockOutcome;
        const isResumed = payload.resumed === true || payload.isResumed === true;
        const targetDateKey = typeof payload.date === 'string' && payload.date.trim() ? payload.date.trim() : getLocalDateKey();
        const startTime = typeof payload.startTime === 'string' && payload.startTime.trim() ? payload.startTime.trim() : undefined;
        const description = typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim()
          : (detailedOutcome === 'structured_slip' ? 'Structured Slip' : 'Unstructured Slip');

        // Canonical write
        const foodLogEntry = saveUnplannedFoodLog({
          description,
          status: 'slip',
          detailedOutcome,
          isResumed,
          dateKey: targetDateKey,
          startTime,
          isUnplanned: true,
        });

        // Canonical scoring
        const scoreResult = recordScoreEvent({
          activityType: 'SLIP_REPORTED',
          dateKey: targetDateKey,
          sourceId: `coach_slip_${proposal.id}`,
          metadata: { detailedOutcome, isResumed, proposalId: proposal.id },
        });

        const receipt: CoachExecutionReceipt = {
          proposalId: proposal.id,
          actionType: 'LOG_SLIP',
          executedAt: Date.now(),
          recordId: foodLogEntry.id,
          pointsAwarded: scoreResult.pointsAwarded,
        };
        saveExecutionReceipt(receipt);

        return {
          success: true,
          actionType: 'LOG_SLIP',
          recordId: foodLogEntry.id,
          pointsAwarded: scoreResult.pointsAwarded,
          status: 'executed',
          message: `Recorded Slip (${detailedOutcome === 'structured_slip' ? 'Structured' : 'Unstructured'}).`,
        };
      }

      case 'LOG_FOOD': {
        const rawOutcome = payload.detailedOutcome || payload.outcome || 'on_track';
        const VALID_FOOD_OUTCOMES: DetailedBlockOutcome[] = ['on_track', 'twenty_percent_off_track'];
        if (!VALID_FOOD_OUTCOMES.includes(rawOutcome as DetailedBlockOutcome)) {
          return {
            success: false,
            actionType: 'LOG_FOOD',
            status: 'rejected',
            message: `Invalid food log outcome: "${String(rawOutcome)}". Expected 'on_track' or 'twenty_percent_off_track'.`,
          };
        }

        const detailedOutcome = rawOutcome as DetailedBlockOutcome;
        const targetDateKey = typeof payload.date === 'string' && payload.date.trim() ? payload.date.trim() : getLocalDateKey();
        const startTime = typeof payload.startTime === 'string' && payload.startTime.trim() ? payload.startTime.trim() : undefined;

        let description = '';
        if (typeof payload.description === 'string' && payload.description.trim()) {
          description = payload.description.trim();
        } else if (Array.isArray(payload.foodItems) && payload.foodItems.length > 0) {
          description = (payload.foodItems as Array<{ rawText?: string; name?: string; portionQuantity?: number; quantity?: number; portionUnit?: string; unit?: string }>)
            .map(f => `${f.rawText || f.name || 'food'} (${f.portionQuantity || f.quantity || 1} ${f.portionUnit || f.unit || 'portion'})`)
            .join(', ');
        } else if (detailedOutcome === 'twenty_percent_off_track') {
          description = '20% OFF TRACK';
        } else {
          description = 'Food Log';
        }

        // Canonical write — 20% OFF TRACK is on-track flexibility
        const foodLogEntry = saveUnplannedFoodLog({
          description,
          status: 'on-track',
          detailedOutcome,
          dateKey: targetDateKey,
          startTime,
          isUnplanned: true,
        });

        // Canonical scoring
        const activityType: ScoreActivityType = detailedOutcome === 'twenty_percent_off_track'
          ? 'DIET_TWENTY_PERCENT_OFF_TRACK'
          : 'DIET_ON_TRACK';

        const scoreResult = recordScoreEvent({
          activityType,
          dateKey: targetDateKey,
          sourceId: `coach_food_${proposal.id}`,
          metadata: { detailedOutcome, proposalId: proposal.id },
        });

        const receipt: CoachExecutionReceipt = {
          proposalId: proposal.id,
          actionType: 'LOG_FOOD',
          executedAt: Date.now(),
          recordId: foodLogEntry.id,
          pointsAwarded: scoreResult.pointsAwarded,
        };
        saveExecutionReceipt(receipt);

        return {
          success: true,
          actionType: 'LOG_FOOD',
          recordId: foodLogEntry.id,
          pointsAwarded: scoreResult.pointsAwarded,
          status: 'executed',
          message: detailedOutcome === 'twenty_percent_off_track'
            ? 'Recorded 20% OFF TRACK.'
            : 'Recorded Food Log.',
        };
      }

      case 'LOG_NEUTRAL': {
        const targetDateKey = typeof payload.date === 'string' && payload.date.trim() ? payload.date.trim() : getLocalDateKey();
        const startTime = typeof payload.startTime === 'string' && payload.startTime.trim() ? payload.startTime.trim() : undefined;
        const description = typeof payload.description === 'string' && payload.description.trim() ? payload.description.trim() : 'Neutral Log';
        const quantity = typeof payload.quantity === 'string' ? payload.quantity : (typeof payload.quantity === 'number' ? String(payload.quantity) : undefined);

        // Canonical write
        const neutralEntry = saveUnplannedFoodLog({
          description,
          recordType: 'neutral',
          status: 'on-track',
          dateKey: targetDateKey,
          startTime,
          quantity,
          isUnplanned: true,
        });

        // Neutral logs strictly award ZERO points
        const receipt: CoachExecutionReceipt = {
          proposalId: proposal.id,
          actionType: 'LOG_NEUTRAL',
          executedAt: Date.now(),
          recordId: neutralEntry.id,
          pointsAwarded: 0,
        };
        saveExecutionReceipt(receipt);

        return {
          success: true,
          actionType: 'LOG_NEUTRAL',
          recordId: neutralEntry.id,
          pointsAwarded: 0,
          status: 'executed',
          message: 'Recorded Neutral Log.',
        };
      }

      default:
        return {
          success: false,
          actionType: proposal.type,
          status: 'rejected',
          message: `Action type "${proposal.type}" is not supported.`,
        };
    }
  } catch (err) {
    return {
      success: false,
      actionType: proposal.type,
      status: 'failed',
      message: err instanceof Error ? err.message : 'Unknown execution error occurred.',
    };
  }
}
