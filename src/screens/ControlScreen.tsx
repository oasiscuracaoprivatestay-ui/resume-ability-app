import { useMemo, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './ControlScreen.css';

interface ControlScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function ControlScreen({ onNavigate }: ControlScreenProps) {
  const { t } = useTranslation();

  const message = useMemo(
    () => t.control_messages[Math.floor(Math.random() * t.control_messages.length)],
    [t],
  );

  useEffect(() => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate([20, 30, 20]);
      } catch {
        // Safe fallback
      }
    }
  }, []);

  return (
    <div className="screen control-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="control-content">
        <div className="control-heading">
          <span className="section-label">{t.control_badge}</span>
          <h2 className="control-title">{t.control_win_title}</h2>
          <p className="control-subtitle">{t.control_win_subtitle}</p>
        </div>
        <div className="control-celebration-container">
          <div className="control-pulse-ring control-pulse-ring--1" />
          <div className="control-pulse-ring control-pulse-ring--2" />
          <div className="control-icon-wrapper">
            <span className="control-icon">✓</span>
          </div>
        </div>

        <div className="control-message-card">
          <p className="control-message">"{message}"</p>
        </div>
      </div>

      <div className="control-actions">
        <button
          id="btn-control-commit"
          className="btn btn-primary btn-large control-btn-commit"
          onClick={() => onNavigate('commit')}
        >
          <span className="control-btn-icon">⚡</span>
          <span>{t.control_btn_commit}</span>
        </button>

        <button
          id="btn-control-home"
          className="btn btn-secondary control-btn-home"
          onClick={() => onNavigate('home')}
        >
          {t.control_btn_home}
        </button>
      </div>
    </div>
  );
}
