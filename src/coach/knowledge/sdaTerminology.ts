/**
 * SDA AI Coach — Centralized Terminology Registry (Phase 35)
 *
 * Source-grounded definitions for all canonical SDA concepts.
 * Each entry includes its authoritative status, short definition,
 * source reference, and semantic relationships.
 */

import type { SDATerm, SDATermKey } from './types';

export const SDA_TERMINOLOGY: Record<SDATermKey, SDATerm> = {
  super_diet_ability: {
    key: 'super_diet_ability',
    displayName: 'Super Diet-Ability',
    shortDefinition: 'The core system of building deep behavioral capacity around food through awareness, structure, and resume capability.',
    fullExplanation: 'Super Diet-Ability (SDA) is not a restrictive diet, but a behavioral skill framework focused on building personal dietary mastery, observing structure, and mastering the return after slips.',
    relatedTerms: ['sda', 'resume_ability', 'structured_diet', 'structure'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  sda: {
    key: 'sda',
    displayName: 'SDA',
    shortDefinition: 'Abbreviation for Super Diet-Ability.',
    relatedTerms: ['super_diet_ability', 'resume_ability'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  resume_ability: {
    key: 'resume_ability',
    displayName: 'Resume-Ability',
    shortDefinition: 'The core capacity to pause between feeling and action, and return to your structure at any point after a slip.',
    fullExplanation: 'Resume-Ability is the foundational superpower in the SDA system. It shifts focus from avoiding all mistakes to drastically shortening the time and emotional cost of returning to your plan.',
    relatedTerms: ['super_diet_ability', 'resume', 'structured_slip', 'unstructured_slip'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_ra',
  },

  appetite_ability: {
    key: 'appetite_ability',
    displayName: 'Appetite Ability',
    shortDefinition: 'The capacity to maintain boundaries against social pressure and distinguish emotional urges from physical nourishment.',
    fullExplanation: 'Partially referenced in coaching data: involves recognizing when food offers from others are emotional or social rituals rather than true appetite requirements.',
    relatedTerms: ['super_diet_ability', 'delay_ability'],
    status: 'partial',
    sourceRef: 'app_data:coaching.ts:people_social',
  },

  delay_ability: {
    key: 'delay_ability',
    displayName: 'Delay Ability',
    shortDefinition: 'The skill of interrupting conditioned urges with a dedicated 15-minute pause before acting.',
    fullExplanation: 'Partially referenced in coaching data: uses the 15-minute urge container to let dopamine surges settle so decisions are made consciously.',
    relatedTerms: ['super_diet_ability', 'urge_timer', 'resume_ability'],
    status: 'partial',
    sourceRef: 'app_data:coaching.ts:delay',
  },

  structured_diet: {
    key: 'structured_diet',
    displayName: 'Structured Diet',
    shortDefinition: 'A chosen, intentional framework defining when, what, and how you plan to eat.',
    fullExplanation: 'A Structured Diet is not imposed from outside; it is chosen by the user. Having explicit structure makes on-track moments clear and returns after slips immediately visible.',
    relatedTerms: ['structure', 'on_track', 'structured_slip'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sd',
  },

  structure: {
    key: 'structure',
    displayName: 'Structure',
    shortDefinition: 'The observable rules, schedule, and food boundaries currently active for the day.',
    relatedTerms: ['structured_diet', 'planned', 'on_track'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sd',
  },

  on_track: {
    key: 'on_track',
    displayName: 'On Track',
    shortDefinition: 'Eating fully aligned with your intended structure and planned meal parameters.',
    relatedTerms: ['adjusted_on_track', 'structure', 'structured_diet'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:on_track',
  },

  adjusted_on_track: {
    key: 'adjusted_on_track',
    displayName: 'Adjusted and On Track',
    shortDefinition: 'A deliberate, conscious change in timing, portions, or food that still respects your dietary intent.',
    fullExplanation: 'Life presents changes. Adapting with awareness is not slipping—it is flexible mastery aligned with your structure.',
    relatedTerms: ['on_track', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:adjusted_on_track',
  },

  near_slip: {
    key: 'near_slip',
    displayName: 'Near-Slip',
    shortDefinition: 'An intense urge or boundary approach where you successfully paused and stopped before crossing into a slip.',
    fullExplanation: 'Near-Slip is a moment of high awareness. Because the boundary was not crossed, it is not a slip and does not count as a resume event.',
    relatedTerms: ['structured_slip', 'slippery_zones', 'urge_timer'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:near_slip',
  },

  structured_slip: {
    key: 'structured_slip',
    displayName: 'Structured Slip',
    shortDefinition: 'A slip that occurs within a structured day (e.g. eating off-plan foods or outside designated meal windows).',
    fullExplanation: 'Valuable behavioral data showing where structure met an urge. Followed immediately by the opportunity to Resume.',
    relatedTerms: ['unstructured_slip', 'resume', 'slippery_zones'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_slip',
  },

  unstructured_slip: {
    key: 'unstructured_slip',
    displayName: 'Unstructured Slip',
    shortDefinition: 'A slip that occurs during an unstructured day or when boundaries are completely absent.',
    fullExplanation: 'Occurs when structure is dropped or absent. Still fully capable of being resumed as soon as conscious awareness returns.',
    relatedTerms: ['structured_slip', 'resume'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:unstructured_slip',
  },

  planned_unstructured: {
    key: 'planned_unstructured',
    displayName: 'Planned Unstructured',
    shortDefinition: 'An intentional, scheduled period with relaxed rules (e.g. social gathering or holiday meal).',
    fullExplanation: 'Planned flexibility is not a slip. Because it was scheduled in advance, it preserves your psychological alignment and commitment.',
    relatedTerms: ['twenty_percent_off_track', 'structure', 'planned'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:planned_unstructured',
  },

  twenty_percent_off_track: {
    key: 'twenty_percent_off_track',
    displayName: '20% OFF TRACK',
    shortDefinition: 'An intentional flexibility buffer (e.g. 80/20 balance) that counts as an On-Track outcome, not a slip.',
    fullExplanation: '20% OFF TRACK provides psychological breathing room within an on-track framework. It is not failure, is never scored as a slip, and is not part of the resume denominator.',
    relatedTerms: ['on_track', 'planned_unstructured'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:twenty_percent_off_track',
  },

  resume: {
    key: 'resume',
    displayName: 'Resume',
    shortDefinition: 'The conscious act of returning to your intended structure after slipping.',
    fullExplanation: 'Resume is an independent dimension of measurement. A user can have a Structured Slip + Resumed. It coexists with the slip and does not erase it.',
    relatedTerms: ['resume_ability', 'structured_slip', 'unstructured_slip'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:resumed',
  },

  commitment: {
    key: 'commitment',
    displayName: 'Commitment',
    shortDefinition: 'The explicit, stated pledge the user made regarding their daily structure and goals.',
    fullExplanation: 'A foundational anchor in SDA. The coach always references actual user commitment data and never invents promises.',
    relatedTerms: ['why', 'non_negotiables'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  why: {
    key: 'why',
    displayName: 'Why',
    shortDefinition: 'The core personal reasons, values, and motivations saved by the user for pursuing Super Diet-Ability.',
    fullExplanation: 'The internal grounding anchor. Referenced when motivation is needed; if no Why is saved, the coach suggests clarifying one rather than fabricating generic reasons.',
    relatedTerms: ['commitment', 'non_negotiables'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts',
  },

  non_negotiables: {
    key: 'non_negotiables',
    displayName: 'Non-Negotiables',
    shortDefinition: 'Personal, firm boundaries established by the user to protect their daily structure.',
    fullExplanation: 'Non-Negotiables are user-defined shields against common drift. The coach respects them as explicit user choices.',
    relatedTerms: ['commitment', 'slippery_zones'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_nn',
  },

  slippery_zones: {
    key: 'slippery_zones',
    displayName: 'Slippery Zones',
    shortDefinition: 'High-risk emotional, social, or environmental triggers where maintaining structure is especially challenging.',
    fullExplanation: 'Slippery zones are contextual risk factors (e.g. stress, fatigue, late nights, social events). The coach explores them without claiming they caused slips.',
    relatedTerms: ['near_slip', 'structured_slip'],
    status: 'defined',
    sourceRef: 'app_terminology:sda_term_sz',
  },

  daily_check_in: {
    key: 'daily_check_in',
    displayName: 'Daily Check-In',
    shortDefinition: 'An intentional daily touchpoint to verify status, record awareness, and log diet outcomes.',
    relatedTerms: ['daily_review', 'on_track'],
    status: 'defined',
    sourceRef: 'app_engine:checkInStorage.ts',
  },

  daily_review: {
    key: 'daily_review',
    displayName: 'Daily Review',
    shortDefinition: 'An end-of-day reflective summary that builds awareness of wins, slips, and resume behaviors.',
    relatedTerms: ['daily_check_in', 'score'],
    status: 'defined',
    sourceRef: 'app_engine:checkInStorage.ts',
  },

  neutral_log: {
    key: 'neutral_log',
    displayName: 'Neutral Log',
    shortDefinition: 'Informational tracking of vitamins, supplements, water, or general notes without food scoring or structure classification.',
    fullExplanation: 'Neutral records capture health items without evaluating them as food or triggering dietary judgments.',
    relatedTerms: ['food_log'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts:Phase31C',
  },

  food_log: {
    key: 'food_log',
    displayName: 'Food Log',
    shortDefinition: 'Recording meals, snacks, or drinks with portions, categories, and timestamps.',
    relatedTerms: ['neutral_log', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  planned: {
    key: 'planned',
    displayName: 'Planned',
    shortDefinition: 'Meals or events scheduled in advance.',
    fullExplanation: 'Planning is a scheduling attribute. It differs from structured alignment: an unplanned meal can still be completely structured.',
    relatedTerms: ['unplanned', 'structure', 'planned_unstructured'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  unplanned: {
    key: 'unplanned',
    displayName: 'Unplanned',
    shortDefinition: 'Spontaneous food choices or events not scheduled in advance.',
    fullExplanation: 'Unplanned does NOT equal unstructured. A spontaneous meal can respect all nutritional boundaries.',
    relatedTerms: ['planned', 'structure'],
    status: 'defined',
    sourceRef: 'app_engine:dietVerificationStorage.ts',
  },

  micro_fasting: {
    key: 'micro_fasting',
    displayName: 'Micro-Fasting',
    shortDefinition: 'Brief, structured pauses between meals to build appetite awareness and mental discipline.',
    fullExplanation: 'Referenced in Phase 9 terminology. Full procedural protocols are partially codified in current app source.',
    relatedTerms: ['structured_diet', 'delay_ability'],
    status: 'partial',
    sourceRef: 'app_terminology:sda_term_mf',
  },

  urge_timer: {
    key: 'urge_timer',
    displayName: 'Urge Timer',
    shortDefinition: 'A 15-minute dedicated timer providing a conscious pause between an urge and an action.',
    fullExplanation: 'Based on Delay Ability: urges peak and subside like waves. Holding the pause for 15 minutes allows intentional choice to return.',
    relatedTerms: ['delay_ability', 'near_slip'],
    status: 'defined',
    sourceRef: 'app_data:coaching.ts:delay',
  },

  score: {
    key: 'score',
    displayName: 'Today\'s Score',
    shortDefinition: 'The daily score earned through positive actions, check-ins, honest reporting, and resume behavior.',
    relatedTerms: ['lifetime_score', 'progression_level'],
    status: 'defined',
    sourceRef: 'app_engine:scoringEngine.ts',
  },

  lifetime_score: {
    key: 'lifetime_score',
    displayName: 'Lifetime XP',
    shortDefinition: 'Cumulative experience points earned across all days. Never decreases upon slips.',
    relatedTerms: ['score', 'progression_level'],
    status: 'defined',
    sourceRef: 'app_engine:progressionEngine.ts',
  },

  progression_level: {
    key: 'progression_level',
    displayName: 'Progression Level',
    shortDefinition: 'The user\'s current tier in the SDA progression system based on cumulative lifetime XP.',
    relatedTerms: ['lifetime_score', 'score'],
    status: 'defined',
    sourceRef: 'app_engine:progressionEngine.ts',
  },
};
