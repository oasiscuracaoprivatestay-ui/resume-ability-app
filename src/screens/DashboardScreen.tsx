import { useMemo } from 'react';
import type { Screen } from '../types';
import { loadSlips, computeDashboard, formatDuration } from '../utils';
import { loadToday, dailyScore } from '../utils/balanceStorage';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './DashboardScreen.css';
import type { Translations } from '../i18n';

function getContextLabel(t: Translations, ctx: string): string {
  const map: Partial<Record<string, string>> = {
    'stress':         t.ctx_stress,
    'people-social':  t.ctx_people_social,
    'environment':    t.ctx_environment,
    'habit':          t.ctx_habit,
    'temptation':     t.ctx_temptation,
    'hunger':         t.ctx_hunger,
    'celebration':    t.ctx_celebration,
    'time-of-day':    t.ctx_time_of_day,
    'delay':          t.ctx_delay,
    'all-or-nothing': t.ctx_all_or_nothing,
    // legacy keys from before the 10-category refactor
    'late-night':     t.ctx_late_night,
    'social':         t.ctx_social,
    'boredom':        t.ctx_boredom,
    'after-meal':     t.ctx_after_meal,
  };
  return map[ctx] ?? '—';
}

function getContextIcon(ctx: string): string {
  const icons: Partial<Record<string, string>> = {
    'stress':         '😤',
    'people-social':  '👥',
    'environment':    '📍',
    'habit':          '🔁',
    'temptation':     '🍫',
    'hunger':         '🍽️',
    'celebration':    '🎉',
    'time-of-day':    '🕐',
    'delay':          '⏳',
    'all-or-nothing': '🔥',
    // legacy
    'late-night':     '🌙',
    'social':         '👥',
    'boredom':        '😶',
    'after-meal':     '🍽️',
  };
  return icons[ctx] ?? '❓';
}

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  const { t } = useTranslation();
  const data = useMemo(() => computeDashboard(loadSlips()), []);
  const balance = useMemo(() => loadToday(), []);
  const score = dailyScore(balance);

  return (
    <div className="screen dashboard-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="dashboard-content">
        <div className="dashboard-heading">
          <span className="section-label">{t.dash_label}</span>
          <h2 className="section-heading">{t.dash_heading}</h2>
        </div>

        <div className="dashboard-cards">
          <div className="dash-card">
            <span className="dash-card-label">{t.dash_slips_today}</span>
            <div className="dash-card-row">
              <span className="dash-card-value dash-card-value--accent">
                {String(data.slipsToday).padStart(2, '0')}
              </span>
              <span className="dash-card-icon">⊘</span>
            </div>
          </div>

          <div className="dash-card">
            <span className="dash-card-label">{t.dash_most_frequent}</span>
            <div className="dash-card-row">
              <span className="dash-card-value">
                {data.mostFrequentContext
                  ? `${getContextIcon(data.mostFrequentContext)} ${getContextLabel(t, data.mostFrequentContext)}`
                  : '—'}
              </span>
              <span className="dash-card-icon">◉</span>
            </div>
          </div>

          <div className="dash-card">
            <span className="dash-card-label">{t.dash_avg_recovery}</span>
            <div className="dash-card-row">
              <span className="dash-card-value">
                {data.averageRecoverySeconds > 0
                  ? formatDuration(data.averageRecoverySeconds)
                  : '—'}
              </span>
              <span className="dash-card-icon">⏱</span>
            </div>
          </div>
        </div>

        {/* ── Balance Score section ── */}
        <div className="balance-section">
          <div className="balance-section-header">
            <span className="section-label">Today's Balance</span>
            <span className="balance-tagline">Balance Kept − Slips = Daily Score</span>
          </div>

          {/* Hero card: Balance Kept */}
          <div className="balance-hero-card">
            <div className="balance-hero-inner">
              <div className="balance-hero-left">
                <span className="balance-hero-label">Balance Kept</span>
                <span className="balance-hero-value">{balance.balanceCount}</span>
                <span className="balance-hero-sub">check-ins today</span>
              </div>
              <div className="balance-hero-icon">✓</div>
            </div>
          </div>

          {/* Sub-row: Slips + Score */}
          <div className="balance-sub-grid">
            <div className="balance-sub-card balance-sub-card--slip">
              <span className="balance-sub-label">Slips Today</span>
              <span className="balance-sub-value">{balance.slipCount}</span>
            </div>
            <div className={`balance-sub-card balance-sub-card--score${
              score >= 0 ? ' balance-sub-card--score-pos' : ' balance-sub-card--score-neg'
            }`}>
              <span className="balance-sub-label">Daily Score</span>
              <span className="balance-sub-value">
                {score >= 0 ? '+' : ''}{score}
              </span>
            </div>
          </div>
        </div>

        {data.slipsToday === 0 && data.averageRecoverySeconds === 0
          && balance.balanceCount === 0 && (
          <p className="dashboard-empty">
            {t.dash_empty}
          </p>
        )}
      </div>
    </div>
  );
}
