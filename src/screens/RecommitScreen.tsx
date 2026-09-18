import { useState, useMemo, useCallback } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import ScreenHeader from '../components/ScreenHeader';
import HoldCommitButton from '../components/HoldCommitButton';
import './RecommitScreen.css';

interface RecommitScreenProps {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

type RecommitStep = 'hold' | 'success';

export default function RecommitScreen({
  onComplete,
  onNavigate,
}: RecommitScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<RecommitStep>('hold');

  // Load user's saved Why reason directly from pledge storage
  const firstReason = useMemo(() => {
    const pledge = loadPledge();
    return pledge.reasons.find((r) => r.trim().length > 0) ?? null;
  }, []);

  const handleHoldComplete = useCallback(() => {
    onComplete();
    setStep('success');
  }, [onComplete]);

  return (
    <div className="screen recommit-screen">
      <ScreenHeader
        onBack={() => onNavigate('help')}
        onHome={() => onNavigate('home')}
      />

      {step === 'hold' ? (
        <div className="recommit-content">
          <div className="recommit-heading">
            <span className="section-label">{t.recommit_label}</span>
            <h2 className="recommit-title">{t.recommit_title}</h2>
            <p className="recommit-subtitle">{t.recommit_subtitle}</p>
          </div>

          {/* ── Saved Why Reason Card (Prominently displayed) ── */}
          <div className="recommit-why-card" aria-label={t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}>
            <div className="recommit-why-header">
              <span className="recommit-why-question">
                {t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}
              </span>
              <button
                id="btn-recommit-manage-why"
                className="recommit-why-manage-btn"
                onClick={() => onNavigate('commitment')}
                aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
              >
                {t.pledge_why_manage} ›
              </button>
            </div>
            <p className={`recommit-why-reason${firstReason ? '' : ' recommit-why-reason--empty'}`}>
              {firstReason ?? (t.pledge_why_empty || 'No Why specified yet. Recommit to return to your structured diet.')}
            </p>
          </div>

          {/* ── Standardized Hold to Re-Commit Ritual ── */}
          <div className="recommit-ritual-section">
            <HoldCommitButton
              id="btn-recommit-hold"
              variant="recommit"
              label={`→ ${t.recommit_hold_btn || 'HOLD TO RE-COMMIT'}`}
              onComplete={handleHoldComplete}
            />

            {/* Unlimited Re-Commit Behavioral Reinforcement Hint */}
            <p className="recommit-unlimited-hint" id="recommit-unlimited-hint">
              {t.recommit_unlimited_hint || 'You can re-commit anytime you need to reset your focus.'}
            </p>
          </div>
        </div>
      ) : (
        /* ── Success Win Screen ── */
        <div className="recommit-success-content" id="recommit-success-screen">
          <div className="recommit-success-icon-wrap">
            <span className="recommit-success-icon">✓</span>
          </div>

          <span className="section-label">{t.recommit_label}</span>
          <h2 className="recommit-success-heading">{t.recommit_success_heading}</h2>
          <p className="recommit-success-body">{t.recommit_success_body}</p>

          <button
            id="btn-recommit-home"
            className="recommit-btn-home"
            onClick={() => onNavigate('home')}
          >
            {t.recommit_btn_main_menu}
          </button>
        </div>
      )}
    </div>
  );
}
