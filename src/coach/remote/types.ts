/**
 * SDA AI Coach — Remote AI Gateway Contracts & DTOs (Phase 36)
 *
 * Defines the request/response wire protocol between the frontend CoachEngine
 * and the secure server-side AI gateway (/api/coach).
 *
 * Privacy / Minimization Rule:
 * Only normalized CoachContext and bounded recent conversation history are passed.
 * Never serializes raw localStorage or browser-specific storage dumps.
 */

import type {
  AbilityId,
  CoachActionProposal,
  CoachActionType,
  CoachContext,
  CoachEntities,
  CoachIntentType,
  CoachUnderstanding,
} from '../types';
import type {
  KnowledgeGap,
  SDACoachingMode,
  SDAPrincipleId,
  SDATermKey,
} from '../knowledge/types';

// ── Client → Server Request DTO ───────────────────────────────────────────────

export interface SerializedChatMessage {
  role: 'user' | 'coach';
  text: string;
}

export interface CoachGatewayRequestDTO {
  message: string;
  language: 'en' | 'es' | 'nl';
  context: CoachContext;
  conversationHistory: SerializedChatMessage[];
}

// ── Server → Client Response Envelope ────────────────────────────────────────

export interface AICoachingPayload {
  mode: SDACoachingMode;
  message: string;
  followUpQuestion?: string;
}

export type FailureCategory =
  | 'NONE'
  | 'KEY_NOT_CONFIGURED'
  | 'PROVIDER_REJECTED'
  | 'AUTH_FAILED'
  | 'RATE_LIMIT_OR_QUOTA'
  | 'EMPTY_RESPONSE'
  | 'STRUCTURED_OUTPUT_PARSE'
  | 'VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'BAD_REQUEST';

export interface GatewayDiagnostics {
  provider?: string;
  model?: string;
  providerAvailable: boolean;
  remoteAttempted: boolean;
  providerHttpOk?: boolean;
  providerHttpStatus?: number;
  remoteSucceeded: boolean;
  structuredOutputParsed?: boolean;
  structuredOutputValid?: boolean;
  reconciliationApplied?: boolean;
  fallbackUsed: boolean;
  failureCategory: FailureCategory;
  coachingMode?: string;
  conversationTurnsIncluded?: number;
}

export interface AIResponseEnvelope {
  version: 1;
  ability: AbilityId;
  understanding: CoachUnderstanding;
  coaching: AICoachingPayload;
  proposedAction?: CoachActionProposal;
  knowledgeGap?: KnowledgeGap;
  fallbackUsed?: boolean;
  diagnostics?: GatewayDiagnostics;
}

// ── Knowledge Projection for Server AI ───────────────────────────────────────

export interface AIKnowledgeProjection {
  relevantPrinciples: Array<{
    id: SDAPrincipleId;
    title: string;
    statement: string;
    prohibitedAssumptions: string[];
  }>;
  relevantTerms: Array<{
    key: SDATermKey;
    displayName: string;
    shortDefinition: string;
  }>;
  semanticRules: string[];
  prohibitedAssumptions: string[];
  knownKnowledgeGaps: Array<{
    pattern: string;
    reason: string;
    status: 'partial' | 'reserved' | 'unknown';
  }>;
}

// ── Raw AI Structured Output Schema (Model Target) ───────────────────────────

export interface RawAIModelOutput {
  intent: CoachIntentType;
  confidence: number;
  entities?: CoachEntities;
  requiresClarification?: boolean;
  clarificationField?: string;
  clarificationReason?: string;
  ambiguities?: Array<{ field: string; reason: string }>;
  actionProposal?: {
    type?: CoachActionType;
    payload?: Record<string, unknown>;
    humanReadableSummary?: string;
    requiresConfirmation?: boolean;
  };
  coachingMode?: SDACoachingMode;
  coachingMessage?: string;
  followUpQuestion?: string;
  proposedActionType?: CoachActionType;
  proposedActionSummary?: string;
  proposedActionPayload?: Record<string, unknown>;
  detectedKnowledgeGap?: {
    topic: string;
    reason: string;
    status: 'partial' | 'reserved' | 'unknown';
  };
}

// ── Server AI Configuration ──────────────────────────────────────────────────

export type SupportedAIProvider = 'openai' | 'gemini' | 'anthropic';

export interface ServerAIConfig {
  provider: SupportedAIProvider;
  apiKey: string;
  model: string;
  endpointUrl?: string;
  maxTokens?: number;
  temperature?: number;
}
