import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import ScreenHeader from '../components/ScreenHeader';
import './CommitScreen.css';

interface CommitScreenProps {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

type CommitStep = 'hold' | 'success';

// ── Ring geometry (consistent with Check-In & Re-Commit) ──
const RING_R = 78;
const RING_CX = 100;
const RING_CY = 100;
const RING_CIRC = 2 * Math.PI * RING_R;
const HOLD_MS = 2500;

export default function CommitScreen({
  onComplete,
  onNavigate,
}: CommitScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<CommitStep>('hold');
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  // Animation refs
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);

  // Load user's saved Why reason directly from pledge storage (zero duplication)
  const firstReason = useMemo(() => {
    const pledge = loadPledge();
    return pledge.reasons.find((r) => r.trim().length > 0) ?? null;
  }, []);

  // Cancel hold if finger lifts or moves away
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

  // Start hold countdown
  const startHold = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (step !== 'hold' || holdCompletedRef.current) return;
      setHolding(true);
      startRef.current = performance.now();

      const tick = (now: number) => {
        if (startRef.current === null) return;
        const p = Math.min((now - startRef.current) / HOLD_MS, 1);
        setProgress(p);

        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          holdCompletedRef.current = true;
          rafRef.current = null;
          startRef.current = null;
          setHolding(false);
          setProgress(1);

          if (navigator.vibrate) navigator.vibrate(60);

          // Record Commit event via callback (guarded against multiple triggers)
          onComplete();

          setTimeout(() => {
            setStep('success');
          }, 250);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [step, onComplete],
  );

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const strokeOffset = RING_CIRC * (1 - progress);

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

          {/* ── Press & Hold Area ── */}
          <div className="commit-ring-area">
            <div className="commit-hold-instruction-block">
              <p className="commit-hold-instruction">{t.commit_hold_instruction}</p>
              <span className="commit-hold-arrow" aria-hidden="true">↓</span>
            </div>

            <div className={`commit-ring-wrap${holding ? ' commit-ring-wrap--holding' : ''}`}>
              <svg className="commit-ring-svg" viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <linearGradient id="commit-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <filter id="commit-ring-glow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  className="commit-ring-track"
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  strokeWidth="5"
                />
                {(holding || progress > 0) && (
                  <circle
                    className="commit-ring-arc"
                    cx={RING_CX}
                    cy={RING_CY}
                    r={RING_R}
                    fill="none"
                    stroke="url(#commit-ring-grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={strokeOffset}
                    transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                    filter="url(#commit-ring-glow)"
                  />
                )}
              </svg>

              <button
                id="btn-commit-hold"
                className={`commit-hold-btn${holding ? ' commit-hold-btn--active' : ''}`}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={t.commit_hold_instruction}
              >
                {holding ? (
                  <span className="commit-hold-pct">{Math.round(progress * 100)}</span>
                ) : (
                  <span className="commit-hold-icon">⚡</span>
                )}
              </button>
            </div>
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
