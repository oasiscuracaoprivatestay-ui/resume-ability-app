import { useMemo } from 'react';
import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_ICONS } from '../types';
import { useTranslation } from '../i18n';
import { loadSlips } from '../utils';
import { computeSlipInsights, type TargetSlipInfo, type TrendDirection } from '../utils/slipInsights';
import ScreenHeader from '../components/ScreenHeader';
import './SlipInsightsScreen.css';

interface SlipInsightsScreenProps {
  target: TargetSlipInfo;
  onContinue: () => void;
  onNavigate: (screen: Screen) => void;
}

const CTX_KEYS: Record<SlipContext, keyof ReturnType<typeof useTranslation>['t']> = {
  'stress':         'ctx_stress',
  'people-social':  'ctx_people_social',
  'environment':    'ctx_environment',
  'habit':          'ctx_habit',
  'temptation':     'ctx_temptation',
  'hunger':         'ctx_hunger',
  'celebration':    'ctx_celebration',
  'time-of-day':    'ctx_time_of_day',
  'delay':          'ctx_delay',
  'all-or-nothing': 'ctx_all_or_nothing',
};

export default function SlipInsightsScreen({
  target,
  onContinue,
  onNavigate,
}: SlipInsightsScreenProps) {
  const { t } = useTranslation();

  // Calculate insights from current slips in storage
  const insights = useMemo(() => {
    const allSlips = loadSlips();
    return computeSlipInsights(allSlips, target);
  }, [target]);

  // Determine back navigation destination
  const backDestination: Screen =
    target.slipType === 'non-negotiable' ? 'slip-non-negotiable' : 'context';

  // Format label and icon for the specific slip
  const targetLabel =
    target.slipType === 'non-negotiable'
      ? target.nonNegotiableText || t.slip_type_non_negotiable
      : (t[CTX_KEYS[target.context]] as string);

  const targetIcon =
    target.slipType === 'non-negotiable'
      ? '🛡️'
      : (SLIP_CONTEXT_ICONS[target.context] ?? '⚡');

  const renderTrendBadge = (trend: TrendDirection) => {
    switch (trend) {
      case 'up':
        return (
          <span className="insights-trend-badge insights-trend-badge--up">
            ↗ {t.insights_trend_up}
          </span>
        );
      case 'down':
        return (
          <span className="insights-trend-badge insights-trend-badge--down">
            ↘ {t.insights_trend_down}
          </span>
        );
      case 'stable':
        return (
          <span className="insights-trend-badge insights-trend-badge--stable">
            → {t.insights_trend_stable}
          </span>
        );
      case 'insufficient-data':
      default:
        return (
          <span className="insights-trend-badge insights-trend-badge--neutral">
            ⋯ {t.insights_trend_insufficient}
          </span>
        );
    }
  };

  return (
    <div className="screen insights-screen">
      <ScreenHeader
        onBack={() => onNavigate(backDestination)}
        onHome={() => onNavigate('home')}
      />

      <div className="insights-content">
        <div className="insights-heading">
          <span className="section-label">{t.insights_label}</span>
          <h2 className="insights-title">{t.insights_title}</h2>
          <p className="insights-subtitle">{t.insights_subtitle}</p>
        </div>

        <div className="insights-cards">
          {/* ── Card 1: Reported Slip Item ── */}
          <div className="insights-card" id="card-specific-insight">
            <div className="insights-card-header">
              <span className="insights-card-icon">{targetIcon}</span>
              <div className="insights-card-title-group">
                <span className="insights-card-category">{t.insights_card_specific_title}</span>
                <span className="insights-card-name">{targetLabel}</span>
              </div>
            </div>

            <div className="insights-metrics-row">
              <div className="insights-metric-item">
                <span className="insights-metric-val">{insights.targetTodayCount}</span>
                <span className="insights-metric-label">{t.insights_today_label}</span>
              </div>
              <div className="insights-metric-divider" />
              <div className="insights-metric-item">
                <div className="insights-metric-trend">{renderTrendBadge(insights.targetTrend)}</div>
                <span className="insights-metric-label">{t.insights_trend_label}</span>
              </div>
            </div>
          </div>

          {/* ── Card 2: Overall Activity ── */}
          <div className="insights-card" id="card-overall-insight">
            <div className="insights-card-header">
              <span className="insights-card-icon">📊</span>
              <div className="insights-card-title-group">
                <span className="insights-card-category">{t.dash_label}</span>
                <span className="insights-card-name">{t.insights_card_overall_title}</span>
              </div>
            </div>

            <div className="insights-metrics-row">
              <div className="insights-metric-item">
                <span className="insights-metric-val">{insights.overallTodayCount}</span>
                <span className="insights-metric-label">{t.insights_today_label}</span>
              </div>
              <div className="insights-metric-divider" />
              <div className="insights-metric-item">
                <div className="insights-metric-trend">{renderTrendBadge(insights.overallTrend)}</div>
                <span className="insights-metric-label">{t.insights_trend_label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Primary Action: Continue to Recovery ── */}
        <div className="insights-actions">
          <button
            id="btn-insights-continue"
            className="insights-btn-continue"
            onClick={onContinue}
          >
            <span>{t.insights_btn_continue}</span>
            <span className="insights-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
