import { useState, useCallback, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import HoldCommitButton from '../components/HoldCommitButton';
import { generateId } from '../utils';
import { saveCommitEvent } from '../utils/inControlStorage';
import './ControlScreen.css';

interface ControlScreenProps {
  onNavigate: (screen: Screen) => void;
  onCommitSuccess?: () => void;
}

type ControlStep = 'control' | 'success';

export default function ControlScreen({ onNavigate, onCommitSuccess }: ControlScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ControlStep>('control');

  const message = useMemo(
    () => t.control_messages[Math.floor(Math.random() * t.control_messages.length)],
    [t],
  );

  const handleHoldComplete = useCallback(() => {
    if (onCommitSuccess) {
      onCommitSuccess();
    } else {
      saveCommitEvent({
        id: generateId(),
        timestamp: Date.now(),
        source: 'in-control',
      });
    }

    setStep('success');
  }, [onCommitSuccess]);

  return (
    <div className="screen control-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      {step === 'control' ? (
        <>
          <div className="control-content">
            <div className="control-heading">
              <span className="section-label">{t.control_badge}</span>
              <h1 className="control-title">{t.control_win_title}</h1>
              <p className="control-subtitle">{t.control_win_subtitle}</p>
            </div>

            {/* ── Win Pulse Animation Element ── */}
            <div className="control-visual-wrap" aria-hidden="true">
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
            {/* ── Standardized Hold to Commit Ritual ── */}
            <HoldCommitButton
              id="btn-control-commit"
              variant="commit"
              label={`→ ${t.commit_hold_btn || 'HOLD TO COMMIT'}`}
              onComplete={handleHoldComplete}
            />

            <button
              id="btn-control-home"
              type="button"
              className="btn btn-secondary control-btn-home"
              onClick={() => onNavigate('home')}
            >
              ✕ {t.recommit_btn_cancel || t.control_btn_home}
            </button>
          </div>
        </>
      ) : (
        /* ── Success Win Screen ── */
        <div className="commit-success-content" id="commit-success-screen">
          <div className="commit-success-icon-wrap">
            <span className="commit-success-icon">✓</span>
          </div>

          <span className="section-label">{t.commit_badge}</span>
          <h2 className="commit-success-heading">{t.commit_success_heading}</h2>
          <p className="commit-success-body">{t.commit_success_body}</p>

          <button
            id="btn-commit-home"
            className="commit-btn-home"
            onClick={() => onNavigate('home')}
          >
            {t.commit_btn_main_menu}
          </button>
        </div>
      )}
    </div>
  );
}
