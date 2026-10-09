import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { resetAllStats } from '../utils/resetStats';
import './ResetStatsModal.css';

interface ResetStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete?: () => void;
}

type ModalStep = 'choice' | 'lifetime_confirm' | 'success' | 'error';

export default function ResetStatsModal({
  isOpen,
  onClose,
  onResetComplete,
}: ResetStatsModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>('choice');
  const [resetLifetimeConfirmed, setResetLifetimeConfirmed] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset internal state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setResetLifetimeConfirmed(false);
      setResetError(null);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step !== 'success') {
          handleCancel();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  const handleCancel = () => {
    onClose();
  };

  const executeReset = (resetLifetime: boolean) => {
    setResetLifetimeConfirmed(resetLifetime);
    const result = resetAllStats({ resetLifetimeScore: resetLifetime });
    if (!result.success) {
      setResetError(result.error || 'Failed to reset statistics.');
      setStep('error');
    } else {
      setStep('success');
    }
  };

  const handleFinishSuccess = () => {
    onClose();
    if (onResetComplete) {
      onResetComplete();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="reset-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'success') {
          handleCancel();
        }
      }}
    >
      <div
        className="reset-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-modal-title"
        ref={modalRef}
      >
        {/* STEP 1: RESET STATS SELECTION (Normal vs Lifetime) */}
        {step === 'choice' && (
          <div className="reset-modal-content">
            <div className="reset-modal-icon-badge" aria-hidden="true">
              ⚠️
            </div>
            <h2 id="reset-modal-title" className="reset-modal-title">
              {t.stats_modal_title}
            </h2>
            <div className="reset-modal-body">
              <p className="reset-modal-warning-text">{t.stats_modal_desc_1}</p>
              <div className="reset-modal-preservation-box">
                <span className="reset-modal-shield" aria-hidden="true">🛡️</span>
                <div>
                  <p>{t.stats_modal_desc_2}</p>
                  <p style={{ marginTop: '0.45rem', color: '#38bdf8', fontWeight: 600 }}>
                    {t.stats_lifetime_preserved_note}
                  </p>
                </div>
              </div>
            </div>
            <div className="reset-modal-actions reset-modal-actions--stacked">
              <button
                type="button"
                id="btn-reset-current-only"
                className="reset-modal-btn reset-modal-btn--keep reset-modal-btn--full"
                onClick={() => executeReset(false)}
                autoFocus
              >
                ✓ {t.stats_btn_reset_current_only}
              </button>
              <button
                type="button"
                id="btn-reset-with-lifetime"
                className="reset-modal-btn reset-modal-btn--reset-subtle reset-modal-btn--full"
                onClick={() => setStep('lifetime_confirm')}
              >
                ⚠️ {t.stats_btn_reset_with_lifetime}
              </button>
              <button
                type="button"
                id="btn-reset-cancel"
                className="reset-modal-btn reset-modal-btn--cancel reset-modal-btn--full"
                onClick={handleCancel}
              >
                {t.stats_modal_btn_cancel}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DESTRUCTIVE LIFETIME SCORE CONFIRMATION */}
        {step === 'lifetime_confirm' && (
          <div className="reset-modal-content">
            <div className="reset-modal-icon-badge" aria-hidden="true">
              💥
            </div>
            <h2 id="reset-modal-title" className="reset-modal-title reset-modal-title--danger">
              {t.stats_lifetime_confirm_title}
            </h2>
            <div className="reset-modal-body">
              <div className="reset-modal-danger-box">
                <p className="reset-modal-danger-text">{t.stats_lifetime_confirm_warning}</p>
              </div>
            </div>
            <div className="reset-modal-actions reset-modal-actions--stacked">
              <button
                type="button"
                id="btn-cancel-lifetime-destructive"
                className="reset-modal-btn reset-modal-btn--cancel reset-modal-btn--full"
                onClick={() => setStep('choice')}
                autoFocus
              >
                {t.stats_modal_btn_cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-lifetime-wipe"
                className="reset-modal-btn reset-modal-btn--danger reset-modal-btn--full"
                onClick={() => executeReset(true)}
              >
                {t.stats_btn_confirm_lifetime_reset}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS FEEDBACK */}
        {step === 'success' && (
          <div className="reset-modal-content">
            <div className="reset-modal-icon-badge reset-modal-icon-badge--success" aria-hidden="true">
              ✓
            </div>
            <h2 id="reset-modal-title" className="reset-modal-title">
              {t.stats_done_title}
            </h2>
            <p className="reset-modal-success-desc">
              {resetLifetimeConfirmed
                ? t.stats_done_lifetime_reset
                : t.stats_done_lifetime_kept}
            </p>

            <button
              type="button"
              id="btn-reset-continue"
              className="reset-modal-btn reset-modal-btn--success reset-modal-btn--full"
              onClick={handleFinishSuccess}
              autoFocus
            >
              {t.stats_done_btn}
            </button>
          </div>
        )}

        {/* STEP 4: ERROR FEEDBACK (Fail-safe) */}
        {step === 'error' && (
          <div className="reset-modal-content">
            <div className="reset-modal-icon-badge" aria-hidden="true" style={{ color: '#ef4444' }}>
              ⚠️
            </div>
            <h2 id="reset-modal-title" className="reset-modal-title reset-modal-title--danger">
              Reset Incomplete
            </h2>
            <p className="reset-modal-warning-text">
              {resetError || 'An error occurred while resetting stored data.'}
            </p>
            <p className="reset-modal-desc" style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
              Any remaining activity records and settings have been safely preserved without corruption. You can retry the reset or dismiss.
            </p>
            <div className="reset-modal-actions reset-modal-actions--stacked">
              <button
                type="button"
                id="btn-reset-error-retry"
                className="reset-modal-btn reset-modal-btn--keep reset-modal-btn--full"
                onClick={() => executeReset(resetLifetimeConfirmed)}
                autoFocus
              >
                ↻ Retry Reset
              </button>
              <button
                type="button"
                id="btn-reset-error-close"
                className="reset-modal-btn reset-modal-btn--cancel reset-modal-btn--full"
                onClick={handleCancel}
              >
                {t.stats_modal_btn_cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
