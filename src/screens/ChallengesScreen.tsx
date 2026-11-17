/**
 * SDA Ability Challenges System — Dedicated Screen (Phase 37)
 *
 * Provides:
 * 1. Active Challenge progress view with day-by-day recovery timeline and metrics.
 * 2. Start Challenge flow with ability selector, duration picker (1, 3, 7, 30, 90 days),
 *    and Hold to Start interaction pattern.
 * 3. Challenge History view displaying completed and cancelled challenges.
 * 4. Cancellation protection modal requiring explicit confirmation.
 * 5. Strictly non-shaming, recovery-oriented messaging.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n';
import {
  syncCurrentChallenge,
  startChallenge,
  cancelActiveChallenge,
  getChallengeHistory,
  getChallengeDayBreakdown,
  calculateChallengePracticeStats,
  evaluateChallengeMilestones,
  markChallengeMilestoneCelebrated,
  getDistinctPracticeDays,
  isMilestoneEligible,
  CHALLENGE_MILESTONE_DEFINITIONS,
  getCanonicalAbilityName,
  CHALLENGE_UPDATED_EVENT,
  OPEN_CHALLENGE_CHECKIN_EVENT,
  CHALLENGE_OPEN_CHECKIN_KEY,
  CHALLENGE_PRESELECT_DURATION_KEY,
  ChallengeInstance,
  ChallengeDurationDays,
  ChallengeAbilityId,
  ChallengeReminderFrequency,
  ChallengeMilestoneMetadata,
  CHALLENGE_DEFINITIONS,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
  resolveNinetyDayJourneyView,
  saveNinetyDayGoalText,
  startStandaloneNinetyDayJourney,
  saveNinetyDayMilestoneReview,
  NINETY_DAY_JOURNEY_UPDATED_EVENT,
  evaluateBook1PracticeLoopGuidance,
  type NinetyDayMilestoneDay,
  type MilestoneStructureDecision,
  type PracticeGuidanceActionTarget,
} from '../challenges';
import { HoldCommitButton } from '../components/HoldCommitButton';
import { ChallengeCheckInModal } from '../components/ChallengeCheckInModal';
import { ChallengeDietSummaryCard } from '../components/ChallengeDietSummaryCard';
import { ChallengeMilestoneModal } from '../components/ChallengeMilestoneModal';
import { NextActionModal } from '../components/premium/NextActionModal';
import { ActiveChallengeWelcomeModal } from '../components/premium/ActiveChallengeWelcomeModal';
import { playFeedback } from '../utils/feedback';
import { loadPledge } from '../utils/pledgeStorage';
import { saveRecommitEvent } from '../utils/recommitStorage';
import { recordScoreEvent } from '../utils/scoringEngine';
import { generateId } from '../utils';
import {
  getPushDeliveryStatus,
  subscribeToPush,
  isPushSupported,
  isIOS,
  isStandalonePWA,
  type PushDeliveryStatus,
} from '../utils/pushNotifications';
import {
  getChallengeActivityCount,
  ACTIVITIES_UPDATED_EVENT,
} from '../activities';
import type { CheckInStatus } from '../utils/checkInStorage';
import {
  DIET_UPDATED_EVENT,
} from '../utils/dietStorage';
import {
  DIET_VERIFICATION_UPDATED_EVENT,
} from '../utils/dietVerificationStorage';
import {
  PROGRESS_VICTORIES_UPDATED_EVENT,
} from '../utils/progressVictoriesStorage';
import type { CanonicalDietAbilityId } from '../abilities';
import { AppIcon } from '../components/icons/AppIcon';
import { ProgressRing } from '../components/premium/ProgressRing';
import './ChallengesScreen.css';

interface ChallengesScreenProps {
  onNavigate: (screen: any) => void;
  onBack: () => void;
  onOpenAbilityDetail?: (abilityId: CanonicalDietAbilityId) => void;
}

const LaurelSprigSvg: React.FC<{ mirrored?: boolean }> = ({ mirrored = false }) => (
  <svg
    className={`sda-ch-laurel ${mirrored ? 'sda-ch-laurel--right' : 'sda-ch-laurel--left'}`}
    viewBox="0 0 26 46"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={mirrored ? 'sda-laurel-r' : 'sda-laurel-l'} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F6D56B" />
        <stop offset="55%" stopColor="#DFA53A" />
        <stop offset="100%" stopColor="#B67C1E" />
      </linearGradient>
    </defs>
    <path
      d="M21 43C11.5 36.5 7.5 26 9.5 14C10.6 8.2 13.5 4.2 17 2"
      stroke={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`}
      strokeWidth="1.35"
      strokeLinecap="round"
    />
    <ellipse cx="15" cy="5.2" rx="3.4" ry="1.5" transform="rotate(-38 15 5.2)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
    <ellipse cx="11.2" cy="10.8" rx="3.8" ry="1.65" transform="rotate(-28 11.2 10.8)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
    <ellipse cx="14.6" cy="13.5" rx="3.3" ry="1.45" transform="rotate(25 14.6 13.5)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} opacity="0.88" />
    <ellipse cx="8.8" cy="18" rx="4" ry="1.7" transform="rotate(-18 8.8 18)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
    <ellipse cx="13.2" cy="20.6" rx="3.4" ry="1.5" transform="rotate(32 13.2 20.6)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} opacity="0.88" />
    <ellipse cx="9.2" cy="25.6" rx="4" ry="1.7" transform="rotate(-6 9.2 25.6)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
    <ellipse cx="14.2" cy="27.8" rx="3.4" ry="1.5" transform="rotate(38 14.2 27.8)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} opacity="0.88" />
    <ellipse cx="11.8" cy="33" rx="3.9" ry="1.65" transform="rotate(10 11.8 33)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
    <ellipse cx="16.8" cy="34.5" rx="3.2" ry="1.4" transform="rotate(46 16.8 34.5)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} opacity="0.85" />
    <ellipse cx="16.2" cy="39.2" rx="3.6" ry="1.55" transform="rotate(24 16.2 39.2)" fill={`url(#${mirrored ? 'sda-laurel-r' : 'sda-laurel-l'})`} />
  </svg>
);

const GoldenTrophySvg: React.FC = () => (
  <svg className="sda-ch-trophy-svg" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sda-trophy-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="48%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <path
      d="M8 5H20V11.5C20 14.8137 17.3137 17.5 14 17.5C10.6863 17.5 8 14.8137 8 11.5V5Z"
      fill="url(#sda-trophy-gold)"
    />
    <path
      d="M8 7H5.5C4.67157 7 4 7.67157 4 8.5V9.5C4 11.7091 5.79086 13.5 8 13.5"
      stroke="url(#sda-trophy-gold)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20 7H22.5C23.3284 7 24 7.67157 24 8.5V9.5C24 11.7091 22.2091 13.5 20 13.5"
      stroke="url(#sda-trophy-gold)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M14 17.5V21.5" stroke="url(#sda-trophy-gold)" strokeWidth="2.4" strokeLinecap="round" />
    <rect x="9" y="21.5" width="10" height="2.6" rx="1.3" fill="url(#sda-trophy-gold)" />
  </svg>
);

const AbilityClusterSvg: React.FC = () => (
  <svg className="sda-ch-cluster-svg" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="2.1" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="11" cy="4.4" r="1.8" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="16.7" cy="7.7" r="1.8" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="16.7" cy="14.3" r="1.8" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="11" cy="17.6" r="1.8" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="5.3" cy="14.3" r="1.8" stroke="currentColor" strokeWidth="1.35" />
    <circle cx="5.3" cy="7.7" r="1.8" stroke="currentColor" strokeWidth="1.35" />
  </svg>
);

const GoldenBoltSvg: React.FC = () => (
  <svg className="sda-ch-bolt-svg" viewBox="0 0 32 38" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sda-bolt-gold" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="45%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#EA8A0A" />
      </linearGradient>
    </defs>
    <path
      d="M18.6 2L6.5 20.4H15.4L12.8 36L25.5 17.2H16.5L18.6 2Z"
      fill="url(#sda-bolt-gold)"
    />
  </svg>
);

const EnergyWaveSvg: React.FC<{ side: 'left' | 'right' }> = ({ side }) => (
  <svg
    className={`sda-ch-wave sda-ch-wave--${side}`}
    viewBox="0 0 116 26"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={`sda-wave-grad-${side}`} x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#2DD4B3" stopOpacity="0" />
        <stop offset="55%" stopColor="#2DD4B3" stopOpacity="0.62" />
        <stop offset="88%" stopColor="#5EEAD4" stopOpacity="0.92" />
        <stop offset="100%" stopColor="#2DD4B3" stopOpacity="0.18" />
      </linearGradient>
    </defs>
    <path
      d="M2 15C24 15 36 20 56 15C74 10.5 84 5.5 98 11.5C105 14.5 110 15.5 114 15"
      stroke={`url(#sda-wave-grad-${side})`}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const PracticeInfinitySvg: React.FC = () => (
  <svg className="sda-pl-infinity-svg" viewBox="0 0 40 22" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sda-pl-inf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#5EEAD4" />
        <stop offset="50%" stopColor="#2DD4B3" />
        <stop offset="100%" stopColor="#10B981" />
      </linearGradient>
    </defs>
    <path
      d="M11.2 4.5C6.8 4.5 3.5 7.4 3.5 11C3.5 14.6 6.8 17.5 11.2 17.5C15.5 17.5 18.2 13.8 20 11C21.8 8.2 24.5 4.5 28.8 4.5C33.2 4.5 36.5 7.4 36.5 11C36.5 14.6 33.2 17.5 28.8 17.5C24.5 17.5 21.8 13.8 20 11C18.2 8.2 15.5 4.5 11.2 4.5Z"
      stroke="url(#sda-pl-inf-grad)"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PracticeSlipBoltSvg: React.FC = () => (
  <svg className="sda-pl-action-svg" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="sda-pl-bolt" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="52%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    <path
      d="M14.8 2.4L5.6 14.4H12.4L10.6 23.6L20.4 11.4H13.4L14.8 2.4Z"
      fill="url(#sda-pl-bolt)"
    />
  </svg>
);

const PracticeDriftWavesSvg: React.FC = () => (
  <svg className="sda-pl-action-svg" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path
      d="M3.5 8.2C6.4 5.8 9.6 5.8 13 8.2C16.4 10.6 19.6 10.6 22.5 8.2"
      stroke="#D8B4FE"
      strokeWidth="2.35"
      strokeLinecap="round"
    />
    <path
      d="M3.5 13C6.4 10.6 9.6 10.6 13 13C16.4 15.4 19.6 15.4 22.5 13"
      stroke="#C084FC"
      strokeWidth="2.35"
      strokeLinecap="round"
    />
    <path
      d="M3.5 17.8C6.4 15.4 9.6 15.4 13 17.8C16.4 20.2 19.6 20.2 22.5 17.8"
      stroke="#A855F7"
      strokeWidth="2.35"
      strokeLinecap="round"
    />
  </svg>
);

const PracticeResumedCheckSvg: React.FC = () => (
  <svg className="sda-pl-action-svg" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <circle cx="13" cy="13" r="9.6" stroke="#34D399" strokeWidth="2.2" />
    <path
      d="M8.8 13.2L11.7 16.1L17.4 10.2"
      stroke="#6EE7B7"
      strokeWidth="2.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PracticeRecommitShieldSvg: React.FC = () => (
  <svg className="sda-pl-action-svg" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path
      d="M13 3.2L5.2 6.4V12.5C5.2 17.6 8.5 21.7 13 23C17.5 21.7 20.8 17.6 20.8 12.5V6.4L13 3.2Z"
      stroke="#60A5FA"
      strokeWidth="2.15"
      strokeLinejoin="round"
    />
    <path
      d="M9.6 13L12 15.4L16.7 10.6"
      stroke="#93C5FD"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ContinuePlayEmblemSvg: React.FC = () => (
  <svg className="sda-pl-continue-play-svg" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="13" fill="#2DD4B3" />
    <path d="M11.6 9.3L19.4 14L11.6 18.7V9.3Z" fill="#041E18" />
  </svg>
);

const GoalEditPencilSvg: React.FC = () => (
  <svg className="sda-j90-pencil-svg" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M13.6 3.5L16.5 6.4L6.9 16H4V13.1L13.6 3.5Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11.8 5.3L14.7 8.2"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </svg>
);

const MilestoneStarSvg: React.FC = () => (
  <svg className="sda-j90-star-svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 2.1L9.75 5.65L13.65 6.22L10.82 8.98L11.49 12.87L8 11.03L4.51 12.87L5.18 8.98L2.35 6.22L6.25 5.65L8 2.1Z"
      fill="currentColor"
    />
  </svg>
);

export const ChallengesScreen: React.FC<ChallengesScreenProps> = ({
  onNavigate,
  onBack,
  onOpenAbilityDetail,
}) => {
  const { t } = useTranslation();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInstance | null>(null);
  const [history, setHistory] = useState<ChallengeInstance[]>([]);
  const [viewTab, setViewTab] = useState<'challenge' | 'history'>('challenge');

  // Start wizard state
  const [selectedAbility, setSelectedAbility] = useState<ChallengeAbilityId>('resume-ability');
  const [showMoreAbilities, setShowMoreAbilities] = useState<boolean>(false);
  // Phase 2: one-shot preselect hint set by the Home flagship 90-Day invite.
  // Consumed once on mount; when absent/invalid, existing defaults are unchanged.
  const [preselectedDuration] = useState<ChallengeDurationDays | null>(() => {
    try {
      const hint = sessionStorage.getItem(CHALLENGE_PRESELECT_DURATION_KEY);
      if (hint) {
        sessionStorage.removeItem(CHALLENGE_PRESELECT_DURATION_KEY);
        const n = Number(hint);
        if (RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations.includes(n as ChallengeDurationDays)) {
          return n as ChallengeDurationDays;
        }
      }
    } catch {
      // ignore storage access issues
    }
    return null;
  });
  const [selectedDuration, setSelectedDuration] = useState<ChallengeDurationDays>(preselectedDuration ?? 7);

  // Phase 41B: Reminder preferences state
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(false);
  const [reminderFrequency, setReminderFrequency] = useState<ChallengeReminderFrequency>('1x');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['09:00']);

  // Phase 41D: Push notification status and pre-permission modal state
  const [pushStatus, setPushStatus] = useState<PushDeliveryStatus>(() => getPushDeliveryStatus());
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 41E: Challenge Check-In Modal state (+ Phase 5A optional preselected status)
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInInitialStatus, setCheckInInitialStatus] = useState<CheckInStatus | null>(null);

  const openCheckInModal = useCallback((initial: CheckInStatus | null = null) => {
    setCheckInInitialStatus(initial);
    setShowCheckInModal(true);
  }, []);

  // Phase 41G: Daily Challenge Control Center state
  const [pledge, setPledge] = useState(() => loadPledge());
  const [hasRecommitted, setHasRecommitted] = useState(false);
  const [continueToast, setContinueToast] = useState<string | null>(null);
  const [showNextActionModal, setShowNextActionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Phase 5A & 5B.1: Practice Loop, 90-Day Goal, Milestone Review & Consolidated Sections state
  const [isBookInfoOpen, setIsBookInfoOpen] = useState<boolean>(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState<boolean>(false);
  const [isEditing90DayGoal, setIsEditing90DayGoal] = useState<boolean>(false);
  const [goal90Draft, setGoal90Draft] = useState<string>('');
  const [reviewingMilestoneDay, setReviewingMilestoneDay] = useState<NinetyDayMilestoneDay | null>(null);
  const [msWhatHelped, setMsWhatHelped] = useState<string>('');
  const [msDecision, setMsDecision] = useState<MilestoneStructureDecision>('continue');
  const [isDietOpen, setIsDietOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 900
  );

  // Phase 3: Collapsible secondary sections (reduce mobile scroll; expand on desktop / focus action)
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const [isNnOpen, setIsNnOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 900
  );
  const [isWhyOpen, setIsWhyOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth >= 900
  );
  const [isMovementOpen, setIsMovementOpen] = useState<boolean>(false);

  // Phase 41H.4: Completion view state
  const [showingStartWizard, setShowingStartWizard] = useState(preselectedDuration !== null);

  const latestCompletedChallenge = useMemo(() => {
    return history.find((c) => c.status === 'completed') || null;
  }, [history]);

  // Phase 41H: Challenge Milestones state & evaluation
  const milestoneTargetChallenge = useMemo(() => {
    if (activeChallenge && activeChallenge.status === 'active') return activeChallenge;
    if (activeChallenge && activeChallenge.status === 'completed') return activeChallenge;
    return latestCompletedChallenge;
  }, [activeChallenge, latestCompletedChallenge]);

  const completedChallengeToSummarize = useMemo(() => {
    if (activeChallenge && activeChallenge.status === 'completed') {
      return activeChallenge;
    }
    if (!activeChallenge && latestCompletedChallenge && !showingStartWizard) {
      return latestCompletedChallenge;
    }
    return null;
  }, [activeChallenge, latestCompletedChallenge, showingStartWizard]);

  const milestoneEval = useMemo(() => {
    return evaluateChallengeMilestones(milestoneTargetChallenge);
  }, [milestoneTargetChallenge]);

  const [activeModalMilestone, setActiveModalMilestone] = useState<ChallengeMilestoneMetadata | null>(null);

  useEffect(() => {
    if (milestoneEval.pendingModal && !showCheckInModal && !showCancelModal && !showPermissionModal) {
      setActiveModalMilestone(milestoneEval.pendingModal);
    }
  }, [milestoneEval.pendingModal, showCheckInModal, showCancelModal, showPermissionModal]);

  const handleDismissModalMilestone = useCallback(() => {
    if (milestoneTargetChallenge && activeModalMilestone) {
      markChallengeMilestoneCelebrated(milestoneTargetChallenge.id, activeModalMilestone.id);
      setActiveModalMilestone(null);
      refreshState();
    }
  }, [milestoneTargetChallenge, activeModalMilestone]);

  const handleAcknowledgeInlineMilestone = useCallback((milestoneId: string) => {
    if (milestoneTargetChallenge) {
      markChallengeMilestoneCelebrated(milestoneTargetChallenge.id, milestoneId);
      refreshState();
    }
  }, [milestoneTargetChallenge]);

  const uncelebratedInlineMilestones = useMemo(() => {
    return milestoneEval.uncelebrated.filter((m) => m.presentation === 'inline');
  }, [milestoneEval.uncelebrated]);

  const celebratedMilestonesList = useMemo(() => {
    return milestoneEval.celebrated;
  }, [milestoneEval.celebrated]);

  const [activityRefreshKey, setActivityRefreshKey] = useState<number>(0);
  const isRefreshingRef = React.useRef<boolean>(false);

  const refreshState = () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const current = syncCurrentChallenge();
      setActiveChallenge(current);
      setHistory(getChallengeHistory());
      setPushStatus(getPushDeliveryStatus());
      setPledge(loadPledge());
    } finally {
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    refreshState();
    const handleUpdate = () => {
      refreshState();
      setActivityRefreshKey((k) => k + 1);
    };
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    window.addEventListener(NINETY_DAY_JOURNEY_UPDATED_EVENT, handleUpdate);
    window.addEventListener(DIET_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
    window.addEventListener(DIET_VERIFICATION_UPDATED_EVENT, handleUpdate);
    window.addEventListener(PROGRESS_VICTORIES_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(NINETY_DAY_JOURNEY_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(DIET_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(DIET_VERIFICATION_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(PROGRESS_VICTORIES_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  // Factual count of activities explicitly linked to active challenge (Phase 43.4)
  const challengeActivityCount = useMemo(() => {
    if (!activeChallenge) return 0;
    return getChallengeActivityCount(activeChallenge.id);
  }, [activeChallenge, activityRefreshKey]);

  const handleHoldRecommit = () => {
    if (!activeChallenge) return;
    const recommitId = generateId();
    saveRecommitEvent({
      id: recommitId,
      timestamp: Date.now(),
    });
    recordScoreEvent({
      activityType: 'RECOMMIT',
      sourceId: `recommit_${recommitId}`,
      metadata: { challengeId: activeChallenge.id },
    });
    playFeedback('commit');
    setHasRecommitted(true);
    refreshState();
    setShowNextActionModal(true);
  };

  const handleContinueChallenge = () => {
    const current = syncCurrentChallenge() || activeChallenge;
    if (!current || current.status !== 'active') {
      playFeedback('neutral');
      setContinueToast(t.challenge_continue_no_active || 'No active challenge found to continue.');
      setTimeout(() => {
        setContinueToast(null);
      }, 3500);
      return;
    }

    // Phase 5B.1: Context-aware Book 1 Practice Loop Guidance Engine determines actual next step
    const freshJourney = resolveNinetyDayJourneyView(current);
    const freshGuidance = evaluateBook1PracticeLoopGuidance({
      activeChallenge: current,
      ninetyDayJourney: freshJourney,
      t,
    });
    playFeedback('commit');
    executeGuidanceAction(freshGuidance.primaryAction);
  };

  const handleScrollToRecommit = () => {
    setIsNnOpen(true);
    requestAnimationFrame(() => {
      const el = document.getElementById('section-my-non-negotiables');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // Phase 41E & 41F: Check for direct check-in trigger from Home card, push notification, or deep link
  useEffect(() => {
    const handleCheckInTrigger = () => {
      try {
        const openCheckIn = sessionStorage.getItem(CHALLENGE_OPEN_CHECKIN_KEY) || sessionStorage.getItem('challenge_open_checkin');
        const params = new URLSearchParams(window.location.search);
        const urlCheckIn = params.get('checkin') === 'true' || params.get('action') === 'check-in';

        if (openCheckIn === '1' || urlCheckIn) {
          sessionStorage.removeItem(CHALLENGE_OPEN_CHECKIN_KEY);
          sessionStorage.removeItem('challenge_open_checkin');
          // Only open if the challenge is confirmed active
          const current = activeChallenge || syncCurrentChallenge();
          if (current && current.status === 'active') {
            openCheckInModal(null);
          }
        }
      } catch {
        // ignore
      }
    };

    handleCheckInTrigger();

    // Listen for push notification click events when already on this screen
    const handleOpenEvent = () => {
      const current = syncCurrentChallenge();
      setActiveChallenge(current);
      sessionStorage.removeItem('challenge_open_checkin');
      if (current && current.status === 'active') {
        openCheckInModal(null);
      }
    };

    window.addEventListener(OPEN_CHALLENGE_CHECKIN_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_CHALLENGE_CHECKIN_EVENT, handleOpenEvent);
  }, [activeChallenge]);

  // Phase 44: Listen for deep-linked Next Action request from Welcome Popup
  useEffect(() => {
    try {
      const showNext = sessionStorage.getItem('challenge_show_next_action');
      if (showNext === '1') {
        sessionStorage.removeItem('challenge_show_next_action');
        const current = activeChallenge || syncCurrentChallenge();
        if (current && current.status === 'active') {
          setShowNextActionModal(true);
        }
      }
    } catch {}
  }, [activeChallenge]);

  const handleFrequencyChange = (freq: ChallengeReminderFrequency) => {
    setReminderFrequency(freq);
    if (freq === '1x') {
      setReminderTimes(['09:00']);
    } else if (freq === '2x') {
      setReminderTimes(['09:00', '18:00']);
    } else if (freq === '3x') {
      setReminderTimes(['09:00', '14:00', '19:00']);
    } else if (freq === 'custom') {
      if (reminderTimes.length === 0) {
        setReminderTimes(['09:00']);
      }
    }
  };

  const handleTimeChange = (index: number, newTime: string) => {
    const updated = [...reminderTimes];
    updated[index] = newTime;
    setReminderTimes(updated);
  };

  const handleAddCustomTime = () => {
    if (reminderTimes.length >= 6) return;
    // Suggest next reasonable hour or default
    const lastTime = reminderTimes[reminderTimes.length - 1] || '09:00';
    const [h] = lastTime.split(':').map(Number);
    const nextH = !isNaN(h) && h < 22 ? String(h + 2).padStart(2, '0') + ':00' : '20:00';
    setReminderTimes([...reminderTimes, nextH]);
  };

  const handleRemoveCustomTime = (index: number) => {
    if (reminderTimes.length <= 1) return;
    setReminderTimes(reminderTimes.filter((_, i) => i !== index));
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const res = await subscribeToPush();
      setPushStatus(res.status);
      setShowPermissionModal(false);
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleStartChallenge = () => {
    try {
      setErrorMessage(null);
      const newInstance = startChallenge(
        selectedAbility,
        selectedDuration,
        undefined,
        remindersEnabled
          ? {
              reminderEnabled: true,
              reminderFrequency,
              reminderTimes,
            }
          : {
              reminderEnabled: false,
              reminderFrequency,
              reminderTimes: [],
            }
      );
      setActiveChallenge(newInstance);
      setShowingStartWizard(false);
      playFeedback('commit');

      // Phase 41D: If reminders enabled, determine if explicit permission prompt is needed
      if (remindersEnabled) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default' && isPushSupported()) {
          setShowPermissionModal(true);
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          subscribeToPush().then(() => setPushStatus(getPushDeliveryStatus())).catch(() => {});
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start challenge');
    }
  };

  const handleConfirmCancel = () => {
    cancelActiveChallenge('User requested cancellation');
    setShowCancelModal(false);
    setShowingStartWizard(false);
    refreshState();
  };

  const dayBreakdown = activeChallenge && activeChallenge.status === 'active'
    ? getChallengeDayBreakdown(activeChallenge)
    : [];

  const practiceStats = activeChallenge && activeChallenge.status === 'active'
    ? calculateChallengePracticeStats(activeChallenge)
    : null;

  // Phase 5A & 5B.1: Authoritative 90-Day Goal & Journey Progress (with non-automatic Milestone Reviews)
  const ninetyDayJourney = useMemo(() => {
    void activityRefreshKey;
    return resolveNinetyDayJourneyView(activeChallenge);
  }, [activeChallenge, activityRefreshKey]);

  const displayed90DayGoal = ninetyDayJourney.goalText.trim() || t.journey90_default_goal;

  const openMilestoneReviewModal = useCallback(
    (day: NinetyDayMilestoneDay) => {
      const item = ninetyDayJourney.milestones.find((m) => m.day === day);
      if (!item || !item.isReached) return;
      setMsWhatHelped(item.reviewRecord?.whatHelped || '');
      setMsDecision(item.reviewRecord?.structureDecision || 'continue');
      setReviewingMilestoneDay(day);
    },
    [ninetyDayJourney.milestones]
  );

  const handleSaveMilestoneReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingMilestoneDay || !ninetyDayJourney.startDate) return;
    saveNinetyDayMilestoneReview({
      milestoneDay: reviewingMilestoneDay,
      journeyStartDate: ninetyDayJourney.startDate,
      whatHelped: msWhatHelped,
      structureDecision: msDecision,
    });
    playFeedback('win');
    const shouldAdjustDiet = msDecision === 'adjust';
    setReviewingMilestoneDay(null);
    setActivityRefreshKey((k) => k + 1);
    if (shouldAdjustDiet) {
      onNavigate('structured-diet');
    }
  };

  const handleStartEdit90DayGoal = () => {
    setGoal90Draft(ninetyDayJourney.goalText.trim() || t.journey90_default_goal);
    setIsEditing90DayGoal(true);
  };

  const handleSave90DayGoal = () => {
    saveNinetyDayGoalText(goal90Draft);
    setIsEditing90DayGoal(false);
    setActivityRefreshKey((k) => k + 1);
  };

  const handleCancelEdit90DayGoal = () => {
    setIsEditing90DayGoal(false);
  };

  const handleStart90DayJourney = () => {
    startStandaloneNinetyDayJourney();
    playFeedback('commit');
    setActivityRefreshKey((k) => k + 1);
  };

  // Phase 5B.1: Book 1 Interactive Practice Loop Guidance Engine
  const book1Guidance = useMemo(() => {
    void activityRefreshKey;
    return evaluateBook1PracticeLoopGuidance({
      activeChallenge,
      ninetyDayJourney,
      t,
    });
  }, [activeChallenge, ninetyDayJourney, activityRefreshKey, t]);

  const executeGuidanceAction = useCallback(
    (target: PracticeGuidanceActionTarget) => {
      switch (target) {
        case 'open_structured_diet':
          onNavigate('structured-diet');
          break;
        case 'open_checkin_modal':
          openCheckInModal(null);
          break;
        case 'open_resume_modal':
          openCheckInModal('resumed');
          break;
        case 'open_detailed_slip':
          onNavigate('slip-type');
          break;
        case 'open_recovery_timer':
          onNavigate('context');
          break;
        case 'open_daily_review':
          onNavigate('daily-review');
          break;
        case 'open_weekly_review':
          try {
            sessionStorage.setItem('pv_initial_tab', 'victories');
          } catch {
            // ignore
          }
          onNavigate('progress-victories');
          break;
        case 'open_milestone_review':
          if (book1Guidance.pendingMilestoneDay) {
            openMilestoneReviewModal(book1Guidance.pendingMilestoneDay);
          }
          break;
      }
    },
    [book1Guidance.pendingMilestoneDay, onNavigate, openCheckInModal, openMilestoneReviewModal]
  );

  const getGuidanceActionLabel = (target: PracticeGuidanceActionTarget, stateKind = book1Guidance.stateKind): string => {
    switch (target) {
      case 'open_structured_diet':
        if (stateKind === 'setup_structured_diet') return t.pl_next_cta_setup_diet;
        if (stateKind === 'cycle_complete_continue_or_adjust') return t.pl_next_cta_adjust_diet;
        return t.pl_next_cta_open_diet;
      case 'open_checkin_modal':
        return t.pl_next_cta_checkin;
      case 'open_resume_modal':
        return t.pl_next_cta_resume;
      case 'open_detailed_slip':
        return t.pl_next_cta_detailed_slip;
      case 'open_recovery_timer':
        return t.pl_next_cta_timer;
      case 'open_daily_review':
        return t.pl_next_cta_daily_review;
      case 'open_weekly_review':
        return t.pl_next_cta_weekly_review;
      case 'open_milestone_review':
        return t.pl_next_cta_milestone_review.replace(
          '{day}',
          String(book1Guidance.pendingMilestoneDay || '')
        );
    }
  };

  const practiceLoopState = useMemo(
    () => ({
      plannedBlocksCount: book1Guidance.plannedBlocksCount,
      reportedBlocksCount: book1Guidance.reportedBlocksCount,
      hasMealPlan: book1Guidance.isStructuredDietConfigured,
      dailyReviewDoneToday: book1Guidance.dailyReviewCompletedToday,
      weeklyReflectionDoneToday: book1Guidance.weeklyReviewCompletedThisWeek,
      activeStep: book1Guidance.activeCycleStep,
    }),
    [book1Guidance]
  );

  const savedReasons = (pledge.reasons || []).filter(
    (r) => typeof r === 'string' && r.trim().length > 0
  );
  const savedNonNegotiables = (pledge.nonNegotiables || []).filter(
    (n) => typeof n === 'string' && n.trim().length > 0
  );

  const isNewChallengeWizard =
    viewTab === 'challenge' &&
    !(activeChallenge && activeChallenge.status === 'active') &&
    !completedChallengeToSummarize;

  const comingSoonAbilities = useMemo(
    () => CHALLENGE_DEFINITIONS.filter((def) => !def.isActive),
    []
  );

  return (
    <div
      className={`challenges-screen ${
        isNewChallengeWizard ? 'challenges-screen--new-wizard' : 'challenges-screen--premium-hub'
      }`}
    >
      {/* ── Header ── */}
      {isNewChallengeWizard ? (
        <header className="challenges-header sda-ch-header">
          <div className="sda-ch-header-top">
            <button
              id="btn-challenges-back"
              className="challenges-back-btn sda-ch-back-btn"
              onClick={onBack}
              aria-label={t.common_back || 'Back'}
            >
              <AppIcon name="arrow-left" size={16} />
              <span>{t.common_back || 'Back'}</span>
            </button>

            <div className="sda-ch-crest">
              <LaurelSprigSvg />
              <div className="sda-ch-crest-inner">
                <div className="sda-ch-crest-title-row">
                  <GoldenTrophySvg />
                  <h1 className="challenges-title sda-ch-title">
                    {t.challenge_screen_title || 'Ability Challenges'}
                  </h1>
                </div>
                <p className="sda-ch-subtitle">
                  {t.challenge_header_tagline || 'BUILD · PRACTICE · STAY IN CONTROL'}
                </p>
              </div>
              <LaurelSprigSvg mirrored />
            </div>

            <span className="sda-ch-header-spacer" aria-hidden="true" />
          </div>

          <div className="challenges-tabs sda-ch-tabs">
            <button
              id="tab-challenge-active"
              className={`challenges-tab-btn sda-ch-tab-btn ${viewTab === 'challenge' ? 'challenges-tab-btn--active sda-ch-tab-btn--active' : ''}`}
              onClick={() => setViewTab('challenge')}
            >
              <AppIcon name="zap" size={15} className="sda-ch-tab-icon sda-ch-tab-icon--zap" />
              <span>{t.challenge_tab_start || 'New Challenge'}</span>
            </button>
            <button
              id="tab-challenge-history"
              className={`challenges-tab-btn sda-ch-tab-btn ${viewTab !== 'challenge' ? 'challenges-tab-btn--active sda-ch-tab-btn--active' : ''}`}
              onClick={() => setViewTab('history')}
            >
              <AppIcon name="history" size={15} className="sda-ch-tab-icon" />
              <span>
                {t.challenge_tab_history || 'History'} {history.length > 0 && `(${history.length})`}
              </span>
            </button>
          </div>
        </header>
      ) : (
        <header className="challenges-header sda-ch-header">
          <div className="sda-ch-header-top">
            <button
              id="btn-challenges-back"
              className="challenges-back-btn sda-ch-back-btn"
              onClick={onBack}
              aria-label={t.common_back || 'Back'}
            >
              <AppIcon name="arrow-left" size={16} />
              <span>{t.common_back || 'Back'}</span>
            </button>

            <div className="sda-ch-crest">
              <LaurelSprigSvg />
              <div className="sda-ch-crest-inner">
                <div className="sda-ch-crest-title-row">
                  <GoldenTrophySvg />
                  <h1 className="challenges-title sda-ch-title">
                    {t.challenge_screen_title || 'Ability Challenges'}
                  </h1>
                </div>
                <p className="sda-ch-subtitle">
                  {viewTab === 'challenge' && activeChallenge && activeChallenge.status === 'active'
                    ? (t.challenge_control_center_title || 'Daily Challenge Control Center')
                    : (t.challenge_header_tagline || 'BUILD · PRACTICE · STAY IN CONTROL')}
                </p>
              </div>
              <LaurelSprigSvg mirrored />
            </div>

            <span className="sda-ch-header-spacer" aria-hidden="true" />
          </div>

          <div className="challenges-tabs sda-ch-tabs">
            <button
              id="tab-challenge-active"
              className={`challenges-tab-btn sda-ch-tab-btn ${viewTab === 'challenge' ? 'challenges-tab-btn--active sda-ch-tab-btn--active' : ''}`}
              onClick={() => setViewTab('challenge')}
            >
              <AppIcon
                name={activeChallenge && activeChallenge.status === 'active' ? 'target' : 'zap'}
                size={15}
                className="sda-ch-tab-icon sda-ch-tab-icon--zap"
              />
              <span>
                {activeChallenge && activeChallenge.status === 'active'
                  ? (t.challenge_tab_current || 'Active Challenge')
                  : (t.challenge_tab_start || 'New Challenge')}
              </span>
            </button>
            <button
              id="tab-challenge-history"
              className={`challenges-tab-btn sda-ch-tab-btn ${viewTab === 'history' ? 'challenges-tab-btn--active sda-ch-tab-btn--active' : ''}`}
              onClick={() => setViewTab('history')}
            >
              <AppIcon name="history" size={15} className="sda-ch-tab-icon" />
              <span>
                {t.challenge_tab_history || 'History'} {history.length > 0 && `(${history.length})`}
              </span>
            </button>
          </div>
        </header>
      )}

      {errorMessage && (
        <div className="challenge-error-notice" role="alert">
          <span className="challenge-error-copy">
            <AppIcon name="alert-triangle" size={16} />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            className="challenge-error-dismiss"
            onClick={() => setErrorMessage(null)}
            aria-label="Close"
          >
            <AppIcon name="x" size={16} />
          </button>
        </div>
      )}

      {/* ── View Tab: History ── */}
      {viewTab === 'history' && (
        <div className="challenges-history-view sda-hist-view">
          <div className="sda-hist-head-row">
            <div className="sda-hist-head-title-group">
              <span className="sda-hist-head-icon" aria-hidden="true">
                <AppIcon name="history" size={18} />
              </span>
              <h2 className="challenges-section-heading sda-hist-heading">
                {t.challenge_history_heading || 'Challenge History'}
              </h2>
            </div>
            {history.length > 0 && (
              <span className="sda-hist-count-pill">
                {history.length}
              </span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="challenge-history-empty sda-hist-empty">
              <div className="sda-hist-empty-emblem" aria-hidden="true">
                <AppIcon name="trophy" size={28} />
              </div>
              <p className="sda-hist-empty-text">
                {t.challenge_history_empty || 'No previous challenges yet. Take on your first challenge today!'}
              </p>
              <button
                type="button"
                id="btn-history-start-challenge"
                className="sda-hist-empty-cta"
                onClick={() => setViewTab('challenge')}
              >
                <AppIcon
                  name={activeChallenge && activeChallenge.status === 'active' ? 'target' : 'zap'}
                  size={16}
                />
                <span>
                  {activeChallenge && activeChallenge.status === 'active'
                    ? (t.challenge_btn_view || 'View Challenge')
                    : (t.challenge_btn_start_challenge || 'Start a Challenge')}
                </span>
                <AppIcon name="chevron-right" size={16} />
              </button>
            </div>
          ) : (
            <div className="challenges-history-list sda-hist-grid">
              {history.map((item) => {
                const isCompleted = item.status === 'completed';
                const isCancelled = item.status === 'cancelled';
                const abilityName = getCanonicalAbilityName(item.abilityId);
                const distinctDays = getDistinctPracticeDays(item);
                const totalCheckIns = item.totalCheckInsCount ?? (item.checkIns ? item.checkIns.length : 0);
                const eligibleSlips = item.relevantEventCounts?.eligibleSlips || 0;
                const resumedSlips = item.relevantEventCounts?.resumedSlips || 0;
                const resumeRate = item.relevantEventCounts?.resumeRate;
                const daysCompleted = item.relevantEventCounts?.daysCompleted || 0;
                const completionPct =
                  item.durationDays > 0
                    ? Math.min(100, Math.max(0, Math.round((daysCompleted / item.durationDays) * 100)))
                    : 0;
                const unitLabel =
                  item.durationDays === 1 ? (t.common_day || 'Day') : (t.common_days || 'Days');

                // Factual recovery rate: strictly no percentage if no eligible slips
                const rateText =
                  eligibleSlips > 0 && resumeRate !== null
                    ? `${resumedSlips} / ${eligibleSlips} (${resumeRate}%)`
                    : (t.challenge_completion_no_slips || 'No eligible slips recorded');

                // Earned milestone badges for completed challenges only
                const earnedBadges = isCompleted
                  ? CHALLENGE_MILESTONE_DEFINITIONS.filter(
                      (m) =>
                        (item.celebratedMilestones && item.celebratedMilestones.includes(m.id)) ||
                        isMilestoneEligible(m, item)
                    )
                  : [];

                return (
                  <article
                    key={item.id}
                    className={`challenge-history-card sda-hist-card challenge-history-card--${item.status}`}
                    id={`history-card-${item.id}`}
                  >
                    <div className="challenge-history-header sda-hist-card-top">
                      <div className="challenge-history-title-wrap sda-hist-title-group">
                        <span
                          className={`sda-hist-card-icon sda-hist-card-icon--${item.status}`}
                          aria-hidden="true"
                        >
                          <AppIcon name={isCompleted ? 'trophy' : 'rotate-ccw'} size={17} />
                        </span>
                        <div className="sda-hist-title-copy">
                          <span className="challenge-history-title sda-hist-card-title">
                            {item.durationDays}-{t.common_day || 'Day'} {abilityName}
                          </span>
                          <span className="history-date-range sda-hist-date-range">
                            <AppIcon name="calendar" size={12} />
                            <span>
                              {item.startDate} → {item.endDate}
                            </span>
                          </span>
                        </div>
                      </div>

                      <span className={`challenge-status-badge challenge-status-badge--${item.status}`}>
                        <AppIcon name={isCompleted ? 'check-circle' : 'clock'} size={12} />
                        <span>
                          {isCompleted
                            ? (t.challenge_status_completed || 'Completed')
                            : (t.challenge_status_cancelled || 'Cancelled')}
                        </span>
                      </span>
                    </div>

                    <div className="challenge-history-dates sda-hist-progress-strip">
                      <div className="sda-hist-progress-track" aria-hidden="true">
                        <div
                          className={`sda-hist-progress-fill sda-hist-progress-fill--${item.status}`}
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                      <span className="history-duration-tag sda-hist-duration-tag">
                        {daysCompleted}/{item.durationDays} {unitLabel.toLowerCase()}
                      </span>
                    </div>

                    <div className="challenge-history-stats sda-hist-stats-grid">
                      <div className="challenge-history-stat-item sda-hist-stat-box">
                        <span className="stat-label">
                          {t.challenge_completion_practice_consistency || 'Practice Consistency'}
                        </span>
                        <span className="stat-val">
                          {distinctDays}/{item.durationDays} {unitLabel.toLowerCase()}
                        </span>
                        <span className="stat-sub">
                          {totalCheckIns} {t.challenge_practice_total_checkins || 'Total Check-Ins'}
                        </span>
                      </div>

                      <div className="challenge-history-stat-item sda-hist-stat-box">
                        <span className="stat-label">
                          {t.challenge_resumed_slips || 'Resumed'}
                        </span>
                        <span className="stat-val">{rateText}</span>
                        <span className="stat-sub">
                          {eligibleSlips > 0
                            ? `${resumedSlips} ${t.challenge_resumed_short || 'resumed'}`
                            : (t.challenge_checkin_status_on_structure || 'On Structure')}
                        </span>
                      </div>
                    </div>

                    {isCompleted && earnedBadges.length > 0 && (
                      <div className="challenge-history-badges-section sda-hist-badges-wrap">
                        <span className="history-badges-label">
                          {t.challenge_history_badges_label || 'Earned Milestone Badges'}
                        </span>
                        <div className="challenge-history-badges-list sda-hist-badges-list">
                          {earnedBadges.map((badge) => (
                            <span
                              key={badge.id}
                              className={`history-badge-pill history-badge-pill--${badge.category}`}
                            >
                              <AppIcon
                                name={
                                  badge.category === 'completion'
                                    ? 'trophy'
                                    : badge.category === 'recovery'
                                    ? 'rotate-ccw'
                                    : badge.category === 'first_checkin'
                                    ? 'target'
                                    : 'award'
                                }
                                size={12}
                              />
                              <span>{(t[badge.badgeKey as keyof typeof t] as string) || badge.id}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="challenge-history-cancelled-wrap sda-hist-cancelled-note">
                        <AppIcon name="shield" size={14} />
                        <p className="challenge-history-cancelled-text">
                          {t.challenge_history_cancelled_note ||
                            'Ended early • Every day of practice counts toward your ability.'}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── View Tab: Active Challenge or Start Wizard ── */}
      {viewTab === 'challenge' && (
        <>
          {activeChallenge && activeChallenge.status === 'active' ? (
            /* ── ACTIVE CHALLENGE DETAIL VIEW: DAILY CHALLENGE CONTROL CENTER (Phase 3 Midnight Emerald) ── */
            <div className="challenges-active-view control-center-hub sda-ac-hub">
              {continueToast && (
                <div className="challenge-continue-toast sda-ac-toast" role="status">
                  <span className="sda-ac-toast-text">
                    <AppIcon name="trophy" size={16} />
                    <span>{continueToast}</span>
                  </span>
                  <button
                    type="button"
                    className="challenge-toast-dismiss"
                    onClick={() => setContinueToast(null)}
                    aria-label="Close"
                  >
                    <AppIcon name="x" size={15} />
                  </button>
                </div>
              )}

              {/* ── COMPACT PROGRESS HERO (Exclusively /images/mountain-path-hero.png) ── */}
              <div className="challenge-hub-hero sda-ac-hero">
                <img
                  src="/images/mountain-path-hero.png"
                  alt=""
                  aria-hidden="true"
                  className="sda-ac-hero-img"
                />
                <div className="sda-ac-hero-scrim" aria-hidden="true" />

                <div className="sda-ac-hero-body">
                  <div className="challenge-hub-badges-row sda-ac-hero-badges">
                    <div className="challenge-hub-badge challenge-hub-badge--ability">
                      <AppIcon name="trophy" size={12} />
                      <span>{t.challenge_resume_ability_title || 'Resume-Ability Challenge'}</span>
                    </div>
                    <div className="challenge-hub-badge challenge-hub-badge--duration">
                      <span>
                        {activeChallenge.durationDays}{' '}
                        {activeChallenge.durationDays === 1
                          ? (t.common_day || 'Day')
                          : (t.common_days || 'Days')}
                      </span>
                    </div>
                    {activeChallenge.reminderEnabled && (
                      <div className="challenge-hub-badge challenge-hub-badge--reminders">
                        <AppIcon name="bell" size={12} />
                        <span>
                          {activeChallenge.reminderTimes && activeChallenge.reminderTimes.length > 0
                            ? activeChallenge.reminderTimes.join(', ')
                            : activeChallenge.reminderFrequency || 'Reminders'}
                        </span>
                      </div>
                    )}
                    {activeChallenge.reminderEnabled && pushStatus === 'enabled' && (
                      <div className="challenge-hub-badge challenge-hub-badge--push">
                        <AppIcon name="check" size={12} />
                        <span>{t.challenge_push_status_enabled || 'Notifications Active'}</span>
                      </div>
                    )}
                  </div>

                  <div className="challenge-hub-hero-inner sda-ac-hero-main">
                    <div className="challenge-hub-hero-content sda-ac-hero-copy">
                      <h2 className="challenge-hub-title">
                        {t.challenge_day_of_total
                          ?.replace('{current}', String(activeChallenge.currentDay))
                          ?.replace('{total}', String(activeChallenge.durationDays)) ||
                          `Day ${activeChallenge.currentDay} of ${activeChallenge.durationDays}`}
                      </h2>

                      <p className="challenge-hub-sub">
                        {activeChallenge.daysRemaining === 0
                          ? (t.challenge_final_day_desc || 'Final day of the challenge! Keep your recovery awareness sharp.')
                          : (t.challenge_days_left_desc?.replace('{days}', String(activeChallenge.daysRemaining)) || `${activeChallenge.daysRemaining} days remaining in this challenge.`)}
                      </p>

                      <div className="sda-ac-hero-dates">
                        <AppIcon name="calendar" size={12} />
                        <span>{activeChallenge.startDate} → {activeChallenge.endDate}</span>
                      </div>
                    </div>

                    <div className="challenge-hub-hero-ring-wrap sda-ac-hero-ring">
                      <ProgressRing
                        value={activeChallenge.progress}
                        size={96}
                        strokeWidth={8.5}
                        ariaLabel={`Day ${activeChallenge.currentDay} of ${activeChallenge.durationDays}, ${Math.round(activeChallenge.progress * 100)}% complete`}
                      >
                        <div className="challenge-hub-ring-label">
                          <span className="ring-day-number">{activeChallenge.currentDay}</span>
                          <span className="ring-day-total">/{activeChallenge.durationDays}d</span>
                        </div>
                      </ProgressRing>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="challenge-progress-bar-wrapper">
                  <div
                    className="challenge-progress-bar-fill"
                    style={{ width: `${Math.round(activeChallenge.progress * 100)}%` }}
                  />
                </div>
              </div>

              {/* ── RESPONSIVE 2-COLUMN CONTROL GRID ── */}
              <div className="sda-ac-grid">
                {/* ── PRIMARY COLUMN: PRACTICE LOOP, CONSOLIDATED METRICS & CONTINUE CTA ── */}
                <div className="sda-ac-col-primary">
                  {/* Phase 41D: Web Push Activation / Status Banner */}
                  {activeChallenge.reminderEnabled && pushStatus === 'available' && (
                    <div className="challenge-push-banner sda-ac-push-card" id="challenge-push-enable-banner">
                      <span className="challenge-push-banner-text">
                        <AppIcon name="bell" size={15} />
                        <span>{t.challenge_push_status_not_enabled || 'Reminders are configured. Enable notifications to receive them when SDA is closed.'}</span>
                      </span>
                      <button
                        id="btn-challenge-enable-push"
                        className="challenge-push-enable-btn"
                        onClick={handleEnablePush}
                        disabled={isEnablingPush}
                      >
                        {isEnablingPush ? '...' : (t.challenge_push_btn_enable || 'ENABLE NOTIFICATIONS')}
                      </button>
                    </div>
                  )}
                  {activeChallenge.reminderEnabled && pushStatus === 'denied' && (
                    <div className="challenge-push-banner challenge-push-banner--denied sda-ac-push-card" id="challenge-push-denied-banner">
                      <span className="challenge-push-banner-text">
                        <AppIcon name="alert-triangle" size={15} />
                        <span>{t.challenge_push_status_denied || 'Notifications are blocked in your browser settings. To receive reminders, allow notifications for this site.'}</span>
                      </span>
                    </div>
                  )}
                  {activeChallenge.reminderEnabled && isIOS() && !isStandalonePWA() && (
                    <div className="challenge-push-banner sda-ac-push-card" id="challenge-push-ios-banner">
                      <span className="challenge-push-banner-text">
                        <AppIcon name="bell" size={15} />
                        <span>{t.challenge_push_ios_instruction || 'To receive Challenge reminders when SDA is closed on iPhone, tap Share and select "Add to Home Screen".'}</span>
                      </span>
                    </div>
                  )}

                  {/* Phase 41H: Intermediate Inline Achievement Banner */}
                  {uncelebratedInlineMilestones.length > 0 && (
                    <div className="challenge-inline-achievement sda-ac-milestone-banner" id="challenge-inline-achievement">
                      <span className="inline-achievement-icon" aria-hidden="true">
                        <AppIcon name="sparkles" size={18} />
                      </span>
                      <div className="inline-achievement-content">
                        <div className="inline-achievement-header">
                          <span className="inline-achievement-badge">
                            {(t[uncelebratedInlineMilestones[0].badgeKey as keyof typeof t] as string) || uncelebratedInlineMilestones[0].id}
                          </span>
                          <h4 className="inline-achievement-title">
                            {(t[uncelebratedInlineMilestones[0].titleKey as keyof typeof t] as string) || uncelebratedInlineMilestones[0].id}
                          </h4>
                        </div>
                        <p className="inline-achievement-desc">
                          {(t[uncelebratedInlineMilestones[0].descKey as keyof typeof t] as string) || ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        id="btn-ack-inline-milestone"
                        className="inline-achievement-ack-btn"
                        onClick={() => handleAcknowledgeInlineMilestone(uncelebratedInlineMilestones[0].id)}
                        aria-label="Acknowledge achievement"
                      >
                        <AppIcon name="check" size={16} />
                      </button>
                    </div>
                  )}

                  {/* ── PHASE 5A: MY 90-DAY GOAL & JOURNEY PROGRESS PANEL ── */}
                  <section
                    className={`sda-j90-card ${
                      ninetyDayJourney.isActive ? 'sda-j90-card--active' : 'sda-j90-card--inactive'
                    }`}
                    id="section-ninety-day-journey"
                    aria-labelledby="heading-ninety-day-goal"
                  >
                    <div className="sda-j90-top">
                      <span className="sda-j90-infinity" aria-hidden="true">
                        <PracticeInfinitySvg />
                      </span>

                      <div className="sda-j90-goal-wrap">
                        <span id="heading-ninety-day-goal" className="sda-j90-eyebrow">
                          {t.journey90_title}
                        </span>

                        {isEditing90DayGoal ? (
                          <div className="sda-j90-edit-row">
                            <input
                              id="input-90day-goal"
                              type="text"
                              className="sda-j90-input"
                              value={goal90Draft}
                              maxLength={100}
                              placeholder={t.journey90_goal_placeholder}
                              aria-label={t.journey90_title}
                              autoFocus
                              onChange={(e) => setGoal90Draft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSave90DayGoal();
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelEdit90DayGoal();
                                }
                              }}
                            />
                            <div className="sda-j90-edit-actions">
                              <button
                                type="button"
                                id="btn-save-90day-goal"
                                className="sda-j90-save-btn"
                                onClick={handleSave90DayGoal}
                              >
                                {t.journey90_save_btn}
                              </button>
                              <button
                                type="button"
                                id="btn-cancel-90day-goal"
                                className="sda-j90-cancel-btn"
                                onClick={handleCancelEdit90DayGoal}
                              >
                                {t.journey90_cancel_btn}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="sda-j90-goal-text" id="text-90day-goal">
                            {displayed90DayGoal}
                          </p>
                        )}
                      </div>

                      {!isEditing90DayGoal && (
                        <button
                          type="button"
                          id="btn-edit-90day-goal"
                          className="sda-j90-edit-btn"
                          aria-label={t.journey90_edit_aria}
                          onClick={handleStartEdit90DayGoal}
                        >
                          <GoalEditPencilSvg />
                        </button>
                      )}
                    </div>

                    <div className="sda-j90-divider" aria-hidden="true" />

                    <div className="sda-j90-progress-block">
                      <div className="sda-j90-progress-meta">
                        <span className="sda-j90-progress-label">{t.journey90_progress_label}</span>
                        {ninetyDayJourney.isActive ? (
                          <span className="sda-j90-progress-stat" id="stat-90day-progress">
                            <span>
                              {t.journey90_day_of_90.replace(
                                '{day}',
                                String(ninetyDayJourney.currentDay)
                              )}
                            </span>
                            <span className="sda-j90-stat-dot" aria-hidden="true">
                              •
                            </span>
                            <strong className="sda-j90-stat-pct">
                              {ninetyDayJourney.completionPct}%
                            </strong>
                          </span>
                        ) : (
                          <span className="sda-j90-inactive-pill" id="stat-90day-inactive">
                            {t.journey90_not_started}
                          </span>
                        )}
                      </div>

                      {/* Slim 90-Day Progress Bar */}
                      <div
                        className="sda-j90-bar-track"
                        role="progressbar"
                        aria-label={t.journey90_progress_label}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={ninetyDayJourney.completionPct}
                      >
                        <div
                          className="sda-j90-bar-fill"
                          style={{ width: `${ninetyDayJourney.completionPct}%` }}
                        />
                      </div>

                      {/* 6-Milestone Track: Day 3, 7, 14, 30, 60, 90 */}
                      <div className="sda-j90-milestones-wrap">
                        <div className="sda-j90-milestones-line" aria-hidden="true">
                          <div
                            className="sda-j90-milestones-line-fill"
                            style={{ width: `${ninetyDayJourney.milestoneTrackPct}%` }}
                          />
                        </div>

                        <ol className="sda-j90-milestones-list">
                          {ninetyDayJourney.milestones.map((ms) => {
                            const dayLabel = t.journey90_milestone_day.replace('{day}', String(ms.day));
                            const statusLabel =
                              ms.status === 'review_completed'
                                ? t.journey90_ms_state_completed
                                : ms.status === 'milestone_reached'
                                ? t.journey90_ms_state_reached
                                : ms.status === 'review_pending'
                                ? t.journey90_ms_state_pending
                                : t.journey90_ms_state_upcoming;

                            const innerContent = (
                              <>
                                <span className="sda-j90-ms-node" aria-hidden="true">
                                  {ms.isFinal ? (
                                    <MilestoneStarSvg />
                                  ) : ms.isReviewCompleted ? (
                                    <AppIcon name="check" size={11} />
                                  ) : ms.isReviewPending ? (
                                    <span className="sda-j90-ms-pending-dot" />
                                  ) : null}
                                </span>
                                <span className="sda-j90-ms-label">{dayLabel}</span>
                              </>
                            );

                            return (
                              <li
                                key={ms.day}
                                className={`sda-j90-ms-item sda-j90-ms-item--${ms.state}`}
                                data-milestone-day={ms.day}
                                data-milestone-status={ms.status}
                                data-milestone-state={ms.state}
                                title={`${dayLabel} — ${statusLabel}`}
                              >
                                {ms.isReached ? (
                                  <button
                                    type="button"
                                    id={`btn-j90-ms-${ms.day}`}
                                    className="sda-j90-ms-btn"
                                    aria-label={`${dayLabel} — ${statusLabel}`}
                                    onClick={() => openMilestoneReviewModal(ms.day)}
                                  >
                                    {innerContent}
                                  </button>
                                ) : (
                                  innerContent
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      {/* Phase 5B.1: Reached Milestone Review Pending Banner */}
                      {ninetyDayJourney.isActive && ninetyDayJourney.pendingMilestoneReviews.length > 0 && (
                        <div className="sda-j90-ms-banner" id="banner-j90-milestone-review">
                          <span className="sda-j90-ms-banner-copy">
                            <span className="sda-j90-ms-banner-dot" aria-hidden="true" />
                            <span>
                              {t.journey90_ms_banner_reached.replace(
                                '{day}',
                                String(
                                  ninetyDayJourney.pendingMilestoneReviews[
                                    ninetyDayJourney.pendingMilestoneReviews.length - 1
                                  ].day
                                )
                              )}
                            </span>
                          </span>
                          <button
                            type="button"
                            id="btn-open-milestone-review"
                            className="sda-j90-ms-banner-btn"
                            onClick={() =>
                              openMilestoneReviewModal(
                                ninetyDayJourney.pendingMilestoneReviews[
                                  ninetyDayJourney.pendingMilestoneReviews.length - 1
                                ].day
                              )
                            }
                          >
                            <span>{t.journey90_ms_banner_cta}</span>
                            <AppIcon name="chevron-right" size={12} />
                          </button>
                        </div>
                      )}

                      {/* Explicit Inactive / Setup Entry Point for Shorter Challenges when 90-Day Journey Not Started */}
                      {!ninetyDayJourney.isActive && (
                        <div className="sda-j90-setup-row" id="setup-90day-journey">
                          <span className="sda-j90-setup-hint">{t.journey90_inactive_hint}</span>
                          <button
                            type="button"
                            id="btn-start-90day-journey"
                            className="sda-j90-start-btn"
                            onClick={handleStart90DayJourney}
                          >
                            <span>{t.journey90_start_btn}</span>
                            <AppIcon name="chevron-right" size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── PHASE 5A: MY PRACTICE LOOP (Book 1 · Resume-Ability) ── */}
                  <section
                    className="sda-pl-card"
                    id="section-my-practice-loop"
                    aria-labelledby="heading-my-practice-loop"
                  >
                    <div className="sda-pl-header">
                      <div className="sda-pl-title-group">
                        <span className="sda-pl-infinity-wrap" aria-hidden="true">
                          <PracticeInfinitySvg />
                        </span>
                        <div className="sda-pl-title-copy">
                          <h3 id="heading-my-practice-loop" className="sda-pl-title">
                            {t.pl_title}
                          </h3>
                          <p className="sda-pl-subtitle">{t.pl_subtitle}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        id="btn-pl-book-selector"
                        className={`sda-pl-book-pill ${isBookInfoOpen ? 'is-open' : ''}`}
                        aria-expanded={isBookInfoOpen}
                        aria-controls="panel-pl-book-info"
                        onClick={() => setIsBookInfoOpen((prev) => !prev)}
                      >
                        <span>{t.pl_book1_pill}</span>
                        <AppIcon name="chevron-down" size={14} className="sda-pl-book-chevron" />
                      </button>
                    </div>

                    {isBookInfoOpen && (
                      <div id="panel-pl-book-info" className="sda-pl-book-drawer">
                        <div className="sda-pl-book-row sda-pl-book-row--active">
                          <div className="sda-pl-book-row-top">
                            <span className="sda-pl-book-name">{t.pl_book1_pill}</span>
                            <span className="sda-pl-book-badge sda-pl-book-badge--active">
                              {t.pl_book1_active_badge}
                            </span>
                          </div>
                          <p className="sda-pl-book-desc">{t.pl_book1_active_desc}</p>
                          <button
                            type="button"
                            id="btn-pl-view-book1"
                            className="sda-pl-book-link"
                            onClick={() => {
                              if (onOpenAbilityDetail) {
                                onOpenAbilityDetail('resume_ability');
                              } else {
                                onNavigate('seven-abilities');
                              }
                            }}
                          >
                            <span>{t.pl_book1_view_principles}</span>
                            <AppIcon name="chevron-right" size={14} />
                          </button>
                        </div>

                        <div className="sda-pl-book-row sda-pl-book-row--future" aria-disabled="true">
                          <div className="sda-pl-book-row-top">
                            <span className="sda-pl-book-name">{t.pl_book2_pill}</span>
                            <span className="sda-pl-book-badge sda-pl-book-badge--future">
                              {t.pl_book2_future_badge}
                            </span>
                          </div>
                          <p className="sda-pl-book-desc">{t.pl_book2_future_desc}</p>
                        </div>
                      </div>
                    )}

                    {/* Compact Consolidated Check-In Status Strip */}
                    <div
                      className={`sda-pl-checkin-strip ${
                        practiceStats?.todayCheckedIn
                          ? 'sda-pl-checkin-strip--done'
                          : 'sda-pl-checkin-strip--pending'
                      }`}
                      id="challenge-checkin-banner"
                    >
                      <div className="sda-pl-checkin-left">
                        <span className={`challenge-checkin-badge ${practiceStats?.todayCheckedIn ? 'is-done' : 'is-pending'}`}>
                          <AppIcon name={practiceStats?.todayCheckedIn ? 'check-circle' : 'target'} size={13} />
                          <span>
                            {practiceStats?.todayCheckedIn
                              ? (t.challenge_practice_status_done || 'Checked in today')
                              : (t.challenge_practice_status_pending || 'Pending Check-In')}
                          </span>
                        </span>
                        {practiceStats?.todayCheckedIn && practiceStats.todayLatestStatus && (
                          <span className={`challenge-checkin-latest-pill challenge-checkin-latest-pill--${practiceStats.todayLatestStatus}`}>
                            {practiceStats.todayLatestStatus === 'on-structure'
                              ? `✓ ${t.challenge_checkin_status_on_structure || 'On Structure'}`
                              : practiceStats.todayLatestStatus === 'near-slip'
                              ? `⚡ ${t.challenge_checkin_status_near_slip || 'Near Slip'}`
                              : practiceStats.todayLatestStatus === 'resumed'
                              ? `✓ ${t.challenge_checkin_status_resumed || 'Resumed'}`
                              : practiceStats.todayLatestStatus === 'off-structure-aware'
                              ? `◉ ${t.challenge_checkin_status_off_structure_aware || 'Off Structure — Aware'}`
                              : `↻ ${t.challenge_checkin_status_slip || 'True Slip'}`}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        id="btn-active-challenge-checkin"
                        className="sda-pl-checkin-btn"
                        onClick={() => openCheckInModal(null)}
                      >
                        <span>
                          {practiceStats?.todayCheckedIn
                            ? (t.challenge_btn_checkin_again || 'Check In Again')
                            : t.pl_checkin_quick_btn}
                        </span>
                        <AppIcon name="chevron-right" size={14} />
                      </button>
                    </div>

                    {/* ── PHASE 5B.1: COMPACT CONTEXT-AWARE "YOUR NEXT STEP" CARD ── */}
                    {(() => {
                      const g = book1Guidance;
                      const blk = g.nextScheduledBlock;
                      const showScheduledBlockRow =
                        g.stateKind === 'next_meal_block' ||
                        g.stateKind === 'next_fasting_block' ||
                        g.stateKind === 'pending_checkin' ||
                        g.stateKind === 'slip_recovery_next_block' ||
                        g.stateKind === 'drifting_recovery' ||
                        (g.stateKind === 'resumed_confirmation' && !g.allTodayBlocksVerified);

                      let headline = t.pl_next_block_heading;
                      let subcopy = '';
                      switch (g.stateKind) {
                        case 'setup_structured_diet':
                          headline = t.pl_next_setup_diet_title;
                          subcopy = t.pl_next_setup_diet_sub;
                          break;
                        case 'slip_recovery_next_block':
                          headline = t.pl_next_slip_title;
                          subcopy = t.pl_next_slip_sub;
                          break;
                        case 'drifting_recovery':
                          headline = t.pl_next_drift_title;
                          subcopy = t.pl_next_drift_sub;
                          break;
                        case 'resumed_confirmation':
                          headline = t.pl_next_resumed_title;
                          if (g.allTodayBlocksVerified) {
                            subcopy = t.pl_next_resumed_sub_review;
                          }
                          break;
                        case 'pending_checkin':
                          headline = blk ? t.pl_next_block_heading : t.pl_next_checkin_title;
                          subcopy = t.pl_next_checkin_sub;
                          break;
                        case 'next_meal_block':
                        case 'next_fasting_block':
                          headline = t.pl_next_block_heading;
                          break;
                        case 'verify_remaining_blocks':
                          headline = t.pl_next_verify_remaining_title;
                          subcopy = t.pl_next_verify_remaining_sub.replace(
                            '{count}',
                            String(g.unverifiedBlocksCount)
                          );
                          break;
                        case 'free_or_unstructured_day':
                          headline = t.pl_next_free_day_title;
                          subcopy = t.pl_next_free_day_sub;
                          break;
                        case 'milestone_review_pending':
                          headline = t.journey90_ms_modal_title.replace(
                            '{day}',
                            String(g.pendingMilestoneDay || '')
                          );
                          subcopy = t.journey90_ms_modal_sub;
                          break;
                        case 'daily_review_pending':
                          headline = t.pl_next_daily_review_title;
                          subcopy = t.pl_next_daily_review_sub;
                          break;
                        case 'weekly_review_pending':
                          headline = t.pl_next_weekly_review_title;
                          subcopy = t.pl_next_weekly_review_sub;
                          break;
                        case 'cycle_complete_continue_or_adjust':
                          headline = t.pl_next_cycle_complete_title;
                          subcopy = t.pl_next_cycle_complete_sub;
                          break;
                      }

                      return (
                        <div
                          className={`sda-pl-next-card sda-pl-next-card--${g.stateKind}`}
                          id="card-pl-next-step"
                          data-guidance-state={g.stateKind}
                        >
                          <div className="sda-pl-next-top">
                            <span className="sda-pl-next-eyebrow">
                              <AppIcon name="sparkles" size={12} />
                              <span>{t.pl_next_eyebrow}</span>
                            </span>

                            <div className="sda-pl-next-badges">
                              {g.stateKind === 'resumed_confirmation' && (
                                <span className="sda-pl-next-chip sda-pl-next-chip--resumed" id="badge-pl-resumed">
                                  ✓ {t.pl_next_resumed_badge}
                                </span>
                              )}
                              {showScheduledBlockRow && blk && (
                                <span
                                  className={`sda-pl-next-chip ${
                                    blk.isFasting
                                      ? 'sda-pl-next-chip--fasting'
                                      : 'sda-pl-next-chip--meal'
                                  }`}
                                  id="badge-pl-block-kind"
                                >
                                  {blk.isFasting ? t.pl_next_fasting_badge : t.pl_next_meal_badge}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="sda-pl-next-main">
                            <div className="sda-pl-next-copy">
                              <h4 className="sda-pl-next-title" id="next-step-title">
                                {headline}
                              </h4>

                              {showScheduledBlockRow && (
                                <div className="sda-pl-next-block-row" id="next-step-scheduled-block">
                                  {blk ? (
                                    <>
                                      <span className="sda-pl-next-block-time" id="next-step-block-time">
                                        {blk.isTomorrow
                                          ? `${t.pl_next_tomorrow_tag} · `
                                          : blk.timingState === 'active_now'
                                          ? `${t.pl_next_now_tag} · `
                                          : ''}
                                        {blk.startTime} – {blk.endTime}
                                      </span>
                                      <span className="sda-pl-next-block-sep" aria-hidden="true">
                                        ·
                                      </span>
                                      <span className="sda-pl-next-block-desc" id="next-step-block-desc">
                                        {blk.primaryDescription}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="sda-pl-next-block-empty" id="next-step-block-empty">
                                      {t.pl_next_no_block_empty}
                                    </span>
                                  )}
                                </div>
                              )}

                              {subcopy && <p className="sda-pl-next-sub">{subcopy}</p>}
                            </div>

                            <div className="sda-pl-next-actions">
                              <button
                                type="button"
                                id="btn-pl-next-step-action"
                                className="sda-pl-next-cta"
                                onClick={() => executeGuidanceAction(g.primaryAction)}
                              >
                                <span>{getGuidanceActionLabel(g.primaryAction)}</span>
                                <AppIcon name="chevron-right" size={13} />
                              </button>

                              {g.secondaryAction && (
                                <button
                                  type="button"
                                  id="btn-pl-next-step-secondary"
                                  className="sda-pl-next-secondary-btn"
                                  onClick={() => executeGuidanceAction(g.secondaryAction!)}
                                >
                                  <span>{getGuidanceActionLabel(g.secondaryAction, g.stateKind)}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4 Action Cards: Gold / Purple / Emerald / Blue */}
                    <div className="sda-pl-actions-grid" role="group" aria-label={t.pl_title}>
                      {/* 1. I Slipped (Warm Gold) — Opens ChallengeCheckInModal with Slip preselected */}
                      <button
                        type="button"
                        id="btn-pl-slipped"
                        className="sda-pl-action-card sda-pl-action-card--gold"
                        onClick={() => openCheckInModal('slip')}
                      >
                        <span className="sda-pl-action-icon" aria-hidden="true">
                          <PracticeSlipBoltSvg />
                        </span>
                        <span className="sda-pl-action-copy">
                          <span className="sda-pl-action-title">{t.pl_action_slipped_title}</span>
                          <span className="sda-pl-action-sub">{t.pl_action_slipped_sub}</span>
                        </span>
                        <AppIcon name="chevron-right" size={16} className="sda-pl-action-chevron" />
                      </button>

                      {/* 2. I Am Drifting (Purple) */}
                      <button
                        type="button"
                        id="btn-pl-drifting"
                        className="sda-pl-action-card sda-pl-action-card--purple"
                        onClick={() => openCheckInModal('off-structure-aware')}
                      >
                        <span className="sda-pl-action-icon" aria-hidden="true">
                          <PracticeDriftWavesSvg />
                        </span>
                        <span className="sda-pl-action-copy">
                          <span className="sda-pl-action-title">{t.pl_action_drifting_title}</span>
                          <span className="sda-pl-action-sub">{t.pl_action_drifting_sub}</span>
                        </span>
                        <AppIcon name="chevron-right" size={16} className="sda-pl-action-chevron" />
                      </button>

                      {/* 3. I Resumed (Emerald) */}
                      <button
                        type="button"
                        id="btn-pl-resumed"
                        className="sda-pl-action-card sda-pl-action-card--emerald"
                        onClick={() => openCheckInModal('resumed')}
                      >
                        <span className="sda-pl-action-icon" aria-hidden="true">
                          <PracticeResumedCheckSvg />
                        </span>
                        <span className="sda-pl-action-copy">
                          <span className="sda-pl-action-title">{t.pl_action_resumed_title}</span>
                          <span className="sda-pl-action-sub">{t.pl_action_resumed_sub}</span>
                        </span>
                        <AppIcon name="chevron-right" size={16} className="sda-pl-action-chevron" />
                      </button>

                      {/* 4. Re-Commit (Blue) */}
                      <button
                        type="button"
                        id="btn-pl-recommit"
                        className="sda-pl-action-card sda-pl-action-card--blue"
                        onClick={() => onNavigate('recommit')}
                      >
                        <span className="sda-pl-action-icon" aria-hidden="true">
                          <PracticeRecommitShieldSvg />
                        </span>
                        <span className="sda-pl-action-copy">
                          <span className="sda-pl-action-title">{t.pl_action_recommit_title}</span>
                          <span className="sda-pl-action-sub">{t.pl_action_recommit_sub}</span>
                        </span>
                        <AppIcon name="chevron-right" size={16} className="sda-pl-action-chevron" />
                      </button>
                    </div>

                    {/* Book 1 Flow Strip: Structured Diet -> Today -> Daily Review -> Weekly Review */}
                    <nav className="sda-pl-steps-flow" aria-label="Book 1 Practice Loop Steps">
                      <button
                        type="button"
                        id="btn-pl-step-diet"
                        className={`sda-pl-step-card ${
                          practiceLoopState.activeStep === 'diet' ? 'is-current' : ''
                        }`}
                        aria-current={practiceLoopState.activeStep === 'diet' ? 'step' : undefined}
                        onClick={() => onNavigate('structured-diet')}
                      >
                        <span className="sda-pl-step-icon" aria-hidden="true">
                          <AppIcon name="utensils" size={19} />
                        </span>
                        <span className="sda-pl-step-title">{t.pl_step_diet_title}</span>
                        <span className="sda-pl-step-sub">{t.pl_step_diet_sub}</span>
                      </button>

                      <span className="sda-pl-step-arrow" aria-hidden="true">→</span>

                      <button
                        type="button"
                        id="btn-pl-step-today"
                        className={`sda-pl-step-card ${
                          practiceLoopState.activeStep === 'today' ? 'is-current' : ''
                        }`}
                        aria-current={practiceLoopState.activeStep === 'today' ? 'step' : undefined}
                        onClick={() => {
                          const freshChallenge = syncCurrentChallenge() || activeChallenge;
                          const freshStats =
                            freshChallenge && freshChallenge.status === 'active'
                              ? calculateChallengePracticeStats(freshChallenge)
                              : practiceStats;
                          if (!freshStats?.todayCheckedIn) {
                            openCheckInModal(null);
                          } else {
                            onNavigate('structured-diet');
                          }
                        }}
                      >
                        <span className="sda-pl-step-icon" aria-hidden="true">
                          <AppIcon name="sun" size={20} />
                        </span>
                        <span className="sda-pl-step-title">{t.pl_step_today_title}</span>
                        <span className="sda-pl-step-sub">{t.pl_step_today_sub}</span>
                      </button>

                      <span className="sda-pl-step-arrow" aria-hidden="true">→</span>

                      <button
                        type="button"
                        id="btn-pl-step-daily-review"
                        className={`sda-pl-step-card ${
                          practiceLoopState.activeStep === 'daily-review' ? 'is-current' : ''
                        } ${practiceLoopState.dailyReviewDoneToday ? 'is-done' : ''}`}
                        aria-current={practiceLoopState.activeStep === 'daily-review' ? 'step' : undefined}
                        onClick={() => onNavigate('daily-review')}
                      >
                        {practiceLoopState.dailyReviewDoneToday && (
                          <span className="sda-pl-step-done-dot" aria-hidden="true">✓</span>
                        )}
                        <span className="sda-pl-step-icon" aria-hidden="true">
                          <AppIcon name="clipboard-list" size={19} />
                        </span>
                        <span className="sda-pl-step-title">{t.pl_step_daily_title}</span>
                        <span className="sda-pl-step-sub">{t.pl_step_daily_sub}</span>
                      </button>

                      <span className="sda-pl-step-arrow" aria-hidden="true">→</span>

                      <button
                        type="button"
                        id="btn-pl-step-weekly-review"
                        className={`sda-pl-step-card ${
                          practiceLoopState.activeStep === 'weekly-review' ? 'is-current' : ''
                        } ${practiceLoopState.weeklyReflectionDoneToday ? 'is-done' : ''}`}
                        aria-current={practiceLoopState.activeStep === 'weekly-review' ? 'step' : undefined}
                        onClick={() => {
                          try {
                            sessionStorage.setItem('pv_initial_tab', 'victories');
                          } catch {
                            // ignore
                          }
                          onNavigate('progress-victories');
                        }}
                      >
                        {practiceLoopState.weeklyReflectionDoneToday && (
                          <span className="sda-pl-step-done-dot" aria-hidden="true">✓</span>
                        )}
                        <span className="sda-pl-step-icon" aria-hidden="true">
                          <AppIcon name="bar-chart" size={19} />
                        </span>
                        <span className="sda-pl-step-title">{t.pl_step_weekly_title}</span>
                        <span className="sda-pl-step-sub">{t.pl_step_weekly_sub}</span>
                      </button>
                    </nav>

                    {/* Prominent Contextual Continue My Journey Action inside Practice Loop */}
                    <button
                      type="button"
                      id="btn-challenge-continue"
                      className="sda-pl-continue-btn"
                      onClick={handleContinueChallenge}
                    >
                      <ContinuePlayEmblemSvg />
                      <span>
                        {(t.pl_continue_journey || 'Continue My Journey (Day {day})').replace(
                          '{day}',
                          String(activeChallenge.currentDay)
                        )}
                      </span>
                    </button>
                  </section>

                  {/* ── CONSOLIDATED CHALLENGE PROGRESS & METRICS (Expandable) ── */}
                  <section className="sda-pl-metrics-card" id="section-current-challenge">
                    <button
                      type="button"
                      id="btn-toggle-challenge-metrics"
                      className={`sda-pl-metrics-head ${isMetricsOpen ? 'is-open' : ''}`}
                      aria-expanded={isMetricsOpen}
                      aria-controls="challenge-metrics-expanded"
                      onClick={() => setIsMetricsOpen((prev) => !prev)}
                    >
                      <span className="sda-pl-metrics-head-left">
                        <span className="sda-pl-metrics-head-icon" aria-hidden="true">
                          <AppIcon name="bar-chart" size={16} />
                        </span>
                        <span className="sda-pl-metrics-head-title">{t.pl_metrics_heading}</span>
                      </span>
                      <AppIcon
                        name="chevron-right"
                        size={16}
                        className="sda-pl-metrics-head-chevron"
                      />
                    </button>

                    {/* Always-visible Factual 4-Box Summary Strip */}
                    <div className="sda-pl-metrics-strip" id="challenge-practice-card">
                      <div className="sda-pl-metric-tile">
                        <span className="sda-pl-metric-icon" aria-hidden="true">
                          <AppIcon name="calendar" size={15} />
                        </span>
                        <span className="sda-pl-metric-val">
                          {practiceStats?.daysCheckedIn || 0}
                          <span className="sda-pl-metric-denom">/{activeChallenge.durationDays}</span>
                        </span>
                        <span className="sda-pl-metric-label">
                          {t.challenge_practice_days_checked || 'Days Checked In'}
                        </span>
                      </div>

                      <div className="sda-pl-metric-tile">
                        <span className="sda-pl-metric-icon" aria-hidden="true">
                          <AppIcon name="check-circle" size={15} />
                        </span>
                        <span className="sda-pl-metric-val">{practiceStats?.totalCheckIns || 0}</span>
                        <span className="sda-pl-metric-label">
                          {t.challenge_practice_total_checkins || 'Total Check-Ins'}
                        </span>
                      </div>

                      <div className="sda-pl-metric-tile">
                        <span className="sda-pl-metric-icon" aria-hidden="true">
                          <AppIcon name="rotate-ccw" size={15} />
                        </span>
                        <span className="sda-pl-metric-val">
                          {activeChallenge.relevantEventCounts.resumedSlips}
                        </span>
                        <span className="sda-pl-metric-label">
                          {t.challenge_resumed_count || 'Resumed'}
                        </span>
                      </div>

                      <div className="sda-pl-metric-tile">
                        <span className="sda-pl-metric-icon" aria-hidden="true">
                          <AppIcon name="target" size={15} />
                        </span>
                        {activeChallenge.relevantEventCounts.eligibleSlips > 0 &&
                        activeChallenge.relevantEventCounts.resumeRate !== null ? (
                          <>
                            <span className="sda-pl-metric-val">
                              {activeChallenge.relevantEventCounts.resumeRate}%
                            </span>
                            <span className="sda-pl-metric-label">
                              {t.challenge_resume_rate || 'Resume Rate'}
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className={`sda-pl-metric-val ${
                                practiceStats?.todayCheckedIn ? 'is-checked' : 'is-empty'
                              }`}
                            >
                              {practiceStats?.todayCheckedIn
                                ? practiceStats.todayLatestStatus === 'on-structure' ||
                                  practiceStats.todayLatestStatus === 'resumed'
                                  ? '✓'
                                  : practiceStats.todayLatestStatus === 'near-slip'
                                  ? '⚡'
                                  : practiceStats.todayLatestStatus === 'off-structure-aware'
                                  ? '◉'
                                  : '↻'
                                : '—'}
                            </span>
                            <span className="sda-pl-metric-label">
                              {t.challenge_practice_today_status || "Today's Status"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expandable Recovery Metrics, Milestones, Timeline & Summary */}
                    <div
                      id="challenge-metrics-expanded"
                      className="sda-pl-metrics-expanded"
                      hidden={!isMetricsOpen}
                    >
                      {celebratedMilestonesList.length > 0 && (
                        <div className="challenge-milestones-row" id="challenge-celebrated-milestones-row">
                          {celebratedMilestonesList.map((m) => (
                            <span
                              key={m.id}
                              className="challenge-milestone-pill"
                              title={(t[m.descKey as keyof typeof t] as string) || ''}
                            >
                              <AppIcon name="award" size={12} />
                              <span>{(t[m.badgeKey as keyof typeof t] as string) || m.id}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="challenge-metrics-card sda-ac-card sda-pl-recovery-subcard">
                        <div className="sda-ac-card-head">
                          <h4 className="challenge-metrics-title">
                            {t.challenge_recovery_metrics || 'Recovery Practice Metrics'}
                          </h4>
                          {activeChallenge.relevantEventCounts.eligibleSlips === 0 && (
                            <span className="challenge-no-slips-hint">
                              <AppIcon name="check-circle" size={12} />
                              <span>{t.challenge_no_slips_yet || 'No Resume opportunities yet'}</span>
                            </span>
                          )}
                        </div>

                        <div className="challenge-metrics-grid">
                          <div className="challenge-metric-box">
                            <span className="metric-box-val">{activeChallenge.relevantEventCounts.eligibleSlips}</span>
                            <span className="metric-box-label">{t.challenge_slips_recorded || 'True Slips'}</span>
                          </div>
                          <div className="challenge-metric-box">
                            <span className="metric-box-val">{activeChallenge.relevantEventCounts.resumedSlips}</span>
                            <span className="metric-box-label">{t.challenge_resumed_count || 'Resumed'}</span>
                          </div>
                          <div className="challenge-metric-box">
                            <span className="metric-box-val metric-box-val--text">
                              {activeChallenge.relevantEventCounts.eligibleSlips > 0 && activeChallenge.relevantEventCounts.resumeRate !== null
                                ? `${activeChallenge.relevantEventCounts.resumeRate}%`
                                : (t.challenge_no_slips_short || 'No slips')}
                            </span>
                            <span className="metric-box-label">{t.challenge_resume_rate || 'Resume Rate'}</span>
                          </div>
                        </div>

                        <div className="challenge-philosophy-banner">
                          <span className="philosophy-icon" aria-hidden="true">
                            <AppIcon name="sparkles" size={15} />
                          </span>
                          <p>
                            {t.challenge_philosophy_quote ||
                              'A Resume-Ability challenge is about practicing recovery and consistency — not perfection. Slips are opportunities to practice Resume-Ability.'}
                          </p>
                        </div>
                      </div>

                      {/* Day-by-day Recovery Timeline (Collapsible) */}
                      <details
                        className="challenge-timeline-collapsible sda-ac-details"
                        id="challenge-timeline-collapsible"
                        open={isTimelineOpen}
                        onToggle={(e) => setIsTimelineOpen((e.currentTarget as HTMLDetailsElement).open)}
                      >
                        <summary className="challenge-timeline-summary">
                          <span className="timeline-summary-title">
                            <span className="sda-ac-collapse-icon">
                              <AppIcon name="calendar" size={14} />
                            </span>
                            <span>
                              {t.challenge_timeline_toggle || 'Daily Recovery Timeline'} ({dayBreakdown.length}{' '}
                              {dayBreakdown.length === 1 ? (t.common_day || 'Day') : (t.common_days || 'Days')})
                            </span>
                          </span>
                          <span className="timeline-summary-chevron" aria-hidden="true">
                            <AppIcon name="chevron-down" size={16} />
                          </span>
                        </summary>
                        <div className="challenge-timeline-list">
                          {dayBreakdown.map((d) => {
                            let iconNode: React.ReactNode = <span className="timeline-dot-upcoming" />;
                            let desc = t.challenge_day_upcoming || 'Upcoming';
                            let rowClass = 'timeline-row timeline-row--upcoming';

                            if (d.isToday) {
                              rowClass = 'timeline-row timeline-row--today';
                              iconNode = <AppIcon name="target" size={14} />;
                              desc = d.hasResumeOpportunity
                                ? `${d.resumedCount}/${d.slipsCount} ${t.challenge_resumed_short || 'resumed'}`
                                : (t.challenge_day_today || 'Today (in progress)');
                            } else if (d.isPast) {
                              if (d.hasResumeOpportunity) {
                                iconNode =
                                  d.resumedCount > 0 ? (
                                    <AppIcon name="rotate-ccw" size={14} />
                                  ) : (
                                    <AppIcon name="zap" size={14} />
                                  );
                                desc = `${d.resumedCount}/${d.slipsCount} ${t.challenge_resumed_short || 'resumed'}`;
                                rowClass =
                                  d.resumedCount > 0
                                    ? 'timeline-row timeline-row--resumed'
                                    : 'timeline-row timeline-row--slip';
                              } else {
                                iconNode = <AppIcon name="check" size={14} />;
                                desc = t.challenge_day_no_slips || 'Completed (on-track)';
                                rowClass = 'timeline-row timeline-row--clean';
                              }
                            }

                            return (
                              <div key={d.dayIndex} className={rowClass}>
                                <div className="timeline-left">
                                  <span className="timeline-icon" aria-hidden="true">{iconNode}</span>
                                  <span className="timeline-day-label">
                                    {t.challenge_day_label || 'Day'} {d.dayIndex}
                                  </span>
                                </div>
                                <div className="timeline-right">
                                  <div className="timeline-date-row">
                                    <span className="timeline-date">{d.dateKey}</span>
                                    {d.checkInsCount && d.checkInsCount > 0 ? (
                                      <span className="timeline-checkin-tag">
                                        ✓ {t.challenge_timeline_checked_in || 'Checked in'}
                                        {d.checkInsCount > 1 ? ` (×${d.checkInsCount})` : ''}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className="timeline-desc">{desc}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>

                      {/* Consolidated Secondary Controls: Challenge Summary & Recommit Focus */}
                      <div className="sda-pl-secondary-controls">
                        <button
                          type="button"
                          id="btn-challenge-summary"
                          className="challenge-control-btn challenge-control-btn--secondary"
                          onClick={() => setShowSummaryModal(true)}
                        >
                          <AppIcon name="clipboard-list" size={15} />
                          <span>{t.challenge_btn_view_summary || 'Challenge Summary'}</span>
                        </button>
                        <button
                          type="button"
                          id="btn-challenge-recommit-focus"
                          className="challenge-control-btn challenge-control-btn--secondary"
                          onClick={handleScrollToRecommit}
                        >
                          <AppIcon name="shield" size={15} />
                          <span>{t.challenge_btn_recommit_focus || 'Recommit Focus'}</span>
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                {/* ── SECONDARY COLUMN: STRUCTURED DIET, NON-NEGOTIABLES, WHY & MOVEMENT ── */}
                <div className="sda-ac-col-secondary">
                  {/* ── COLLAPSIBLE SECTION: TODAY'S STRUCTURED DIET ── */}
                  <section className="control-center-section sda-ac-accordion" id="section-my-structured-diet">
                    <button
                      type="button"
                      id="btn-toggle-challenge-diet"
                      className={`sda-ac-collapse-trigger ${isDietOpen ? 'is-open' : ''}`}
                      aria-expanded={isDietOpen}
                      aria-controls="challenge-diet-accordion-body"
                      onClick={() => setIsDietOpen((prev) => !prev)}
                    >
                      <span className="sda-ac-collapse-left">
                        <span className="sda-ac-collapse-icon">
                          <AppIcon name="utensils" size={15} />
                        </span>
                        <span className="sda-ac-collapse-title">
                          {t.challenge_diet_summary_title || "Today's Structured Diet"}
                        </span>
                      </span>
                      <span className="sda-ac-collapse-right">
                        <span className="sda-ac-collapse-pill">
                          {practiceLoopState.reportedBlocksCount}/{practiceLoopState.plannedBlocksCount}
                        </span>
                        <span className="sda-ac-collapse-chevron" aria-hidden="true">
                          <AppIcon name="chevron-down" size={16} />
                        </span>
                      </span>
                    </button>

                    <div
                      id="challenge-diet-accordion-body"
                      className="sda-ac-accordion-body sda-ac-diet-accordion-body"
                      hidden={!isDietOpen}
                    >
                      <ChallengeDietSummaryCard onNavigate={onNavigate} />
                    </div>
                  </section>

                  {/* ── COLLAPSIBLE SECTION: MY NON-NEGOTIABLES ── */}
                  <section className="control-center-section sda-ac-accordion" id="section-my-non-negotiables">
                    <button
                      type="button"
                      className={`sda-ac-collapse-trigger ${isNnOpen ? 'is-open' : ''}`}
                      aria-expanded={isNnOpen}
                      aria-controls="challenge-nn-card"
                      onClick={() => setIsNnOpen((prev) => !prev)}
                    >
                      <span className="sda-ac-collapse-left">
                        <span className="sda-ac-collapse-icon">
                          <AppIcon name="shield" size={15} />
                        </span>
                        <span className="sda-ac-collapse-title">
                          {t.challenge_section_nn || 'My Non-Negotiables'}
                        </span>
                      </span>
                      <span className="sda-ac-collapse-right">
                        <span className="sda-ac-collapse-pill">
                          {savedNonNegotiables.length}{' '}
                          {savedNonNegotiables.length === 1
                            ? (t.challenge_nn_rule_singular || 'Rule')
                            : (t.challenge_nn_rule_plural || 'Rules')}
                        </span>
                        <span className="sda-ac-collapse-chevron" aria-hidden="true">
                          <AppIcon name="chevron-down" size={16} />
                        </span>
                      </span>
                    </button>

                    <div className="challenge-nn-card sda-ac-accordion-body" id="challenge-nn-card" hidden={!isNnOpen}>
                      {savedNonNegotiables.length > 0 ? (
                        <div className="challenge-nn-content">
                          <div className="challenge-nn-meta-row">
                            <span className="challenge-nn-count-tag">
                              <AppIcon name="shield" size={13} />
                              <span>
                                {savedNonNegotiables.length}{' '}
                                {savedNonNegotiables.length === 1
                                  ? (t.challenge_nn_rule_singular || 'Rule')
                                  : (t.challenge_nn_rule_plural || 'Rules')}
                              </span>
                            </span>
                            <span className="challenge-nn-review-stat">
                              {t.challenge_nn_reviewed_count?.replace('{count}', String(pledge.nonNegotiableReviewCount || 0)) ||
                                `Reviewed ${pledge.nonNegotiableReviewCount || 0} times`}
                            </span>
                          </div>

                          <div className="challenge-nn-list">
                            {savedNonNegotiables.map((rule, idx) => (
                              <div key={idx} className="challenge-nn-item">
                                <span className="challenge-nn-bullet" aria-hidden="true">
                                  {idx + 1}
                                </span>
                                <span className="challenge-nn-rule-text">{rule}</span>
                              </div>
                            ))}
                          </div>

                          <div className="challenge-nn-actions-block">
                            <div className="challenge-nn-recommit-wrap">
                              {hasRecommitted ? (
                                <div className="challenge-recommitted-badge" id="challenge-control-recommitted-badge">
                                  <AppIcon name="check-circle" size={16} />
                                  <span>{t.challenge_nn_recommitted_badge || 'Re-commitment registered!'}</span>
                                </div>
                              ) : (
                                <HoldCommitButton
                                  id="btn-control-recommit-hold"
                                  className="sda-ac-recommit-ritual"
                                  variant="recommit"
                                  icon={<AppIcon name="rotate-ccw" size={22} />}
                                  label={t.challenge_nn_hold_to_recommit || 'HOLD TO RE-COMMIT'}
                                  subLabel={t.challenge_hold_sub_commit || 'PRESS AND HOLD TO COMMIT'}
                                  onComplete={handleHoldRecommit}
                                />
                              )}
                            </div>

                            <button
                              type="button"
                              id="btn-challenge-manage-nn"
                              className="challenge-section-link-btn"
                              onClick={() => {
                                sessionStorage.setItem('commitment_focus', 'nn');
                                onNavigate('commitment');
                              }}
                            >
                              <span>{t.challenge_nn_btn_manage || 'Review & Manage Rules'}</span>
                              <AppIcon name="chevron-right" size={15} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="challenge-nn-empty" id="challenge-nn-empty">
                          <span className="challenge-nn-empty-icon" aria-hidden="true">
                            <AppIcon name="shield" size={22} />
                          </span>
                          <p className="challenge-nn-empty-text">
                            {t.challenge_nn_empty || 'No Non-Negotiables defined yet. Set your personal boundaries to protect your structured eating.'}
                          </p>
                          <button
                            type="button"
                            id="btn-challenge-set-nn"
                            className="challenge-section-cta-btn"
                            onClick={() => {
                              sessionStorage.setItem('commitment_focus', 'nn');
                              onNavigate('commitment');
                            }}
                          >
                            <span>{t.challenge_nn_btn_manage || 'Set Non-Negotiables'}</span>
                            <AppIcon name="chevron-right" size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── COLLAPSIBLE SECTION: WHY I AM DOING THIS ── */}
                  <section className="control-center-section sda-ac-accordion" id="section-why-i-am-doing-this">
                    <button
                      type="button"
                      className={`sda-ac-collapse-trigger ${isWhyOpen ? 'is-open' : ''}`}
                      aria-expanded={isWhyOpen}
                      aria-controls="challenge-why-card"
                      onClick={() => setIsWhyOpen((prev) => !prev)}
                    >
                      <span className="sda-ac-collapse-left">
                        <span className="sda-ac-collapse-icon">
                          <AppIcon name="heart" size={15} />
                        </span>
                        <span className="sda-ac-collapse-title">
                          {t.challenge_section_why || 'Why I Am Doing This'}
                        </span>
                      </span>
                      <span className="sda-ac-collapse-right">
                        <span className="sda-ac-collapse-pill">{savedReasons.length}</span>
                        <span className="sda-ac-collapse-chevron" aria-hidden="true">
                          <AppIcon name="chevron-down" size={16} />
                        </span>
                      </span>
                    </button>

                    <div className="challenge-why-card sda-ac-accordion-body" id="challenge-why-card" hidden={!isWhyOpen}>
                      {savedReasons.length > 0 ? (
                        <div className="challenge-why-content">
                          <div className="challenge-why-list">
                            {savedReasons.map((reason, idx) => (
                              <div key={idx} className="challenge-why-item">
                                <span className="challenge-why-quote-mark" aria-hidden="true">“</span>
                                <p className="challenge-why-text">{reason}</p>
                              </div>
                            ))}
                          </div>
                          <div className="challenge-why-actions">
                            <button
                              type="button"
                              id="btn-challenge-manage-why"
                              className="challenge-section-link-btn"
                              onClick={() => {
                                sessionStorage.setItem('commitment_focus', 'why');
                                onNavigate('commitment');
                              }}
                            >
                              <span>{t.challenge_why_btn_review || 'Review & Edit My Why'}</span>
                              <AppIcon name="chevron-right" size={15} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="challenge-why-empty" id="challenge-why-empty">
                          <span className="challenge-why-empty-icon" aria-hidden="true">
                            <AppIcon name="sparkles" size={22} />
                          </span>
                          <p className="challenge-why-empty-text">
                            {t.challenge_why_empty || "You haven't added your personal Why yet. Adding your reasons provides anchoring during moments of temptation."}
                          </p>
                          <button
                            type="button"
                            id="btn-challenge-add-why"
                            className="challenge-section-cta-btn"
                            onClick={() => {
                              sessionStorage.setItem('commitment_focus', 'why');
                              onNavigate('commitment');
                            }}
                          >
                            <span>{t.challenge_why_btn_add || 'Add My Why'}</span>
                            <AppIcon name="chevron-right" size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── COLLAPSIBLE SECTION: OPTIONAL MOVEMENT & ACTIVITY ── */}
                  <section className="control-center-section challenge-movement-section sda-ac-accordion" id="section-challenge-movement">
                    <button
                      type="button"
                      className={`sda-ac-collapse-trigger ${isMovementOpen ? 'is-open' : ''}`}
                      aria-expanded={isMovementOpen}
                      aria-controls="challenge-movement-card"
                      onClick={() => setIsMovementOpen((prev) => !prev)}
                    >
                      <span className="sda-ac-collapse-left">
                        <span className="sda-ac-collapse-icon">
                          <AppIcon name="footprints" size={15} />
                        </span>
                        <span className="sda-ac-collapse-title">
                          {t.act_challenge_section_title}
                        </span>
                      </span>
                      <span className="sda-ac-collapse-right">
                        <span className="sda-ac-collapse-pill">
                          <span className="challenge-movement-count-badge" id="challenge-activity-count">
                            {challengeActivityCount}
                          </span>
                        </span>
                        <span className="sda-ac-collapse-chevron" aria-hidden="true">
                          <AppIcon name="chevron-down" size={16} />
                        </span>
                      </span>
                    </button>

                    <div className="challenge-movement-card sda-ac-accordion-body" id="challenge-movement-card" hidden={!isMovementOpen}>
                      <p className="challenge-movement-desc">
                        {t.act_challenge_section_desc}
                      </p>

                      <div className="challenge-movement-count-row">
                        <span className="challenge-movement-count-label">
                          {t.act_screen_title}
                        </span>
                        <span className="challenge-movement-count-value">
                          {challengeActivityCount} {t.act_challenge_linked_count}
                        </span>
                      </div>

                      <div className="challenge-movement-actions">
                        <button
                          type="button"
                          id="btn-challenge-view-activities"
                          className="challenge-section-link-btn challenge-movement-btn-view"
                          onClick={() => onNavigate('activity-log')}
                        >
                          <span>{t.act_challenge_btn_view}</span>
                          <AppIcon name="chevron-right" size={15} />
                        </button>
                        <button
                          type="button"
                          id="btn-challenge-add-activity"
                          className="challenge-section-cta-btn challenge-movement-btn-add"
                          onClick={() => {
                            try {
                              sessionStorage.setItem('activity_log_open_modal', 'true');
                            } catch {
                              // ignore
                            }
                            onNavigate('activity-log');
                          }}
                        >
                          <AppIcon name="plus" size={14} />
                          <span>{t.act_btn_record}</span>
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Contextual Links: Seven Diet-Abilities & My Progress & Victories */}
                  <div className="sda-ac-links-grid">
                    <button
                      type="button"
                      id="btn-challenges-seven-abilities-link"
                      className="challenge-seven-abilities-link-btn"
                      onClick={() => onNavigate('seven-abilities')}
                    >
                      <span className="sda-ac-link-icon">
                        <AppIcon name="layers" size={16} />
                      </span>
                      <span className="sda-ac-link-label">
                        {t.seven_abilities_challenge_link || 'Explore the Seven Diet-Abilities →'}
                      </span>
                      <AppIcon name="chevron-right" size={15} />
                    </button>

                    <button
                      type="button"
                      id="btn-challenge-view-victories"
                      className="challenge-seven-abilities-link-btn"
                      onClick={() => onNavigate('progress-victories')}
                    >
                      <span className="sda-ac-link-icon">
                        <AppIcon name="award" size={16} />
                      </span>
                      <span className="sda-ac-link-label">
                        {t.challenge_btn_view_victories || 'My Progress & Victories →'}
                      </span>
                      <AppIcon name="chevron-right" size={15} />
                    </button>
                  </div>

                  {/* Cancel Challenge Option */}
                  <div className="challenge-actions-row">
                    <button
                      type="button"
                      id="btn-cancel-challenge-initiate"
                      className="challenge-cancel-link"
                      onClick={() => setShowCancelModal(true)}
                    >
                      {t.challenge_btn_cancel || 'Cancel Challenge'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : completedChallengeToSummarize ? (
            /* ── CHALLENGE COMPLETION EXPERIENCE (Phase 3 Midnight Emerald) ── */
            <div className="challenges-completion-view sda-completion-view" id="challenges-completion-view">
              <div className="challenge-completion-card sda-completion-card">
                <div className="completion-card-badge-row">
                  <span className="completion-card-pill">
                    <AppIcon name="trophy" size={13} />
                    <span>{t.challenge_status_completed || 'Completed'}</span>
                  </span>
                  <span className="completion-card-duration">
                    {completedChallengeToSummarize.durationDays}{' '}
                    {completedChallengeToSummarize.durationDays === 1
                      ? (t.common_day || 'Day')
                      : (t.common_days || 'Days')}
                  </span>
                </div>

                <h2 className="completion-card-title">
                  {t.challenge_completion_summary_title || 'Challenge Completed!'}
                </h2>

                <p className="completion-card-ability">
                  {getCanonicalAbilityName(completedChallengeToSummarize.abilityId)}
                </p>

                <div className="completion-card-dates">
                  <AppIcon name="calendar" size={13} />
                  <span>{completedChallengeToSummarize.startDate} → {completedChallengeToSummarize.endDate}</span>
                </div>

                <div className="completion-card-stats-grid">
                  <div className="completion-stat-box">
                    <span className="stat-label">{t.challenge_completion_practice_consistency || 'Practice Consistency'}</span>
                    <span className="stat-val">
                      {getDistinctPracticeDays(completedChallengeToSummarize)} / {completedChallengeToSummarize.durationDays}
                    </span>
                    <span className="stat-sub">{t.common_days || 'days checked in'}</span>
                  </div>

                  <div className="completion-stat-box">
                    <span className="stat-label">{t.challenge_completion_total_checkins || 'Total Check-Ins'}</span>
                    <span className="stat-val">
                      {completedChallengeToSummarize.totalCheckInsCount ?? (completedChallengeToSummarize.checkIns ? completedChallengeToSummarize.checkIns.length : 0)}
                    </span>
                    <span className="stat-sub">{t.challenge_timeline_checked_in || 'check-ins recorded'}</span>
                  </div>

                  <div className="completion-stat-box">
                    <span className="stat-label">{t.challenge_completion_verified_recoveries || 'Verified Recoveries'}</span>
                    <span className="stat-val">
                      {(completedChallengeToSummarize.relevantEventCounts?.eligibleSlips || 0) > 0
                        ? `${completedChallengeToSummarize.relevantEventCounts?.resumedSlips || 0} / ${completedChallengeToSummarize.relevantEventCounts?.eligibleSlips || 0}`
                        : '0'}
                    </span>
                    <span className="stat-sub">
                      {(completedChallengeToSummarize.relevantEventCounts?.eligibleSlips || 0) > 0 && completedChallengeToSummarize.relevantEventCounts?.resumeRate !== null
                        ? `${completedChallengeToSummarize.relevantEventCounts.resumeRate}% ${t.challenge_resume_rate?.toLowerCase() || 'resume rate'}`
                        : (t.challenge_completion_no_slips || 'No eligible slips recorded')}
                    </span>
                  </div>
                </div>

                <div className="completion-philosophy-notice">
                  <span className="completion-notice-icon" aria-hidden="true">
                    <AppIcon name="shield" size={18} />
                  </span>
                  <p className="completion-notice-text">
                    {t.challenge_completion_period_notice || 'You completed your Challenge duration! Completing a challenge is about practicing awareness and consistency — not about flawless perfection or fearing slips.'}
                  </p>
                </div>

                <div className="completion-actions-row">
                  <button
                    id="btn-completion-review"
                    type="button"
                    className="completion-btn-secondary"
                    onClick={() => setViewTab('history')}
                  >
                    <AppIcon name="history" size={16} />
                    <span>{t.challenge_completion_btn_review || 'Review My Challenge'}</span>
                  </button>

                  <button
                    id="btn-completion-start-new"
                    type="button"
                    className="completion-btn-primary"
                    onClick={() => setShowingStartWizard(true)}
                  >
                    <AppIcon name="zap" size={16} />
                    <span>{t.challenge_completion_btn_start_new || 'Start a New Challenge'}</span>
                    <AppIcon name="chevron-right" size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── START CHALLENGE WIZARD (Phase 2 Premium Redesign) ── */
            <div className="challenges-wizard-view sda-ch-wizard">
              {latestCompletedChallenge && (
                <button
                  type="button"
                  className="wizard-back-completion-link sda-ch-back-summary"
                  onClick={() => setShowingStartWizard(false)}
                >
                  {t.challenge_completion_back_summary || '← Back to Completion Summary'}
                </button>
              )}

              {/* Cinematic Challenge Introduction Card */}
              <section className="wizard-intro-card sda-ch-hero-card" aria-labelledby="sda-ch-hero-heading">
                <img
                  src="/images/hero-atmosphere.jpg"
                  alt=""
                  aria-hidden="true"
                  className="sda-ch-hero-img"
                />
                <div className="sda-ch-hero-scrim" aria-hidden="true" />
                <div className="sda-ch-hero-content">
                  <span className="sda-ch-hero-eyebrow">
                    {t.challenge_hero_eyebrow || 'YOUR NEXT'}
                  </span>
                  <h2 id="sda-ch-hero-heading" className="wizard-intro-title sda-ch-hero-title">
                    {(t.challenge_hero_title || 'CHALLENGE\nSTARTS HERE.')
                      .split('\n')
                      .map((line, idx, arr) => (
                        <React.Fragment key={idx}>
                          {line}
                          {idx < arr.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                  </h2>
                  <span className="sda-ch-hero-bar" aria-hidden="true" />
                  <p className="wizard-intro-body sda-ch-hero-body">
                    {t.challenge_hero_body ||
                      'Practice consistency, recover from slips, and build your Super Diet-Ability.'}
                  </p>
                </div>
              </section>

              <div className="sda-ch-wizard-grid">
                <div className="sda-ch-col-setup">
                  {/* Step 01: Choose Ability */}
                  <section className="wizard-step sda-ch-section" aria-labelledby="heading-choose-ability">
                    <h3 id="heading-choose-ability" className="wizard-step-title sda-ch-step-heading">
                      <span className="step-num sda-ch-step-badge">01</span>
                      <span>{t.challenge_step_ability || 'Choose Ability'}</span>
                    </h3>

                    {/* Prominent Selected Resume-Ability Card */}
                    <button
                      type="button"
                      id="card-ability-resume-ability"
                      className={`ability-select-card sda-ch-ability-featured ${
                        selectedAbility === RESUME_ABILITY_CHALLENGE_DEFINITION.abilityId
                          ? 'ability-select-card--selected'
                          : ''
                      }`}
                      onClick={() => setSelectedAbility(RESUME_ABILITY_CHALLENGE_DEFINITION.abilityId)}
                      aria-pressed={selectedAbility === RESUME_ABILITY_CHALLENGE_DEFINITION.abilityId}
                    >
                      <span className="sda-ch-ability-icon" aria-hidden="true">
                        <AppIcon name="layers" size={24} />
                      </span>

                      <span className="sda-ch-ability-body">
                        <span className="sda-ch-ability-top">
                          <span className="ability-card-name sda-ch-ability-name">
                            {RESUME_ABILITY_CHALLENGE_DEFINITION.canonicalName}
                          </span>
                          <span className="sda-ch-available-pill">
                            {t.challenge_available_now || 'AVAILABLE NOW'}
                          </span>
                        </span>
                        <span className="ability-card-desc sda-ch-ability-desc">
                          {t.challenge_resume_ability_brief ||
                            'Build psychological resilience by recovering immediately whenever life drifts.'}
                        </span>
                      </span>

                      <span className="sda-ch-ability-check" aria-hidden="true">
                        <AppIcon name="check" size={16} strokeWidth={3} />
                      </span>
                    </button>

                    {/* Compact Expandable 6 Coming Soon Abilities */}
                    <div className="sda-ch-more-wrap">
                      <button
                        type="button"
                        id="btn-toggle-coming-soon-abilities"
                        className={`sda-ch-more-toggle ${showMoreAbilities ? 'sda-ch-more-toggle--open' : ''}`}
                        onClick={() => setShowMoreAbilities((prev) => !prev)}
                        aria-expanded={showMoreAbilities}
                        aria-controls="panel-coming-soon-abilities"
                      >
                        <span className="sda-ch-more-left">
                          <span className="sda-ch-cluster-wrap" aria-hidden="true">
                            <AbilityClusterSvg />
                          </span>
                          <span className="sda-ch-more-label">
                            {t.challenge_more_abilities_label || '6 more Diet-Abilities'}
                          </span>
                        </span>

                        <span className="sda-ch-more-right">
                          <span className="sda-ch-coming-pill">
                            {(t.challenge_coming_soon || 'Coming Soon').toUpperCase()}
                          </span>
                          <span className="sda-ch-more-chevron" aria-hidden="true">
                            <AppIcon name="chevron-down" size={16} />
                          </span>
                        </span>
                      </button>

                      {showMoreAbilities && (
                        <div id="panel-coming-soon-abilities" className="sda-ch-more-panel">
                          <div className="ability-selector-grid sda-ch-coming-list">
                            {comingSoonAbilities.map((def, idx) => {
                              const canonicalIndex = idx + 2;
                              const localizedDesc =
                                (t[def.descriptionKey as keyof typeof t] as string) || '';
                              return (
                                <button
                                  key={def.id}
                                  type="button"
                                  id={`card-ability-${def.id}`}
                                  className="ability-select-card ability-select-card--disabled sda-ch-coming-card"
                                  disabled
                                >
                                  <div className="ability-card-top sda-ch-coming-card-top">
                                    <span className="sda-ch-coming-title-group">
                                      <span className="sda-ch-coming-num">0{canonicalIndex}</span>
                                      <span className="ability-card-name sda-ch-coming-name">
                                        {def.canonicalName}
                                      </span>
                                    </span>
                                    <span className="ability-coming-soon sda-ch-coming-badge">
                                      {t.challenge_coming_soon || 'Coming Soon'}
                                    </span>
                                  </div>
                                  {localizedDesc && (
                                    <p className="ability-card-desc sda-ch-coming-desc">
                                      {localizedDesc}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="wizard-seven-abilities-link-wrap sda-ch-explore-wrap">
                            <button
                              type="button"
                              id="btn-wizard-seven-abilities-link"
                              className="wizard-seven-abilities-link-btn sda-ch-explore-btn"
                              onClick={() => onNavigate('seven-abilities')}
                            >
                              <AppIcon name="layers" size={16} />
                              <span>
                                {t.seven_abilities_challenge_link || 'Explore the Seven Diet-Abilities →'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Step 02: Choose Duration */}
                  <section className="wizard-step sda-ch-section" aria-labelledby="heading-choose-duration">
                    <h3 id="heading-choose-duration" className="wizard-step-title sda-ch-step-heading">
                      <span className="step-num sda-ch-step-badge">02</span>
                      <span>{t.challenge_step_duration || 'Choose Duration'}</span>
                    </h3>
                    <div className="duration-selector-row sda-ch-duration-grid">
                      {RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations.map((d) => {
                        const isSelected = selectedDuration === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            id={`btn-duration-${d}`}
                            className={`duration-pill-btn sda-ch-duration-card ${
                              isSelected ? 'duration-pill-btn--selected sda-ch-duration-card--selected' : ''
                            }`}
                            onClick={() => setSelectedDuration(d)}
                            aria-pressed={isSelected}
                          >
                            <span className="duration-pill-num sda-ch-duration-num">{d}</span>
                            <span className="duration-pill-label sda-ch-duration-unit">
                              {(d === 1 ? (t.common_day || 'Day') : (t.common_days || 'Days')).toUpperCase()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Compact Challenge Reminders Control (Phase 41B Preserved) */}
                  <section className="wizard-step sda-ch-section" aria-labelledby="label-challenge-reminders">
                    <div
                      className={`challenge-reminders-card sda-ch-reminders-card ${
                        remindersEnabled ? 'sda-ch-reminders-card--open' : ''
                      }`}
                    >
                      <div className="sda-ch-reminders-row">
                        <span className="sda-ch-reminders-bell" aria-hidden="true">
                          <AppIcon name="bell" size={22} />
                        </span>

                        <div className="sda-ch-reminders-copy">
                          <span id="label-challenge-reminders" className="sda-ch-reminders-title">
                            {t.challenge_reminders_toggle_label || 'Challenge Reminders'}
                          </span>
                          <span className="sda-ch-reminders-sub">
                            {t.challenge_reminders_compact_desc ||
                              'Get gentle reminders to check in and stay on track.'}
                          </span>
                        </div>

                        <label className="sda-ch-switch" htmlFor="toggle-challenge-reminders">
                          <input
                            id="toggle-challenge-reminders"
                            type="checkbox"
                            role="switch"
                            aria-checked={remindersEnabled}
                            aria-labelledby="label-challenge-reminders"
                            className="reminders-toggle-input sda-ch-switch-input"
                            checked={remindersEnabled}
                            onChange={(e) => setRemindersEnabled(e.target.checked)}
                          />
                          <span
                            className={`sda-ch-switch-track ${
                              remindersEnabled ? 'sda-ch-switch-track--on' : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className="sda-ch-switch-knob" />
                            <span className="sda-ch-switch-state">
                              {remindersEnabled
                                ? (t.challenge_reminders_on || 'On')
                                : (t.challenge_reminders_off_short || 'Off')}
                            </span>
                          </span>
                        </label>
                      </div>

                      {remindersEnabled && (
                        <div className="reminders-controls sda-ch-reminders-expanded">
                          <div className="reminders-freq-label">
                            {t.challenge_reminders_frequency_label || 'How often?'}
                          </div>
                          <div className="reminders-freq-grid">
                            <button
                              type="button"
                              id="btn-freq-1x"
                              className={`reminders-freq-btn ${
                                reminderFrequency === '1x' ? 'reminders-freq-btn--selected' : ''
                              }`}
                              onClick={() => handleFrequencyChange('1x')}
                            >
                              {t.challenge_reminders_freq_1x || 'Once a day'}
                            </button>
                            <button
                              type="button"
                              id="btn-freq-2x"
                              className={`reminders-freq-btn ${
                                reminderFrequency === '2x' ? 'reminders-freq-btn--selected' : ''
                              }`}
                              onClick={() => handleFrequencyChange('2x')}
                            >
                              {t.challenge_reminders_freq_2x || 'Twice a day'}
                            </button>
                            <button
                              type="button"
                              id="btn-freq-3x"
                              className={`reminders-freq-btn ${
                                reminderFrequency === '3x' ? 'reminders-freq-btn--selected' : ''
                              }`}
                              onClick={() => handleFrequencyChange('3x')}
                            >
                              {t.challenge_reminders_freq_3x || 'Three times a day'}
                            </button>
                            <button
                              type="button"
                              id="btn-freq-custom"
                              className={`reminders-freq-btn ${
                                reminderFrequency === 'custom' ? 'reminders-freq-btn--selected' : ''
                              }`}
                              onClick={() => handleFrequencyChange('custom')}
                            >
                              {t.challenge_reminders_freq_custom || 'Custom'}
                            </button>
                          </div>

                          <div className="reminders-times-label">
                            {t.challenge_reminders_times_label || 'Reminder Times'}
                          </div>
                          <div className="reminders-times-list">
                            {reminderTimes.map((time, idx) => (
                              <div key={idx} className="reminder-time-row">
                                <span className="reminder-time-index">#{idx + 1}</span>
                                <input
                                  type="time"
                                  id={`input-reminder-time-${idx}`}
                                  className="reminder-time-input"
                                  value={time}
                                  onChange={(e) => handleTimeChange(idx, e.target.value)}
                                />
                                {reminderFrequency === 'custom' && reminderTimes.length > 1 && (
                                  <button
                                    type="button"
                                    className="reminder-time-remove-btn"
                                    onClick={() => handleRemoveCustomTime(idx)}
                                  >
                                    {t.challenge_reminders_remove_time || 'Remove'}
                                  </button>
                                )}
                              </div>
                            ))}
                            {reminderFrequency === 'custom' && reminderTimes.length < 6 && (
                              <button
                                type="button"
                                id="btn-add-reminder-time"
                                className="reminder-time-add-btn"
                                onClick={handleAddCustomTime}
                              >
                                {t.challenge_reminders_add_time || '+ Add Time'}
                              </button>
                            )}
                          </div>

                          <p className="reminders-notice">
                            {t.challenge_reminders_delivery_note ||
                              'Notification delivery can be enabled after your Challenge starts.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Challenge Commitment & Glowing Hold-to-Start Ritual */}
                <div className="sda-ch-col-commit">
                  <section
                    className="wizard-review-card sda-ch-commitment-card"
                    aria-labelledby="heading-challenge-commitment"
                  >
                    <div className="sda-ch-commit-head">
                      <span className="sda-ch-commit-icon" aria-hidden="true">
                        <AppIcon name="clipboard-list" size={20} />
                      </span>
                      <h3 id="heading-challenge-commitment" className="wizard-review-title sda-ch-commit-title">
                        {t.challenge_review_heading || 'Challenge Commitment'}
                      </h3>
                    </div>

                    <div className="wizard-review-details sda-ch-summary-strip">
                      <div className="review-detail-row sda-ch-summary-item">
                        <span className="detail-label">
                          {t.challenge_selected_ability || 'Ability'}:
                        </span>
                        <span className="detail-val">
                          {RESUME_ABILITY_CHALLENGE_DEFINITION.canonicalName}
                        </span>
                      </div>
                      <div className="review-detail-row sda-ch-summary-item">
                        <span className="detail-label">
                          {t.challenge_selected_duration || 'Duration'}:
                        </span>
                        <span className="detail-val">
                          {selectedDuration}{' '}
                          {selectedDuration === 1 ? (t.common_day || 'Day') : (t.common_days || 'Days')}
                        </span>
                      </div>
                      <div className="review-detail-row sda-ch-summary-item">
                        <span className="detail-label">
                          {t.challenge_reminders_short_label || 'Reminders'}:
                        </span>
                        <span className="detail-val">
                          {remindersEnabled
                            ? `${reminderTimes.length}x (${reminderTimes.join(', ')})`
                            : (t.challenge_reminders_off || 'Off')}
                        </span>
                      </div>
                    </div>

                    <div className="wizard-safety-notice sda-ch-rule-box">
                      <span className="sda-ch-rule-icon" aria-hidden="true">
                        i
                      </span>
                      <p className="sda-ch-rule-text">
                        <strong>{t.challenge_important_note || 'Important Rule'}:</strong>{' '}
                        {t.challenge_rule_explanation ||
                          'This challenge is about practicing Resume-Ability — not avoiding every slip. When an unexpected situation happens, your practice is to report it honestly and resume your structured eating.'}
                      </p>
                    </div>

                    <div className="wizard-hold-container sda-ch-hold-stage">
                      <div className="sda-ch-hold-waves" aria-hidden="true">
                        <EnergyWaveSvg side="left" />
                        <EnergyWaveSvg side="right" />
                      </div>
                      <HoldCommitButton
                        variant="commit"
                        className="sda-ch-hold-ritual"
                        label={t.challenge_hold_to_start || 'HOLD TO START CHALLENGE'}
                        holdingLabel={t.challenge_starting || 'STARTING CHALLENGE...'}
                        subLabel={t.challenge_hold_sub_commit || 'PRESS AND HOLD TO COMMIT'}
                        icon={<GoldenBoltSvg />}
                        onComplete={handleStartChallenge}
                        id="btn-hold-start-challenge"
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Cancellation Confirmation Modal ── */}
      {showCancelModal && (
        <div className="challenge-modal-backdrop" role="dialog" aria-modal="true">
          <div className="challenge-modal-card">
            <h3 className="challenge-modal-title">
              {t.challenge_cancel_modal_title || 'Cancel Active Challenge?'}
            </h3>
            <p className="challenge-modal-body">
              {t.challenge_cancel_modal_body ||
                'Cancelling will archive this challenge in your history. You can take on a new challenge whenever you are ready.'}
            </p>
            <div className="challenge-modal-actions">
              <button
                id="btn-cancel-challenge-confirm"
                className="modal-btn modal-btn--danger"
                onClick={handleConfirmCancel}
              >
                {t.challenge_confirm_cancel || 'Yes, Cancel Challenge'}
              </button>
              <button
                id="btn-cancel-challenge-keep"
                className="modal-btn modal-btn--secondary"
                onClick={() => setShowCancelModal(false)}
              >
                {t.challenge_keep_challenge || 'Keep Challenge Active'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Web Push Pre-Permission Modal (Phase 41D) ── */}
      {showPermissionModal && (
        <div className="challenge-push-modal-overlay" role="dialog" aria-modal="true">
          <div className="challenge-push-modal">
            <div className="challenge-push-modal-icon" aria-hidden="true">
              <AppIcon name="bell" size={24} />
            </div>
            <h3 className="challenge-push-modal-title">
              {t.challenge_push_modal_title || 'STAY CONNECTED TO YOUR STRUCTURE'}
            </h3>
            <p className="challenge-push-modal-body">
              {t.challenge_push_modal_body || 'SDA can send gentle check-in reminders during your Challenge to help you pause, reconnect, and recommit.'}
            </p>
            <div className="challenge-push-modal-actions">
              <button
                id="btn-modal-enable-push"
                className="challenge-push-modal-btn-confirm"
                onClick={handleEnablePush}
                disabled={isEnablingPush}
              >
                {isEnablingPush ? '...' : (t.challenge_push_btn_enable || 'ENABLE NOTIFICATIONS')}
              </button>
              <button
                id="btn-modal-skip-push"
                className="challenge-push-modal-btn-skip"
                onClick={() => setShowPermissionModal(false)}
              >
                {t.challenge_push_modal_skip || 'SKIP FOR NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Challenge Check-In Modal (Phase 41E / Phase 5A) ── */}
      {activeChallenge && activeChallenge.status === 'active' && (
        <ChallengeCheckInModal
          isOpen={showCheckInModal}
          challenge={activeChallenge}
          initialStatus={checkInInitialStatus}
          onClose={() => {
            setShowCheckInModal(false);
            setCheckInInitialStatus(null);
          }}
          onNavigate={onNavigate}
          onCheckInCompleted={refreshState}
          onRecommitCompleted={() => {
            setShowCheckInModal(false);
            setCheckInInitialStatus(null);
            refreshState();
            setShowNextActionModal(true);
          }}
        />
      )}

      {/* ── Premium Next Action After Recommit (Phase 5) ── */}
      <NextActionModal
        isOpen={showNextActionModal}
        onClose={() => setShowNextActionModal(false)}
        onNavigate={onNavigate}
        currentScreen="challenges"
      />

      {/* ── Challenge Milestone Celebration Modal (Phase 41H) ── */}
      {activeModalMilestone && milestoneTargetChallenge && (
        <ChallengeMilestoneModal
          milestone={activeModalMilestone}
          challenge={milestoneTargetChallenge}
          onDismiss={handleDismissModalMilestone}
          onReviewChallenge={() => {
            handleDismissModalMilestone();
            setViewTab('history');
          }}
        />
      )}
      {/* ── Active Challenge Welcome Summary Modal (Phase 44) ── */}
      {showSummaryModal && activeChallenge && activeChallenge.status === 'active' && (
        <ActiveChallengeWelcomeModal
          isOpen={showSummaryModal}
          challenge={activeChallenge}
          practiceStats={practiceStats || undefined}
          onClose={() => setShowSummaryModal(false)}
          onContinue={() => {
            setShowSummaryModal(false);
            handleContinueChallenge();
          }}
          isManualOpen={true}
        />
      )}

      {/* ── Phase 5B.1: 90-Day Milestone Review Modal ── */}
      {reviewingMilestoneDay !== null && ninetyDayJourney.isActive && (
        <div
          className="challenge-modal-backdrop sda-j90-ms-modal-backdrop"
          onClick={() => setReviewingMilestoneDay(null)}
          role="presentation"
        >
          <div
            id="modal-90day-milestone-review"
            className="sda-j90-ms-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="heading-j90-ms-modal"
          >
            <div className="sda-j90-ms-modal-head">
              <div className="sda-j90-ms-modal-title-group">
                <span className="sda-j90-ms-modal-pill">
                  {t.journey90_day_of_90.replace('{day}', String(reviewingMilestoneDay))}
                </span>
                <h3 id="heading-j90-ms-modal" className="sda-j90-ms-modal-title">
                  {t.journey90_ms_modal_title.replace('{day}', String(reviewingMilestoneDay))}
                </h3>
              </div>
              <button
                type="button"
                id="btn-close-j90-ms-modal"
                className="sda-j90-ms-modal-close"
                aria-label={t.journey90_cancel_btn}
                onClick={() => setReviewingMilestoneDay(null)}
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>

            <p className="sda-j90-ms-modal-sub">{t.journey90_ms_modal_sub}</p>

            <form className="sda-j90-ms-form" onSubmit={handleSaveMilestoneReview}>
              <label htmlFor="textarea-j90-ms-helped" className="sda-j90-ms-field-label">
                {t.journey90_ms_prompt_label}
              </label>
              <textarea
                id="textarea-j90-ms-helped"
                className="sda-j90-ms-textarea"
                rows={3}
                maxLength={500}
                placeholder={t.journey90_ms_prompt_placeholder}
                value={msWhatHelped}
                onChange={(e) => setMsWhatHelped(e.target.value)}
              />

              <span className="sda-j90-ms-field-label">{t.journey90_ms_decision_label}</span>
              <div className="sda-j90-ms-decision-grid" role="radiogroup" aria-label={t.journey90_ms_decision_label}>
                <button
                  type="button"
                  id="btn-j90-decision-continue"
                  role="radio"
                  aria-checked={msDecision === 'continue'}
                  className={`sda-j90-ms-decision-btn ${msDecision === 'continue' ? 'is-selected' : ''}`}
                  onClick={() => setMsDecision('continue')}
                >
                  <AppIcon name="check-circle" size={15} />
                  <span>{t.journey90_ms_decision_continue}</span>
                </button>
                <button
                  type="button"
                  id="btn-j90-decision-adjust"
                  role="radio"
                  aria-checked={msDecision === 'adjust'}
                  className={`sda-j90-ms-decision-btn ${msDecision === 'adjust' ? 'is-selected' : ''}`}
                  onClick={() => setMsDecision('adjust')}
                >
                  <AppIcon name="utensils" size={15} />
                  <span>{t.journey90_ms_decision_adjust}</span>
                </button>
              </div>

              <div className="sda-j90-ms-modal-actions">
                <button
                  type="submit"
                  id="btn-submit-j90-ms-review"
                  className="sda-j90-ms-submit-btn"
                >
                  <AppIcon name="check" size={16} />
                  <span>{t.journey90_ms_submit_btn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
