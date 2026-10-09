/**
 * SDA Ability Challenges System — Active Challenge Card Component (Phase 37)
 *
 * Compact, premium dark card displayed on the Home screen.
 * Shows active challenge day, dot progress, days remaining, or entry prompt.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import {
  syncCurrentChallenge,
  getChallengeDayBreakdown,
  calculateChallengePracticeStats,
  canShowChallengeInvitation,
  setChallengeInvitationSnooze,
  markChallengeInvitationPrompted,
  CHALLENGE_UPDATED_EVENT,
  ChallengeInstance,
  ChallengeDayProgress,
  SnoozeOptionDays,
} from '../challenges';
import './ActiveChallengeCard.css';

interface ActiveChallengeCardProps {
  onNavigate: (screen: any) => void;
}

export const ActiveChallengeCard: React.FC<ActiveChallengeCardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInstance | null>(null);
  const [days, setDays] = useState<ChallengeDayProgress[]>([]);
  const [showInvitation, setShowInvitation] = useState<boolean>(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState<boolean>(false);

  const refresh = () => {
    const current = syncCurrentChallenge();
    setActiveChallenge(current);
    if (current && current.status === 'active') {
      setDays(getChallengeDayBreakdown(current));
      setShowInvitation(false);
    } else {
      setDays([]);
      const eligible = canShowChallengeInvitation();
      setShowInvitation(eligible);
    }
  };

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
  }, []);

  const handleStartChallengeFromInvite = () => {
    markChallengeInvitationPrompted();
    onNavigate('challenges');
  };

  const handleSnooze = (option: SnoozeOptionDays | 'not_now') => {
    setChallengeInvitationSnooze(option);
    setShowSnoozeMenu(false);
    setShowInvitation(false);
  };

  if (!activeChallenge || activeChallenge.status !== 'active') {
    // If not eligible for invitation (snoozed or in 24h cooldown), render permanent feature entry
    if (!showInvitation) {
      return (
        <button
          id="home-ability-challenges"
          className="home-btn-action home-btn-action--challenges"
          onClick={() => onNavigate('challenges')}
          aria-label={t.challenge_home_entry_title || 'Ability Challenges'}
        >
          <span className="home-btn-icon">🏆</span>
          <div className="home-btn-text-col">
            <span className="home-btn-primary-text">
              {t.challenge_home_entry_title || 'Ability Challenges'}
            </span>
            <span className="home-btn-sub-text">
              {t.challenge_home_permanent_sub || t.challenge_home_entry_sub || 'Build your Resume-Ability one day at a time.'}
            </span>
          </div>
          <span className="home-btn-chevron" aria-hidden="true">→</span>
        </button>
      );
    }

    return (
      <div id="home-ability-challenges" className="home-challenges-invite-wrapper">
        <div className="challenge-card challenge-card--invite" id="challenge-invitation-card">
          <div className="challenge-card-header">
            <span className="challenge-card-icon">⚡</span>
            <div className="challenge-card-text">
              <span className="challenge-card-title">{t.challenge_invite_title || 'READY FOR A CHALLENGE?'}</span>
              <span className="challenge-card-sub">
                {t.challenge_invite_body || 'Put your Resume-Ability into practice and build consistency one day at a time.'}
              </span>
            </div>
          </div>

          {!showSnoozeMenu ? (
            <div className="challenge-invite-actions">
              <button
                id="btn-invite-start-challenge"
                className="challenge-card-cta challenge-card-cta--primary"
                onClick={handleStartChallengeFromInvite}
              >
                <span>{t.challenge_invite_btn_start || 'START A CHALLENGE'}</span>
                <span className="challenge-card-arrow">→</span>
              </button>
              <button
                id="btn-invite-remind-later"
                className="challenge-card-cta challenge-card-cta--secondary"
                onClick={() => setShowSnoozeMenu(true)}
              >
                <span>{t.challenge_invite_btn_later || 'REMIND ME LATER'}</span>
              </button>
            </div>
          ) : (
            <div className="challenge-snooze-container">
              <div className="challenge-snooze-heading">
                {t.challenge_snooze_heading || 'Remind me in...'}
              </div>
              <div className="challenge-snooze-grid">
                <button
                  type="button"
                  id="btn-snooze-1d"
                  className="snooze-pill-btn"
                  onClick={() => handleSnooze(1)}
                >
                  {t.challenge_snooze_1d || '1 Day'}
                </button>
                <button
                  type="button"
                  id="btn-snooze-3d"
                  className="snooze-pill-btn"
                  onClick={() => handleSnooze(3)}
                >
                  {t.challenge_snooze_3d || '3 Days'}
                </button>
                <button
                  type="button"
                  id="btn-snooze-7d"
                  className="snooze-pill-btn"
                  onClick={() => handleSnooze(7)}
                >
                  {t.challenge_snooze_7d || '7 Days'}
                </button>
                <button
                  type="button"
                  id="btn-snooze-14d"
                  className="snooze-pill-btn"
                  onClick={() => handleSnooze(14)}
                >
                  {t.challenge_snooze_14d || '14 Days'}
                </button>
                <button
                  type="button"
                  id="btn-snooze-30d"
                  className="snooze-pill-btn"
                  onClick={() => handleSnooze(30)}
                >
                  {t.challenge_snooze_30d || '30 Days'}
                </button>
              </div>
              <button
                type="button"
                id="btn-snooze-not-now"
                className="snooze-not-now-btn"
                onClick={() => handleSnooze('not_now')}
              >
                {t.challenge_snooze_not_now || 'Not Now'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Challenge view
  const { currentDay, durationDays, daysRemaining, relevantEventCounts } = activeChallenge;
  const practiceStats = calculateChallengePracticeStats(activeChallenge);

  return (
    <div
      id="home-ability-challenges"
      className="challenge-card challenge-card--active"
      onClick={() => onNavigate('challenges')}
      role="button"
      tabIndex={0}
      aria-label={`${t.challenge_resume_ability_title || 'Resume-Ability Challenge'} - ${t.challenge_day_of_total?.replace('{current}', String(currentDay)).replace('{total}', String(durationDays)) || `Day ${currentDay} of ${durationDays}`}`}
      style={{ cursor: 'pointer' }}
    >
      <div id="active-challenge-card">
        <div className="challenge-card-badge-row">
          <span className="challenge-card-ability-badge">
            🏆 {t.challenge_resume_ability_title || 'Resume-Ability Challenge'}
          </span>
          <span className="challenge-card-days-tag">
            {durationDays}D
          </span>
        </div>

        <div className="challenge-card-status-row">
          <h3 className="challenge-card-day-title">
            {t.challenge_day_of_total
              ?.replace('{current}', String(currentDay))
              ?.replace('{total}', String(durationDays)) || `Day ${currentDay} of ${durationDays}`}
          </h3>
          <span className="challenge-card-remaining">
            {daysRemaining === 0
              ? (t.challenge_final_day || 'Final day')
              : (t.challenge_days_remaining?.replace('{days}', String(daysRemaining)) || `${daysRemaining} days remaining`)}
          </span>
        </div>

        {/* Dot progress indicator */}
        <div className="challenge-card-dots" aria-label={`Progress: day ${currentDay} of ${durationDays}`}>
          {days.map((d) => {
            let dotClass = 'challenge-dot';
            if (d.isToday) {
              dotClass += ' challenge-dot--current';
            } else if (d.isPast) {
              dotClass += ' challenge-dot--past';
            } else {
              dotClass += ' challenge-dot--upcoming';
            }

            if (d.state === 'resume_practiced') {
              dotClass += ' challenge-dot--resumed';
            }

            return (
              <span
                key={d.dayIndex}
                className={dotClass}
                title={`Day ${d.dayIndex}: ${d.dateKey}`}
              />
            );
          })}
        </div>

        {/* Quick stats banner */}
        <div className="challenge-card-stats-row">
          <span className="challenge-card-stat">
            {practiceStats.todayCheckedIn ? (
              <span className="challenge-card-stat-pill challenge-card-stat-pill--checked">
                ✓ {t.challenge_practice_status_done || 'Checked in today'}
              </span>
            ) : (
              <span className="challenge-card-stat-pill challenge-card-stat-pill--pending">
                🎯 {t.challenge_practice_status_pending || 'Pending Check-In'}
              </span>
            )}
          </span>
          <span className="challenge-card-stat">
            {relevantEventCounts.eligibleSlips > 0
              ? `${relevantEventCounts.resumedSlips}/${relevantEventCounts.eligibleSlips} ${t.challenge_resumed_label || 'resumed'} (${relevantEventCounts.resumeRate}%)`
              : (t.challenge_no_slips_yet || 'No Resume opportunities yet')}
          </span>
        </div>

        <div className="challenge-card-actions-group">
          <button
            id="btn-home-challenge-checkin"
            className="challenge-card-btn challenge-card-btn--checkin"
            onClick={(e) => {
              e.stopPropagation();
              try {
                sessionStorage.setItem('challenge_open_checkin', '1');
              } catch {}
              onNavigate('challenges');
            }}
          >
            <span>
              {practiceStats.todayCheckedIn
                ? (t.challenge_btn_checkin_again || 'Check In Again')
                : (t.challenge_btn_checkin || 'Check In to Challenge')}
            </span>
            <span className="challenge-card-arrow">✓</span>
          </button>
          <button
            id="btn-home-view-challenge"
            className="challenge-card-btn challenge-card-btn--secondary"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('challenges');
            }}
          >
            <span>{t.challenge_btn_continue || t.challenge_btn_view || 'Continue Challenge'}</span>
            <span className="challenge-card-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
