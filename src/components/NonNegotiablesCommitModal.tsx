import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { saveCommitEvent } from '../utils/inControlStorage';
import { generateId } from '../utils';
import { playFeedback } from '../utils/feedback';
import './NonNegotiablesCommitModal.css';

interface NonNegotiablesCommitModalProps {
  isOpen: boolean;
  nonNegotiables: string[];
  onClose: () => void;
  onCommitSuccess: () => void;
  onNavigateHome: () => void;
}

type ModalStep = 'hold' | 'success';

// ── Geometry & timing ────────────────────────────────────────────────────────
const HOLD_MS = 2200; // 2.2s deliberate hold (meets 2.0–2.5s requirement)
const RING_R = 48;
const RING_CX = 60;
const RING_CY = 60;
const RING_CIRC = 2 * Math.PI * RING_R;

export default function NonNegotiablesCommitModal({
  isOpen,
  nonNegotiables,
  onClose,
  onCommitSuccess,
  onNavigateHome,
}: NonNegotiablesCommitModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>('hold');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  // Animation & duplicate protection refs
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);
  const holdBtnRef = useRef<HTMLButtonElement>(null);

  // Reset state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('hold');
      setHolding(false);
      setProgress(0);
      holdCompletedRef.current = false;
      startRef.current = null;
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [isOpen]);

  // Handle ESC key to close (only if not in success state)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'success') {
        cancelHold();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  // Cancel hold if pointer lifts, leaves, or key releases
  const cancelHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  // Complete commitment action (guarded against duplicate executions)
  const completeCommit = useCallback(() => {
    if (holdCompletedRef.current) return;
    holdCompletedRef.current = true;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(1);

    playFeedback('commit');

    // Persist single CommitEvent with source 'non-negotiables'
    const id = generateId();
    saveCommitEvent({
      id,
      timestamp: Date.now(),
      source: 'non-negotiables',
    });

    onCommitSuccess();

    // Transition to success confirmation
    setTimeout(() => {
      setStep('success');
    }, 150);
  }, [onCommitSuccess]);

  // Start hold countdown loop
  const startHold = useCallback(() => {
    if (step !== 'hold' || holdCompletedRef.current || holding) return;
    setHolding(true);
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / HOLD_MS, 1);
      setProgress(p);

      if (p >= 1) {
        completeCommit();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [step, holding, completeCommit]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only respond to primary click/touch
    if (e.button !== 0) return;
    e.preventDefault();
    startHold();
  };

  // Keyboard accessibility: Space & Enter hold support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat && !holding && !holdCompletedRef.current) {
        startHold();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      cancelHold();
    }
  };

  if (!isOpen) return null;

  const strokeDashoffset = RING_CIRC * (1 - progress);

  return (
    <div
      className="nn-commit-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nn-commit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'success') {
          cancelHold();
          onClose();
        }
      }}
    >
      <div className="nn-commit-modal" role="document">
        {step === 'hold' ? (
          <div className="nn-commit-body">
            {/* Header */}
            <div className="nn-commit-header">
              <div className="nn-commit-badge-wrap">
                <span className="nn-commit-badge">⚡ {t.nn_commit_modal_title}</span>
              </div>
              <button
                id="btn-nn-commit-close"
                className="nn-commit-close-btn"
                onClick={() => {
                  cancelHold();
                  onClose();
                }}
                aria-label={t.commit_cancel}
              >
                ✕
              </button>
            </div>

            {/* Supportive Affirmation Message */}
            <div className="nn-commit-affirmation-card">
              <p className="nn-commit-affirmation-text">
                "{t.nn_commit_affirmation}"
              </p>
            </div>

            {/* User's Non-Negotiables List */}
            <div className="nn-commit-list-section">
              <span className="nn-commit-list-label">{t.commit_nn_section}</span>
              <div className="nn-commit-list">
                {nonNegotiables.map((nn, idx) => (
                  <div key={idx} className="nn-commit-list-item">
                    <span className="nn-commit-item-num" aria-hidden="true">{idx + 1}</span>
                    <span className="nn-commit-item-text">{nn}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Deliberate Press-and-Hold Section */}
            <div className="nn-commit-hold-container">
              <div className={`nn-commit-ring-wrap${holding ? ' nn-commit-ring-wrap--holding' : ''}`}>
                <svg
                  className="nn-commit-ring-svg"
                  viewBox="0 0 120 120"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="nn-commit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                  {/* Track */}
                  <circle
                    className="nn-commit-ring-track"
                    cx={RING_CX}
                    cy={RING_CY}
                    r={RING_R}
                    fill="none"
                    strokeWidth="5"
                  />
                  {/* Active Arc */}
                  {(holding || progress > 0) && (
                    <circle
                      className="nn-commit-ring-arc"
                      cx={RING_CX}
                      cy={RING_CY}
                      r={RING_R}
                      fill="none"
                      stroke="url(#nn-commit-grad)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRC}
                      strokeDashoffset={strokeDashoffset}
                      transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                    />
                  )}
                </svg>

                <button
                  ref={holdBtnRef}
                  id="btn-nn-hold-commit"
                  className={`nn-commit-hold-btn${holding ? ' nn-commit-hold-btn--active' : ''}`}
                  onPointerDown={handlePointerDown}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={t.nn_commit_hold_instruction}
                  role="button"
                  tabIndex={0}
                >
                  {holding ? (
                    <span className="nn-commit-hold-pct">{Math.round(progress * 100)}%</span>
                  ) : (
                    <span className="nn-commit-hold-icon">⚡</span>
                  )}
                </button>
              </div>

              <p className="nn-commit-hold-instruction" aria-live="polite">
                {t.nn_commit_hold_instruction}
              </p>
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="nn-commit-success" aria-live="polite">
            <div className="nn-commit-success-icon-wrap">
              <span className="nn-commit-success-icon" aria-hidden="true">✓</span>
            </div>

            <h2 id="nn-commit-modal-title" className="nn-commit-success-title">
              {t.nn_commit_success_title}
            </h2>
            <p className="nn-commit-success-sub">
              {t.nn_commit_success_sub}
            </p>

            <div className="nn-commit-success-actions">
              <button
                id="btn-nn-commit-continue"
                className="nn-commit-btn-continue"
                onClick={onClose}
              >
                {t.nn_commit_btn_continue}
              </button>
              <button
                id="btn-nn-commit-home"
                className="nn-commit-btn-home"
                onClick={onNavigateHome}
              >
                {t.nn_commit_btn_return_home}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
