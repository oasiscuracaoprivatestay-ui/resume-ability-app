/**
 * Phase 35 Knowledge Reconciliation Matrix (Phase 36B)
 *
 * Compares all Phase 35 concepts, principles, and terminology against
 * the seven authoritative Sergio Laurant manuscripts and implemented application behavior.
 */

import type { ConceptReconciliation } from '../types';

export const PHASE_35_RECONCILIATION_MATRIX: ConceptReconciliation[] = [
  {
    conceptKey: 'resume_ability',
    conceptName: 'Resume-Ability',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 1 (Chapters 1-25) is entirely dedicated to Resume-Ability. Emphasizes that resume is not restarting, speed of return is power, and the two diets reality.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Maintain full definition. Deepen coaching using Book 1 techniques (15-Minute Resume Method, Seven Signals, Core Flow).',
  },

  {
    conceptKey: 'loss_maintenance_ability',
    conceptName: 'Loss-Maintenance Ability',
    phase35Status: 'partial (named only)',
    manuscriptEvidence:
      'Book 2 (Chapters 1-17) defines Loss-Maintenance as the central Umbrella Ability. Maintenance precedes fat loss; the Fat-Loss Duet alternates deficit and maintenance.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Elevate from partial to fully supported canonical ability with complete Book 2 grounding.',
  },

  {
    conceptKey: 'appetite_ability',
    conceptName: 'Appetite Ability / Appetite-Fix Ability',
    phase35Status: 'partial (named only)',
    manuscriptEvidence:
      'Book 3 (Chapters 1-14) is titled "Appetite-Fix Ability". Covers the Seven Appetite Disruptors, Satiety Toolbox, Hunger vs Craving, and fixing the meal before the gap.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Rename canonical identifier to appetite_fix_ability to match official Book 3 title while aliasing appetite_ability for backward compatibility.',
  },

  {
    conceptKey: 'delay_ability',
    conceptName: 'Delay Ability',
    phase35Status: 'partial (from urge timer)',
    manuscriptEvidence:
      'The manuscripts do not define a separate Book for "Delay Ability". The 15-minute delay/pause is codified as a core technique in Book 1 Ch 11 ("15-Minute Resume Method") and Book 7 Ch 11 & 15 ("The 15-Minute Block" / "The Craving Block").',
    status: 'APP_SPECIFIC',
    recommendedResolution:
      'Classify as an app-specific technique belonging to Resume-Ability (Book 1) and Micro-Fasting (Book 7). Retain timer integration in the app.',
  },

  {
    conceptKey: 'insulin_aware_ability',
    conceptName: 'Insulin-Aware Ability',
    phase35Status: 'reserved (uncodified)',
    manuscriptEvidence:
      'Book 4 (Chapters 1-18) defines Insulin-Aware Ability: understanding insulin as a vital signal not an enemy, plate composition, metabolic pauses, and liquid calories.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Promote to fully supported canonical ability grounded in Book 4.',
  },

  {
    conceptKey: 'keto_switching_ability',
    conceptName: 'Keto-Switching Ability',
    phase35Status: 'reserved (uncodified)',
    manuscriptEvidence:
      'Book 5 (Chapters 1-25) defines Keto-Switching: training fuel transition from incoming energy to stored energy, metabolic flexibility, meal boundaries, and switching ladder.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Promote to fully supported canonical ability grounded in Book 5.',
  },

  {
    conceptKey: 'circadian_eating_ability',
    conceptName: 'Circadian Eating Ability',
    phase35Status: 'reserved (uncodified)',
    manuscriptEvidence:
      'Book 6 (Chapters 1-30) defines Circadian Eating: three metabolic phases (Eating, Clearing, Overnight Gap), late-night eating solutions, and shift work adaptations.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Promote to fully supported canonical ability grounded in Book 6.',
  },

  {
    conceptKey: 'micro_fasting_ability',
    conceptName: 'Micro-Fasting Ability',
    phase35Status: 'partial (from timer)',
    manuscriptEvidence:
      'Book 7 (Chapters 1-47) is the comprehensive Capstone Ability: 15-minute progressive blocks, readiness before duration, stop rules, and refeeding protocols.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Promote to fully supported canonical capstone ability grounded in Book 7.',
  },

  {
    conceptKey: 'structured_diet',
    conceptName: 'Structured Diet',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 2 Chapters 3, 5, 12: Structure is intentional chosen framework, not external restriction. Observable boundaries.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Maintain full definition. Deepen connection with personal meal design from Book 2.',
  },

  {
    conceptKey: 'near_slip',
    conceptName: 'Near-Slip',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 1 Chapter 14 (Seven Signals): Catching an urge before the line is crossed. Book 7 Chapter 15 (Craving Block). Awareness in action.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Maintain semantic boundary: a near-slip is an awareness victory and NEVER a slip.',
  },

  {
    conceptKey: 'twenty_percent_off_track',
    conceptName: '20% OFF TRACK / 80-20 Principle',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 1 Chapter 13 ("80/20 Rule of Diet Consistency") and Book 2 Chapter 4 ("The 80/20 Principle: Why Perfection Fails"). Intentional flexibility.',
    status: 'SUPPORTED',
    recommendedResolution:
      'Maintain as an acceptable On-Track outcome, never a slip. Aligns perfectly with Sergio’s 80/20 principle.',
  },

  {
    conceptKey: 'structured_slip_vs_unstructured_slip',
    conceptName: 'Structured Slip vs Unstructured Slip',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 1 Chapter 5: Distinguishes between eating off-plan foods within a decided window (Category slip) versus total boundary abandonment (Unstructured slip).',
    status: 'SUPPORTED',
    recommendedResolution:
      'Maintain distinction in coaching and logging flows.',
  },

  {
    conceptKey: 'neutral_log',
    conceptName: 'Neutral Log',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Reflects Book 4 Ch 12 (liquid calories and pure water) and Book 6 Ch 23 (medications). The app’s non-evaluative tracking of water, vitamins, and meds aligns with keeping non-caloric items separate from diet scoring.',
    status: 'APP_SPECIFIC',
    recommendedResolution:
      'Maintain as an authoritative Level 2 application feature.',
  },

  {
    conceptKey: 'positive_scoring_no_punishment',
    conceptName: 'Positive Scoring & No Punishment',
    phase35Status: 'defined',
    manuscriptEvidence:
      'Book 1 Ch 24 & Book 7 Ch 47: Language and psychology must eliminate shame, guilt, and moralistic judgment. Rewarding honest reporting aligns directly with Sergio’s philosophy.',
    status: 'APP_SPECIFIC',
    recommendedResolution:
      'Preserve strictly. Slips never deduct points or reduce lifetime XP.',
  },
];
