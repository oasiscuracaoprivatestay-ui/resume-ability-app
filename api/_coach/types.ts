/**
 * SDA AI Coach — Server-Side Wire Types & Canonical Models (Phase 36A Hotfix)
 *
 * Fully self-contained inside api/_coach/ to ensure 100% reliable
 * packaging and execution in Vercel's Node Serverless Function runtime.
 * Zero imports from src/ to eliminate ERR_MODULE_NOT_FOUND.
 */

// ── Canonical Domain Vocabulary ───────────────────────────────────────────────

export type AbilityId = 'diet' | 'habits' | 'sleep' | 'movement';

export type CoachIntentType =
  | 'LOG_FOOD'
  | 'LOG_NEUTRAL'
  | 'LOG_SLIP'
  | 'LOG_RESUME'
  | 'LOG_CHECK_IN'
  | 'UPDATE_FOOD_LOG'
  | 'RECOMMIT'
  | 'CHECK_TODAY_STATUS'
  | 'NEED_MOTIVATION'
  | 'REVIEW_DAY'
  | 'REVIEW_COMMITMENT'
  | 'REVIEW_WHY'
  | 'REVIEW_NON_NEGOTIABLES'
  | 'REVIEW_SLIPPERY_ZONES'
  | 'GENERAL_COACHING';

export type CoachActionType =
  | 'LOG_FOOD'
  | 'LOG_NEUTRAL'
  | 'LOG_SLIP'
  | 'LOG_RESUME'
  | 'LOG_CHECK_IN'
  | 'UPDATE_FOOD_LOG'
  | 'RECOMMIT';

export const CANONICAL_ACTION_TYPES: readonly CoachActionType[] = [
  'LOG_FOOD',
  'LOG_NEUTRAL',
  'LOG_SLIP',
  'LOG_RESUME',
  'LOG_CHECK_IN',
  'UPDATE_FOOD_LOG',
  'RECOMMIT',
] as const;

export type DetailedBlockOutcome =
  | 'on_track'
  | 'adjusted_on_track'
  | 'planned_unstructured'
  | 'twenty_percent_off_track'
  | 'near_slip'
  | 'structured_slip'
  | 'unstructured_slip';

export const ALL_DETAILED_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
  'twenty_percent_off_track',
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

export type FoodCategoryKey =
  | 'protein'
  | 'simple_carbs'
  | 'complex_carbs'
  | 'healthy_fats'
  | 'vegetables'
  | 'fruits'
  | 'desserts'
  | 'snacks'
  | 'beverages'
  | 'soups';

export const FOOD_CATEGORY_KEYS: readonly FoodCategoryKey[] = [
  'protein',
  'simple_carbs',
  'complex_carbs',
  'healthy_fats',
  'vegetables',
  'fruits',
  'desserts',
  'snacks',
  'beverages',
  'soups',
] as const;

export type CheckInStatus = 'on-structure' | 'near-slip' | 'slip';

export const CANONICAL_CHECKIN_STATUSES: readonly CheckInStatus[] = [
  'on-structure',
  'near-slip',
  'slip',
] as const;

export type SDACoachingMode =
  | 'AWARENESS'
  | 'SUPPORT'
  | 'RECOVERY'
  | 'REFLECTION'
  | 'COMMITMENT'
  | 'MOTIVATION'
  | 'INFORMATION'
  | 'ACTION_PREPARATION';

// ── Bounded Request Constants ─────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 1500;
export const MAX_CONVERSATION_HISTORY = 10;
export const GATEWAY_TIMEOUT_MS = 10000;

// ── Context & Entity Models ───────────────────────────────────────────────────

export interface CoachEntityFoodItem {
  rawText: string;
  foodKey?: string;
  categoryKey?: FoodCategoryKey;
  quantity?: {
    amount?: number;
    unit?: string;
    portionCount?: number;
  };
  confidence?: number;
}

export interface CoachEntities {
  foodItems?: CoachEntityFoodItem[];
  recordType?: 'food' | 'neutral';
  plannedStatus?: 'planned' | 'unplanned';
  outcome?: DetailedBlockOutcome;
  resumed?: boolean;
  resumeDurationMinutes?: number;
  startTime?: string;
  checkInStatus?: CheckInStatus;
  targetDate?: string;
}

export interface CoachAmbiguity {
  field: string;
  reason: string;
}

export interface CoachActionProposal {
  id: string;
  ability: AbilityId;
  type: CoachActionType;
  confidence: number;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  humanReadableSummary: string;
}

export interface CoachUnderstanding {
  id: string;
  ability: AbilityId;
  rawText: string;
  intent: CoachIntentType;
  confidence: number;
  entities: CoachEntities;
  ambiguities: CoachAmbiguity[];
  requiresClarification: boolean;
  proposedAction?: CoachActionProposal;
}

// ── Read-Only Normalized Coach Context (Privacy Minimized — Phase 40B) ───────────

export interface NormalizedScoringSnapshot {
  todayPoints: number;
  lifetimePoints: number;
  level: number;
  levelTitle: string;
}

export interface NormalizedCheckInSnapshot {
  hasCheckedInToday: boolean;
  checkInCountToday: number;
  latestCheckInStatus: 'on-structure' | 'near-slip' | 'slip' | null;
}

export interface NormalizedDietSnapshot {
  hasStructuredDiet: boolean;
  plannedBlocksCount: number;
  dietEntriesLoggedToday: number;
  onTrackCountToday: number;
  twentyPercentCountToday: number;
  neutralCountToday: number;
  totalPortions: number;
  topCategories: Array<{ category: string; portions: number; percentage: number }>;
}

export interface NormalizedDietSlipResumeSnapshot {
  dietSlipsToday: number;
  dietResumesToday: number;
  hasUnresolvedDietSlip: boolean;
  unresolvedDietSlipCount: number;
  dietResumeRate: number | null;
}

export interface NormalizedResumeAbilitySnapshot {
  dailyResumeAbilityIndex: number;
}

export interface NormalizedChallengeSnapshot {
  hasActiveChallenge: boolean;
  activeChallenge?: {
    abilityId: string;
    durationDays: number;
    currentDay: number;
    daysRemaining: number;
    eligibleSlips: number;
    resumedSlips: number;
    resumeRate: number | null;
  };
}

export interface NormalizedCommitmentSnapshot {
  hasCommitment: boolean;
  whyCount: number;
  reasons?: string[];
}

export interface NormalizedNonNegotiablesSnapshot {
  hasNonNegotiables: boolean;
  nonNegotiablesCount: number;
  nonNegotiables?: string[];
}

export interface NormalizedSlipperyZonesSnapshot {
  count: number;
  zones?: string[];
}

export interface TurnScopedSensitiveContext {
  reasons?: string[];
  nonNegotiables?: string[];
}

export interface CoachContext {
  ability: AbilityId;
  language?: 'en' | 'es' | 'nl';
  dateKey?: string;
  scoring?: NormalizedScoringSnapshot;
  checkIn?: NormalizedCheckInSnapshot;
  diet?: NormalizedDietSnapshot;
  dietSlipResume?: NormalizedDietSlipResumeSnapshot;
  resumeAbility?: NormalizedResumeAbilitySnapshot;
  nonNegotiables?: NormalizedNonNegotiablesSnapshot;
  turnScopedSensitive?: TurnScopedSensitiveContext;
  today: {
    todayScore: number;
    foodLogsCount: number;
    totalPortions: number;
    checkInCount: number;
    slipsCount: number;
    resumedCount: number;
    latestCheckInStatus?: string | null;
    topCategories?: Array<{ category: string; portions: number; percentage: number }>;
    recentFoods?: Array<{ name: string; portions: number }>;
    latestBlock?: {
      startTime: string;
      endTime: string;
      mealType?: string;
      status?: string;
    };
  };
  commitment: {
    hasCommitment: boolean;
    whyCount?: number;
    reasons: string[];
    nonNegotiables: string[];
  };
  slipperyZones: {
    count?: number;
    zones: string[];
  };
  progression: {
    level: number;
    levelTitle: string;
    xp?: number;
    lifetimeScore?: number;
  };
  structuredDiet?: {
    hasPlan: boolean;
    todayPlannedCount: number;
    nextPlannedMealTime?: string;
  };
  challenge?: {
    hasActiveChallenge: boolean;
    activeChallenge?: {
      id?: string;
      abilityId: string;
      challengeType: string;
      durationDays: number;
      currentDay: number;
      daysRemaining: number;
      startDate?: string;
      endDate?: string;
      status: 'active' | 'completed' | 'cancelled';
      eligibleSlips: number;
      resumedSlips: number;
      resumeRate: number | null;
    };
  };
}

export interface SDAGroundingPack {
  identity: {
    name: string;
    role: string;
    prohibitedRoles: string[];
    communicationStyle: string;
  };
  coachingMode: SDACoachingMode;
  primaryGoal: string;
  relevantPrinciples: Array<{
    id: string;
    title: string;
    statement: string;
    prohibitedAssumptions: string[];
  }>;
  relevantTerms: Array<{
    key: string;
    displayName: string;
    shortDefinition: string;
  }>;
  semanticBoundaries: string[];
  contextFacts: string[];
  coachObservations: string[];
  prohibitedAssumptions: string[];
  cadenceGuide: string;
  scenarioGuidance?: string;
  knowledgeGap?: KnowledgeGap | null;
  mutationPolicy: 'preview_only';
  responseModality?: 'text' | 'voice' | 'text_and_voice';
  groundedKnowledgeUnits?: SDAGroundedKnowledgeTrace[];
  groundedKnowledgeIds?: string[];
  activeConflicts?: Array<{
    conflictId: string;
    domain: string;
    governingAuthority: string;
    doctrinalMeaning: string;
    appProductBehavior: string;
    resolutionPolicy: string;
  }>;
}

export type SDAKnowledgeSourceType =
  | 'sergio-manuscript'
  | 'sergio-direct-instruction'
  | 'app-operational'
  | 'developer-normalization';

export type SDAAuthorityLevel =
  | 'primary-doctrine'
  | 'product-directive'
  | 'operational-schema'
  | 'developer-normalization';

export interface SDAGroundedKnowledgeTrace {
  id: string;
  sourceType: SDAKnowledgeSourceType;
  bookNumber?: number;
  chapter?: number;
  chapterTitle?: string;
  abilityId: string;
  topic?: string;
  concepts?: string[];
  summarySnippet?: string;
  authorityLevel?: SDAAuthorityLevel;
}

// ── Client → Server Wire Protocol ─────────────────────────────────────────────

export interface SerializedChatMessage {
  role: 'user' | 'coach';
  text: string;
}

export interface CoachGatewayRequestDTO {
  message: string;
  language: 'en' | 'es' | 'nl';
  context: CoachContext;
  conversationHistory: SerializedChatMessage[];
  responseModality?: 'text' | 'voice' | 'text_and_voice';
}

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

export interface KnowledgeGap {
  requestedTopic: string;
  reason: string;
  status: 'partial' | 'reserved' | 'unknown';
  fallbackMessage: string;
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
  groundingTrace?: {
    groundedKnowledgeIds: string[];
    sourceTypes: SDAKnowledgeSourceType[];
    books: number[];
    chapters: number[];
    abilities: string[];
    topics: string[];
  };
}

// ── Model IO & Config ─────────────────────────────────────────────────────────

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

export type SupportedAIProvider = 'openai' | 'gemini' | 'anthropic';

export interface ServerAIConfig {
  provider: SupportedAIProvider;
  apiKey: string;
  model: string;
  endpointUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIKnowledgeProjection {
  relevantPrinciples: Array<{
    id: string;
    title: string;
    statement: string;
    prohibitedAssumptions: string[];
  }>;
  relevantTerms: Array<{
    key: string;
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
