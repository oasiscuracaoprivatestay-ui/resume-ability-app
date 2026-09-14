import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { getTodayScore, getLifetimeScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { getCurrentLevel } from '../utils/progressionEngine';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import ProgressionQuickModal from './ProgressionQuickModal';
import './GlobalScoreBadge.css';

interface GlobalScoreBadgeProps {
  onNavigate?: (screen: Screen) => void;
  onClick?: () => void;
}

export default function GlobalScoreBadge({ onNavigate, onClick }: GlobalScoreBadgeProps) {
  const { t } = useTranslation();
  const [updateKey, setUpdateKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBumping, setIsBumping] = useState(false);
  const isMounted = useRef(false);

  useEffect(() => {
    const handleUpdate = () => {
      setUpdateKey((k) => k + 1);
      if (isMounted.current) {
        setIsBumping(true);
        setTimeout(() => setIsBumping(false), 500);
      }
    };
    isMounted.current = true;
    window.addEventListener(SCORE_UPDATED_EVENT, handleUpdate);
    window.addEventListener(STATS_RESET_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(SCORE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(STATS_RESET_EVENT, handleUpdate);
    };
  }, []);

  const todayScore = useMemo(() => {
    return getTodayScore();
  }, [updateKey]);

  const lifetimeScore = useMemo(() => {
    return getLifetimeScore();
  }, [updateKey]);

  const currentLevel = useMemo(() => {
    return getCurrentLevel();
  }, [updateKey]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      setIsModalOpen(true);
    }
  };

  const titleText = `${t.global_score_badge_title} (${t.global_score_badge_today}: ${todayScore} pts • ${t.global_score_badge_level} ${currentLevel} • ${t.global_score_badge_lifetime}: ${lifetimeScore} pts)`;

  return (
    <>
      <button
        id="btn-global-score-badge"
        className={`global-score-badge ${isBumping ? 'global-score-badge--bumping' : ''}`}
        onClick={handleClick}
        title={titleText}
        aria-label={titleText}
      >
        {/* Today's Score (Prominent) */}
        <div className="gsb-section gsb-section--today">
          <span className="gsb-icon" aria-hidden="true">⚡</span>
          <div className="gsb-val-wrap">
            <span className="gsb-val gsb-val--today">{todayScore}</span>
            <span className="gsb-lbl">{t.global_score_badge_today}</span>
          </div>
        </div>

        <div className="gsb-divider" aria-hidden="true" />

        {/* Current Level */}
        <div className="gsb-section gsb-section--level">
          <span className={`gsb-level-pill ${currentLevel === 10 ? 'gsb-level-pill--max' : ''}`}>
            <span className="gsb-level-tag">{t.global_score_badge_level}</span>
            <span className="gsb-level-num">{currentLevel}</span>
          </span>
        </div>

        <div className="gsb-divider" aria-hidden="true" />

        {/* Lifetime Score */}
        <div className="gsb-section gsb-section--lifetime">
          <div className="gsb-val-wrap">
            <span className="gsb-val gsb-val--lifetime">{lifetimeScore.toLocaleString()}</span>
            <span className="gsb-lbl">{t.global_score_badge_lifetime}</span>
          </div>
        </div>
      </button>

      {!onClick && (
        <ProgressionQuickModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

