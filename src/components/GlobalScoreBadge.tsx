import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { getTodayScore, getLifetimeScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { getCurrentLevel, getProgressionOverview } from '../utils/progressionEngine';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import ProgressionQuickModal from './ProgressionQuickModal';
import './GlobalScoreBadge.css';

export type GlobalScoreBadgeMode = 'prominent' | 'compact' | 'header';

interface GlobalScoreBadgeProps {
  mode?: GlobalScoreBadgeMode;
  onNavigate?: (screen: Screen) => void;
  onClick?: () => void;
}

export default function GlobalScoreBadge({
  mode = 'header',
  onNavigate,
  onClick,
}: GlobalScoreBadgeProps) {
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

  const progressionOverview = useMemo(() => {
    return getProgressionOverview();
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

  // ── PROMINENT MODE: Hero 3-Pillar Score Summary Card ────────────────────────
  if (mode === 'prominent') {
    return (
      <>
        <div
          id="card-global-score-prominent"
          className={`global-score-card-prominent ${isBumping ? 'global-score-card-prominent--bumping' : ''}`}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(e as unknown as React.MouseEvent);
            }
          }}
          title={titleText}
          aria-label={titleText}
        >
          {/* Pillar 1: Today's Score */}
          <div className="gsb-prominent-pillar gsb-prominent-pillar--today">
            <div className="gsb-prominent-pillar-header">
              <span className="gsb-prominent-icon gsb-prominent-icon--today" aria-hidden="true">⚡</span>
              <span className="gsb-prominent-label">{t.global_score_badge_today}</span>
            </div>
            <div className="gsb-prominent-val-row">
              <span id="val-score-today" className="gsb-prominent-value gsb-prominent-value--today">
                {todayScore}
              </span>
              <span className="gsb-prominent-unit">XP</span>
            </div>
            <span className="gsb-prominent-hint">{t.dash_today_score_label}</span>
          </div>

          <div className="gsb-prominent-divider" aria-hidden="true" />

          {/* Pillar 2: Current Level & Progress */}
          <div className="gsb-prominent-pillar gsb-prominent-pillar--level">
            <div className="gsb-prominent-pillar-header">
              <span className="gsb-prominent-icon gsb-prominent-icon--level" aria-hidden="true">🛡️</span>
              <span className="gsb-prominent-label">{t.global_score_badge_level}</span>
            </div>
            <div className="gsb-prominent-val-row">
              <span
                id="val-score-level"
                className={`gsb-prominent-value gsb-prominent-value--level ${
                  currentLevel === 10 ? 'gsb-prominent-value--max' : ''
                }`}
              >
                {currentLevel}
              </span>
            </div>
            <div className="gsb-prominent-progress-wrap">
              <div className="gsb-prominent-progress-track">
                <div
                  className="gsb-prominent-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round(progressionOverview.progressPercentage)))}%` }}
                />
              </div>
              <span className="gsb-prominent-progress-text">
                {progressionOverview.hasReachedLevel10
                  ? t.level_max_reached
                  : `${Math.round(progressionOverview.progressPercentage)}%`}
              </span>
            </div>
          </div>

          <div className="gsb-prominent-divider" aria-hidden="true" />

          {/* Pillar 3: Lifetime Score */}
          <div className="gsb-prominent-pillar gsb-prominent-pillar--lifetime">
            <div className="gsb-prominent-pillar-header">
              <span className="gsb-prominent-icon gsb-prominent-icon--lifetime" aria-hidden="true">🏆</span>
              <span className="gsb-prominent-label">{t.global_score_badge_lifetime}</span>
            </div>
            <div className="gsb-prominent-val-row">
              <span id="val-score-lifetime" className="gsb-prominent-value gsb-prominent-value--lifetime">
                {lifetimeScore.toLocaleString()}
              </span>
              <span className="gsb-prominent-unit">XP</span>
            </div>
            <span className="gsb-prominent-hint">{t.dash_lifetime_xp_label}</span>
          </div>

          <div className="gsb-prominent-chevron" aria-hidden="true">›</div>
        </div>

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

  // ── COMPACT / HEADER MODE ───────────────────────────────────────────────────
  return (
    <>
      <button
        id="btn-global-score-badge"
        className={`global-score-badge ${isBumping ? 'global-score-badge--bumping' : ''} ${
          mode === 'compact' ? 'global-score-badge--compact' : ''
        }`}
        onClick={handleClick}
        title={titleText}
        aria-label={titleText}
      >
        {/* Today's Score */}
        <div className="gsb-section gsb-section--today">
          <span className="gsb-icon" aria-hidden="true">⚡</span>
          <div className="gsb-val-wrap">
            <span id="val-score-today-compact" className="gsb-val gsb-val--today">{todayScore}</span>
            <span className="gsb-lbl">{t.global_score_badge_today}</span>
          </div>
        </div>

        <div className="gsb-divider" aria-hidden="true" />

        {/* Current Level */}
        <div className="gsb-section gsb-section--level">
          <span className={`gsb-level-pill ${currentLevel === 10 ? 'gsb-level-pill--max' : ''}`}>
            <span className="gsb-level-tag">{t.global_score_badge_level}</span>
            <span id="val-score-level-compact" className="gsb-level-num">{currentLevel}</span>
          </span>
        </div>

        <div className="gsb-divider" aria-hidden="true" />

        {/* Lifetime Score */}
        <div className="gsb-section gsb-section--lifetime">
          <div className="gsb-val-wrap">
            <span id="val-score-lifetime-compact" className="gsb-val gsb-val--lifetime">{lifetimeScore.toLocaleString()}</span>
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


