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
  ChallengeInstance,
  ChallengeDurationDays,
  ChallengeAbilityId,
  ChallengeReminderFrequency,
  ChallengeMilestoneMetadata,
  CHALLENGE_DEFINITIONS,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
} from '../challenges';
import { HoldCommitButton } from '../components/HoldCommitButton';
import { ChallengeCheckInModal } from '../components/ChallengeCheckInModal';
import { ChallengeDietSummaryCard } from '../components/ChallengeDietSummaryCard';
import { ChallengeMilestoneModal } from '../components/ChallengeMilestoneModal';
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
import './ChallengesScreen.css';

interface ChallengesScreenProps {
  onNavigate: (screen: any) => void;
  onBack: () => void;
}

export const ChallengesScreen: React.FC<ChallengesScreenProps> = ({ onNavigate, onBack }) => {
  const { t } = useTranslation();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInstance | null>(null);
  const [history, setHistory] = useState<ChallengeInstance[]>([]);
  const [viewTab, setViewTab] = useState<'challenge' | 'history'>('challenge');

  // Start wizard state
  const [selectedAbility, setSelectedAbility] = useState<ChallengeAbilityId>('resume-ability');
  const [selectedDuration, setSelectedDuration] = useState<ChallengeDurationDays>(7);

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

  // Phase 41E: Challenge Check-In Modal state
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Phase 41G: Daily Challenge Control Center state
  const [pledge, setPledge] = useState(() => loadPledge());
  const [hasRecommitted, setHasRecommitted] = useState(false);
  const [continueToast, setContinueToast] = useState<string | null>(null);

  // Phase 41H.4: Completion view state
  const [showingStartWizard, setShowingStartWizard] = useState(false);

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

  const refreshState = () => {
    const current = syncCurrentChallenge();
    setActiveChallenge(current);
    setHistory(getChallengeHistory());
    setPushStatus(getPushDeliveryStatus());
    setPledge(loadPledge());
  };

  useEffect(() => {
    refreshState();
    const handleUpdate = () => {
      refreshState();
      setActivityRefreshKey((k) => k + 1);
    };
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
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
  };

  const handleContinueChallenge = () => {
    playFeedback('win');
    setContinueToast(t.challenge_checkin_win_desc || 'Consistency is your superpower! Keep going.');
    setTimeout(() => {
      setContinueToast(null);
    }, 3500);
  };

  const handleScrollToRecommit = () => {
    const el = document.getElementById('section-my-non-negotiables');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
            setShowCheckInModal(true);
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
        setShowCheckInModal(true);
      }
    };

    window.addEventListener(OPEN_CHALLENGE_CHECKIN_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_CHALLENGE_CHECKIN_EVENT, handleOpenEvent);
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

  const savedReasons = (pledge.reasons || []).filter(
    (r) => typeof r === 'string' && r.trim().length > 0
  );
  const savedNonNegotiables = (pledge.nonNegotiables || []).filter(
    (n) => typeof n === 'string' && n.trim().length > 0
  );

  return (
    <div className="challenges-screen">
      {/* ── Header ── */}
      <header className="challenges-header">
        <button
          id="btn-challenges-back"
          className="challenges-back-btn"
          onClick={onBack}
          aria-label={t.common_back || 'Back'}
        >
          ← {t.common_back || 'Back'}
        </button>
        <h1 className="challenges-title">
          {activeChallenge && activeChallenge.status === 'active'
            ? (t.challenge_control_center_title || 'Daily Challenge Control Center')
            : (t.challenge_screen_title || 'Ability Challenges')}
        </h1>
        <div className="challenges-tabs">
          <button
            id="tab-challenge-active"
            className={`challenges-tab-btn ${viewTab === 'challenge' ? 'challenges-tab-btn--active' : ''}`}
            onClick={() => setViewTab('challenge')}
          >
            {activeChallenge && activeChallenge.status === 'active'
              ? (t.challenge_tab_current || 'Active Challenge')
              : (t.challenge_tab_start || 'New Challenge')}
          </button>
          <button
            id="tab-challenge-history"
            className={`challenges-tab-btn ${viewTab === 'history' ? 'challenges-tab-btn--active' : ''}`}
            onClick={() => setViewTab('history')}
          >
            {t.challenge_tab_history || 'History'} {history.length > 0 && `(${history.length})`}
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="challenge-error-notice" role="alert">
          <span>⚠️ {errorMessage}</span>
          <button className="challenge-error-dismiss" onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      {/* ── View Tab: History ── */}
      {viewTab === 'history' && (
        <div className="challenges-history-view">
          <h2 className="challenges-section-heading">
            {t.challenge_history_heading || 'Challenge History'}
          </h2>
          {history.length === 0 ? (
            <div className="challenge-history-empty">
              <span className="challenge-empty-icon">📜</span>
              <p>{t.challenge_history_empty || 'No previous challenges yet. Take on your first challenge today!'}</p>
            </div>
          ) : (
            <div className="challenges-history-list">
              {history.map((item) => {
                const isCompleted = item.status === 'completed';
                const isCancelled = item.status === 'cancelled';
                const abilityName = getCanonicalAbilityName(item.abilityId);
                const distinctDays = getDistinctPracticeDays(item);
                const totalCheckIns = item.totalCheckInsCount ?? (item.checkIns ? item.checkIns.length : 0);
                const eligibleSlips = item.relevantEventCounts?.eligibleSlips || 0;
                const resumedSlips = item.relevantEventCounts?.resumedSlips || 0;
                const resumeRate = item.relevantEventCounts?.resumeRate;

                // Factual recovery rate: strictly no percentage if no eligible slips
                const rateText = eligibleSlips > 0 && resumeRate !== null
                  ? `${resumedSlips} / ${eligibleSlips} (${resumeRate}%)`
                  : (t.challenge_completion_no_slips || 'No eligible slips recorded');

                // Earned milestone badges for completed challenges only
                const earnedBadges = isCompleted
                  ? CHALLENGE_MILESTONE_DEFINITIONS.filter((m) =>
                      (item.celebratedMilestones && item.celebratedMilestones.includes(m.id)) ||
                      isMilestoneEligible(m, item)
                    )
                  : [];

                return (
                  <div key={item.id} className={`challenge-history-card challenge-history-card--${item.status}`} id={`history-card-${item.id}`}>
                    <div className="challenge-history-header">
                      <div className="challenge-history-title-wrap">
                        <span className="challenge-history-title">
                          {item.durationDays}-Day {abilityName}
                        </span>
                      </div>
                      <span className={`challenge-status-badge challenge-status-badge--${item.status}`}>
                        {isCompleted ? (t.challenge_status_completed || 'Completed') : (t.challenge_status_cancelled || 'Cancelled')}
                      </span>
                    </div>

                    <div className="challenge-history-dates">
                      <span className="history-date-range">📅 {item.startDate} → {item.endDate}</span>
                      <span className="history-duration-tag">{item.relevantEventCounts?.daysCompleted || 0}/{item.durationDays} days</span>
                    </div>

                    <div className="challenge-history-stats">
                      <div className="challenge-history-stat-item">
                        <span className="stat-label">{t.challenge_completion_practice_consistency || 'Practice Consistency'}</span>
                        <span className="stat-val">{distinctDays}/{item.durationDays} days</span>
                        <span className="stat-sub">{totalCheckIns} {t.challenge_practice_total_checkins || 'check-ins'}</span>
                      </div>
                      <div className="challenge-history-stat-item">
                        <span className="stat-label">{t.challenge_resumed_slips || 'Recovered Slips'}</span>
                        <span className="stat-val">{rateText}</span>
                        <span className="stat-sub">{eligibleSlips > 0 ? `${resumedSlips} resumed` : (t.challenge_checkin_status_on_structure || 'On structure')}</span>
                      </div>
                    </div>

                    {isCompleted && earnedBadges.length > 0 && (
                      <div className="challenge-history-badges-section">
                        <span className="history-badges-label">{t.challenge_history_badges_label || 'Earned Milestone Badges'}:</span>
                        <div className="challenge-history-badges-list">
                          {earnedBadges.map((badge) => (
                            <span key={badge.id} className={`history-badge-pill history-badge-pill--${badge.category}`}>
                              {badge.category === 'completion' ? '🏆' : badge.category === 'recovery' ? '🔄' : badge.category === 'first_checkin' ? '🎯' : '⭐'}{' '}
                              {(t[badge.badgeKey as keyof typeof t] as string) || badge.id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="challenge-history-cancelled-wrap">
                        <p className="challenge-history-cancelled-text">
                          {t.challenge_history_cancelled_note || 'Ended early • Every day of practice counts toward your ability.'}
                        </p>
                      </div>
                    )}
                  </div>
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
            /* ── ACTIVE CHALLENGE DETAIL VIEW: DAILY CHALLENGE CONTROL CENTER ── */
            <div className="challenges-active-view control-center-hub">
              {continueToast && (
                <div className="challenge-continue-toast" role="status">
                  <span>🏆 {continueToast}</span>
                  <button className="challenge-toast-dismiss" onClick={() => setContinueToast(null)}>✕</button>
                </div>
              )}

              {/* ── SECTION 1: WHERE AM I NOW? ── */}
              <section className="control-center-section" id="section-where-am-i-now">
                <div className="control-center-section-header">
                  <span className="section-number-badge">1</span>
                  <h3 className="control-center-section-title">
                    {t.challenge_section_where_now || 'Where Am I Now?'}
                  </h3>
                </div>

                <div className="challenge-checkin-banner" id="challenge-checkin-banner">
                  <div className="challenge-checkin-banner-content">
                    <div className="challenge-checkin-status-row">
                      <span className="challenge-checkin-badge">
                        {practiceStats?.todayCheckedIn
                          ? `✓ ${t.challenge_practice_status_done || 'Checked in today'}`
                          : `🎯 ${t.challenge_practice_status_pending || 'Pending Check-In'}`}
                      </span>
                      {practiceStats?.todayCheckedIn && practiceStats.todayLatestStatus && (
                        <span className={`challenge-checkin-latest-pill challenge-checkin-latest-pill--${practiceStats.todayLatestStatus}`}>
                          {practiceStats.todayLatestStatus === 'on-structure'
                            ? `✓ ${t.challenge_checkin_status_on_structure || 'On Structure'}`
                            : practiceStats.todayLatestStatus === 'near-slip'
                            ? `⚡ ${t.challenge_checkin_status_near_slip || 'Near Slip'}`
                            : `↻ ${t.challenge_checkin_status_slip || 'True Slip'}`}
                        </span>
                      )}
                    </div>
                    <p className="challenge-checkin-desc">
                      {practiceStats?.todayCheckedIn
                        ? (t.challenge_checkin_day_badge?.replace('{current}', String(activeChallenge.currentDay)).replace('{total}', String(activeChallenge.durationDays)) + ' • ' + (t.challenge_practice_status_done || 'Checked in today'))
                        : (t.challenge_checkin_prompt || 'Report your current structure status')}
                    </p>
                  </div>
                  <button
                    id="btn-active-challenge-checkin"
                    className="challenge-checkin-cta-btn"
                    onClick={() => setShowCheckInModal(true)}
                  >
                    <span>
                      {practiceStats?.todayCheckedIn
                        ? (t.challenge_btn_checkin_again || 'Check In Again')
                        : (t.challenge_btn_checkin || 'Check In to Challenge')}
                    </span>
                    <span>→</span>
                  </button>
                </div>
              </section>

              {/* ── SECTION 2: CURRENT CHALLENGE ── */}
              <section className="control-center-section" id="section-current-challenge">
                <div className="control-center-section-header">
                  <span className="section-number-badge">2</span>
                  <h3 className="control-center-section-title">
                    {t.challenge_section_current_challenge || 'Current Challenge'}
                  </h3>
                </div>

                <div className="challenge-hub-hero">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div className="challenge-hub-badge">
                      <span>🏆</span>
                      <span>{t.challenge_resume_ability_title || 'Resume-Ability Challenge'}</span>
                    </div>
                    {activeChallenge.reminderEnabled && (
                      <div
                        className="challenge-hub-badge"
                        style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                      >
                        <span>🔔</span>
                        <span>
                          {activeChallenge.reminderTimes && activeChallenge.reminderTimes.length > 0
                            ? activeChallenge.reminderTimes.join(', ')
                            : activeChallenge.reminderFrequency || 'Reminders'}
                        </span>
                      </div>
                    )}
                    {activeChallenge.reminderEnabled && pushStatus === 'enabled' && (
                      <div
                        className="challenge-hub-badge"
                        style={{ background: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.35)', color: '#4ade80' }}
                      >
                        <span>✓</span>
                        <span>{t.challenge_push_status_enabled || 'Notifications Active'}</span>
                      </div>
                    )}
                  </div>
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

                  {/* Phase 41D: Web Push Activation / Status Banner */}
                  {activeChallenge.reminderEnabled && pushStatus === 'available' && (
                    <div className="challenge-push-banner" id="challenge-push-enable-banner">
                      <span className="challenge-push-banner-text">
                        🔔 {t.challenge_push_status_not_enabled || 'Reminders are configured. Enable notifications to receive them when SDA is closed.'}
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
                    <div className="challenge-push-banner challenge-push-banner--denied" id="challenge-push-denied-banner">
                      <span className="challenge-push-banner-text">
                        ⚠️ {t.challenge_push_status_denied || 'Notifications are blocked in your browser settings. To receive reminders, allow notifications for this site.'}
                      </span>
                    </div>
                  )}
                  {activeChallenge.reminderEnabled && isIOS() && !isStandalonePWA() && (
                    <div className="challenge-push-banner" id="challenge-push-ios-banner">
                      <span className="challenge-push-banner-text">
                        📲 {t.challenge_push_ios_instruction || 'To receive Challenge reminders when SDA is closed on iPhone, tap Share and select "Add to Home Screen".'}
                      </span>
                    </div>
                  )}

                  {/* Progress bar */}
                  <div className="challenge-progress-bar-wrapper">
                    <div
                      className="challenge-progress-bar-fill"
                      style={{ width: `${Math.round(activeChallenge.progress * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Phase 41H: Intermediate Inline Achievement Banner */}
                {uncelebratedInlineMilestones.length > 0 && (
                  <div className="challenge-inline-achievement" id="challenge-inline-achievement">
                    <span className="inline-achievement-icon" aria-hidden="true">⭐</span>
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
                      ✓
                    </button>
                  </div>
                )}

                {/* Challenge Practice Progress */}
                <div className="challenge-practice-card" id="challenge-practice-card">
                  <h3 className="challenge-practice-title">
                    {t.challenge_practice_progress_title || 'Challenge Practice Progress'}
                  </h3>
                  <p className="challenge-practice-sub">
                    {t.challenge_practice_progress_sub || 'Your daily consistency and check-in practice.'}
                  </p>
                  <div className="challenge-practice-grid">
                    <div className="challenge-practice-box">
                      <span className="practice-box-val">
                        {practiceStats?.daysCheckedIn || 0}/{activeChallenge.durationDays}
                      </span>
                      <span className="practice-box-label">
                        {t.challenge_practice_days_checked || 'Days Checked In'}
                      </span>
                    </div>
                    <div className="challenge-practice-box">
                      <span className="practice-box-val">{practiceStats?.totalCheckIns || 0}</span>
                      <span className="practice-box-label">
                        {t.challenge_practice_total_checkins || 'Total Check-Ins'}
                      </span>
                    </div>
                    <div className="challenge-practice-box">
                      <span className="practice-box-val">
                        {practiceStats?.todayCheckedIn
                          ? (practiceStats.todayLatestStatus === 'on-structure'
                              ? '✓'
                              : practiceStats.todayLatestStatus === 'near-slip'
                              ? '⚡'
                              : '↻')
                          : '—'}
                      </span>
                      <span className="practice-box-label">
                        {t.challenge_practice_today_status || 'Today\'s Status'}
                      </span>
                    </div>
                  </div>

                  {/* Phase 41H: Celebrated Milestones Badges Row */}
                  {celebratedMilestonesList.length > 0 && (
                    <div className="challenge-milestones-row" id="challenge-celebrated-milestones-row">
                      {celebratedMilestonesList.map((m) => (
                        <span
                          key={m.id}
                          className="challenge-milestone-pill"
                          title={(t[m.descKey as keyof typeof t] as string) || ''}
                        >
                          ✓ {(t[m.badgeKey as keyof typeof t] as string) || m.id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Factual Metrics Card (Strictly separated from practice consistency) */}
                <div className="challenge-metrics-card">
                  <h3 className="challenge-metrics-title">{t.challenge_recovery_metrics || 'Recovery Practice Metrics'}</h3>
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
                      <span className="metric-box-val">
                        {activeChallenge.relevantEventCounts.eligibleSlips > 0 && activeChallenge.relevantEventCounts.resumeRate !== null
                          ? `${activeChallenge.relevantEventCounts.resumeRate}%`
                          : (t.challenge_no_slips_short || 'No slips')}
                      </span>
                      <span className="metric-box-label">{t.challenge_resume_rate || 'Resume Rate'}</span>
                    </div>
                  </div>

                  {activeChallenge.relevantEventCounts.eligibleSlips === 0 && (
                    <div className="challenge-no-slips-hint">
                      <span>✓ {t.challenge_no_slips_yet || 'No Resume opportunities yet'}</span>
                    </div>
                  )}

                  <div className="challenge-philosophy-banner">
                    <span className="philosophy-icon">💡</span>
                    <p>
                      {t.challenge_philosophy_quote ||
                        'A Resume-Ability challenge is about practicing recovery and consistency — not perfection. Slips are opportunities to practice Resume-Ability.'}
                    </p>
                  </div>
                </div>

                {/* Primary Section 2 Actions: Continue / Recommit */}
                <div className="challenge-control-actions-row">
                  <button
                    type="button"
                    id="btn-challenge-continue"
                    className="challenge-control-btn challenge-control-btn--primary"
                    onClick={handleContinueChallenge}
                  >
                    <span>✓ {t.challenge_checkin_btn_continue || 'Continue Challenge'}</span>
                  </button>
                  <button
                    type="button"
                    id="btn-challenge-recommit-focus"
                    className="challenge-control-btn challenge-control-btn--secondary"
                    onClick={handleScrollToRecommit}
                  >
                    <span>↻ {t.challenge_btn_recommit_focus || 'Recommit Focus'}</span>
                  </button>
                </div>

                {/* Day-by-day Recovery Timeline (Collapsible for mobile layout) */}
                <details className="challenge-timeline-collapsible" id="challenge-timeline-collapsible">
                  <summary className="challenge-timeline-summary">
                    <span>📅 {t.challenge_timeline_toggle || 'Daily Recovery Timeline'} ({dayBreakdown.length} days)</span>
                    <span className="timeline-summary-chevron">▼</span>
                  </summary>
                  <div className="challenge-timeline-list">
                    {dayBreakdown.map((d) => {
                      let icon = '○';
                      let desc = t.challenge_day_upcoming || 'Upcoming';
                      let rowClass = 'timeline-row timeline-row--upcoming';

                      if (d.isToday) {
                        rowClass = 'timeline-row timeline-row--today';
                        icon = '🎯';
                        desc = d.hasResumeOpportunity
                          ? `${d.resumedCount}/${d.slipsCount} ${t.challenge_resumed_short || 'resumed'}`
                          : (t.challenge_day_today || 'Today (in progress)');
                      } else if (d.isPast) {
                        if (d.hasResumeOpportunity) {
                          icon = d.resumedCount > 0 ? '🔄' : '⚠️';
                          desc = `${d.resumedCount}/${d.slipsCount} ${t.challenge_resumed_short || 'resumed'}`;
                          rowClass = d.resumedCount > 0
                            ? 'timeline-row timeline-row--resumed'
                            : 'timeline-row timeline-row--slip';
                        } else {
                          icon = '✓';
                          desc = t.challenge_day_no_slips || 'Completed (on-track)';
                          rowClass = 'timeline-row timeline-row--clean';
                        }
                      }

                      return (
                        <div key={d.dayIndex} className={rowClass}>
                          <div className="timeline-left">
                            <span className="timeline-icon">{icon}</span>
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
              </section>

              {/* ── SECTION 3: WHY I AM DOING THIS ── */}
              <section className="control-center-section" id="section-why-i-am-doing-this">
                <div className="control-center-section-header">
                  <span className="section-number-badge">3</span>
                  <h3 className="control-center-section-title">
                    {t.challenge_section_why || 'Why I Am Doing This'}
                  </h3>
                </div>

                <div className="challenge-why-card" id="challenge-why-card">
                  {savedReasons.length > 0 ? (
                    <div className="challenge-why-content">
                      <div className="challenge-why-list">
                        {savedReasons.map((reason, idx) => (
                          <div key={idx} className="challenge-why-item">
                            <span className="challenge-why-quote-mark">“</span>
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
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="challenge-why-empty" id="challenge-why-empty">
                      <span className="challenge-why-empty-icon">💡</span>
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
                        <span>→</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* ── SECTION 4: MY NON-NEGOTIABLES ── */}
              <section className="control-center-section" id="section-my-non-negotiables">
                <div className="control-center-section-header">
                  <span className="section-number-badge">4</span>
                  <h3 className="control-center-section-title">
                    {t.challenge_section_nn || 'My Non-Negotiables'}
                  </h3>
                </div>

                <div className="challenge-nn-card" id="challenge-nn-card">
                  {savedNonNegotiables.length > 0 ? (
                    <div className="challenge-nn-content">
                      <div className="challenge-nn-meta-row">
                        <span className="challenge-nn-count-tag">
                          🛡️ {savedNonNegotiables.length} {savedNonNegotiables.length === 1 ? 'Rule' : 'Rules'}
                        </span>
                        <span className="challenge-nn-review-stat">
                          {t.challenge_nn_reviewed_count?.replace('{count}', String(pledge.nonNegotiableReviewCount || 0)) ||
                            `Reviewed ${pledge.nonNegotiableReviewCount || 0} times`}
                        </span>
                      </div>

                      <div className="challenge-nn-list">
                        {savedNonNegotiables.map((rule, idx) => (
                          <div key={idx} className="challenge-nn-item">
                            <span className="challenge-nn-bullet">🛡️</span>
                            <span className="challenge-nn-rule-text">{rule}</span>
                          </div>
                        ))}
                      </div>

                      <div className="challenge-nn-actions-block">
                        <div className="challenge-nn-recommit-wrap">
                          {hasRecommitted ? (
                            <div className="challenge-recommitted-badge" id="challenge-control-recommitted-badge">
                              <span className="recommitted-check">✓</span>
                              <span>{t.challenge_nn_recommitted_badge || 'Re-commitment registered!'}</span>
                            </div>
                          ) : (
                            <HoldCommitButton
                              id="btn-control-recommit-hold"
                              variant="recommit"
                              label={`→ ${t.challenge_nn_hold_to_recommit || 'HOLD TO RE-COMMIT'}`}
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
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="challenge-nn-empty" id="challenge-nn-empty">
                      <span className="challenge-nn-empty-icon">🛡️</span>
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
                        <span>→</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* ── SECTION 5: MY STRUCTURED DIET ── */}
              <section className="control-center-section" id="section-my-structured-diet">
                <div className="control-center-section-header">
                  <span className="section-number-badge">5</span>
                  <h3 className="control-center-section-title">
                    {t.challenge_section_diet || 'My Structured Diet'}
                  </h3>
                </div>

                <ChallengeDietSummaryCard onNavigate={onNavigate} />
              </section>

              {/* ── SECTION: CHALLENGE MOVEMENT (OPTIONAL) (Phase 43.4) ── */}
              <section className="control-center-section challenge-movement-section" id="section-challenge-movement">
                <div className="control-center-section-header">
                  <span className="section-number-badge section-number-badge--optional">🏃</span>
                  <h3 className="control-center-section-title">
                    {t.act_challenge_section_title}
                  </h3>
                </div>

                <div className="challenge-movement-card" id="challenge-movement-card">
                  <p className="challenge-movement-desc">
                    {t.act_challenge_section_desc}
                  </p>

                  <div className="challenge-movement-count-row">
                    <span className="challenge-movement-count-label">
                      {t.act_challenge_linked_count}
                    </span>
                    <span className="challenge-movement-count-badge" id="challenge-activity-count">
                      {challengeActivityCount}
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
                      <span>→</span>
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
                      <span>+ {t.act_btn_record}</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Contextual Link to Seven Diet-Abilities (Phase 42.3) */}
              <div className="challenge-seven-abilities-link-wrap">
                <button
                  type="button"
                  id="btn-challenges-seven-abilities-link"
                  className="challenge-seven-abilities-link-btn"
                  onClick={() => onNavigate('seven-abilities')}
                >
                  <span>{t.seven_abilities_challenge_link || 'Explore the Seven Diet-Abilities →'}</span>
                </button>
              </div>

              {/* Cancel Challenge Option */}
              <div className="challenge-actions-row">
                <button
                  id="btn-cancel-challenge-initiate"
                  className="challenge-cancel-link"
                  onClick={() => setShowCancelModal(true)}
                >
                  {t.challenge_btn_cancel || 'Cancel Challenge'}
                </button>
              </div>
            </div>
          ) : completedChallengeToSummarize ? (
            /* ── CHALLENGE COMPLETION EXPERIENCE ── */
            <div className="challenges-completion-view" id="challenges-completion-view">
              <div className="challenge-completion-card">
                <div className="completion-card-badge-row">
                  <span className="completion-card-pill">🏆 {t.challenge_status_completed || 'Completed'}</span>
                  <span className="completion-card-duration">{completedChallengeToSummarize.durationDays}-Day Challenge</span>
                </div>

                <h2 className="completion-card-title">
                  {t.challenge_completion_summary_title || 'Challenge Completed!'}
                </h2>

                <p className="completion-card-ability">
                  {getCanonicalAbilityName(completedChallengeToSummarize.abilityId)}
                </p>

                <div className="completion-card-dates">
                  <span>📅 {completedChallengeToSummarize.startDate} → {completedChallengeToSummarize.endDate}</span>
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
                        ? `${completedChallengeToSummarize.relevantEventCounts.resumeRate}% resume rate`
                        : (t.challenge_completion_no_slips || 'No eligible slips recorded')}
                    </span>
                  </div>
                </div>

                <div className="completion-philosophy-notice">
                  <span className="completion-notice-icon">🛡️</span>
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
                    <span>📜 {t.challenge_completion_btn_review || 'Review My Challenge'}</span>
                  </button>

                  <button
                    id="btn-completion-start-new"
                    type="button"
                    className="completion-btn-primary"
                    onClick={() => setShowingStartWizard(true)}
                  >
                    <span>🛡️ {t.challenge_completion_btn_start_new || 'Start a New Challenge'}</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── START CHALLENGE WIZARD ── */
            <div className="challenges-wizard-view">
              {latestCompletedChallenge && (
                <button
                  type="button"
                  className="wizard-back-completion-link"
                  onClick={() => setShowingStartWizard(false)}
                >
                  {t.challenge_completion_back_summary || '← Back to Completion Summary'}
                </button>
              )}
              <div className="wizard-intro-card">
                <span className="wizard-intro-icon">🛡️</span>
                <h2 className="wizard-intro-title">
                  {t.challenge_wizard_title || 'Take on an Ability Challenge'}
                </h2>
                <p className="wizard-intro-body">
                  {t.challenge_wizard_body ||
                    'Select a duration to practice your Resume-Ability. This challenge is about developing consistency and recovery — not avoiding every slip.'}
                </p>
              </div>

              {/* Step 1: Choose Ability */}
              <div className="wizard-step">
                <h3 className="wizard-step-title">
                  <span className="step-num">1</span>
                  {t.challenge_step_ability || 'Choose Ability'}
                </h3>
                <div className="ability-selector-grid">
                  {CHALLENGE_DEFINITIONS.map((def) => {
                    const isSelected = selectedAbility === def.abilityId;
                    return (
                      <button
                        key={def.id}
                        className={`ability-select-card ${isSelected ? 'ability-select-card--selected' : ''} ${!def.isActive ? 'ability-select-card--disabled' : ''}`}
                        onClick={() => {
                          if (def.isActive) {
                            setSelectedAbility(def.abilityId);
                          }
                        }}
                        disabled={!def.isActive}
                      >
                        <div className="ability-card-top">
                          <span className="ability-card-name">
                            {def.canonicalName ||
                              (def.id === 'resume-ability'
                                ? (t.challenge_resume_ability_title || 'Resume-Ability')
                                : def.id.replace(/-/g, ' '))}
                          </span>
                          {!def.isActive && (
                            <span className="ability-coming-soon">{t.challenge_coming_soon || 'Coming Soon'}</span>
                          )}
                        </div>
                        <p className="ability-card-desc">
                          {def.id === 'resume-ability'
                            ? (t.challenge_resume_ability_brief || 'Build psychological resilience by recovering immediately whenever life drifts.')
                            : 'Future Super Diet-Ability.'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="wizard-seven-abilities-link-wrap">
                  <button
                    type="button"
                    id="btn-wizard-seven-abilities-link"
                    className="wizard-seven-abilities-link-btn"
                    onClick={() => onNavigate('seven-abilities')}
                  >
                    <span>{t.seven_abilities_challenge_link || 'Explore the Seven Diet-Abilities →'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Choose Duration */}
              <div className="wizard-step">
                <h3 className="wizard-step-title">
                  <span className="step-num">2</span>
                  {t.challenge_step_duration || 'Choose Duration'}
                </h3>
                <div className="duration-selector-row">
                  {RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations.map((d) => {
                    const isSelected = selectedDuration === d;
                    return (
                      <button
                        key={d}
                        id={`btn-duration-${d}`}
                        className={`duration-pill-btn ${isSelected ? 'duration-pill-btn--selected' : ''}`}
                        onClick={() => setSelectedDuration(d)}
                      >
                        <span className="duration-pill-num">{d}</span>
                        <span className="duration-pill-label">
                          {d === 1 ? (t.common_day || 'Day') : (t.common_days || 'Days')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Keep This Challenge Top of Mind (Phase 41B Reminders) */}
              <div className="wizard-step">
                <div className="challenge-reminders-card">
                  <div className="reminders-card-header">
                    <h4 className="reminders-section-title">
                      {t.challenge_reminders_section_title || 'KEEP THIS CHALLENGE TOP OF MIND'}
                    </h4>
                    <p className="reminders-section-desc">
                      {t.challenge_reminders_section_desc ||
                        'Get gentle reminders during the day to check in, report your status, and reconnect with your Challenge.'}
                    </p>
                  </div>

                  <div className="reminders-toggle-row">
                    <label className="reminders-toggle-label" htmlFor="toggle-challenge-reminders">
                      <input
                        id="toggle-challenge-reminders"
                        type="checkbox"
                        className="reminders-toggle-input"
                        checked={remindersEnabled}
                        onChange={(e) => setRemindersEnabled(e.target.checked)}
                      />
                      <span>{t.challenge_reminders_toggle_label || 'Challenge Reminders'}</span>
                    </label>
                  </div>

                  {remindersEnabled && (
                    <div className="reminders-controls">
                      <div className="reminders-freq-label">
                        {t.challenge_reminders_frequency_label || 'How often?'}
                      </div>
                      <div className="reminders-freq-grid">
                        <button
                          type="button"
                          id="btn-freq-1x"
                          className={`reminders-freq-btn ${reminderFrequency === '1x' ? 'reminders-freq-btn--selected' : ''}`}
                          onClick={() => handleFrequencyChange('1x')}
                        >
                          {t.challenge_reminders_freq_1x || 'Once a day'}
                        </button>
                        <button
                          type="button"
                          id="btn-freq-2x"
                          className={`reminders-freq-btn ${reminderFrequency === '2x' ? 'reminders-freq-btn--selected' : ''}`}
                          onClick={() => handleFrequencyChange('2x')}
                        >
                          {t.challenge_reminders_freq_2x || 'Twice a day'}
                        </button>
                        <button
                          type="button"
                          id="btn-freq-3x"
                          className={`reminders-freq-btn ${reminderFrequency === '3x' ? 'reminders-freq-btn--selected' : ''}`}
                          onClick={() => handleFrequencyChange('3x')}
                        >
                          {t.challenge_reminders_freq_3x || 'Three times a day'}
                        </button>
                        <button
                          type="button"
                          id="btn-freq-custom"
                          className={`reminders-freq-btn ${reminderFrequency === 'custom' ? 'reminders-freq-btn--selected' : ''}`}
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
              </div>

              {/* Step 4: Review Challenge & Philosophy */}
              <div className="wizard-review-card">
                <h3 className="wizard-review-title">
                  {t.challenge_review_heading || 'Challenge Commitment'}
                </h3>
                <div className="wizard-review-details">
                  <div className="review-detail-row">
                    <span className="detail-label">{t.challenge_selected_ability || 'Ability'}:</span>
                    <span className="detail-val">Resume-Ability</span>
                  </div>
                  <div className="review-detail-row">
                    <span className="detail-label">{t.challenge_selected_duration || 'Duration'}:</span>
                    <span className="detail-val">{selectedDuration} {selectedDuration === 1 ? 'Day' : 'Days'}</span>
                  </div>
                  <div className="review-detail-row">
                    <span className="detail-label">{t.challenge_reminders_toggle_label || 'Challenge Reminders'}:</span>
                    <span className="detail-val">
                      {remindersEnabled
                        ? `${reminderTimes.length}x (${reminderTimes.join(', ')})`
                        : (t.challenge_reminders_off || 'Off')}
                    </span>
                  </div>
                </div>

                <div className="wizard-safety-notice">
                  <p>
                    <strong>{t.challenge_important_note || 'Important Rule'}:</strong>{' '}
                    {t.challenge_rule_explanation ||
                      'This challenge is about practicing Resume-Ability — not avoiding every slip. When an unexpected situation happens, your practice is to report it honestly and resume your structured eating.'}
                  </p>
                </div>

                {/* Step 4: Hold to Start Ritual */}
                <div className="wizard-hold-container">
                  <HoldCommitButton
                    variant="commit"
                    label={t.challenge_hold_to_start || 'HOLD TO START CHALLENGE'}
                    holdingLabel={t.challenge_starting || 'STARTING CHALLENGE...'}
                    onComplete={handleStartChallenge}
                    id="btn-hold-start-challenge"
                  />
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
            <div className="challenge-push-modal-icon">🔔</div>
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

      {/* ── Challenge Check-In Modal (Phase 41E) ── */}
      {activeChallenge && activeChallenge.status === 'active' && (
        <ChallengeCheckInModal
          isOpen={showCheckInModal}
          challenge={activeChallenge}
          onClose={() => setShowCheckInModal(false)}
          onNavigate={onNavigate}
          onCheckInCompleted={refreshState}
        />
      )}

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
    </div>
  );
};
