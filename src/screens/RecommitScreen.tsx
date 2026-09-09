import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import ScreenHeader from '../components/ScreenHeader';
import './RecommitScreen.css';

interface RecommitScreenProps {
  onComplete: () => void;
  onNavigate: (screen: Screen) => void;
}

type RecommitStep = 'hold' | 'success';

// ── Ring geometry (consistent with Check-In) ──
const RING_R = 78;
const RING_CX = 100;
const RING_CY = 100;
const RING_CIRC = 2 * Math.PI * RING_R;
const HOLD_MS = 2500;

export default function RecommitScreen({
  onComplete,
  onNavigate,
}: RecommitScreenProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<RecommitStep>('hold');
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

          // Record Re-Commit event via callback (guarded against multiple triggers)
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

          {/* ── Saved Why Reason Card ── */}
          <div className="recommit-why-card" aria-label={t.pledge_why_question}>
            <span className="recommit-why-question">{t.pledge_why_question}</span>
            <p className={`recommit-why-reason${firstReason ? '' : ' recommit-why-reason--empty'}`}>
              {firstReason ?? t.pledge_why_empty}
            </p>
            <button
              id="btn-recommit-manage-why"
              className="recommit-why-manage-btn"
              onClick={() => onNavigate('commitment')}
              aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
            >
              {t.pledge_why_manage} ›
            </button>
          </div>

          {/* ── Press & Hold Area ── */}
          <div className="recommit-ring-area">
            <div className="recommit-hold-instruction-block">
              <p className="recommit-hold-instruction">{t.recommit_hold_instruction}</p>
              <span className="recommit-hold-arrow" aria-hidden="true">↓</span>
            </div>

            <div className={`recommit-ring-wrap${holding ? ' recommit-ring-wrap--holding' : ''}`}>
              <svg className="recommit-ring-svg" viewBox="0 0 200 200" aria-hidden="true">
                <defs>
                  <linearGradient id="recommit-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <filter id="recommit-ring-glow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle
                  className="recommit-ring-track"
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  strokeWidth="5"
                />
                {(holding || progress > 0) && (
                  <circle
                    className="recommit-ring-arc"
                    cx={RING_CX}
                    cy={RING_CY}
                    r={RING_R}
                    fill="none"
                    stroke="url(#recommit-ring-grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={strokeOffset}
                    transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                    filter="url(#recommit-ring-glow)"
                  />
                )}
              </svg>

              <button
                id="btn-recommit-hold"
                className={`recommit-hold-btn${holding ? ' recommit-hold-btn--active' : ''}`}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={t.recommit_hold_instruction}
              >
                {holding ? (
                  <span className="recommit-hold-pct">{Math.round(progress * 100)}</span>
                ) : (
                  <span className="recommit-hold-icon">↻</span>
                )}
              </button>
            </div>
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
