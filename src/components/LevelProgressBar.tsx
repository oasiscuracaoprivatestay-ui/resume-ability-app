import { useMemo } from 'react';
import { useTranslation } from '../i18n';
import {
  getProgressionOverview,
  type ProgressionOverview,
} from '../utils/progressionEngine';
import './LevelProgressBar.css';

interface LevelProgressBarProps {
  overview?: ProgressionOverview;
  compact?: boolean;
}

export default function LevelProgressBar({ overview: propOverview, compact = false }: LevelProgressBarProps) {
  const { t } = useTranslation();

  const overview = useMemo(() => {
    return propOverview || getProgressionOverview();
  }, [propOverview]);

  const {
    currentLevel,
    lifetimeXp,
    nextLevel,
    nextLevelThreshold,
    xpRemaining,
    progressPercentage,
    isLevel10,
  } = overview;

  return (
    <div className={`level-progress-wrap ${compact ? 'level-progress-wrap--compact' : ''}`}>
      {/* Top Header */}
      <div className="level-progress-header">
        <div className="level-badge-wrap">
          <span className={`level-badge-pill ${isLevel10 ? 'level-badge-pill--max' : ''}`}>
            {isLevel10 ? '👑' : '⭐'} {t.level_label} {currentLevel}
          </span>
          <span className="level-xp-text">
            {lifetimeXp.toLocaleString()} pts
          </span>
        </div>

        <div className="level-target-wrap">
          {isLevel10 ? (
            <span className="level-max-tag">{t.level_max_reached}</span>
          ) : (
            <span className="level-next-tag">
              {t.level_progress_to_next.replace('{level}', String(nextLevel))}
              {nextLevelThreshold !== null && (
                <span className="level-next-target-xp"> ({nextLevelThreshold.toLocaleString()} pts)</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="level-track" role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`level-fill ${isLevel10 ? 'level-fill--max' : ''}`}
          style={{ width: `${Math.max(4, Math.min(100, progressPercentage))}%` }}
        />
      </div>

      {/* Footer Info */}
      <div className="level-progress-footer">
        <span className="level-remaining-text">
          {isLevel10
            ? t.level_max_description
            : t.level_xp_remaining.replace('{xp}', xpRemaining.toLocaleString())}
        </span>
        <span className="level-pct-text">
          {progressPercentage}%
        </span>
      </div>
    </div>
  );
}
