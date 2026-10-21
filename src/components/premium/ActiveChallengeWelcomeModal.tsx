/**
 * Super Diet-Ability — Active Challenge Welcome Popup (Phase 44)
 *
 * Premium mobile-first welcome modal shown on app entry when an eligible active challenge exists.
 * Helps users understand their current challenge progress, view authentic recovery statistics,
 * and seamlessly continue their daily practice.
 *
 * Core Guarantees:
 * 1. Read-only presentation: Opening or dismissing NEVER alters challenge progress, streaks, XP, or check-ins.
 * 2. Authentic metrics: Uses only existing engine fields (eligibleSlips, resumedSlips, resumeRate). Never fabricates statistics.
 * 3. Session & preference respect: Shown once per continuous session, respects "Don't show automatically" preference,
 *    and allows manual reopening from the Challenges screen.
 * 4. Non-shaming recovery messaging grounded in Sergio Laurant's SDA doctrine.
 * 5. Full EN/ES/NL localization and touch targets >= 44px.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ChallengeInstance, ChallengePracticeStats } from '../../challenges/types';
import {
  calculateChallengePracticeStats,
  getCanonicalAbilityName,
} from '../../challenges';
import {
  isChallengeWelcomeAutoShowEnabled,
  setChallengeWelcomeAutoShowEnabled,
  markChallengeWelcomeShownThisSession,
} from '../../challenges/challengeStorage';
import { useTranslation } from '../../i18n';
import { formatTemplate } from '../../utils/homeSelectors';
import { AppIcon } from '../icons/AppIcon';
import './ActiveChallengeWelcomeModal.css';

export interface ActiveChallengeWelcomeModalProps {
  isOpen: boolean;
  challenge: ChallengeInstance | null;
  practiceStats?: ChallengePracticeStats;
  onClose: () => void;
  onContinue: () => void;
  isManualOpen?: boolean;
}

export const ActiveChallengeWelcomeModal: React.FC<ActiveChallengeWelcomeModalProps> = ({
  isOpen,
  challenge,
  practiceStats: externalStats,
  onClose,
  onContinue,
  isManualOpen = false,
}) => {
  const { t } = useTranslation();
  const [autoShowDisabled, setAutoShowDisabled] = useState<boolean>(() => !isChallengeWelcomeAutoShowEnabled());
  const modalCardRef = useRef<HTMLDivElement>(null);

  // Compute or reuse practice stats
  const practiceStats = useMemo(() => {
    if (externalStats) return externalStats;
    if (challenge && challenge.status === 'active') {
      return calculateChallengePracticeStats(challenge);
    }
    return {
      totalCheckIns: 0,
      daysCheckedIn: 0,
      todayCheckedIn: false,
    };
  }, [challenge, externalStats]);

  // Sync preference state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAutoShowDisabled(!isChallengeWelcomeAutoShowEnabled());
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !challenge || challenge.status !== 'active') {
    return null;
  }

  const handleClose = () => {
    markChallengeWelcomeShownThisSession();
    onClose();
  };

  const handleContinue = () => {
    markChallengeWelcomeShownThisSession();
    onContinue();
  };

  const handleToggleAutoShow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const disabled = e.target.checked;
    setAutoShowDisabled(disabled);
    setChallengeWelcomeAutoShowEnabled(!disabled);
  };

  const currentDay = challenge.currentDay;
  const totalDays = challenge.durationDays;
  const progressPct = Math.min(100, Math.max(0, Math.round((challenge.progress ?? (currentDay / totalDays)) * 100)));
  const abilityName = getCanonicalAbilityName(challenge.abilityId);

  const dayLabel = formatTemplate(t.challenge_welcome_day_of || 'Day {current} of {total}', {
    current: currentDay,
    total: totalDays,
  });

  const remainingLabel =
    challenge.daysRemaining === 0
      ? (t.challenge_final_day || 'Final Day!')
      : formatTemplate(t.challenge_days_remaining || '{days} days remaining', {
          days: challenge.daysRemaining,
        });

  // Authentic recovery metrics
  const eligibleSlips = challenge.relevantEventCounts?.eligibleSlips ?? 0;
  const resumedSlips = challenge.relevantEventCounts?.resumedSlips ?? 0;
  const resumeRate = challenge.relevantEventCounts?.resumeRate;

  const rateDisplay =
    eligibleSlips > 0 && resumeRate !== null
      ? `${resumeRate}%`
      : (t.challenge_welcome_stat_no_slips || 'No slips recorded');

  // Today's practice status
  const todayCheckedIn = practiceStats.todayCheckedIn;
  const todayStatusKey = practiceStats.todayLatestStatus;
  const todayStatusLabel = todayStatusKey
    ? todayStatusKey === 'on-structure'
      ? (t.challenge_checkin_status_on_structure || 'On Structure')
      : todayStatusKey === 'near-slip'
      ? (t.challenge_checkin_status_near_slip || 'Near Slip')
      : (t.challenge_checkin_status_slip || 'True Slip')
    : (t.challenge_practice_status_done || 'Checked in today');

  // Context-aware motivational quote grounded in SDA philosophy
  let motivationalMessage = t.challenge_welcome_motivation_on_track ||
    'A Resume-Ability challenge is about daily awareness and consistency. Take a moment to check in and anchor your practice today.';

  if (todayCheckedIn) {
    motivationalMessage = t.challenge_welcome_motivation_checked ||
      "Today's practice is completed. Consistency is about reliable return — keep honoring your daily rhythm.";
  } else if (eligibleSlips > 0) {
    motivationalMessage = t.challenge_welcome_motivation_slips ||
      'Every slip is an opportunity to practice Resume-Ability. Recovery and awareness matter far more than perfection.';
  }

  return (
    <div
      className="challenge-welcome-backdrop"
      role="presentation"
      onClick={handleClose}
    >
      <div
        ref={modalCardRef}
        id="active-challenge-welcome-modal"
        className="challenge-welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-challenge-welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar: Badge & Close Button */}
        <div className="challenge-welcome-topbar">
          <div className="challenge-welcome-badge" id="badge-welcome-active">
            <span className="welcome-badge-dot" aria-hidden="true" />
            <span className="welcome-badge-text">
              {t.challenge_welcome_badge || 'ACTIVE CHALLENGE'}
            </span>
          </div>

          <button
            type="button"
            id="btn-welcome-close"
            className="challenge-welcome-close-btn"
            onClick={handleClose}
            aria-label={t.challenge_welcome_close_aria || 'Close challenge welcome popup'}
          >
            ✕
          </button>
        </div>

        {/* Header: Title and Ability */}
        <div className="challenge-welcome-header">
          <h2 id="active-challenge-welcome-title" className="challenge-welcome-title">
            {formatTemplate(t.home_hero_title_days || '{days}-Day Challenge', { days: totalDays })}
          </h2>
          <div className="challenge-welcome-ability-pill">
            <AppIcon name="shield" size={14} />
            <span>{abilityName}</span>
          </div>
        </div>

        {/* Progress Section */}
        <div className="challenge-welcome-progress-section">
          <div className="welcome-progress-header">
            <span className="welcome-progress-day" id="welcome-current-day">
              {dayLabel}
            </span>
            <span className="welcome-progress-remaining">
              {remainingLabel}
            </span>
          </div>

          <div
            className="welcome-progress-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t.challenge_welcome_progress || 'Progress'}: ${progressPct}%`}
          >
            <div
              className="welcome-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="welcome-progress-footer">
            <span className="welcome-progress-pct">{progressPct}% {t.challenge_welcome_progress || 'Complete'}</span>
            <span className="welcome-progress-duration">{totalDays} {t.common_days || 'Days Total'}</span>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="challenge-welcome-stats-box" id="welcome-stats-grid">
          <div className="welcome-stat-col">
            <span className="welcome-stat-val" id="welcome-stat-slips">{eligibleSlips}</span>
            <span className="welcome-stat-label">{t.challenge_welcome_stat_slips || 'True Slips'}</span>
          </div>
          <div className="welcome-stat-col">
            <span className="welcome-stat-val" id="welcome-stat-resumed">{resumedSlips}</span>
            <span className="welcome-stat-label">{t.challenge_welcome_stat_resumed || 'Resumed'}</span>
          </div>
          <div className="welcome-stat-col">
            <span className="welcome-stat-val" id="welcome-stat-rate">{rateDisplay}</span>
            <span className="welcome-stat-label">{t.challenge_welcome_stat_rate || 'Resume Rate'}</span>
          </div>
        </div>

        {/* Today's Practice Status Banner */}
        <div
          className={`welcome-today-banner welcome-today-banner--${todayCheckedIn ? 'done' : 'pending'}`}
          id="welcome-today-status-banner"
        >
          <div className="welcome-today-icon">
            <AppIcon name={todayCheckedIn ? 'check' : 'clock'} size={16} />
          </div>
          <div className="welcome-today-info">
            <span className="welcome-today-kicker">{t.challenge_welcome_today_status || "Today's Practice"}</span>
            <span className="welcome-today-status">
              {todayCheckedIn
                ? (t.challenge_welcome_today_done
                    ? formatTemplate(t.challenge_welcome_today_done, { status: todayStatusLabel })
                    : `Checked In (${todayStatusLabel})`)
                : (t.challenge_welcome_today_pending || 'Check-In Pending')}
            </span>
          </div>
        </div>

        {/* Motivational Philosophy Box */}
        <div className="challenge-welcome-philosophy-card">
          <span className="welcome-philosophy-icon" aria-hidden="true">💡</span>
          <p className="welcome-philosophy-text">{motivationalMessage}</p>
        </div>

        {/* Action Controls */}
        <div className="challenge-welcome-actions">
          <button
            type="button"
            id="btn-welcome-continue"
            className="challenge-welcome-btn-primary"
            onClick={handleContinue}
          >
            <span>✓ {t.challenge_welcome_btn_continue || 'Continue Challenge'}</span>
            <AppIcon name="chevron-right" size={18} />
          </button>

          <button
            type="button"
            id="btn-welcome-later"
            className="challenge-welcome-btn-secondary"
            onClick={handleClose}
          >
            {t.challenge_welcome_btn_later || 'Maybe Later'}
          </button>
        </div>

        {/* Auto-show preference toggle (only relevant when on startup, but available) */}
        {!isManualOpen && (
          <div className="challenge-welcome-pref-row">
            <label className="welcome-pref-label" htmlFor="checkbox-welcome-dont-show">
              <input
                type="checkbox"
                id="checkbox-welcome-dont-show"
                className="welcome-pref-checkbox"
                checked={autoShowDisabled}
                onChange={handleToggleAutoShow}
              />
              <span className="welcome-pref-text">
                {t.challenge_welcome_dont_show || "Don't show automatically on app launch"}
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveChallengeWelcomeModal;
