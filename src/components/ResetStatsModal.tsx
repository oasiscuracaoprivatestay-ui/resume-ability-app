import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { resetAllStats } from '../utils/resetStats';
import './ResetStatsModal.css';

interface ResetStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete?: () => void;
}

type ModalStep = 'warning' | 'hold' | 'lifetime_choice' | 'lifetime_confirm' | 'success';

const HOLD_DURATION_MS = 2500;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ResetStatsModal({
  isOpen,
  onClose,
  onResetComplete,
}: ResetStatsModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>('warning');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resetLifetimeConfirmed, setResetLifetimeConfirmed] = useState(false);

  const startRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset internal state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('warning');
      setHolding(false);
      setProgress(0);
      setResetLifetimeConfirmed(false);
      holdCompletedRef.current = false;
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
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
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setHolding(false);
    setProgress(0);
    holdCompletedRef.current = false;
    onClose();
  };

  const cancelHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const handleHoldSuccess = useCallback(() => {
    holdCompletedRef.current = true;
    setHolding(false);
    setProgress(1);
    // Move to separate Lifetime Score decision (Phase 4)
    setStep('lifetime_choice');
  }, []);

  const startHold = useCallback(() => {
    if (step !== 'hold' || holdCompletedRef.current) return;
    setHolding(true);
    startRef.current = performance.now();

    const loop = () => {
      if (!startRef.current) return;
      const now = performance.now();
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setProgress(p);

      if (p >= 1) {
        handleHoldSuccess();
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [step, handleHoldSuccess]);

  const executeReset = (resetLifetime: boolean) => {
    setResetLifetimeConfirmed(resetLifetime);
    resetAllStats({ resetLifetimeScore: resetLifetime });
    setStep('success');
  };

  const handleFinishSuccess = () => {
    onClose();
    if (onResetComplete) {
      onResetComplete();
    } else {
      // Clean UI refresh
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

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
        {/* STEP 1: WARNING CONFIRMATION */}
        {step === 'warning' && (
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
                <p>{t.stats_modal_desc_2}</p>
              </div>
            </div>
            <div className="reset-modal-actions">
              <button
                type="button"
                id="btn-reset-cancel-step1"
                className="reset-modal-btn reset-modal-btn--cancel"
                onClick={handleCancel}
              >
                {t.stats_modal_btn_cancel}
              </button>
              <button
                type="button"
                id="btn-reset-proceed-hold"
                className="reset-modal-btn reset-modal-btn--danger"
                onClick={() => setStep('hold')}
              >
                {t.stats_modal_btn_reset}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SAFETY HOLD (2.5 SECONDS) */}
        {step === 'hold' && (
          <div className="reset-modal-content">
            <h2 id="reset-modal-title" className="reset-modal-title reset-modal-title--danger">
              {t.stats_hold_title}
            </h2>
            <p className="reset-modal-subtext">{t.stats_hold_subtext}</p>

            <div className="reset-hold-container">
              <div className={`reset-hold-ring-wrap${holding ? ' reset-hold-ring-wrap--active' : ''}`}>
                <svg className="reset-hold-svg" viewBox="0 0 100 100" aria-hidden="true">
                  <circle
                    className="reset-hold-track"
                    cx="50"
                    cy="50"
                    r={RADIUS}
                  />
                  <circle
                    className="reset-hold-fill"
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    style={{
                      strokeDasharray: CIRCUMFERENCE,
                      strokeDashoffset,
                    }}
                  />
                </svg>

                <button
                  type="button"
                  id="btn-confirm-hold-reset"
                  className={`reset-hold-button${holding ? ' reset-hold-button--holding' : ''}`}
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      if (!holding) startHold();
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      cancelHold();
                    }
                  }}
                  aria-label={t.stats_hold_instruction}
                >
                  <span className="reset-hold-pct">
                    {holding ? `${Math.round(progress * 100)}%` : '⏱️'}
                  </span>
                  <span className="reset-hold-label">{t.stats_hold_instruction}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              className="reset-modal-btn reset-modal-btn--cancel reset-modal-btn--full"
              onClick={handleCancel}
            >
              {t.stats_modal_btn_cancel}
            </button>
          </div>
        )}

        {/* STEP 3: LIFETIME SCORE SEPARATE DECISION (Phase 4) */}
        {step === 'lifetime_choice' && (
          <div className="reset-modal-content">
            <div className="reset-modal-icon-badge reset-modal-icon-badge--choice" aria-hidden="true">
              ⚡
            </div>
            <h2 id="reset-modal-title" className="reset-modal-title">
              {t.stats_lifetime_choice_title}
            </h2>
            <div className="reset-modal-body">
              <p className="reset-modal-choice-question">{t.stats_lifetime_choice_question}</p>
              <div className="reset-modal-preservation-box">
                <span className="reset-modal-shield" aria-hidden="true">🛡️</span>
                <p>{t.stats_lifetime_choice_desc}</p>
              </div>
            </div>
            <div className="reset-modal-actions reset-modal-actions--stacked">
              <button
                type="button"
                id="btn-keep-lifetime-score"
                className="reset-modal-btn reset-modal-btn--keep reset-modal-btn--full"
                onClick={() => executeReset(false)}
                autoFocus
              >
                ✓ {t.stats_btn_keep_lifetime}
              </button>
              <button
                type="button"
                id="btn-prompt-reset-lifetime"
                className="reset-modal-btn reset-modal-btn--reset-subtle reset-modal-btn--full"
                onClick={() => setStep('lifetime_confirm')}
              >
                ⚠️ {t.stats_btn_reset_lifetime}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DESTRUCTIVE CONFIRMATION BARRIER (Phase 4) */}
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
                className="reset-modal-btn reset-modal-btn--keep reset-modal-btn--full"
                onClick={() => executeReset(false)}
                autoFocus
              >
                {t.stats_btn_keep_lifetime}
              </button>
              <button
                type="button"
                id="btn-confirm-lifetime-wipe"
                className="reset-modal-btn reset-modal-btn--danger-destruct reset-modal-btn--full"
                onClick={() => executeReset(true)}
              >
                {t.stats_btn_confirm_lifetime_reset}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS FEEDBACK */}
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
      </div>
    </div>
  );
}
