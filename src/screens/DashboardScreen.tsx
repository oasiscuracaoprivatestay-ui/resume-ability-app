import { useMemo } from 'react';
import type { Screen } from '../types';
import { loadSlips, computeDashboard, formatDuration } from '../utils';
import { loadToday, dailyScore } from '../utils/balanceStorage';
import {
  getTodayCheckIns,
  getCheckInsLastNDays,
  getStatusCounts,
  getStatusPercentages,
  getDominantStatus,
  getTotalCheckInCount,
} from '../utils/checkInStorage';
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

        {/* ══ Check-In KPI section ══ */}
        <CheckInKPI t={t} />

      </div>
    </div>
  );
}

// ── CheckInKPI ────────────────────────────────────────────────────────────────
// Self-contained sub-component so the parent's render stays clean.
// Reads localStorage exactly once per mount via useMemo.

interface CheckInKPIProps {
  t: Translations;
}

function CheckInKPI({ t }: CheckInKPIProps) {
  const kpi = useMemo(() => {
    const todayRecords  = getTodayCheckIns();
    const last7Records  = getCheckInsLastNDays(7);

    const todayCounts   = getStatusCounts(todayRecords);
    const week7Counts   = getStatusCounts(last7Records);
    const week7Pct      = getStatusPercentages(week7Counts);
    const dominant      = getDominantStatus(week7Counts);
    const totalCheckIns = getTotalCheckInCount();

    return { todayCounts, week7Counts, week7Pct, dominant, totalCheckIns };
  }, []);

  const { todayCounts, week7Counts, week7Pct, dominant, totalCheckIns } = kpi;

  // ── Insight message ────────────────────────────────────────────────────────
  let insight: string;
  if (week7Counts.total === 0) {
    insight = t.kpi_insight_none;
  } else if (dominant === 'on-structure') {
    insight = t.kpi_insight_on_structure;
  } else if (dominant === 'near-slip') {
    insight = t.kpi_insight_near_slip;
  } else if (dominant === 'slip') {
    insight = t.kpi_insight_slip;
  } else {
    insight = t.kpi_insight_mixed;  // tie (dominant === null) or unexpected
  }

  // ── Segmented bar widths (percentages already clamped/rounded) ─────────────
  const onPct   = week7Pct['on-structure'];
  const nearPct = week7Pct['near-slip'];
  const slipPct = week7Pct['slip'];

  return (
    <div className="kpi-section">
      {/* Header */}
      <div className="kpi-header">
        <span className="section-label">{t.kpi_section_label}</span>
        <h2 className="section-heading">{t.kpi_section_heading}</h2>
        <p className="kpi-sub">{t.kpi_section_sub}</p>
      </div>

      {/* ── CHECK-IN WINS HERO CARD ────────────────────────────── */}
      <div className="checkin-wins-card">
        <div className="checkin-wins-inner">
          <div className="checkin-wins-left">
            <span className="checkin-wins-label">{t.kpi_total_checkins}</span>
            <span className="checkin-wins-value">{totalCheckIns}</span>
            <span className="checkin-wins-sub">{t.ci_checkin_wins_label}</span>
          </div>
          <div className="checkin-wins-icon">✓</div>
        </div>
      </div>

      {/* ── TODAY ─────────────────────────────────────────────────────────── */}
      <div className="kpi-period-block">
        <span className="kpi-period-heading">{t.kpi_today_heading}</span>

        {todayCounts.total === 0 ? (
          <p className="kpi-empty">{t.kpi_no_checkins_today}</p>
        ) : (
          <div className="kpi-count-row">
            <div className="kpi-count kpi-count--on-structure">
              <span className="kpi-count-value">{todayCounts['on-structure']}</span>
              <span className="kpi-count-label">{t.kpi_status_on_structure}</span>
            </div>
            <div className="kpi-count kpi-count--near-slip">
              <span className="kpi-count-value">{todayCounts['near-slip']}</span>
              <span className="kpi-count-label">{t.kpi_status_near_slip}</span>
            </div>
            <div className="kpi-count kpi-count--slip">
              <span className="kpi-count-value">{todayCounts['slip']}</span>
              <span className="kpi-count-label">{t.kpi_status_slip}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── LAST 7 DAYS ───────────────────────────────────────────────────── */}
      <div className="kpi-period-block">
        <span className="kpi-period-heading">{t.kpi_7day_heading}</span>

        {week7Counts.total === 0 ? (
          <p className="kpi-empty">{t.kpi_insight_none}</p>
        ) : (
          <>
            {/* Stat grid */}
            <div className="kpi-stat-grid">
              <div className="kpi-stat kpi-stat--on-structure">
                <span className="kpi-stat-value">{week7Counts['on-structure']}</span>
                <span className="kpi-stat-pct">{onPct}%</span>
                <span className="kpi-stat-label">{t.kpi_status_on_structure}</span>
              </div>
              <div className="kpi-stat kpi-stat--near-slip">
                <span className="kpi-stat-value">{week7Counts['near-slip']}</span>
                <span className="kpi-stat-pct">{nearPct}%</span>
                <span className="kpi-stat-label">{t.kpi_status_near_slip}</span>
              </div>
              <div className="kpi-stat kpi-stat--slip">
                <span className="kpi-stat-value">{week7Counts['slip']}</span>
                <span className="kpi-stat-pct">{slipPct}%</span>
                <span className="kpi-stat-label">{t.kpi_status_slip}</span>
              </div>
            </div>

            {/* Segmented bar */}
            <div className="kpi-bar" role="img" aria-label="7-day status distribution">
              {onPct   > 0 && <div className="kpi-bar-seg kpi-bar-seg--on-structure" style={{ width: `${onPct}%` }} />}
              {nearPct > 0 && <div className="kpi-bar-seg kpi-bar-seg--near-slip"    style={{ width: `${nearPct}%` }} />}
              {slipPct > 0 && <div className="kpi-bar-seg kpi-bar-seg--slip"         style={{ width: `${slipPct}%` }} />}
            </div>

            {/* Bar legend */}
            <div className="kpi-legend">
              {onPct   > 0 && <span className="kpi-legend-item kpi-legend-item--on-structure">✓ {t.kpi_status_on_structure} {onPct}%</span>}
              {nearPct > 0 && <span className="kpi-legend-item kpi-legend-item--near-slip">⚡ {t.kpi_status_near_slip} {nearPct}%</span>}
              {slipPct > 0 && <span className="kpi-legend-item kpi-legend-item--slip">↻ {t.kpi_status_slip} {slipPct}%</span>}
            </div>
          </>
        )}
      </div>

      {/* ── Insight ───────────────────────────────────────────────────────── */}
      <div className="kpi-insight">
        <p className="kpi-insight-text">{insight}</p>
      </div>
    </div>
  );
}
