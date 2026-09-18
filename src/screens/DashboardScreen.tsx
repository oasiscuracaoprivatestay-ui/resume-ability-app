import { useState, useEffect, useMemo } from 'react';
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
import { loadWeeklyDiet, getDayPlan, getLocalTodayKey } from '../utils/dietStorage';
import { getDailyVerificationStats, loadAllDietVerifications } from '../utils/dietVerificationStorage';
import { getAwarenessSummary } from '../utils/dietStructureAnalytics';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import {
  getTodayScore,
  getDateScoreBreakdown,
  SCORE_UPDATED_EVENT,
  type ScoreActivityType,
} from '../utils/scoringEngine';
import {
  getProgressionOverview,
} from '../utils/progressionEngine';
import LevelProgressBar from '../components/LevelProgressBar';
import ResetStatsModal from '../components/ResetStatsModal';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import TermHelp from '../components/TermHelp';
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
  onBack?: () => void;
}

export default function DashboardScreen({ onNavigate, onBack }: DashboardScreenProps) {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    const handleReset = () => setRefreshKey((k) => k + 1);
    window.addEventListener(STATS_RESET_EVENT, handleReset);
    window.addEventListener(SCORE_UPDATED_EVENT, handleReset);
    return () => {
      window.removeEventListener(STATS_RESET_EVENT, handleReset);
      window.removeEventListener(SCORE_UPDATED_EVENT, handleReset);
    };
  }, []);

  const progressionOverview = useMemo(() => {
    return getProgressionOverview();
  }, [refreshKey]);

  const todayScore = useMemo(() => {
    return getTodayScore();
  }, [refreshKey]);

  const todayBreakdown = useMemo(() => {
    return getDateScoreBreakdown();
  }, [refreshKey]);

  const categoryLabels: Record<ScoreActivityType, { label: string; icon: string }> = useMemo(() => ({
    DAY_START: { label: t.score_cat_day_start, icon: '🌅' },
    DAILY_CHECK_IN: { label: t.score_cat_check_in, icon: '✓' },
    DIET_ON_TRACK: { label: t.score_cat_diet_on_track, icon: '🥗' },
    DIET_TWENTY_PERCENT_OFF_TRACK: { label: t.score_cat_diet_twenty_percent_off_track, icon: '🍎' },
    SLIP_REPORTED: { label: t.score_cat_slip_reported, icon: '⚡' },
    RECOMMIT: { label: t.score_cat_recommit, icon: '🔁' },
    DAILY_REVIEW_COMPLETE: { label: t.score_cat_daily_review, icon: '📝' },
    COMMITMENT_COMPLETE: { label: t.score_cat_commitment, icon: '🤝' },
    NON_NEGOTIABLES_REVIEW: { label: t.score_cat_non_negotiables, icon: '🛡️' },
    WHY_REVIEW: { label: t.score_cat_why_review, icon: '💡' },
    STRUCTURED_DIET_REVIEW: { label: t.score_cat_diet_review, icon: '📋' },
    SLIPPERY_ZONES_REVIEW: { label: t.score_cat_slippery_zones, icon: '⚠️' },
    I_AM_IN_CONTROL: { label: t.score_cat_in_control, icon: '✊' },
    MOTIVATION_CONSUMED: { label: t.score_cat_motivation, icon: '🎧' },
    TIMER_COMPLETED: { label: t.score_cat_timer, icon: '⏱️' },
    CONSISTENCY_BONUS: { label: t.score_cat_consistency_bonus, icon: '🔥' },
  }), [t]);

  const activeCategories = useMemo(() => {
    return (Object.entries(todayBreakdown) as [ScoreActivityType, number][])
      .filter(([_, pts]) => pts > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [todayBreakdown]);

  const data = useMemo(() => computeDashboard(loadSlips()), [refreshKey]);

  const scoreResult = useMemo(() => {
    return calculateDailyResumeAbilityScore({
      checkIns: getCheckIns(),
      slips: loadSlips(),
      recommits: loadRecommitEvents(),
      inControlEvents: loadInControlEvents(),
      commitEvents: loadCommitEvents(),
      reviewEvents: loadReviewEvents(),
    });
  }, [refreshKey]);

  const dietStats = useMemo(() => {
    const weekly = loadWeeklyDiet();
    const todayKey = getLocalTodayKey();
    const todayPlan = getDayPlan(weekly, todayKey);
    const plannedCount = todayPlan.mode === 'structured' ? todayPlan.blocks.length : 0;
    return getDailyVerificationStats(plannedCount);
  }, [refreshKey]);

  const todayAwareness = useMemo(() => {
    const all = loadAllDietVerifications();
    return getAwarenessSummary(all, 'today');
  }, [refreshKey]);

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
        onBack={onBack ? onBack : () => onNavigate('home')}
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

          {(dietStats.plannedCount > 0 || dietStats.reportedCount > 0) && (
            <div
              className="dash-card dash-card--interactive dash-card--diet-today"
              id="dash-card-diet-today"
              onClick={() => onNavigate('structured-diet')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('structured-diet'); }}
            >
              <div className="dash-card-header-row">
                <span className="dash-card-label">{t.dash_diet_today_title}</span>
                <span className="dash-card-action-hint">→</span>
              </div>
              <div className="dash-card-row">
                <span className="dash-card-value">
                  {t.sdb_v_reported_summary
                    .replace('{reported}', String(dietStats.reportedCount))
                    .replace('{total}', String(dietStats.plannedCount))}
                </span>
                <span className="dash-card-icon">🥗</span>
              </div>
              {dietStats.reportedCount > 0 && (
                <>
                  <div className="dash-diet-breakdown">
                    <span className="dash-diet-badge dash-diet-badge--on-track">
                      ✓ {dietStats.onTrackCount} {t.sdb_v_on_track}
                    </span>
                    {dietStats.slipCount > 0 && (
                      <span className="dash-diet-badge dash-diet-badge--slip">
                        ⚡ {dietStats.slipCount} {t.sdb_v_slip}
                      </span>
                    )}
                  </div>
                  {todayAwareness.structureStats.hasData && (
                    <div className="dash-diet-awareness-row" id="dash-diet-awareness-row">
                      <span className="dash-diet-awareness-item dash-diet-awareness-item--core">
                        {t.sdb_stat_structured_core}: {todayAwareness.structureStats.structuredCorePercentage}%
                      </span>
                      <span className="dash-diet-awareness-divider">•</span>
                      <span className="dash-diet-awareness-item dash-diet-awareness-item--outside">
                        {t.sdb_stat_outside_core}: {todayAwareness.structureStats.outsideCorePercentage}%
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Super Diet-Ability Progression Section ── */}
        <section className="dash-prog-section" aria-label={t.dash_progression_title}>
          <div className="dash-prog-header">
            <span className="section-label">SUPER DIET-ABILITY</span>
            <h2 className="section-heading">{t.dash_progression_title}</h2>
            <p className="dash-prog-slogan">{t.sda_slogan}</p>
            <p className="dash-prog-subtitle">{t.dash_progression_subtitle}</p>
          </div>

          {/* Primary Progression Cards */}
          <div className="dash-prog-cards">
            <div className="dash-prog-card dash-prog-card--today">
              <span className="dash-prog-card-lbl">{t.dash_today_score_label}</span>
              <div className="dash-prog-card-val-row">
                <span className="dash-prog-card-val dash-prog-card-val--accent" id="dash-today-score-val">
                  {todayScore}
                </span>
              </div>
            </div>

            <div className="dash-prog-card dash-prog-card--level">
              <span className="dash-prog-card-lbl">{t.level_label}</span>
              <div className="dash-prog-card-val-row">
                <span className="dash-prog-card-val dash-prog-card-val--gold" id="dash-current-level-val">
                  {progressionOverview.isLevel10 ? '👑 10' : `${progressionOverview.currentLevel}`}
                </span>
              </div>
            </div>

            <div className="dash-prog-card dash-prog-card--xp">
              <span className="dash-prog-card-lbl">{t.dash_lifetime_score_label}</span>
              <div className="dash-prog-card-val-row">
                <span className="dash-prog-card-val" id="dash-lifetime-xp-val">
                  {progressionOverview.lifetimeXp.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Progress to Next Level Indicator */}
          <LevelProgressBar overview={progressionOverview} />

          {/* Streak & Consistency Stats */}
          <div className="dash-prog-streak-row">
            <div className="dash-prog-streak-box">
              <span className="dash-prog-streak-icon">🔥</span>
              <span className="dash-prog-streak-val" id="dash-current-streak-val">
                {progressionOverview.currentStreak}
              </span>
              <span className="dash-prog-streak-lbl">{t.dash_current_streak_label}</span>
            </div>

            <div className="dash-prog-streak-box">
              <span className="dash-prog-streak-icon">⭐</span>
              <span className="dash-prog-streak-val" id="dash-longest-streak-val">
                {progressionOverview.longestStreak}
              </span>
              <span className="dash-prog-streak-lbl">{t.dash_longest_streak_label}</span>
            </div>

            <div className="dash-prog-streak-box">
              <span className="dash-prog-streak-icon">📅</span>
              <span className="dash-prog-streak-val" id="dash-active-days-val">
                {progressionOverview.totalActiveDays}
              </span>
              <span className="dash-prog-streak-lbl">{t.dash_total_active_days_label}</span>
            </div>
          </div>

          {/* Today's Points Breakdown */}
          <div className="dash-breakdown-card">
            <div className="dash-breakdown-header">
              <span className="dash-breakdown-title">{t.dash_score_breakdown_title}</span>
              <span className="dash-breakdown-total">{todayScore} pts</span>
            </div>

            {activeCategories.length === 0 ? (
              <p className="dash-breakdown-empty">{t.dash_score_breakdown_empty}</p>
            ) : (
              <div className="dash-breakdown-list">
                {activeCategories.map(([actType, pts]) => {
                  const meta = categoryLabels[actType] || { label: actType, icon: '•' };
                  return (
                    <div key={actType} className="dash-breakdown-item">
                      <div className="dash-breakdown-item-left">
                        <span className="dash-breakdown-item-icon">{meta.icon}</span>
                        <span className="dash-breakdown-item-label">{meta.label}</span>
                      </div>
                      <span className="dash-breakdown-item-pts">+{pts} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Daily Resume-Ability Score Hero Section ── */}
        <div className="resume-score-section">
          <div className="resume-score-header">
            <div className="resume-score-title-row">
              <span className="section-label">{t.dash_resume_ability_score_label}</span>
              <TermHelp termKey="ra" btnId="btn-help-dash-ra" />
            </div>
            <p className="resume-score-header-hint">{t.sda_term_ra_def}</p>
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
        <CheckInKPI t={t} refreshKey={refreshKey} />

        {/* ══ DATA & STATISTICS RESET ══ */}
        <div className="dash-reset-section">
          <div className="dash-reset-header">
            <span className="dash-reset-title">{t.stats_section_title}</span>
            <span className="dash-reset-desc">{t.stats_reset_section_desc}</span>
          </div>
          <button
            type="button"
            id="btn-dash-reset-all-stats"
            className="commit-reset-stats-btn"
            onClick={() => setShowResetModal(true)}
          >
            <span className="commit-reset-stats-icon" aria-hidden="true">↺</span>
            <span>{t.stats_reset_btn}</span>
          </button>
        </div>

      </div>

      <ResetStatsModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          setRefreshKey((k) => k + 1);
          setShowResetModal(false);
        }}
      />
    </div>
  );
}

// ── CheckInKPI ────────────────────────────────────────────────────────────────
// Self-contained sub-component so the parent's render stays clean.
// Re-reads data when refreshKey updates.

interface CheckInKPIProps {
  t: Translations;
  refreshKey: number;
}

function CheckInKPI({ t, refreshKey }: CheckInKPIProps) {
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
  }, [refreshKey]);

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
