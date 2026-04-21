import { useState, useCallback, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../config';
import LanguageSelector from '../components/LanguageSelector';
import {
  loadToday,
  recordBalance,
  recordSlip,
  dailyScore,
  type DayRecord,
} from '../utils/balanceStorage';
import './ControlHomeScreen.css';

interface ControlHomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

type FeedbackState = 'idle' | 'balance-success' | 'slip-recorded';

// Ring geometry — pure SVG, custom to this screen
const RING_RADIUS = 110;
const RING_CX = 150;
const RING_CY = 150;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function ControlHomeScreen({ onNavigate }: ControlHomeScreenProps) {
  const { t } = useTranslation();

  const [day, setDay] = useState<DayRecord>(loadToday);
  const [feedback, setFeedback] = useState<FeedbackState>('idle');
  const [pulseKey, setPulseKey] = useState(0); // force animation restart

  // Auto-refresh at midnight so score resets without requiring a reload
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };
    const timer = setTimeout(() => setDay(loadToday()), msUntilMidnight());
    return () => clearTimeout(timer);
  }, [day.date]);

  // Ring progress: based on balance checks, capped visually at 10 for the ring
  const ringProgress = Math.min(day.balanceCount / 10, 1);
  const strokeDashoffset = RING_CIRC * (1 - ringProgress);
  const score = dailyScore(day);

  const handleBalance = useCallback(() => {
    const updated = recordBalance();
    setDay(updated);
    setFeedback('balance-success');
    setPulseKey((k) => k + 1);
    // Haptic feedback (supported on mobile)
    if (navigator.vibrate) navigator.vibrate(40);
    setTimeout(() => setFeedback('idle'), 2800);
  }, []);

  const handleSlip = useCallback(() => {
    const updated = recordSlip();
    setDay(updated);
    setFeedback('slip-recorded');
    setTimeout(() => setFeedback('idle'), 2000);
    // Navigate to slip flow
    onNavigate('context');
  }, [onNavigate]);

  const handleExit = () => {
    history.back();
    setTimeout(() => window.close(), 200);
  };

  return (
    <div className="screen ch-screen">
      {/* ── Top bar ── */}
      <header className="ch-top-bar">
        <button
          className="home-brand-btn"
          onClick={() => onNavigate('home')}
          aria-label="Home"
        >
          <span className="home-brand-title">{t.home_brand_title}</span>
          <span className="home-brand-sub">{t.home_brand}</span>
        </button>
        <div className="home-top-right">
          <LanguageSelector />
          <button
            id="btn-exit-app"
            className="home-exit-btn"
            onClick={handleExit}
            aria-label={t.home_exit}
          >
            <span className="home-exit-icon">✕</span>
            <span className="home-exit-label">{t.home_exit}</span>
          </button>
        </div>
      </header>

      {/* ── Title block ── */}
      <div className="ch-title-block">
        <h1 className="ch-title">In Control</h1>
        <p className="ch-subtitle">Maintain your balance, one check at a time</p>
      </div>

      {/* ── Hero ring + CTA ── */}
      <div className={`ch-ring-wrap${feedback === 'balance-success' ? ' ch-ring-wrap--pulse' : ''}`}>
        {/* Ambient glow behind ring */}
        <div className="ch-ring-glow" />

        {/* SVG ring — redraws on every balance tap */}
        <svg
          className="ch-ring-svg"
          viewBox="0 0 300 300"
          aria-hidden="true"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id="ch-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
            <filter id="ch-ring-glow-filter">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle
            className="ch-ring-track"
            cx={RING_CX}
            cy={RING_CY}
            r={RING_RADIUS}
            fill="none"
            strokeWidth="7"
          />
          {/* Progress arc */}
          <circle
            className="ch-ring-arc"
            cx={RING_CX}
            cy={RING_CY}
            r={RING_RADIUS}
            fill="none"
            stroke="url(#ch-ring-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
            filter="url(#ch-ring-glow-filter)"
          />
        </svg>

        {/* Inner content */}
        <div className="ch-ring-inner">
          {feedback === 'idle' && (
            <>
              <span className="ch-ring-label">Balance Check</span>
              <span className="ch-ring-hint">Tap to confirm you stayed in control</span>
            </>
          )}
          {feedback === 'balance-success' && (
            <span key={pulseKey} className="ch-ring-success">
              Well done.<br />Keep your balance.
            </span>
          )}
          {feedback === 'slip-recorded' && (
            <span className="ch-ring-slip-msg">
              Recorded.<br />Let's recover.
            </span>
          )}

          {/* Main CTA */}
          <button
            id="btn-maintained-balance"
            className={`ch-cta-btn${feedback === 'balance-success' ? ' ch-cta-btn--success' : ''}`}
            onClick={handleBalance}
          >
            I Maintained Balance
          </button>
        </div>
      </div>

      {/* ── Score counters ── */}
      <div className="ch-scores">
        <div className="ch-score-card ch-score-card--balance">
          <span className="ch-score-value">{day.balanceCount}</span>
          <span className="ch-score-label">Balance Kept</span>
        </div>
        <div className="ch-score-divider" />
        <div className="ch-score-card ch-score-card--slip">
          <span className="ch-score-value">{day.slipCount}</span>
          <span className="ch-score-label">Slips</span>
        </div>
      </div>

      {/* Daily score line */}
      <p className={`ch-daily-score${score >= 0 ? ' ch-daily-score--pos' : ' ch-daily-score--neg'}`}>
        Daily Score: {score >= 0 ? '+' : ''}{score}
      </p>

      {/* Hourly hint */}
      <p className="ch-hint">Check in at least once every hour</p>

      {/* ── Secondary slip button ── */}
      <button
        id="btn-i-slipped"
        className="ch-slip-btn"
        onClick={handleSlip}
      >
        I Slipped
      </button>

      {/* ── Bottom navigation ── */}
      <nav className="home-nav">
        <button id="nav-dashboard" className="nav-link" onClick={() => onNavigate('dashboard')}>
          {t.home_dashboard}
        </button>
        <span className="nav-dot">·</span>
        <button id="nav-daily-audio" className="nav-link" onClick={() => onNavigate('daily-audio')}>
          {t.home_daily_audio}
        </button>
        <span className="nav-dot">·</span>
        <button id="nav-history" className="nav-link" onClick={() => onNavigate('history')}>
          {t.home_history}
        </button>
      </nav>

      {/* ── Feedback ── */}
      <button
        id="btn-feedback"
        className="home-feedback-btn"
        onClick={() =>
          window.open(
            `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`,
            '_blank',
          )
        }
        aria-label={t.home_feedback}
      >
        <span className="home-feedback-icon">✉️</span>
        <span>{t.home_feedback}</span>
      </button>
    </div>
  );
}
