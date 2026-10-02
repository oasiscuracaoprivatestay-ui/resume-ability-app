/**
 * SDA AI Coach — Knowledge Layer Types & Contracts (Phase 35)
 *
 * Provider-independent knowledge architecture for Super Diet-Ability.
 * Enforces methodology boundaries, terminology precision, source references,
 * and explicit separation between facts, observations, and prohibited assumptions.
 */

import type { AbilityId, CoachActionProposal } from '../types';

// ── Knowledge Status & Source Reference ──────────────────────────────────────

export type KnowledgeStatus =
  | 'defined'   // Fully defined and source-supported in the current app
  | 'partial'   // Named or partially referenced in source; full doctrine not present
  | 'reserved'; // Future ability or uncodified external concept

export type KnowledgeSourceType =
  | 'app_data'         // Sourced from src/data (e.g. coaching.ts, branding.ts, foodOptions.ts)
  | 'app_terminology'  // Sourced from Phase 9 terminology screen / i18n
  | 'app_coaching'     // Sourced from coaching sections and behavioral models
  | 'app_engine'       // Sourced from scoringEngine / progressionEngine / dietVerificationStorage
  | 'external_future'; // Reserved for future official books, scripts, or RAG ingestion

export interface KnowledgeSourceReference {
  id: string;
  type: KnowledgeSourceType;
  title: string;
  location?: string;
  authority: 'authoritative' | 'provisional';
}

// ── Terminology Registry ─────────────────────────────────────────────────────

export type SDATermKey =
  | 'super_diet_ability'
  | 'sda'
  | 'resume_ability'
  | 'appetite_ability'
  | 'delay_ability'
  | 'structured_diet'
  | 'structure'
  | 'on_track'
  | 'adjusted_on_track'
  | 'near_slip'
  | 'structured_slip'
  | 'unstructured_slip'
  | 'planned_unstructured'
  | 'twenty_percent_off_track'
  | 'resume'
  | 'commitment'
  | 'why'
  | 'non_negotiables'
  | 'slippery_zones'
  | 'daily_check_in'
  | 'daily_review'
  | 'neutral_log'
  | 'food_log'
  | 'planned'
  | 'unplanned'
  | 'micro_fasting'
  | 'urge_timer'
  | 'score'
  | 'lifetime_score'
  | 'progression_level';

export interface SDATerm {
  key: SDATermKey;
  displayName: string;
  shortDefinition: string;
  fullExplanation?: string;
  relatedTerms: SDATermKey[];
  status: KnowledgeStatus;
  sourceRef: string;
}

// ── Core Methodology Principles ──────────────────────────────────────────────

export type SDAPrincipleId =
  | 'awareness_over_perfection'
  | 'structure_is_observable'
  | 'positive_reporting_no_punishment'
  | 'slip_is_information_not_ruin'
  | 'resume_is_independent_behavior'
  | 'resume_speed_is_true_power'
  | 'planned_differs_from_structured'
  | 'near_slip_is_not_slip'
  | 'twenty_percent_off_track_buffer'
  | 'commitment_and_why_anchors'
  | 'non_negotiables_are_personal_shields'
  | 'slippery_zones_are_triggers_not_causes'
  | 'neutral_log_is_non_evaluative'
  | 'pause_between_urge_and_action'
  | 'confirmation_first_data_safety';

export interface SDAPrinciple {
  id: SDAPrincipleId;
  title: string;
  statement: string;
  practicalApplication: string;
  prohibitedAssumptions: string[];
  status: KnowledgeStatus;
  sourceRef: string;
}

// ── Coaching Modes & Behavioral Taxonomy ────────────────────────────────────

export type SDACoachingMode =
  | 'AWARENESS'
  | 'SUPPORT'
  | 'RECOVERY'
  | 'REFLECTION'
  | 'COMMITMENT'
  | 'MOTIVATION'
  | 'INFORMATION'
  | 'ACTION_PREPARATION';

// ── Knowledge Gap Contract ───────────────────────────────────────────────────

export interface KnowledgeGap {
  requestedTopic: string;
  status: 'partial' | 'reserved' | 'unknown';
  reason: string;
  fallbackMessage: string;
}

// ── Coaching Plan Contract (Pre-Response Pipeline) ──────────────────────────

export interface SDACoachingPlan {
  mode: SDACoachingMode;
  primaryGoal: string;
  relevantPrinciples: SDAPrincipleId[];
  relevantTerms: SDATermKey[];
  contextFacts: string[];
  coachObservations: string[];
  questions: string[];
  shouldAskQuestion: boolean;
  suggestedQuestion?: string;
  shouldOfferAction: boolean;
  actionProposal?: CoachActionProposal;
  prohibitedAssumptions: string[];
  knowledgeGap?: KnowledgeGap;
  responseTemplate?: string;
}

// ── Knowledge Base Contract ──────────────────────────────────────────────────

export interface SDAKnowledgeTopic {
  id: string;
  ability: AbilityId;
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  relatedTopicIds: string[];
  sourceIds: string[];
  status: KnowledgeStatus;
}

export interface SDAKnowledgeBase {
  readonly ability: AbilityId;
  getTerm(key: SDATermKey): SDATerm | undefined;
  findTerm(query: string): SDATerm | undefined;
  getAllTerms(): SDATerm[];
  getPrinciple(id: SDAPrincipleId): SDAPrinciple | undefined;
  getAllPrinciples(): SDAPrinciple[];
  getTopic(id: string): SDAKnowledgeTopic | undefined;
  getAllTopics(): SDAKnowledgeTopic[];
  checkKnowledgeGap(query: string): KnowledgeGap | null;
}
