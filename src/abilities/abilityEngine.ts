/**
 * Super Diet-Ability — Seven Diet-Abilities Progression & Evidence Engine (Phase 42)
 *
 * Source: Authoritative Sergio Laurant SDA Manuscripts (Books 1-7).
 *
 * Principles:
 * - Strictly evidence-based: computes factual metrics from canonical stores.
 * - NO arbitrary mastery tiers (e.g. Unexplored, Orienting, Practicing, Consistent, Resilient).
 * - NO clinical or physiological claims.
 * - Only Resume-Ability currently has an active, operational Challenge system.
 * - Remaining six abilities have accurate Coming Soon status and authoritative doctrine availability.
 * - Zero XP side effects: completely separate from XP Level and Daily Resume-Ability Index.
 * - Pure, deterministic, and side-effect free evaluation.
 */

import {
  CANONICAL_SEVEN_DIET_ABILITIES,
  MANUSCRIPT_BREAKDOWN_SEQUENCE,
  MANUSCRIPT_RECOVERY_SEQUENCE,
} from '../coach/knowledge/abilities/sevenDietAbilities';
import { loadChallengeStore } from '../challenges/challengeStorage';
import { calculateChallengeEventCounts } from '../challenges/challengeEngine';
import type { ChallengeInstance, ChallengeCheckInEntry } from '../challenges/types';
import { getLocalDateKey } from '../utils/dietStorage';
import { getDoctrineExplorationRecord } from './abilityStorage';
import type {
  CanonicalDietAbilityId,
  DietAbilityProgress,
  ResumeAbilityEvidence,
  SevenDietAbilitiesOverview,
} from './types';

/**
 * Normalizes any challenge or ability ID format (kebab-case or snake_case)
 * to the canonical snake_case CanonicalDietAbilityId, or returns null if not a diet ability.
 */
export function normalizeToCanonicalDietAbilityId(id: string): CanonicalDietAbilityId | null {
  if (!id) return null;
  const normalized = id.replace(/-/g, '_') as CanonicalDietAbilityId;
  if (normalized in CANONICAL_SEVEN_DIET_ABILITIES) {
    return normalized;
  }
  return null;
}

/**
 * Derives factual behavioral evidence for Resume-Ability from canonical challenge stores.
 *
 * Guaranteed invariants:
 * 1. Single source of truth: derives metrics directly from loadChallengeStore().
 * 2. Idempotent and pure: never mutates or archives challenges.
 * 3. Exact deduplication: suppresses duplicate check-ins, retries, and cross-store duplicate IDs.
 * 4. Distinct practice days: unique calendar dates with logged check-ins.
 * 5. Factual recovery rate: strictly null if eligible slips === 0 (no fake 0% or 100%).
 * 6. Legacy compatibility: handles missing checkIns arrays gracefully.
 */
export function deriveResumeAbilityEvidence(
  referenceDateKey: string = getLocalDateKey()
): ResumeAbilityEvidence {
  const store = loadChallengeStore();

  // 1. Deduplicate challenge instances by ID between activeChallenge and history
  const instancesById = new Map<string, ChallengeInstance>();

  if (store.activeChallenge) {
    instancesById.set(store.activeChallenge.id, store.activeChallenge);
  }

  if (Array.isArray(store.history)) {
    for (const hist of store.history) {
      if (hist && hist.id && !instancesById.has(hist.id)) {
        instancesById.set(hist.id, hist);
      }
    }
  }

  // Filter for Resume-Ability challenges
  const resumeInstances = Array.from(instancesById.values()).filter(
    (inst) => normalizeToCanonicalDietAbilityId(inst.abilityId) === 'resume_ability'
  );

  // 2. Completed challenges count
  const completedChallengesCount = resumeInstances.filter(
    (inst) => inst.status === 'completed'
  ).length;

  // 3. Active challenge participation
  const activeInstance =
    store.activeChallenge &&
    store.activeChallenge.status === 'active' &&
    normalizeToCanonicalDietAbilityId(store.activeChallenge.abilityId) === 'resume_ability'
      ? store.activeChallenge
      : undefined;

  const hasActiveChallenge = Boolean(activeInstance);

  // 4. Canonical Check-Ins and Unique Practice Days deduplication
  const checkInsById = new Map<string, ChallengeCheckInEntry>();
  const uniquePracticeDatesSet = new Set<string>();
  let legacyCheckInsCount = 0;

  for (const instance of resumeInstances) {
    if (Array.isArray(instance.checkIns) && instance.checkIns.length > 0) {
      for (const entry of instance.checkIns) {
        if (!entry || !entry.id) continue;
        // Use deterministic entry id scoped to instance
        const stableKey = `${instance.id}::${entry.id}`;
        if (!checkInsById.has(stableKey)) {
          checkInsById.set(stableKey, entry);
          if (entry.dateKey) {
            uniquePracticeDatesSet.add(entry.dateKey);
          }
        }
      }
    } else if (typeof instance.totalCheckInsCount === 'number' && instance.totalCheckInsCount > 0) {
      // Legacy instance fallback
      legacyCheckInsCount += instance.totalCheckInsCount;
      if (instance.lastCheckInDateKey) {
        uniquePracticeDatesSet.add(instance.lastCheckInDateKey);
      }
    }
  }

  const totalChallengeCheckIns = checkInsById.size + legacyCheckInsCount;
  const uniquePracticeDates = Array.from(uniquePracticeDatesSet).sort();
  const uniquePracticeDays = uniquePracticeDates.length;
  const lastPracticeDateKey =
    uniquePracticeDates.length > 0
      ? uniquePracticeDates[uniquePracticeDates.length - 1]
      : undefined;

  // 5. True-slip opportunities and verified recoveries
  let eligibleSlipsCount = 0;
  let resumedSlipsCount = 0;

  for (const instance of resumeInstances) {
    let counts = instance.relevantEventCounts;

    if (instance.status === 'active' && instance.startDate && instance.endDate) {
      // Calculate up-to-date counts for the active instance without mutating it
      counts = calculateChallengeEventCounts(
        instance.startDate,
        instance.endDate,
        referenceDateKey,
        instance.durationDays
      );
    } else if (!counts && instance.startDate && instance.endDate) {
      // Legacy completed/cancelled instance without frozen counts
      counts = calculateChallengeEventCounts(
        instance.startDate,
        instance.endDate,
        instance.endDate,
        instance.durationDays
      );
    }

    if (counts) {
      eligibleSlipsCount += counts.eligibleSlips || 0;
      resumedSlipsCount += counts.resumedSlips || 0;
    }
  }

  const hasResumeOpportunities = eligibleSlipsCount > 0;
  const resumeRate = hasResumeOpportunities
    ? Math.round((resumedSlipsCount / eligibleSlipsCount) * 100)
    : null;

  return {
    totalChallengeCheckIns,
    uniquePracticeDays,
    uniquePracticeDates,
    completedChallengesCount,
    hasActiveChallenge,
    activeChallengeId: activeInstance?.id,
    activeChallengeDurationDays: activeInstance?.durationDays,
    activeChallengeCurrentDay: activeInstance?.currentDay,
    activeChallengeDaysRemaining: activeInstance?.daysRemaining,
    eligibleSlipsCount,
    resumedSlipsCount,
    resumeRate,
    hasResumeOpportunities,
    lastPracticeDateKey,
  };
}

/**
 * Returns progress and evidence status for a single canonical diet ability.
 */
export function getDietAbilityProgress(
  abilityId: CanonicalDietAbilityId,
  referenceDateKey: string = getLocalDateKey()
): DietAbilityProgress {
  const definition = CANONICAL_SEVEN_DIET_ABILITIES[abilityId];

  if (!definition) {
    throw new Error(`Unknown canonical diet ability ID: ${abilityId}`);
  }

  const isResumeAbility = abilityId === 'resume_ability';
  const evidence = isResumeAbility ? deriveResumeAbilityEvidence(referenceDateKey) : null;
  const doctrineRecord = getDoctrineExplorationRecord(abilityId);
  const doctrineExplored = Boolean(doctrineRecord?.explored);
  const doctrineExploredAt = doctrineRecord?.exploredAt;

  return {
    abilityId,
    bookNumber: definition.bookNumber,
    officialTitle: definition.officialTitle,
    subtitle: definition.subtitle,
    operationalStatus: isResumeAbility ? 'active_challenge' : 'doctrine_only',
    hasInteractiveChallenge: isResumeAbility,
    hasEducationalDoctrine: true,
    evidence,
    doctrineExplored,
    doctrineExploredAt,
  };
}

/**
 * Returns the complete evidence-based overview of all Seven Diet-Abilities.
 */
export function getSevenDietAbilitiesOverview(
  referenceDateKey: string = getLocalDateKey()
): SevenDietAbilitiesOverview {
  const abilities = {} as Record<CanonicalDietAbilityId, DietAbilityProgress>;

  for (const abilityId of MANUSCRIPT_RECOVERY_SEQUENCE) {
    abilities[abilityId] = getDietAbilityProgress(abilityId, referenceDateKey);
  }

  return {
    abilities,
    recoverySequence: [...MANUSCRIPT_RECOVERY_SEQUENCE],
    breakdownSequence: [...MANUSCRIPT_BREAKDOWN_SEQUENCE],
    activeAbilityId: 'resume_ability',
    generatedAt: Date.now(),
  };
}
