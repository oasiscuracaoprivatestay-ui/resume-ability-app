import React, { useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { playFeedback } from '../utils/feedback';
import type {
  ChallengeInstance,
  ChallengeMilestoneMetadata,
} from '../challenges/types';
import { getDistinctPracticeDays } from '../challenges/challengeMilestones';
import './ChallengeMilestoneModal.css';

export interface ChallengeMilestoneModalProps {
  milestone: ChallengeMilestoneMetadata;
  challenge: ChallengeInstance;
  onDismiss: () => void;
  onReviewChallenge?: () => void;
}

export const ChallengeMilestoneModal: React.FC<ChallengeMilestoneModalProps> = ({
  milestone,
  challenge,
  onDismiss,
  onReviewChallenge,
}) => {
  const { t } = useTranslation();
  const continueBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management & Sound/Haptic feedback on mount
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Trigger subtle procedural sound & haptic feedback respecting preferences
    if (milestone.feedbackType) {
      playFeedback(milestone.feedbackType);
    } else if (milestone.category === 'recovery') {
      playFeedback('recovery');
    } else {
      playFeedback('win');
    }

    // Auto-focus primary continue button
    const timer = setTimeout(() => {
      continueBtnRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [milestone]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Decorative spark particles for visual pop (omitted when prefers-reduced-motion is active)
  const particles = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => (
      <div
        key={i}
        className="ch-milestone-particle"
        style={
          {
            '--i': i,
            '--delay': `${(i * 0.1).toFixed(2)}s`,
            left: `${(i * 5.2 + 6) % 92}%`,
          } as React.CSSProperties
        }
      />
    ));
  }, []);

  // Icon selection
  const icon = useMemo(() => {
    if (milestone.category === 'first_checkin') return '🎯';
    if (milestone.category === 'recovery') return '🔄';
    if (milestone.category === 'completion') return '🏆';
    return '⭐';
  }, [milestone.category]);

  const title = (t[milestone.titleKey as keyof typeof t] as string) || milestone.id;
  const desc = (t[milestone.descKey as keyof typeof t] as string) || '';
  const badge = (t[milestone.badgeKey as keyof typeof t] as string) || '';

  // Factual factual progress details (strictly authentic, no invented claims)
  const factualDetail = useMemo(() => {
    if (milestone.category === 'first_checkin') {
      return `${t.common_day || 'Day'} 1 • ${challenge.durationDays} ${t.common_days || 'Days Total'}`;
    }
    if (milestone.category === 'recovery') {
      const resumed = challenge.relevantEventCounts?.resumedSlips ?? 1;
      const totalSlips = challenge.relevantEventCounts?.eligibleSlips ?? 1;
      return `${resumed} ${t.challenge_resumed_count || 'Resumed'} / ${totalSlips} ${t.challenge_slips_recorded || 'True Slips'}`;
    }
    if (milestone.category === 'completion') {
      const distinctDays = getDistinctPracticeDays(challenge);
      return `${challenge.durationDays} ${t.common_days || 'Days'} • ${distinctDays} ${t.challenge_practice_days_checked || 'Days Practiced'}`;
    }
    return null;
  }, [milestone.category, challenge, t]);

  return (
    <div
      className="ch-milestone-backdrop"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        className={`ch-milestone-card ch-milestone-card--${milestone.category}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-milestone-title"
        aria-describedby="challenge-milestone-desc"
      >
        <div className="ch-milestone-particles" aria-hidden="true">
          {particles}
        </div>

        <button
          type="button"
          className="ch-milestone-close"
          onClick={onDismiss}
          aria-label={t.recommit_btn_cancel || 'Close'}
        >
          ✕
        </button>

        <div className={`ch-milestone-icon-ring ch-milestone-icon-ring--${milestone.category}`}>
          <span className="ch-milestone-icon" aria-hidden="true">
            {icon}
          </span>
        </div>

        {badge && (
          <span className="ch-milestone-badge">
            {badge}
          </span>
        )}

        <h2 id="challenge-milestone-title" className="ch-milestone-title">
          {title}
        </h2>

        {factualDetail && (
          <div className="ch-milestone-detail-pill">
            <span className="ch-milestone-detail-text">{factualDetail}</span>
          </div>
        )}

        <p id="challenge-milestone-desc" className="ch-milestone-desc">
          {desc}
        </p>

        {milestone.category === 'completion' && onReviewChallenge ? (
          <div className="ch-milestone-actions-dual">
            <button
              id="btn-milestone-review"
              type="button"
              className="ch-milestone-secondary-btn"
              onClick={onReviewChallenge}
            >
              {t.challenge_completion_btn_review || 'Review My Challenge'}
            </button>
            <button
              ref={continueBtnRef}
              id="btn-challenge-milestone-continue"
              type="button"
              className="ch-milestone-continue-btn"
              onClick={onDismiss}
            >
              <span>{t.challenge_btn_continue || 'Continue'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <button
            ref={continueBtnRef}
            id="btn-challenge-milestone-continue"
            type="button"
            className="ch-milestone-continue-btn"
            onClick={onDismiss}
          >
            <span>{t.challenge_btn_continue || 'Continue'}</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ChallengeMilestoneModal;
