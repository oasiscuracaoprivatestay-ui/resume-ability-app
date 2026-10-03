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
  CHALLENGE_UPDATED_EVENT,
  ChallengeInstance,
  ChallengeDayProgress,
} from '../challenges';
import './ActiveChallengeCard.css';

interface ActiveChallengeCardProps {
  onNavigate: (screen: any) => void;
}

export const ActiveChallengeCard: React.FC<ActiveChallengeCardProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [activeChallenge, setActiveChallenge] = useState<ChallengeInstance | null>(null);
  const [days, setDays] = useState<ChallengeDayProgress[]>([]);

  const refresh = () => {
    const current = syncCurrentChallenge();
    setActiveChallenge(current);
    if (current && current.status === 'active') {
      setDays(getChallengeDayBreakdown(current));
    } else {
      setDays([]);
    }
  };

  useEffect(() => {
    refresh();
    const handleUpdate = () => refresh();
    window.addEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(CHALLENGE_UPDATED_EVENT, handleUpdate);
  }, []);

  if (!activeChallenge || activeChallenge.status !== 'active') {
    return (
      <div className="challenge-card challenge-card--entry">
        <div className="challenge-card-header">
          <span className="challenge-card-icon">🏆</span>
          <div className="challenge-card-text">
            <span className="challenge-card-title">{t.challenge_home_entry_title || 'Ability Challenges'}</span>
            <span className="challenge-card-sub">
              {t.challenge_home_entry_sub || 'Practice Resume-Ability with a 1, 3, 7, 30, or 90-day challenge.'}
            </span>
          </div>
        </div>
        <button
          id="btn-home-start-challenge"
          className="challenge-card-cta"
          onClick={() => onNavigate('challenges')}
        >
          <span>{t.challenge_btn_choose || 'Choose Challenge'}</span>
          <span className="challenge-card-arrow">→</span>
        </button>
      </div>
    );
  }

  // Active Challenge view
  const { currentDay, durationDays, daysRemaining, relevantEventCounts } = activeChallenge;

  return (
    <div className="challenge-card challenge-card--active" id="active-challenge-card">
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
          {relevantEventCounts.eligibleSlips > 0
            ? `${relevantEventCounts.resumedSlips}/${relevantEventCounts.eligibleSlips} ${t.challenge_resumed_label || 'resumed'} (${relevantEventCounts.resumeRate}%)`
            : (t.challenge_no_slips_yet || 'No Resume opportunities yet')}
        </span>
      </div>

      <button
        id="btn-home-view-challenge"
        className="challenge-card-btn"
        onClick={() => onNavigate('challenges')}
      >
        <span>{t.challenge_btn_view || 'View Challenge'}</span>
        <span className="challenge-card-arrow">→</span>
      </button>
    </div>
  );
};
