import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { getTodayScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { getCurrentLevel } from '../utils/progressionEngine';
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

  useEffect(() => {
    const handleUpdate = () => setUpdateKey((k) => k + 1);
    window.addEventListener(SCORE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SCORE_UPDATED_EVENT, handleUpdate);
  }, []);

  const todayScore = useMemo(() => {
    return getTodayScore();
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

  return (
    <>
      <button
        id="btn-global-score-badge"
        className="global-score-badge"
        onClick={handleClick}
        title={`${t.global_score_badge_title} (${todayScore} pts, Level ${currentLevel})`}
        aria-label={`${t.global_score_badge_title} (${todayScore} pts, Level ${currentLevel})`}
      >
        <span className="gsb-icon" aria-hidden="true">⚡</span>
        <span className="gsb-score">{todayScore}</span>
        <span className="gsb-dot" aria-hidden="true">•</span>
        <span className={`gsb-level ${currentLevel === 10 ? 'gsb-level--max' : ''}`}>
          {t.global_score_badge_level}.{currentLevel}
        </span>
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
