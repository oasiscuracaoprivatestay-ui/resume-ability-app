import { useMemo } from 'react';
import type { Screen } from '../types';
import { SLIP_CONTEXT_LABELS, SLIP_CONTEXT_ICONS } from '../types';
import { loadSlips, computeDashboard, formatDuration } from '../utils';
import ScreenHeader from '../components/ScreenHeader';
import './DashboardScreen.css';

interface DashboardScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function DashboardScreen({ onNavigate }: DashboardScreenProps) {
  const data = useMemo(() => computeDashboard(loadSlips()), []);

  return (
    <div className="screen dashboard-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="dashboard-content">
        <div className="dashboard-heading">
          <span className="section-label">Diagnostic Summary</span>
          <h2 className="section-heading">Daily Pulse</h2>
        </div>

        <div className="dashboard-cards">
          <div className="dash-card">
            <span className="dash-card-label">Slips Today</span>
            <div className="dash-card-row">
              <span className="dash-card-value dash-card-value--accent">
                {String(data.slipsToday).padStart(2, '0')}
              </span>
              <span className="dash-card-icon">⊘</span>
            </div>
          </div>

          <div className="dash-card">
            <span className="dash-card-label">Most Frequent Zone</span>
            <div className="dash-card-row">
              <span className="dash-card-value">
                {data.mostFrequentContext
                  ? `${SLIP_CONTEXT_ICONS[data.mostFrequentContext]} ${SLIP_CONTEXT_LABELS[data.mostFrequentContext]}`
                  : '—'}
              </span>
              <span className="dash-card-icon">◉</span>
            </div>
          </div>

          <div className="dash-card">
            <span className="dash-card-label">Avg Recovery Time</span>
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

        {data.slipsToday === 0 && data.averageRecoverySeconds === 0 && (
          <p className="dashboard-empty">
            No slips recorded yet. Stay aware.
          </p>
        )}
      </div>
    </div>
  );
}
