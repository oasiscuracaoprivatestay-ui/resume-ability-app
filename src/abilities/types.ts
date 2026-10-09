/**
 * Super Diet-Ability — Seven Diet-Abilities Progression Domain (Phase 42)
 *
 * Source: Authoritative Sergio Laurant SDA Manuscripts (Books 1-7).
 *
 * Principles:
 * - Strictly evidence-based: records real, observable behavioral evidence.
 * - NO arbitrary mastery tiers (e.g. Unexplored, Orienting, Practicing, etc.) without explicit Sergio approval.
 * - NO clinical or physiological claims (never promise fat adaptation, insulin levels, etc.).
 * - Only Resume-Ability currently has an active, operational Challenge system.
 * - The remaining six abilities are presented with honest educational doctrine and Coming Soon challenge states.
 * - Single source of truth: derives metrics from canonical stores without duplicating mutable counters.
 * - Zero XP side effects: completely separate from XP Level and Daily Resume-Ability Index.
 */

import type { CanonicalDietAbilityId } from '../coach/knowledge/types';

export type { CanonicalDietAbilityId };

export type DietAbilityOperationalStatus =
  | 'active_challenge'     // Operational interactive challenge (Resume-Ability)
  | 'doctrine_only';       // Authoritative doctrine available; challenges coming soon (Books 2-7)

export interface ResumeAbilityEvidence {
  totalChallengeCheckIns: number;
  uniquePracticeDays: number;
  uniquePracticeDates: string[]; // YYYY-MM-DD sorted ascending
  completedChallengesCount: number;
  hasActiveChallenge: boolean;
  activeChallengeId?: string;
  activeChallengeDurationDays?: number;
  activeChallengeCurrentDay?: number;
  activeChallengeDaysRemaining?: number;
  eligibleSlipsCount: number;
  resumedSlipsCount: number;
  resumeRate: number | null; // e.g. 100 for 100%, null if eligibleSlipsCount === 0
  hasResumeOpportunities: boolean;
  lastPracticeDateKey?: string; // YYYY-MM-DD
}

export interface DietAbilityProgress {
  abilityId: CanonicalDietAbilityId;
  bookNumber: number;
  officialTitle: string;
  subtitle: string;
  operationalStatus: DietAbilityOperationalStatus;
  hasInteractiveChallenge: boolean;
  hasEducationalDoctrine: boolean;
  evidence: ResumeAbilityEvidence | null; // Strictly null for abilities 2-7
  doctrineExplored: boolean;
  doctrineExploredAt?: number;
}

export interface SevenDietAbilitiesOverview {
  abilities: Record<CanonicalDietAbilityId, DietAbilityProgress>;
  recoverySequence: CanonicalDietAbilityId[];
  breakdownSequence: CanonicalDietAbilityId[];
  activeAbilityId: CanonicalDietAbilityId; // 'resume_ability'
  generatedAt: number;
}

export interface DoctrineExplorationRecord {
  explored: boolean;
  exploredAt?: number;
}

export interface DietAbilitiesStore {
  version: 1;
  updatedAt: number;
  doctrineExploration: Partial<Record<CanonicalDietAbilityId, DoctrineExplorationRecord>>;
}
