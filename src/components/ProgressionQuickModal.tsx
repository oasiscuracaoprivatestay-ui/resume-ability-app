import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { getTodayScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import {
  getProgressionOverview,
  type ProgressionOverview,
} from '../utils/progressionEngine';
import LevelProgressBar from './LevelProgressBar';
import './ProgressionQuickModal.css';

interface ProgressionQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (screen: Screen) => void;
}

export default function ProgressionQuickModal({
  isOpen,
  onClose,
  onNavigate,
}: ProgressionQuickModalProps) {
  const { t } = useTranslation();
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => setUpdateKey((k) => k + 1);
    window.addEventListener(SCORE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SCORE_UPDATED_EVENT, handleUpdate);
  }, [isOpen]);

  const overview: ProgressionOverview = useMemo(() => {
    return getProgressionOverview();
  }, [updateKey]);

  const todayScore = useMemo(() => {
    return getTodayScore();
  }, [updateKey]);

  if (!isOpen) return null;

  return (
    <div className="pq-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pq-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pq-header">
          <div className="pq-title-wrap">
            <span className="pq-sparkle">⚡</span>
            <h3 className="pq-title">{t.global_score_badge_title}</h3>
          </div>
          <button
            id="btn-close-progression-modal"
            className="pq-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Score, Level, and Lifetime XP Banner */}
        <div className="pq-hero-banner">
          <div className="pq-hero-col">
            <span className="pq-hero-label">{t.dash_today_score_label}</span>
            <span className="pq-hero-val pq-hero-val--score">{todayScore} <small>pts</small></span>
          </div>
          <div className="pq-hero-divider" />
          <div className="pq-hero-col">
            <span className="pq-hero-label">{t.level_label}</span>
            <span className="pq-hero-val pq-hero-val--level">
              {overview.isLevel10 ? '👑 10' : `Lvl ${overview.currentLevel}`}
            </span>
          </div>
          <div className="pq-hero-divider" />
          <div className="pq-hero-col">
            <span className="pq-hero-label">{t.dash_lifetime_xp_label}</span>
            <span className="pq-hero-val pq-hero-val--lifetime">{overview.lifetimeXp.toLocaleString()} <small>XP</small></span>
          </div>
        </div>

        {/* Level Progress Indicator */}
        <LevelProgressBar overview={overview} compact />

        {/* Streak Stats Grid */}
        <div className="pq-stats-grid">
          <div className="pq-stat-box">
            <span className="pq-stat-icon">🔥</span>
            <span className="pq-stat-val">{overview.currentStreak}</span>
            <span className="pq-stat-lbl">{t.dash_current_streak_label}</span>
          </div>
          <div className="pq-stat-box">
            <span className="pq-stat-icon">⭐</span>
            <span className="pq-stat-val">{overview.longestStreak}</span>
            <span className="pq-stat-lbl">{t.dash_longest_streak_label}</span>
          </div>
          <div className="pq-stat-box">
            <span className="pq-stat-icon">📅</span>
            <span className="pq-stat-val">{overview.totalActiveDays}</span>
            <span className="pq-stat-lbl">{t.dash_total_active_days_label}</span>
          </div>
        </div>

        {/* Dashboard Link Button */}
        {onNavigate && (
          <button
            id="btn-quick-view-dashboard"
            className="pq-dashboard-btn"
            onClick={() => {
              onClose();
              onNavigate('dashboard');
            }}
          >
            📊 {t.dash_view_dashboard} →
          </button>
        )}
      </div>
    </div>
  );
}
