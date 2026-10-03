/**
 * SDA Ability Challenges System — Challenge Definitions (Phase 37 / Phase 37B)
 *
 * Defines the catalog of challenges across abilities.
 * In Phase 37 / 37B, only Resume-Ability is active.
 * Remaining abilities are defined as future extensions without fabricating unverified doctrine.
 *
 * PROVENANCE CLARIFICATION (Phase 37B / Phase 38):
 * - The 1, 3, 7, 30, and 90-day Challenge durations, countdown timer UI, and daily progress
 *   timeline are APP OPERATIONAL FEATURES (Category C / Category B Product Directives).
 * - They were directly requested by Sergio Laurant as interactive app mechanics to practice recovery.
 * - They are NOT specific features or chapters defined inside the manuscripts.
 * - However, the underlying recovery philosophy ("Slips are opportunities to practice Resume-Ability",
 *   consistency as reliable return, 80/20 balance) is MANUSCRIPT-GROUNDED (Category A: Book 1 Ch 13 & Book 2 Ch 4).
 */

import type { ChallengeDefinition, ChallengeDurationDays } from './types';
import { SUPPORTED_CHALLENGE_DURATIONS } from './types';
export { SUPPORTED_CHALLENGE_DURATIONS };

export const RESUME_ABILITY_CHALLENGE_DEFINITION: ChallengeDefinition = {
  id: 'resume-ability',
  abilityId: 'resume-ability',
  challengeType: 'resume-ability',
  canonicalName: 'Resume-Ability',
  titleKey: 'challenge_resume_ability_title',
  descriptionKey: 'challenge_resume_ability_desc',
  supportedDurations: SUPPORTED_CHALLENGE_DURATIONS,
  isActive: true,
  sourceType: 'app-operational',
  authorityLevel: 'product-directive',
};

/**
 * Registry of challenge definitions.
 * Only resume-ability is active in Phase 37 / 37B.
 * Canonical ability names follow Sergio Laurant's authoritative manuscript typography.
 */
export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  RESUME_ABILITY_CHALLENGE_DEFINITION,
  {
    id: 'loss-maintenance-ability',
    abilityId: 'loss-maintenance-ability',
    challengeType: 'loss-maintenance-ability',
    canonicalName: 'Loss-Maintenance Ability',
    titleKey: 'challenge_loss_maintenance_title',
    descriptionKey: 'challenge_loss_maintenance_desc',
    supportedDurations: [7, 30, 90],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
  {
    id: 'appetite-fix-ability',
    abilityId: 'appetite-fix-ability',
    challengeType: 'appetite-fix-ability',
    canonicalName: 'Appetite-Fix Ability',
    titleKey: 'challenge_appetite_fix_title',
    descriptionKey: 'challenge_appetite_fix_desc',
    supportedDurations: [3, 7, 30],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
  {
    id: 'insulin-aware-ability',
    abilityId: 'insulin-aware-ability',
    challengeType: 'insulin-aware-ability',
    canonicalName: 'Insulin-Aware Ability',
    titleKey: 'challenge_insulin_aware_title',
    descriptionKey: 'challenge_insulin_aware_desc',
    supportedDurations: [7, 30],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
  {
    id: 'keto-switching-ability',
    abilityId: 'keto-switching-ability',
    challengeType: 'keto-switching-ability',
    canonicalName: 'Keto-Switching Ability',
    titleKey: 'challenge_keto_switching_title',
    descriptionKey: 'challenge_keto_switching_desc',
    supportedDurations: [7, 30],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
  {
    id: 'circadian-eating-ability',
    abilityId: 'circadian-eating-ability',
    challengeType: 'circadian-eating-ability',
    canonicalName: 'Circadian Eating Ability',
    titleKey: 'challenge_circadian_eating_title',
    descriptionKey: 'challenge_circadian_eating_desc',
    supportedDurations: [7, 30],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
  {
    id: 'micro-fasting-ability',
    abilityId: 'micro-fasting-ability',
    challengeType: 'micro-fasting-ability',
    canonicalName: 'Micro-Fasting Ability',
    titleKey: 'challenge_micro_fasting_title',
    descriptionKey: 'challenge_micro_fasting_desc',
    supportedDurations: [1, 3, 7],
    isActive: false,
    sourceType: 'app-operational',
    authorityLevel: 'product-directive',
  },
];

export function getActiveChallengeDefinitions(): ChallengeDefinition[] {
  return CHALLENGE_DEFINITIONS.filter(def => def.isActive);
}

export function getChallengeDefinition(id: string): ChallengeDefinition | null {
  return CHALLENGE_DEFINITIONS.find(def => def.id === id) || null;
}

export function isValidChallengeDuration(
  definition: ChallengeDefinition,
  duration: number
): duration is ChallengeDurationDays {
  return definition.supportedDurations.includes(duration as ChallengeDurationDays);
}

/**
 * Returns the exact canonical manuscript-verified name for any challenge or ability ID.
 */
export function getCanonicalAbilityName(id: string): string {
  const def = CHALLENGE_DEFINITIONS.find(d => d.id === id || d.abilityId === id);
  if (def?.canonicalName) {
    return def.canonicalName;
  }
  switch (id) {
    case 'resume-ability':
    case 'resume_ability':
      return 'Resume-Ability';
    case 'loss-maintenance-ability':
    case 'loss_maintenance_ability':
      return 'Loss-Maintenance Ability';
    case 'appetite-fix-ability':
    case 'appetite_fix_ability':
      return 'Appetite-Fix Ability';
    case 'insulin-aware-ability':
    case 'insulin_aware_ability':
      return 'Insulin-Aware Ability';
    case 'keto-switching-ability':
    case 'keto_switching_ability':
      return 'Keto-Switching Ability';
    case 'circadian-eating-ability':
    case 'circadian_eating_ability':
      return 'Circadian Eating Ability';
    case 'micro-fasting-ability':
    case 'micro_fasting_ability':
      return 'Micro-Fasting Ability';
    default:
      return id;
  }
}
