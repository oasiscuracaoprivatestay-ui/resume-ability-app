import { useMemo } from 'react';
import type { Screen } from '../types';
import { loadSlips, computeWeeklyHistory, formatDuration } from '../utils';
import ScreenHeader from '../components/ScreenHeader';
import './HistoryScreen.css';

interface HistoryScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HistoryScreen({ onNavigate }: HistoryScreenProps) {
  const weeks = useMemo(() => computeWeeklyHistory(loadSlips()), []);

  return (
    <div className="screen history-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="history-content">
        <div className="history-heading">
          <span className="section-label">Weekly Insights</span>
          <h2 className="section-heading">Progress</h2>
        </div>

        {weeks.length === 0 ? (
          <p className="history-empty">
            No history yet. Your weekly trends will appear here.
          </p>
        ) : (
          <div className="history-weeks">
            {weeks.map((week, i) => {
              // Show trend arrows compared to next (older) week
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
                        avg recovery
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
                        slips
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
        )}
      </div>
    </div>
  );
}
