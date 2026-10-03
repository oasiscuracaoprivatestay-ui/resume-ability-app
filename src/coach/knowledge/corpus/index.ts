/**
 * SDA Authoritative Knowledge Corpus — Master Registry & Aggregator (Phase 36B)
 *
 * Combines all Level 1 manuscript knowledge units, Level 2 application knowledge units,
 * and authoritative safety boundaries into a unified, high-integrity corpus.
 */

import type { SDAKnowledgeUnit, AppKnowledgeUnit } from '../types';
import { BOOK_01_RESUME_ABILITY_UNITS } from './book01ResumeAbility.js';
import { BOOK_02_LOSS_MAINTENANCE_UNITS } from './book02LossMaintenance.js';
import { BOOK_03_APPETITE_FIX_UNITS } from './book03AppetiteFix.js';
import { BOOK_04_INSULIN_AWARE_UNITS } from './book04InsulinAware.js';
import { BOOK_05_KETO_SWITCHING_UNITS } from './book05KetoSwitching.js';
import { BOOK_06_CIRCADIAN_EATING_UNITS } from './book06CircadianEating.js';
import { BOOK_07_MICRO_FASTING_UNITS } from './book07MicroFasting.js';
import { SAFETY_KNOWLEDGE_UNITS, SDA_SAFETY_PROTOCOLS } from './safetyCorpus.js';
import { APP_KNOWLEDGE_UNITS } from './appKnowledgeCorpus.js';

export {
  BOOK_01_RESUME_ABILITY_UNITS,
  BOOK_02_LOSS_MAINTENANCE_UNITS,
  BOOK_03_APPETITE_FIX_UNITS,
  BOOK_04_INSULIN_AWARE_UNITS,
  BOOK_05_KETO_SWITCHING_UNITS,
  BOOK_06_CIRCADIAN_EATING_UNITS,
  BOOK_07_MICRO_FASTING_UNITS,
  SAFETY_KNOWLEDGE_UNITS,
  SDA_SAFETY_PROTOCOLS,
  APP_KNOWLEDGE_UNITS,
};

/**
 * Complete collection of all manuscript-grounded and safety knowledge units.
 */
export const ALL_SDA_KNOWLEDGE_UNITS: SDAKnowledgeUnit[] = [
  ...BOOK_01_RESUME_ABILITY_UNITS,
  ...BOOK_02_LOSS_MAINTENANCE_UNITS,
  ...BOOK_03_APPETITE_FIX_UNITS,
  ...BOOK_04_INSULIN_AWARE_UNITS,
  ...BOOK_05_KETO_SWITCHING_UNITS,
  ...BOOK_06_CIRCADIAN_EATING_UNITS,
  ...BOOK_07_MICRO_FASTING_UNITS,
  ...SAFETY_KNOWLEDGE_UNITS,
];

/**
 * Lookup map by unique knowledge unit ID.
 */
export const SDA_KNOWLEDGE_MAP: Record<string, SDAKnowledgeUnit> = Object.fromEntries(
  ALL_SDA_KNOWLEDGE_UNITS.map((unit) => [unit.id, unit])
);

/**
 * Lookup map for application features by feature key.
 */
export const APP_KNOWLEDGE_MAP: Record<string, AppKnowledgeUnit> = Object.fromEntries(
  APP_KNOWLEDGE_UNITS.map((unit) => [unit.featureKey, unit])
);

/**
 * Returns all knowledge units for a given book number (1 to 7).
 */
export function getUnitsByBookNumber(bookNumber: number): SDAKnowledgeUnit[] {
  return ALL_SDA_KNOWLEDGE_UNITS.filter((u) => u.bookNumber === bookNumber);
}

/**
 * Returns all knowledge units associated with an ability ID.
 */
export function getUnitsByAbilityId(abilityId: string): SDAKnowledgeUnit[] {
  return ALL_SDA_KNOWLEDGE_UNITS.filter(
    (u) => u.abilityId === abilityId || u.relatedAbilities.includes(abilityId as any)
  );
}

/**
 * Returns all knowledge units associated with an application feature.
 */
export function getUnitsByAppFeature(featureKey: string): SDAKnowledgeUnit[] {
  return ALL_SDA_KNOWLEDGE_UNITS.filter((u) => u.relatedAppFeatures.includes(featureKey));
}
