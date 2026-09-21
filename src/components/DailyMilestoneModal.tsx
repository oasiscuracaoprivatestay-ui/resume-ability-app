import React, { useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { playFeedback } from '../utils/feedback';
import {
  type DailyMilestoneTier,
  markMilestoneCelebrated,
} from '../utils/dailyMilestonesStorage';
import { getLocalDateKey } from '../utils/dietStorage';
import './DailyMilestoneModal.css';

interface DailyMilestoneModalProps {
  tier: DailyMilestoneTier;
  onClose: () => void;
}

const TIER_ICONS: Record<DailyMilestoneTier, string> = {
  25: '🥉',
  50: '🥈',
  100: '🥇',
  150: '💎',
};

export default function DailyMilestoneModal({ tier, onClose }: DailyMilestoneModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    // Play sound & haptic feedback respecting user preferences in feedbackSettingsStorage
    playFeedback('win');
  }, []);

  const handleDismiss = () => {
    // Mark this tier celebrated for today so it will not re-trigger
    markMilestoneCelebrated(tier, getLocalDateKey());
    onClose();
  };

  // Generate celebratory sparks with tier-specific hues
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => (
      <div
        key={i}
        className="milestone-particle"
        style={{
          '--i': i,
          '--delay': `${(i * 0.12).toFixed(2)}s`,
          left: `${(i * 4.9 + 5) % 90}%`,
        } as React.CSSProperties}
      />
    ));
  }, []);

  const titleKey = `milestone_${tier}_title` as keyof typeof t;
  const descKey = `milestone_${tier}_desc` as keyof typeof t;

  const milestoneTitle = (t[titleKey] as string) || `${tier} Points Reached`;
  const milestoneDesc = (t[descKey] as string) || `You've earned ${tier} points today!`;

  return (
    <div
      className="milestone-modal-backdrop"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-milestone-title"
    >
      <div
        className={`milestone-modal-card milestone-modal-card--tier-${tier}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="milestone-particles-wrap" aria-hidden="true">
          {particles}
        </div>

        <div className={`milestone-icon-ring milestone-icon-ring--tier-${tier}`}>
          <span className="milestone-main-icon" aria-hidden="true">
            {TIER_ICONS[tier]}
          </span>
        </div>

        <span className="milestone-celebration-kicker">
          {t.milestone_celebration_title}
        </span>

        <h2 id="daily-milestone-title" className="milestone-heading">
          {milestoneTitle}
        </h2>

        <div className="milestone-pts-badge">
          <span className="milestone-pts-num">{tier}</span>
          <span className="milestone-pts-text">{t.milestone_points_label}</span>
        </div>

        <p className="milestone-description">
          {milestoneDesc}
        </p>

        <button
          id="btn-daily-milestone-continue"
          type="button"
          className="milestone-continue-btn"
          onClick={handleDismiss}
        >
          {t.milestone_continue_btn} →
        </button>
      </div>
    </div>
  );
}
