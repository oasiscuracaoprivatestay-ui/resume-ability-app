/**
 * SDA Ability Challenges System — Types & Domain Model (Phase 37)
 *
 * Core Principles:
 * 1. Non-shaming recovery orientation: A Resume-Ability challenge is NOT a "no-slip" challenge.
 *    Slips provide opportunities to practice Resume-Ability.
 * 2. NO punitive "failed" status: Challenge statuses are strictly
 *    'not_started' | 'active' | 'completed' | 'cancelled'.
 * 3. Future-ready: Supports initial 1, 3, 7, 30, and 90 day durations,
 *    and architected for future abilities while keeping only 'resume-ability' active now.
 * 4. Local calendar dates: All day math is local calendar date based (YYYY-MM-DD),
 *    never raw 24h ms math.
 */

import type { CheckInStatus } from '../utils/checkInStorage';

export type ChallengeAbilityId =
  | 'resume-ability'
  // Reserved for future abilities (not active in Phase 37):
  | 'loss-maintenance-ability'
  | 'appetite-fix-ability'
  | 'insulin-aware-ability'
  | 'keto-switching-ability'
  | 'circadian-eating-ability'
  | 'micro-fasting-ability'
  | 'productivity'
  | 'time-management'
  | 'organizer'
  | 'money'
  | 'entrepreneurship';

export type ChallengeDurationDays = 1 | 3 | 7 | 30 | 90;

export const SUPPORTED_CHALLENGE_DURATIONS: ChallengeDurationDays[] = [1, 3, 7, 30, 90];

export type ChallengeStatus = 'not_started' | 'active' | 'completed' | 'cancelled';

export type ChallengeDayState =
  | 'completed'          // Past day within the challenge window
  | 'current'            // Today (active calendar day)
  | 'upcoming'           // Future day within the challenge window
  | 'resume_practiced'   // Slip occurred on this day and user resumed
  | 'no_opportunity';    // No eligible slip occurred on this day (on-track / flexibility)

// Phase 41E: Challenge Check-In Entry model
export interface ChallengeCheckInEntry {
  id: string;             // deterministic actionId / checkIn ID
  challengeId: string;
  dayIndex: number;       // 1-indexed (1..durationDays)
  dateKey: string;        // YYYY-MM-DD
  status: CheckInStatus;  // 'on-structure' | 'near-slip' | 'slip'
  timestamp: number;      // epoch ms
  actionTaken?: 'continue' | 'recommit' | 'diet_review';
}

// Phase 41E: Challenge Practice Progress stats (strictly separated from true slip metrics)
export interface ChallengePracticeStats {
  totalCheckIns: number;
  daysCheckedIn: number;
  todayCheckedIn: boolean;
  todayLatestStatus?: CheckInStatus;
}

export interface ChallengeDayProgress {
  dayIndex: number;      // 1-indexed (1..durationDays)
  dateKey: string;       // YYYY-MM-DD
  state: ChallengeDayState;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  slipsCount: number;
  resumedCount: number;
  hasResumeOpportunity: boolean;
  // Phase 41E: Practice check-in status for this day
  checkInsCount?: number;
  latestCheckInStatus?: CheckInStatus;
}

export interface ChallengeEventCounts {
  eligibleSlips: number;
  resumedSlips: number;
  unresumedSlips: number;
  resumeRate: number | null; // null if 0 eligible slips (to distinguish from 0%)
  hasResumeOpportunities: boolean;
  daysCompleted: number;
  totalDays: number;
}

export type ChallengeReminderFrequency = '1x' | '2x' | '3x' | 'custom';

export interface ChallengeReminderConfig {
  reminderEnabled: boolean;
  reminderFrequency: ChallengeReminderFrequency;
  reminderTimes: string[]; // HH:mm format, e.g. ["09:00", "18:00"]
}

export interface ChallengeInstance {
  id: string;
  abilityId: ChallengeAbilityId;
  challengeType: string; // 'resume-ability'
  durationDays: ChallengeDurationDays;
  startDate: string;     // YYYY-MM-DD (local calendar date, inclusive)
  endDate: string;       // YYYY-MM-DD (local calendar date, inclusive)
  status: ChallengeStatus;
  createdAt: number;     // epoch ms
  startedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  cancellationReason?: string;
  currentDay: number;    // 1-indexed, clamped between 1 and durationDays
  daysRemaining: number; // 0 when on or after final day
  progress: number;      // 0.0 to 1.0 (clamped)
  relevantEventCounts: ChallengeEventCounts;
  // Phase 41B: Behavioral trigger reminder preferences
  reminderEnabled?: boolean;
  reminderFrequency?: ChallengeReminderFrequency;
  reminderTimes?: string[];
  // Phase 41E: Practice Check-Ins (backward-compatible optional fields)
  checkIns?: ChallengeCheckInEntry[];
  lastCheckInDateKey?: string;
  totalCheckInsCount?: number;
  // Phase 41H: Milestone celebration state
  celebratedMilestones?: string[];
  // Phase 41H.5: Legacy concluded marker (suppresses retroactive modal popups while keeping celebratedMilestones authentic)
  isLegacyConcluded?: boolean;
}

// ── Phase 41H: Challenge Milestones ──────────────────────────────────────────

export type ChallengeMilestoneCategory =
  | 'first_checkin'
  | 'practice_consistency'
  | 'recovery'
  | 'completion';

export type ChallengeMilestonePresentation = 'modal' | 'inline';

export interface ChallengeMilestoneMetadata {
  id: string;
  category: ChallengeMilestoneCategory;
  presentation: ChallengeMilestonePresentation;
  priority: number;
  titleKey: string;
  descKey: string;
  badgeKey: string;
  feedbackType?: 'win' | 'recovery' | 'commit' | 'neutral';
  requiredDuration?: ChallengeDurationDays;
  requiredPracticeDays?: number;
}


export interface ChallengeDefinition {
  id: string;
  abilityId: ChallengeAbilityId;
  challengeType: string;
  titleKey: string;
  descriptionKey: string;
  canonicalName: string;
  supportedDurations: ChallengeDurationDays[];
  isActive: boolean;
  sourceType?: 'app-operational';
  authorityLevel?: 'product-directive';
}

export type SnoozeOptionDays = 1 | 3 | 7 | 14 | 30;

export interface ChallengeInvitationState {
  snoozeUntil: number | null; // absolute timestamp ms until which invitation is hidden
  lastPromptAt: number | null; // timestamp ms when the invitation was surfaced or dismissed
}

export interface ChallengeStore {
  version: 1;
  activeChallenge: ChallengeInstance | null;
  history: ChallengeInstance[];
  // Phase 41C: Challenge invitation & snooze state
  invitation?: ChallengeInvitationState;
}
