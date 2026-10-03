/**
 * SDA Knowledge Provenance & Authority Registry (Phase 38)
 *
 * Establishes a rigorous four-category knowledge provenance taxonomy, authority hierarchy,
 * conflict-resolution policies, and medical safety boundaries across the Super Diet-Ability
 * codebase and AI Coach runtime.
 *
 * PROVENANCE CATEGORIES:
 * - Category A: Authoritative Sergio Laurant SDA Doctrine ('sergio-manuscript')
 *   The 7 canonical manuscript books (176 chapters). Primary authority for all doctrine,
 *   philosophy, terminology, ability definitions, and principles.
 *
 * - Category B: Authoritative Sergio Laurant Direct App Directives ('sergio-direct-instruction')
 *   Explicit instructions from Sergio Laurant regarding app mechanics, scoring rules (+15, +5, etc.),
 *   neutral logging, 20% OFF TRACK as an On-Track outcome, challenge durations, and daily check-ins.
 *
 * - Category C: App Operational Architecture ('app-operational')
 *   Client-side architecture, local storage schemas, event counts, progress math, countdown timers,
 *   history archiving, and UI components.
 *
 * - Category D: Inferred / Derived / Developer Normalization ('developer-normalization')
 *   Derived indexes, prompt aggregations, legacy aliases (appetite_ability, delay_ability),
 *   formatting utilities. Lowest authority; can never override Categories A, B, or C.
 */

import type {
  CanonicalDietAbilityId,
  SDAKnowledgeSourceType,
  SDAAuthorityLevel,
  HealthSafetyCategory,
  KnowledgeConflictOverride,
} from '../types';

export interface ProvenanceEntry {
  id: string;
  name: string;
  sourceType: SDAKnowledgeSourceType;
  authorityLevel: SDAAuthorityLevel;
  sourceDocument?: string;
  sourceChapter?: string | number;
  healthSafetyCategory: HealthSafetyCategory;
  safetyNotes?: string;
  notes: string;
}

/**
 * Authority Hierarchy Policies
 */
export const SDA_AUTHORITY_POLICIES = {
  doctrineAndPhilosophy: {
    primaryAuthority: 'sergio-manuscript',
    rule: 'Manuscripts (Category A) strictly govern all doctrine, recovery philosophy, ability definitions, and terms. App features cannot alter doctrine.',
  },
  appUXAndScoring: {
    primaryAuthority: 'sergio-direct-instruction',
    rule: 'Sergio\'s direct instructions (Category B) strictly govern in-app scoring, daily check-in workflows, neutral logs, and challenge parameters.',
  },
  technicalArchitecture: {
    primaryAuthority: 'app-operational',
    rule: 'Client-side local storage, event counting, offline resilience, and UI component structures (Category C) govern runtime mechanics.',
  },
  developerNormalization: {
    primaryAuthority: 'developer-normalization',
    rule: 'Derived indexes and aliases (Category D) exist solely for runtime convenience and backward compatibility. They yield immediately to A, B, and C.',
  },
} as const;

/**
 * Health & Medical Safety Invariants
 */
export const HEALTH_SAFETY_INVARIANTS = {
  nonMedicalDisclaimer:
    'The SDA Coach and Resume-Ability App provide behavioral coaching and educational guidance, not medical diagnosis or treatment.',
  targetVetoAuthority:
    'An app can say NO to a target; an app can NEVER medically clear a user.',
  stopRules: [
    'Pregnancy or nursing: extended fasting is strictly contraindicated.',
    'History of eating disorders: strict fasting protocols require professional clinical supervision.',
    'Type 1 diabetes or insulin-dependent diabetes: any fasting or carbohydrate restriction requires physician supervision.',
    'Dizziness, fainting, persistent nausea, extreme lightheadedness, or heart palpitations: immediately break the fast with balanced nutrients and seek medical evaluation.',
  ],
} as const;

/**
 * Registry of Canonical Seven Diet-Abilities Provenance (Phase 38B DOCX-Verified)
 */
export const CANONICAL_ABILITIES_PROVENANCE: Record<CanonicalDietAbilityId, ProvenanceEntry> = {
  resume_ability: {
    id: 'resume_ability',
    name: 'Resume-Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_01_Resume-Ability.docx',
    sourceChapter: 'Chapters 1-25 (25 chapters + 1 Intro + 3 Conclusions)',
    healthSafetyCategory: 'behavioral',
    notes: 'Primary foundational doctrine. Active challenge feature in-app.',
  },
  loss_maintenance_ability: {
    id: 'loss_maintenance_ability',
    name: 'Loss-Maintenance Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_02_Loss-Maintenance-Ability.docx',
    sourceChapter: 'Chapters 1-17 across 4 Parts (17 chapters + 1 Conclusion)',
    healthSafetyCategory: 'behavioral',
    notes: 'Umbrella ability. Maintenance comes before fat loss. In-app challenge locked as future.',
  },
  appetite_fix_ability: {
    id: 'appetite_fix_ability',
    name: 'Appetite-Fix Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_03_Appetite-Fix-Ability.docx',
    sourceChapter: 'Chapters 1-14 across 4 Parts (14 chapters + 3 Conclusions)',
    healthSafetyCategory: 'metabolic_concept',
    notes: 'Fix meal satiety before fighting gaps. In-app challenge locked as future.',
  },
  insulin_aware_ability: {
    id: 'insulin_aware_ability',
    name: 'Insulin-Aware Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_04_Insulin-Aware-Ability.docx',
    sourceChapter: 'Chapters 1-18 across 5 Parts (18 chapters)',
    healthSafetyCategory: 'metabolic_concept',
    notes: 'Metabolic signaling and pauses between meals. In-app challenge locked as future.',
  },
  keto_switching_ability: {
    id: 'keto_switching_ability',
    name: 'Keto-Switching Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_05_Keto-Switching-Ability.docx',
    sourceChapter: 'Chapters 1-25 across 6 Parts (25 chapters + 1 Conclusion)',
    healthSafetyCategory: 'metabolic_concept',
    notes: 'Transitioning from incoming fuel to stored energy. In-app challenge locked as future.',
  },
  circadian_eating_ability: {
    id: 'circadian_eating_ability',
    name: 'Circadian Eating Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_06_Circadian-Eating-Ability.docx',
    sourceChapter: 'Chapters 1-30 across 7 Parts (30 chapters + 1 Conclusion)',
    healthSafetyCategory: 'metabolic_concept',
    notes: 'Aligning meals with circadian daylight rhythms. In-app challenge locked as future.',
  },
  micro_fasting_ability: {
    id: 'micro_fasting_ability',
    name: 'Micro-Fasting Ability',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_07_Micro-Fasting-Ability.docx',
    sourceChapter: 'Chapters 1-47 across 9 Parts (47 chapters + 1 Intro + 2 Conclusions)',
    healthSafetyCategory: 'safety_critical',
    safetyNotes: 'Subject to strict biological readiness and red flag stop rules.',
    notes: 'Manageable 15-minute blocks. In-app challenge locked as future.',
  },
};

/**
 * App Features & Direct Instructions Provenance
 */
export const APP_FEATURES_PROVENANCE: Record<string, ProvenanceEntry> = {
  resume_ability_challenge: {
    id: 'resume_ability_challenge',
    name: 'Resume-Ability Challenge (1, 3, 7, 30, 90 days)',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
    healthSafetyCategory: 'behavioral',
    notes: 'Requested directly by Sergio as an interactive recovery practice module.',
  },
  daily_check_in: {
    id: 'daily_check_in',
    name: 'Daily Check-In & Streak System',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
    healthSafetyCategory: 'behavioral',
    notes: 'Direct product instruction. +15 pts On Track, +15 pts Slip + Resumed, +5 pts Slip Not Yet Resumed.',
  },
  neutral_log: {
    id: 'neutral_log',
    name: 'Neutral Log',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
    healthSafetyCategory: 'behavioral',
    notes: 'Direct product instruction: 0 pts, non-evaluative recording without food evaluation.',
  },
  twenty_percent_off_track: {
    id: 'twenty_percent_off_track',
    name: '20% OFF TRACK (Intentional Flexibility)',
    sourceType: 'sergio-direct-instruction',
    authorityLevel: 'product-directive',
    sourceDocument: 'SDA_Book_01_Resume-Ability.docx / SDA_Book_02_Loss-Maintenance-Ability.docx',
    sourceChapter: 'Book 1 Ch 13 / Book 2 Ch 4',
    healthSafetyCategory: 'behavioral',
    notes: 'Operationalizes Sergio\'s 80/20 balance. Counts as On-Track outcome (+5 pts), strictly not a slip. Never carbs.',
  },
  urge_timer_15m: {
    id: 'urge_timer_15m',
    name: '15-Minute Urge Timer',
    sourceType: 'sergio-manuscript',
    authorityLevel: 'primary-doctrine',
    sourceDocument: 'SDA_Book_01_Resume-Ability.docx',
    sourceChapter: 'Chapter 11',
    healthSafetyCategory: 'behavioral',
    notes: 'Direct implementation of The 15-Minute Resume Method.',
  },
};

/**
 * Phase 38B Explicit Knowledge Conflict & Override Registry
 */
export const KNOWLEDGE_CONFLICT_OVERRIDES: KnowledgeConflictOverride[] = [
  {
    conflictId: 'conflict_80_20_vs_20_percent_off_track',
    domain: 'app_product_behavior',
    governingAuthority: 'sergio-direct-instruction',
    governingSource: 'Sergio Laurant Direct Product Instruction (Food Log Outcome Flow)',
    underlyingDoctrinalSource: 'SDA_Book_01_Resume-Ability.docx Ch 13 & SDA_Book_02_Loss-Maintenance-Ability.docx Ch 4',
    conceptName: '80/20 Consistency Principle vs 20% OFF TRACK Log Outcome',
    doctrinalMeaning: '80/20 represents lifestyle consistency: ~80% following your structured diet, ~20% allowing room for real-life flexibility (social occasions, restaurants, travel). It is NEVER a macronutrient ratio or instruction to eat 20% healthy carbs.',
    appProductBehavior: 'The app food log contains a discrete button/outcome "20% OFF TRACK" which awards +5 points as an On-Track outcome, strictly not a slip.',
    resolutionPolicy: 'Manuscript governs doctrinal definition and coaching explanation (lifestyle flexibility, zero carbs). Sergio product instruction governs in-app scoring (+5 pts) and logging flow. Coach must explain the concept without conflating it with carbs or calling it a slip.',
    effectiveFor: 'Food log meal outcomes, scoring calculations, AI coaching advice',
    conflictStatus: 'harmonized_derivation',
  },
  {
    conflictId: 'conflict_resume_ability_challenge_durations',
    domain: 'app_product_behavior',
    governingAuthority: 'sergio-direct-instruction',
    governingSource: 'Sergio Laurant Direct Product Instruction (Challenge System)',
    underlyingDoctrinalSource: 'SDA_Book_01_Resume-Ability.docx Ch 10 (The Five Levels of Resume-Ability)',
    conceptName: 'Resume-Ability Lifelong Habit vs App Challenge Durations',
    doctrinalMeaning: 'Book 1 establishes Resume-Ability as a permanent, evergreen behavioral skill practiced over 5 progressive levels of maturity without fixed day counts.',
    appProductBehavior: 'The app implements interactive practice challenges with durations of 1, 3, 7, 30, and 90 days.',
    resolutionPolicy: 'Manuscript doctrine defines what Resume-Ability is. Sergio\'s product directive defines how users practice it in the app. The challenge durations are bounded training intervals for an evergreen skill.',
    effectiveFor: 'Challenge selection, streak tracking, completion criteria',
    conflictStatus: 'resolved_operational_override',
  },
  {
    conflictId: 'conflict_slip_types_manuscript_vs_operational',
    domain: 'doctrine_and_concepts',
    governingAuthority: 'sergio-manuscript',
    governingSource: 'SDA_Book_01_Resume-Ability.docx Ch 5 (The Five Types of Slips)',
    underlyingDoctrinalSource: 'SDA_Book_01_Resume-Ability.docx Ch 5',
    conceptName: 'Five Behavioral Slip Types vs Operational Slip State',
    doctrinalMeaning: 'Book 1 establishes 5 distinct behavioral slip types: Timing Slip, Impulse Eating Slip, Hunger Misinterpretation Slip, Portion Slip, Structure Slip.',
    appProductBehavior: 'App operational storage classifies slips binary-relative to meal schedule blocks: structured_slip (inside planned block) vs unstructured_slip (outside planned blocks).',
    resolutionPolicy: 'Manuscript governs conversational coaching, self-diagnosis, and root-cause reflection. Operational storage classifications govern internal database and scoring records.',
    effectiveFor: 'Coach reflection, slip reporting dialogue, database records',
    conflictStatus: 'harmonized_derivation',
  },
];

