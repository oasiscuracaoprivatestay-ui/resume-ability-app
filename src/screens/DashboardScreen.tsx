import { useMemo } from 'react';
import type { Screen } from '../types';
import { loadSlips, computeDashboard, formatDuration } from '../utils';
import { calculateDailyResumeAbilityScore } from '../utils/dailyScore';
import { loadRecommitEvents } from '../utils/recommitStorage';
import { loadInControlEvents, loadCommitEvents } from '../utils/inControlStorage';
import { loadReviewEvents } from '../utils/reviewStorage';
import {
  getCheckIns,
  getTodayCheckIns,
  getCheckInsLastNDays,
  getStatusCounts,
  getStatusPercentages,
  getDominantStatus,
  getTotalCheckInCount,
} from '../utils/checkInStorage';
import { getNonNegotiableReviewCount } from '../utils/pledgeStorage';
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

  const scoreResult = useMemo(() => {
    return calculateDailyResumeAbilityScore({
      checkIns: getCheckIns(),
      slips: loadSlips(),
      recommits: loadRecommitEvents(),
      inControlEvents: loadInControlEvents(),
      commitEvents: loadCommitEvents(),
      reviewEvents: loadReviewEvents(),
    });
  }, []);

  const feedbackMessage = useMemo(() => {
    switch (scoreResult.feedbackKey) {
      case 'high_recovery':
        return t.score_feedback_high_recovery;
      case 'strong_structure':
        return t.score_feedback_strong_structure;
      case 'slips_no_recommit':
        return t.score_feedback_slips_no_recommit;
      case 'low_engagement':
        return t.score_feedback_low_engagement;
      case 'no_activity':
      default:
        return t.score_feedback_no_activity;
    }
  }, [scoreResult.feedbackKey, t]);

  // Circumference for r=60 is 2 * PI * 60 = 376.99
  const CIRC = 2 * Math.PI * 60;
  const strokeOffset = CIRC * (1 - scoreResult.score / 100);

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

        {/* ── Daily Resume-Ability Score Hero Section ── */}
        <div className="resume-score-section">
          <div className="resume-score-header">
            <span className="section-label">{t.dash_resume_ability_score_label}</span>
          </div>

          <div className="resume-score-hero-card">
            <div className="resume-score-dial-wrap">
              <svg className="resume-score-svg" viewBox="0 0 160 160" aria-hidden="true">
                <defs>
                  <linearGradient id="resume-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                  <filter id="resume-score-glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  className="resume-score-track"
                  cx="80"
                  cy="80"
                  r="60"
                  fill="none"
                  strokeWidth="8"
                />
                {scoreResult.score > 0 && (
                  <circle
                    className="resume-score-progress"
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="url(#resume-score-grad)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={strokeOffset}
                    transform="rotate(-90 80 80)"
                    filter="url(#resume-score-glow)"
                  />
                )}
              </svg>

              <div className="resume-score-center">
                <span className="resume-score-number" id="dash-score-value">{scoreResult.score}</span>
                <span className="resume-score-denom">/ 100</span>
              </div>
            </div>

            <p className="resume-score-feedback" id="dash-score-feedback">{feedbackMessage}</p>
          </div>
        </div>

        {data.slipsToday === 0 && data.averageRecoverySeconds === 0
          && scoreResult.rawPoints === 0 && (
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
    const nnReviewCount = getNonNegotiableReviewCount();

    return { todayCounts, week7Counts, week7Pct, dominant, totalCheckIns, nnReviewCount };
  }, []);

  const { todayCounts, week7Counts, week7Pct, dominant, totalCheckIns, nnReviewCount } = kpi;

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

      {/* ── Insight ──────────────────────────────────────────────────────────────── */}
      <div className="kpi-insight">
        <p className="kpi-insight-text">{insight}</p>
      </div>

      {/* ── Compact NN Reviews stat row ────────────────────────────────────── */}
      <div className="kpi-nn-review-row">
        <span className="kpi-nn-review-label">{t.kpi_nn_reviews_label}</span>
        <span className="kpi-nn-review-value">{nnReviewCount}</span>
      </div>
    </div>
  );
}
