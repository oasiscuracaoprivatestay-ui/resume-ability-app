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
  CHALLENGE_UPDATED_EVENT,
  ChallengeInstance,
  ChallengeDurationDays,
  ChallengeAbilityId,
  CHALLENGE_DEFINITIONS,
  RESUME_ABILITY_CHALLENGE_DEFINITION,
} from '../challenges';
import { HoldCommitButton } from '../components/HoldCommitButton';
import { playFeedback } from '../utils/feedback';
import './ChallengesScreen.css';

interface ChallengesScreenProps {
  onNavigate: (screen: any) => void;
  onBack: () => void;
}

export const ChallengesScreen: React.FC<ChallengesScreenProps> = ({ onNavigate: _onNavigate, onBack }) => {
  const { t } = useTranslation();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInstance | null>(null);
  const [history, setHistory] = useState<ChallengeInstance[]>([]);
  const [viewTab, setViewTab] = useState<'challenge' | 'history'>('challenge');

  // Start wizard state
  const [selectedAbility, setSelectedAbility] = useState<ChallengeAbilityId>('resume-ability');
  const [selectedDuration, setSelectedDuration] = useState<ChallengeDurationDays>(7);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshState = () => {
    const current = syncCurrentChallenge();
    setActiveChallenge(current);
    setHistory(getChallengeHistory());
  };

  useEffect(() => {
    refreshState();
    const handleUpdate = () => refreshState();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
  }, []);

  const handleStartChallenge = () => {
    try {
      setErrorMessage(null);
      const newInstance = startChallenge(selectedAbility, selectedDuration);
      setActiveChallenge(newInstance);
      playFeedback('commit');
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
                <div className="challenge-hub-badge">
                  <span>🏆</span>
                  <span>{t.challenge_resume_ability_title || 'Resume-Ability Challenge'}</span>
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

                {/* Progress bar */}
                <div className="challenge-progress-bar-wrapper">
                  <div
                    className="challenge-progress-bar-fill"
                    style={{ width: `${Math.round(activeChallenge.progress * 100)}%` }}
                  />
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
                          <span className="timeline-date">{d.dateKey}</span>
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

              {/* Step 3: Review Challenge & Philosophy */}
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
    </div>
  );
};
