import { useState, useCallback } from 'react';
import type { Screen, SlipContext, SlipStatus } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import {
  loadSlips,
  clearSlips,
  filterSlipsByRange,
  computeWeeklyHistory,
  formatDuration,
  formatDateTime,
} from '../utils';
import type { HistoryRange } from '../utils';
import { useTranslation } from '../i18n';
import type { Translations } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './HistoryScreen.css';

// ── Helpers ──

type ViewTab = 'summary' | 'log';

const RANGES: HistoryRange[] = ['today', '7d', '30d', 'all'];

const RANGE_KEYS: Record<HistoryRange, keyof Translations> = {
  today: 'hist_range_today',
  '7d': 'hist_range_7d',
  '30d': 'hist_range_30d',
  all: 'hist_range_all',
};

function getContextLabel(t: Translations, ctx: SlipContext): string {
  const map: Record<SlipContext, string> = {
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
  };
  return map[ctx];
}

function getStatusLabel(t: Translations, status: SlipStatus): string {
  const map: Record<SlipStatus, string> = {
    recovered: t.hist_status_recovered,
    extended: t.hist_status_extended,
    relapsed: t.hist_status_relapsed,
  };
  return map[status];
}

function getModeLabel(mode: string): string {
  const map: Record<string, string> = {
    single: 'Single',
    loop: 'Loop',
    'extended-fast': 'Extended',
  };
  return map[mode] || mode;
}

// ── Component ──

interface HistoryScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HistoryScreen({ onNavigate }: HistoryScreenProps) {
  const { t } = useTranslation();

  const [range, setRange] = useState<HistoryRange>('all');
  const [tab, setTab] = useState<ViewTab>('summary');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load and filter data (refreshKey forces re-read from localStorage)
  const allSlips = loadSlips();
  void refreshKey; // consumed to trigger re-render
  const filtered = filterSlipsByRange(allSlips, range);
  const weeks = computeWeeklyHistory(filtered);

  // Summary stats for filtered range
  const totalSlips = filtered.length;
  const avgRecovery =
    totalSlips > 0
      ? Math.round(filtered.reduce((s, r) => s + r.recoveryDuration, 0) / totalSlips)
      : 0;

  const contextCounts: Partial<Record<SlipContext, number>> = {};
  for (const s of filtered) {
    contextCounts[s.context] = (contextCounts[s.context] || 0) + 1;
  }
  let mostCommon: SlipContext | null = null;
  let maxCount = 0;
  for (const [ctx, count] of Object.entries(contextCounts)) {
    if (count! > maxCount) {
      maxCount = count!;
      mostCommon = ctx as SlipContext;
    }
  }

  // Log entries (newest first)
  const logEntries = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleClear = useCallback(() => {
    clearSlips();
    setShowClearConfirm(false);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="screen history-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="history-content">
        <div className="history-heading">
          <span className="section-label">{t.hist_label}</span>
          <h2 className="section-heading">{t.hist_heading}</h2>
        </div>

        {/* ── Range selector ── */}
        <div className="hist-range-bar">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`hist-range-pill${range === r ? ' hist-range-pill--active' : ''}`}
              onClick={() => setRange(r)}
            >
              {t[RANGE_KEYS[r]] as string}
            </button>
          ))}
        </div>

        {/* ── Tab selector ── */}
        <div className="hist-tab-bar">
          <button
            className={`hist-tab${tab === 'summary' ? ' hist-tab--active' : ''}`}
            onClick={() => setTab('summary')}
          >
            {t.hist_tab_summary}
          </button>
          <button
            className={`hist-tab${tab === 'log' ? ' hist-tab--active' : ''}`}
            onClick={() => setTab('log')}
          >
            {t.hist_tab_log}
          </button>
        </div>

        {totalSlips === 0 ? (
          <p className="history-empty">{t.hist_empty}</p>
        ) : tab === 'summary' ? (
          /* ── Summary view ── */
          <div className="hist-summary">
            {/* Quick stats */}
            <div className="hist-stat-row">
              <div className="hist-stat-card">
                <span className="hist-stat-value hist-stat-value--accent">
                  {String(totalSlips).padStart(2, '0')}
                </span>
                <span className="hist-stat-label">{t.hist_total_slips}</span>
              </div>
              <div className="hist-stat-card">
                <span className="hist-stat-value">
                  {avgRecovery > 0 ? formatDuration(avgRecovery) : '—'}
                </span>
                <span className="hist-stat-label">{t.hist_avg_recovery}</span>
              </div>
              <div className="hist-stat-card">
                <span className="hist-stat-value">
                  {mostCommon
                    ? `${SLIP_CONTEXT_ICONS[mostCommon]} ${getContextLabel(t, mostCommon)}`
                    : '—'}
                </span>
                <span className="hist-stat-label">{t.hist_most_common}</span>
              </div>
            </div>

            {/* Weekly trend cards */}
            <div className="history-weeks">
              {weeks.map((week, i) => {
                const prev = weeks[i + 1];
                const speedTrend = prev
                  ? week.averageRecoverySeconds < prev.averageRecoverySeconds
                    ? 'faster'
                    : week.averageRecoverySeconds > prev.averageRecoverySeconds
                      ? 'slower'
                      : 'same'
                  : null;
                const freqTrend = prev
                  ? week.slipCount < prev.slipCount
                    ? 'fewer'
                    : week.slipCount > prev.slipCount
                      ? 'more'
                      : 'same'
                  : null;

                return (
                  <div key={week.weekLabel} className="history-week-card">
                    <div className="week-label">{week.weekLabel}</div>
                    <div className="week-stats">
                      <div className="week-stat">
                        <span className="week-stat-value">
                          {formatDuration(week.averageRecoverySeconds)}
                        </span>
                        <span className="week-stat-label">
                          {t.hist_avg_recovery}
                          {speedTrend && (
                            <span
                              className={`trend trend-${speedTrend === 'faster' ? 'good' : speedTrend === 'slower' ? 'bad' : 'neutral'}`}
                            >
                              {speedTrend === 'faster' ? ' ↓' : speedTrend === 'slower' ? ' ↑' : ''}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="week-stat">
                        <span className="week-stat-value">{week.slipCount}</span>
                        <span className="week-stat-label">
                          {t.hist_slips}
                          {freqTrend && (
                            <span
                              className={`trend trend-${freqTrend === 'fewer' ? 'good' : freqTrend === 'more' ? 'bad' : 'neutral'}`}
                            >
                              {freqTrend === 'fewer' ? ' ↓' : freqTrend === 'more' ? ' ↑' : ''}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── Log view ── */
          <div className="hist-log">
            {logEntries.map((entry) => {
              const dt = formatDateTime(entry.timestamp);
              return (
                <div key={entry.id} className="hist-log-entry">
                  <div className="hist-log-top">
                    <span className="hist-log-date">{dt.date}</span>
                    <span className="hist-log-time">{dt.time}</span>
                    <span
                      className={`hist-log-status hist-log-status--${entry.status}`}
                    >
                      {getStatusLabel(t, entry.status)}
                    </span>
                  </div>
                  <div className="hist-log-bottom">
                    <span className="hist-log-context">
                      {SLIP_CONTEXT_ICONS[entry.context]}{' '}
                      {getContextLabel(t, entry.context)}
                    </span>
                    <span className="hist-log-meta">
                      {formatDuration(entry.recoveryDuration)} · {getModeLabel(entry.mode)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="hist-footer">
          <button className="hist-footer-btn" onClick={handleRefresh}>
            {t.hist_refresh}
          </button>
          <button
            className="hist-footer-btn hist-footer-btn--danger"
            onClick={() => setShowClearConfirm(true)}
          >
            {t.hist_clear}
          </button>
        </div>

        {/* ── Clear confirmation modal ── */}
        {showClearConfirm && (
          <div className="hist-modal-overlay" onClick={() => setShowClearConfirm(false)}>
            <div className="hist-modal" onClick={(e) => e.stopPropagation()}>
              <p className="hist-modal-text">{t.hist_clear_confirm}</p>
              <div className="hist-modal-actions">
                <button
                  className="hist-modal-btn hist-modal-btn--danger"
                  onClick={handleClear}
                >
                  {t.hist_clear_yes}
                </button>
                <button
                  className="hist-modal-btn"
                  onClick={() => setShowClearConfirm(false)}
                >
                  {t.hist_clear_no}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
