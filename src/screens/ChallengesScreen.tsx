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

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import {
  syncCurrentChallenge,
  startChallenge,
  cancelActiveChallenge,
  getChallengeHistory,
  getChallengeDayBreakdown,
  calculateChallengePracticeStats,
  CHALLENGE_UPDATED_EVENT,
  ChallengeInstance,
  ChallengeDurationDays,
  ChallengeAbilityId,
  ChallengeReminderFrequency,
  CHALLENGE_DEFINITIONS,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
} from '../challenges';
import { HoldCommitButton } from '../components/HoldCommitButton';
import { ChallengeCheckInModal } from '../components/ChallengeCheckInModal';
import { playFeedback } from '../utils/feedback';
import {
  getPushDeliveryStatus,
  subscribeToPush,
  isPushSupported,
  isIOS,
  isStandalonePWA,
  type PushDeliveryStatus,
} from '../utils/pushNotifications';
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

  const refreshState = () => {
    const current = syncCurrentChallenge();
    setActiveChallenge(current);
    setHistory(getChallengeHistory());
    setPushStatus(getPushDeliveryStatus());
  };

  useEffect(() => {
    refreshState();
    const handleUpdate = () => refreshState();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
  }, []);

  // Phase 41E: Check for direct check-in trigger from Home card or notification deep link
  useEffect(() => {
    try {
      const openCheckIn = sessionStorage.getItem('challenge_open_checkin');
      const params = new URLSearchParams(window.location.search);
      const urlCheckIn = params.get('checkin') === 'true' || params.get('action') === 'check-in';

      if (openCheckIn === '1' || urlCheckIn) {
        sessionStorage.removeItem('challenge_open_checkin');
        setShowCheckInModal(true);
      }
    } catch {
      // ignore
    }
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
    refreshState();
  };

  const dayBreakdown = activeChallenge && activeChallenge.status === 'active'
    ? getChallengeDayBreakdown(activeChallenge)
    : [];

  const practiceStats = activeChallenge && activeChallenge.status === 'active'
    ? calculateChallengePracticeStats(activeChallenge)
    : null;

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
        <h1 className="challenges-title">{t.challenge_screen_title || 'Ability Challenges'}</h1>
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
                const rateText = item.relevantEventCounts?.resumeRate !== null
                  ? `${item.relevantEventCounts.resumeRate}%`
                  : (t.challenge_no_slips_short || 'No slips');

                return (
                  <div key={item.id} className={`challenge-history-card challenge-history-card--${item.status}`}>
                    <div className="challenge-history-header">
                      <span className="challenge-history-title">
                        {item.durationDays}-Day Resume-Ability
                      </span>
                      <span className={`challenge-status-badge challenge-status-badge--${item.status}`}>
                        {isCompleted ? (t.challenge_status_completed || 'Completed') : (t.challenge_status_cancelled || 'Cancelled')}
                      </span>
                    </div>

                    <div className="challenge-history-dates">
                      <span>{item.startDate} → {item.endDate}</span>
                      <span>{item.relevantEventCounts?.daysCompleted || 0}/{item.durationDays} days</span>
                    </div>

                    <div className="challenge-history-stats">
                      <div className="challenge-history-stat-item">
                        <span className="stat-label">{t.challenge_eligible_slips || 'True Slips'}</span>
                        <span className="stat-val">{item.relevantEventCounts?.eligibleSlips || 0}</span>
                      </div>
                      <div className="challenge-history-stat-item">
                        <span className="stat-label">{t.challenge_resumed_slips || 'Resumed'}</span>
                        <span className="stat-val">{item.relevantEventCounts?.resumedSlips || 0}</span>
                      </div>
                      <div className="challenge-history-stat-item">
                        <span className="stat-label">{t.challenge_resume_rate || 'Resume Rate'}</span>
                        <span className="stat-val">{rateText}</span>
                      </div>
                    </div>
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
            /* ── ACTIVE CHALLENGE DETAIL VIEW ── */
            <div className="challenges-active-view">
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

              {/* Phase 41E: Challenge Check-In Banner */}
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

              {/* Phase 41E: Challenge Practice Progress (Strictly separated from slip recovery metrics) */}
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
              </div>

              {/* Factual Metrics Card */}
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
                      {activeChallenge.relevantEventCounts.resumeRate !== null
                        ? `${activeChallenge.relevantEventCounts.resumeRate}%`
                        : '—'}
                    </span>
                    <span className="metric-box-label">{t.challenge_resume_rate || 'Resume Rate'}</span>
                  </div>
                </div>

                <div className="challenge-philosophy-banner">
                  <span className="philosophy-icon">💡</span>
                  <p>
                    {t.challenge_philosophy_quote ||
                      'A Resume-Ability challenge is about practicing recovery and consistency — not perfection. Slips are opportunities to practice Resume-Ability.'}
                  </p>
                </div>
              </div>

              {/* Day-by-day Recovery Timeline */}
              <div className="challenge-timeline-card">
                <h3 className="challenge-timeline-title">{t.challenge_timeline_title || 'Daily Recovery Timeline'}</h3>
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
          ) : (
            /* ── START CHALLENGE WIZARD ── */
            <div className="challenges-wizard-view">
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
      {activeChallenge && (
        <ChallengeCheckInModal
          isOpen={showCheckInModal}
          challenge={activeChallenge}
          onClose={() => setShowCheckInModal(false)}
          onNavigate={onNavigate}
          onCheckInCompleted={refreshState}
        />
      )}
    </div>
  );
};
