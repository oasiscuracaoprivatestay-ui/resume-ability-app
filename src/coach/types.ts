/**
 * SDA AI Coach — Domain Types & Interfaces (Phase 33)
 *
 * Designed for the Super Ability ecosystem (Diet, Productivity, Time-Management,
 * Organizer, Money, Entrepreneurship).
 *
 * Current active ability: 'diet'
 * Strictly provider-agnostic: no direct dependency on OpenAI, Anthropic, Gemini, etc.
 */

import type { FoodCategoryKey } from '../data/dietData';
import type { SoupPortionKey } from '../data/foodOptions';
import type { DetailedBlockOutcome, DietRecordType } from '../utils/dietVerificationStorage';
import type { CheckInStatus } from '../utils/checkInStorage';

// ── Multi-Ability Extensibility ──────────────────────────────────────────────

export type AbilityId =
  | 'diet'
  | 'productivity'
  | 'time-management'
  | 'organizer'
  | 'money'
  | 'entrepreneurship';

export const ACTIVE_ABILITY_ID: AbilityId = 'diet';

// ── Confidence Constants ──────────────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  CANONICAL_EXACT: 0.95,
  STRONG_DETERMINISTIC: 0.85,
  POSSIBLE_MAPPING: 0.65,
  MINIMUM_FOR_PROPOSAL: 0.80,
} as const;

// ── Message & Conversation Model ─────────────────────────────────────────────

export type CoachRole = 'user' | 'coach';

export interface CoachMessage {
  id: string;
  role: CoachRole;
  text: string;
  createdAt: number; // Unix timestamp ms
  actionProposal?: CoachActionProposal;
  understanding?: CoachUnderstanding;
}

export interface CoachConversation {
  schemaVersion: number;
  ability: AbilityId;
  messages: CoachMessage[];
  updatedAt: number;
}

// ── Coach Intents ─────────────────────────────────────────────────────────────

export type CoachIntentType =
  | 'GENERAL_COACHING'
  | 'CHECK_TODAY_STATUS'
  | 'NEED_MOTIVATION'
  | 'REVIEW_DAY'
  | 'REVIEW_COMMITMENT'
  | 'REVIEW_WHY'
  | 'REVIEW_NON_NEGOTIABLES'
  | 'REVIEW_SLIPPERY_ZONES'
  // Future action-oriented intents (Phase 35+) — contracts defined, no execution in Phase 33
  | 'LOG_FOOD'
  | 'LOG_NEUTRAL'
  | 'LOG_SLIP'
  | 'LOG_RESUME'
  | 'LOG_CHECK_IN'
  | 'UPDATE_FOOD_LOG'
  | 'RECOMMIT';

// ── Personal State Query Categories (Phase 40C) ──────────────────────────────

export type PersonalStateQueryCategory =
  | 'PROGRESS_SUMMARY'
  | 'SCORING_STATUS'
  | 'RESUME_ABILITY_STATUS'
  | 'CHECK_IN_STATUS'
  | 'DIET_STATUS'
  | 'SLIP_RESUME_STATUS'
  | 'CHALLENGE_STATUS'
  | 'NEXT_BEST_FOCUS'
  | 'COMMITMENT_RECALL'
  | 'NON_NEGOTIABLE_RECALL';

export interface CoachIntent {
  type: CoachIntentType;
  confidence: number;
  extractedParams?: Record<string, unknown>;
}

// ── Action Proposal Contract ──────────────────────────────────────────────────

export type CoachActionType =
  | 'LOG_FOOD'
  | 'LOG_NEUTRAL'
  | 'LOG_SLIP'
  | 'LOG_RESUME'
  | 'LOG_CHECK_IN'
  | 'UPDATE_FOOD_LOG'
  | 'RECOMMIT';

export interface CoachActionProposal {
  id: string;
  ability: AbilityId;
  type: CoachActionType;
  confidence: number;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  humanReadableSummary: string;
  createdAt?: number;
  executed?: boolean;
  executedAt?: number;
  executionStatus?: 'pending' | 'executing' | 'executed' | 'already_executed' | 'failed' | 'rejected' | 'expired';
  recordId?: string;
  pointsAwarded?: number;
}

export interface CoachExecutionResult {
  success: boolean;
  actionType: CoachActionType;
  recordId?: string;
  pointsAwarded?: number;
  status: 'executed' | 'already_executed' | 'failed' | 'rejected' | 'expired';
  message: string;
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
  reasons?: string[]; // Preserved locally, stripped remotely unless turn-scoped
}

export interface NormalizedNonNegotiablesSnapshot {
  hasNonNegotiables: boolean;
  nonNegotiablesCount: number;
  nonNegotiables?: string[]; // Preserved locally, stripped remotely unless turn-scoped
}

export interface NormalizedSlipperyZonesSnapshot {
  count: number;
  zones?: string[]; // Preserved locally, stripped remotely
}

export interface TurnScopedSensitiveContext {
  reasons?: string[];
  nonNegotiables?: string[];
}

export interface CoachContextToday {
  dateKey: string;
  todayScore: number;
  checkInCount: number;
  latestCheckInStatus: string | null;
  foodLogsCount: number;
  neutralLogsCount: number;
  totalPortions: number;
  slipsCount: number;
  resumedCount: number;
  topCategories: Array<{ category: string; portions: number; percentage: number }>;
  recentFoods?: Array<{ name: string; portions: number }>;
}

export interface CoachContextCommitment {
  hasCommitment: boolean;
  reasons: string[]; // "My Why"
  nonNegotiables: string[];
  reviewCount: number;
  lastReviewedAt: string | null;
  whyCount?: number;
}

export interface CoachContextSlipperyZones {
  count: number;
  zones: string[];
  lastReviewedAt?: string;
}

export interface CoachContextProgression {
  level: number;
  lifetimeScore: number;
  levelTitle: string;
}

export interface CoachContextStructuredDiet {
  hasPlan: boolean;
  todayPlannedCount: number;
  nextPlannedMealTime?: string;
}

export interface CoachContextChallenge {
  hasActiveChallenge: boolean;
  activeChallenge?: {
    id: string;
    abilityId: string;
    challengeType: string;
    durationDays: number;
    currentDay: number;
    daysRemaining: number;
    startDate: string;
    endDate: string;
    status: 'active' | 'completed' | 'cancelled';
    eligibleSlips: number;
    resumedSlips: number;
    resumeRate: number | null;
  };
}

export interface CoachContext {
  ability: AbilityId;
  dateKey: string;
  scoring: NormalizedScoringSnapshot;
  checkIn: NormalizedCheckInSnapshot;
  diet: NormalizedDietSnapshot;
  dietSlipResume: NormalizedDietSlipResumeSnapshot;
  resumeAbility: NormalizedResumeAbilitySnapshot;
  commitment: CoachContextCommitment & NormalizedCommitmentSnapshot;
  nonNegotiables: NormalizedNonNegotiablesSnapshot;
  slipperyZones: CoachContextSlipperyZones & NormalizedSlipperyZonesSnapshot;
  challenge?: CoachContextChallenge & NormalizedChallengeSnapshot;
  turnScopedSensitive?: TurnScopedSensitiveContext;
  today: CoachContextToday;
  progression: CoachContextProgression;
  structuredDiet: CoachContextStructuredDiet;
}

// ── Structured Understanding Model (Phase 34) ───────────────────────────────

export interface ParsedFoodItem {
  rawText: string;
  foodKey?: string;
  foodLabel?: string;
  categoryKey?: FoodCategoryKey;
  categoryLabel?: string;
  quantity?: {
    amount?: number;
    unit?: string;
    portionCount?: number;
    freeText?: string;
  };
  soupPortion?: SoupPortionKey;
  confidence: number;
}

export interface CoachEntities {
  date?: string; // Local YYYY-MM-DD
  startTime?: string; // 24h "HH:MM"
  endTime?: string; // 24h "HH:MM"
  foodItems?: ParsedFoodItem[];
  recordType?: DietRecordType;
  plannedStatus?: 'planned' | 'unplanned';
  outcome?: DetailedBlockOutcome;
  resumed?: boolean;
  resumeDurationMinutes?: number;
  slipperyZones?: string[];
  note?: string;
  description?: string;
  quantity?: {
    amount?: number;
    unit?: string;
    portionCount?: number;
    freeText?: string;
  };
  checkInStatus?: CheckInStatus;
  queryCategory?: PersonalStateQueryCategory;
}

export interface CoachAmbiguityOption {
  label: string;
  value: string;
  description?: string;
}

export interface CoachAmbiguity {
  field: string;
  reason: string;
  options?: CoachAmbiguityOption[];
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
  queryCategory?: PersonalStateQueryCategory;
}

// ── Provider Contracts ────────────────────────────────────────────────────────

export interface CoachRequest {
  message: string;
  conversationHistory: CoachMessage[];
  context: CoachContext;
  language: 'en' | 'es' | 'nl';
}

export interface CoachResponse {
  message: CoachMessage;
  intent?: CoachIntent;
  understanding?: CoachUnderstanding;
  actionProposal?: CoachActionProposal;
}

export interface CoachProvider {
  readonly id: string;
  readonly name: string;
  sendMessage(request: CoachRequest): Promise<CoachResponse>;
}

export interface UnderstandingRequest {
  text: string;
  language?: 'en' | 'es' | 'nl';
  context?: CoachContext;
}

export interface CoachUnderstandingProvider {
  readonly id: string;
  readonly name: string;
  understand(request: UnderstandingRequest): Promise<CoachUnderstanding>;
}
