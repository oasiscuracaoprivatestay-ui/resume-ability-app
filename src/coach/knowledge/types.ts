/**
 * SDA AI Coach — Authoritative Knowledge Architecture Types & Contracts (Phase 36B)
 *
 * Source-grounded, provider-independent knowledge system covering:
 * - Level 1: The Seven Sergio Laurant Super Diet-Ability Manuscripts
 * - Level 2: Authoritative Application Behavior (Implemented features, scoring, progression)
 * - Level 3: Derived Knowledge (Summaries, terminology index, coaching rules)
 * - General Model Knowledge (For reasoning/language; NOT authoritative SDA methodology)
 */

import type { AbilityId, CoachActionProposal } from '../types';

// ── Source Authority Model ───────────────────────────────────────────────────

export type KnowledgeAuthority =
  | 'level1_manuscript'     // Authoritative Sergio Laurant SDA Manuscripts
  | 'level2_app_behavior'   // Authoritative Implemented Application Logic
  | 'level3_derived'        // Derived summaries, rules, and coaching indexes
  | 'general_model';        // General model knowledge (language only, not SDA rules)

/**
 * Phase 36B.1 Strict Source Authority Taxonomy
 */
export type SourceAuthority =
  | 'MANUSCRIPT_EXPLICIT'   // Directly and clearly stated by Sergio Laurant in a manuscript
  | 'MANUSCRIPT_DERIVED'    // A faithful synthesis of multiple manuscript passages without new rules
  | 'APP_EXPLICIT'          // Derived from actual implemented application behavior
  | 'SYSTEM_SAFETY'         // Necessary product/medical safety guardrail (may be stricter than text)
  | 'RESERVED';             // Future functionality or concept not currently active

export type AppRelationshipType =
  | 'DIRECT_IMPLEMENTATION' // Directly implements the manuscript concept
  | 'SUPPORTING_TOOL'       // Acts as a supportive tool for the concept
  | 'RELATED_CONTEXT'       // Contextually related but not a direct tool
  | 'FUTURE_OPPORTUNITY';   // Potential future feature; MUST NOT be claimed as current

export type SafetyClassification =
  | 'standard'              // Normal behavioral coaching
  | 'safety_boundary'       // Safety protocol, health boundary, or medical boundary
  | 'contraindicated';      // Absolute contraindication (e.g. extended fasting with ED/pregnancy)

export type AppFeatureStatus =
  | 'APP_CURRENT'           // Implemented, working in the current application
  | 'APP_PLANNED'           // Planned for future phases (must NOT be told as currently existing)
  | 'APP_RESERVED';         // Reserved for future multi-ability ecosystem (productivity, money, etc.)

// ── Canonical Seven Diet-Abilities ───────────────────────────────────────────

export type CanonicalDietAbilityId =
  | 'resume_ability'            // Book 1: Resume-Ability
  | 'loss_maintenance_ability'  // Book 2: Loss-Maintenance Ability
  | 'appetite_fix_ability'      // Book 3: Appetite-Fix Ability
  | 'insulin_aware_ability'     // Book 4: Insulin-Aware Ability
  | 'keto_switching_ability'    // Book 5: Keto-Switching Ability
  | 'circadian_eating_ability'  // Book 6: Circadian Eating Ability
  | 'micro_fasting_ability';    // Book 7: Micro-Fasting Ability

export interface CanonicalAbilityDefinition {
  id: CanonicalDietAbilityId;
  bookNumber: number;
  officialTitle: string;
  subtitle: string;
  author: 'Sergio Laurant';
  domain: AbilityId;            // 'diet'
  coreDefinition: string;
  centralParadigmShift: string;
  keyTechniques: string[];
  keyNonNegotiables: string[];
  relationshipsWithOtherAbilities: Record<string, string>;
  sourceBookFile: string;
}

// ── Granular Knowledge Unit ──────────────────────────────────────────────────

export interface SDAKnowledgeUnit {
  id: string;
  abilityId: CanonicalDietAbilityId | 'sda_general' | 'safety' | 'app';
  bookNumber?: number;           // 1 to 7
  bookTitle?: string;
  part?: string;
  chapter?: number;
  chapterTitle?: string;
  section?: string;
  topicTags: string[];
  concepts: string[];
  terminology: string[];
  content: string;
  coachingApplication: string;
  prohibitedAssumptions?: string[];
  sourceRef: string;
  authority: KnowledgeAuthority;
  sourceAuthority?: SourceAuthority; // Phase 36B.1: MANUSCRIPT_EXPLICIT | MANUSCRIPT_DERIVED | etc.
  safetyClassification: SafetyClassification;
  relatedAbilities: CanonicalDietAbilityId[];
  relatedAppFeatures: string[];
}

// ── App Knowledge Unit ───────────────────────────────────────────────────────

export interface AppKnowledgeUnit {
  id: string;
  featureKey: string;
  name: string;
  status: AppFeatureStatus;
  sourceAuthority?: SourceAuthority; // Phase 36B.1: APP_EXPLICIT | RESERVED
  screen?: string;
  description: string;
  userActions: string[];
  scoringEvent?: string;
  pointsAwarded?: number;
  dailyCap?: number;
  persistence: string;
  relatedDietAbilities: CanonicalDietAbilityId[];
  coachingGuidance: string;
}

// ── Terminology Registry ─────────────────────────────────────────────────────

export type KnowledgeStatus =
  | 'defined'   // Fully defined and source-supported in the current app/manuscripts
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

export type SDATermKey =
  | 'super_diet_ability'
  | 'sda'
  | 'resume_ability'
  | 'loss_maintenance_ability'
  | 'appetite_fix_ability'
  | 'insulin_aware_ability'
  | 'keto_switching_ability'
  | 'circadian_eating_ability'
  | 'micro_fasting_ability'
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
  | 'restarting_vs_resuming'
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
  | 'fifteen_minute_resume_method'
  | 'craving_block'
  | 'stop_rules'
  | 'incoming_vs_stored_energy'
  | 'metabolic_flexibility'
  | 'appetite_thermostat'
  | 'satiety_toolbox'
  | 'fat_loss_duet'
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
  authority?: KnowledgeAuthority;
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

// ── Coaching Plan Contract ──────────────────────────────────────────────────

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

// ── Knowledge Base Contracts ─────────────────────────────────────────────────

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

// ── Safety Boundaries ────────────────────────────────────────────────────────

export interface SafetyProtocol {
  id: string;
  title: string;
  condition: string;
  prohibitedActions: string[];
  mandatoryEscalation: string;
  emergencySymptoms: string[];
  sourceRef: string;
  sourceAuthority?: SourceAuthority; // Phase 36B.1: MANUSCRIPT_EXPLICIT vs SYSTEM_SAFETY
  sourceBook?: string;
  sourceChapter?: string;
  sourceReference?: string;
  safetyType?: 'medical_red_flag' | 'contraindication' | 'product_guardrail' | 'disclaimer';
}

export interface ManuscriptAppMapping {
  manuscriptConcept: string;
  sourceBook: number;
  sourceChapter: number;
  appFeature: string;
  relationshipType: AppRelationshipType; // DIRECT_IMPLEMENTATION | SUPPORTING_TOOL | RELATED_CONTEXT | FUTURE_OPPORTUNITY
  description: string;
}

// ── Retrieval Query & Results ────────────────────────────────────────────────

export interface RetrievalQuery {
  rawText?: string;
  abilityId?: CanonicalDietAbilityId;
  intent?: string;
  concepts?: string[];
  topicTags?: string[];
  appFeature?: string;
  includeSafety?: boolean;
  limit?: number;
}

export interface RetrievalResult {
  units: SDAKnowledgeUnit[];
  matchedAbilities: CanonicalDietAbilityId[];
  matchedTerms: SDATerm[];
  safetyBoundaries: SafetyProtocol[];
  appFeatures: AppKnowledgeUnit[];
  isKnowledgeGap: boolean;
  gapReason?: string;
}

// ── Reconciliation Status ────────────────────────────────────────────────────

export type ReconciliationStatus =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'APP_SPECIFIC'
  | 'RESERVED'
  | 'UNKNOWN';

export interface ConceptReconciliation {
  conceptKey: string;
  conceptName: string;
  phase35Status: string;
  manuscriptEvidence: string;
  status: ReconciliationStatus;
  recommendedResolution: string;
}
