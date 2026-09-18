import { useState, useCallback, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import ScreenHeader from '../components/ScreenHeader';
import HoldCommitButton from '../components/HoldCommitButton';
import './CommitScreen.css';

interface CommitScreenProps {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

type CommitStep = 'hold' | 'success';

export default function CommitScreen({
  onComplete,
  onNavigate,
}: CommitScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<CommitStep>('hold');

  // Load user's saved Why reason directly from pledge storage (zero duplication)
  const firstReason = useMemo(() => {
    const pledge = loadPledge();
    return pledge.reasons.find((r) => r.trim().length > 0) ?? null;
  }, []);

  const handleHoldComplete = useCallback(() => {
    onComplete();
    setStep('success');
  }, [onComplete]);

  return (
    <div className="screen commit-screen">
      <ScreenHeader
        onBack={() => onNavigate('control')}
        onHome={() => onNavigate('home')}
      />

      {step === 'hold' ? (
        <div className="commit-content">
          <div className="commit-heading">
            <span className="section-label">{t.commit_badge}</span>
            <h2 className="commit-title">{t.commit_title}</h2>
            <p className="commit-subtitle">{t.commit_subtitle}</p>
          </div>

          {/* ── Saved Why Reason Card ── */}
          <div className="commit-why-card" aria-label={t.commit_why_label}>
            <span className="commit-why-question">{t.commit_why_label}</span>
            <p className={`commit-why-reason${firstReason ? '' : ' commit-why-reason--empty'}`}>
              {firstReason ?? t.commit_why_empty}
            </p>
            <button
              id="btn-commit-why-link"
              className="commit-why-manage-btn"
              onClick={() => onNavigate('commitment')}
              aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
            >
              {t.commit_why_link}
            </button>
          </div>

          {/* ── Unified Hold to Commit Ritual ── */}
          <div className="commit-ring-area">
            <HoldCommitButton
              id="btn-commit-hold"
              variant="commit"
              label={`→ ${t.commit_hold_btn || 'HOLD TO COMMIT'}`}
              onComplete={handleHoldComplete}
            />
          </div>
        </div>
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
