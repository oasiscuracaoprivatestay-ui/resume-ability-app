import { useState, useRef, useCallback } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './CheckInScreen.css';

interface CheckInScreenProps {
  onNavigate: (screen: Screen) => void;
}

type CheckInStep = 'hold' | 'choice';
type CheckInStatus = 'on-structure' | 'near-slip' | 'slip';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_R     = 78;
const RING_CX    = 100;
const RING_CY    = 100;
const RING_CIRC  = 2 * Math.PI * RING_R;  // ≈ 490 px
const HOLD_MS    = 2500;                   // 2.5 seconds

// ── Status options config ─────────────────────────────────────────────────────
interface StatusOption {
  id: CheckInStatus;
  mod: string;           // BEM modifier for colour
  icon: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'on-structure', mod: 'on-structure', icon: '✓' },
  { id: 'near-slip',    mod: 'near-slip',    icon: '⚡' },
  { id: 'slip',         mod: 'slip',         icon: '↻' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function CheckInScreen({ onNavigate }: CheckInScreenProps) {
  const { t } = useTranslation();

  const [step, setStep]         = useState<CheckInStep>('hold');
  const [progress, setProgress] = useState(0);          // 0 – 1
  const [holding, setHolding]   = useState(false);
  const [selected, setSelected] = useState<CheckInStatus | null>(null);

  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // ── Hold mechanics ───────────────────────────────────────────────────────────

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  const startHold = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    // Prevent scroll / long-press context menu on mobile
    e.preventDefault();
    if (step !== 'hold') return;

    setHolding(true);
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;          // cancelled
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / HOLD_MS, 1);
      setProgress(p);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // ── Hold complete ──
        rafRef.current = null;
        startRef.current = null;
        setHolding(false);
        setProgress(1);
        if (navigator.vibrate) navigator.vibrate(60);
        // Short pause so the user sees the ring reach 100% before transition
        setTimeout(() => {
          setProgress(0);
          setStep('choice');
        }, 250);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [step]);

  // ── Status selection ─────────────────────────────────────────────────────────

  const handleStatusSelect = (id: CheckInStatus) => {
    setSelected(prev => (prev === id ? null : id));
  };

  // ── Ring SVG values ──────────────────────────────────────────────────────────
  const strokeOffset = RING_CIRC * (1 - progress);

  // ── Labels from i18n for each status ─────────────────────────────────────────
  const statusLabel: Record<CheckInStatus, string> = {
    'on-structure': t.ci_on_structure,
    'near-slip':    t.ci_near_slip,
    'slip':         t.ci_slip,
  };
  const statusBody: Record<CheckInStatus, string> = {
    'on-structure': t.ci_on_structure_body,
    'near-slip':    t.ci_near_slip_body,
    'slip':         t.ci_slip_body,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="screen ci-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      {/* ══ HOLD STEP ══════════════════════════════════════════════════════════ */}
      {step === 'hold' && (
        <div className="ci-hold-content">

          {/* Title block */}
          <div className="ci-title-block">
            <span className="section-label">{t.ci_label}</span>
            <h1 className="ci-title">{t.ci_title}</h1>
            <p className="ci-supporting">{t.ci_supporting}</p>
          </div>

          {/* Ring + button */}
          <div className="ci-ring-area">
            <div className={`ci-ring-wrap${holding ? ' ci-ring-wrap--holding' : ''}`}>

              {/* Progress ring SVG */}
              <svg
                className="ci-ring-svg"
                viewBox="0 0 200 200"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ci-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#2dd4bf" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                  <filter id="ci-ring-glow">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Track */}
                <circle
                  className="ci-ring-track"
                  cx={RING_CX} cy={RING_CY} r={RING_R}
                  fill="none" strokeWidth="5"
                />

                {/* Progress arc — only visible when holding */}
                {(holding || progress > 0) && (
                  <circle
                    className="ci-ring-arc"
                    cx={RING_CX} cy={RING_CY} r={RING_R}
                    fill="none"
                    stroke="url(#ci-ring-grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={strokeOffset}
                    transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                    filter="url(#ci-ring-glow)"
                  />
                )}
              </svg>

              {/* Inner hold button */}
              <button
                id="btn-ci-hold"
                className={`ci-hold-btn${holding ? ' ci-hold-btn--active' : ''}`}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                // Prevent iOS magnifier / context menu on long-press
                onContextMenu={e => e.preventDefault()}
                aria-label={t.ci_hold_label}
              >
                {holding ? (
                  <span className="ci-hold-pct">{Math.round(progress * 100)}</span>
                ) : (
                  <span className="ci-hold-icon">◎</span>
                )}
              </button>

            </div>{/* /ci-ring-wrap */}

            <p className="ci-hold-label">
              {holding ? t.ci_holding_label : t.ci_hold_label}
            </p>
          </div>{/* /ci-ring-area */}

        </div>
      )}{/* /hold step */}

      {/* ══ CHOICE STEP ════════════════════════════════════════════════════════ */}
      {step === 'choice' && (
        <div className="ci-choice-content">

          {/* Title block */}
          <div className="ci-title-block">
            <span className="section-label">{t.ci_label}</span>
            <h1 className="ci-title">{t.ci_status_label}</h1>
            <p className="ci-supporting">{t.ci_status_sub}</p>
          </div>

          {/* Status cards */}
          <div className="ci-status-list" role="radiogroup" aria-label={t.ci_status_label}>
            {STATUS_OPTIONS.map(({ id, mod, icon }) => (
              <button
                key={id}
                id={`ci-status-${id}`}
                role="radio"
                aria-checked={selected === id}
                className={[
                  'ci-status-card',
                  `ci-status-card--${mod}`,
                  selected === id ? 'ci-status-card--selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleStatusSelect(id)}
              >
                <div className="ci-status-top">
                  <span className="ci-status-icon">{icon}</span>
                  <span className="ci-status-name">{statusLabel[id]}</span>
                  {/* Selection indicator */}
                  <span className="ci-status-check" aria-hidden="true">
                    {selected === id ? '●' : '○'}
                  </span>
                </div>
                <p className="ci-status-body">{statusBody[id]}</p>
              </button>
            ))}
          </div>

          {/* Retake hint */}
          <button
            className="ci-redo-link"
            onClick={() => { setStep('hold'); setSelected(null); }}
          >
            ← Check in again
          </button>

        </div>
      )}{/* /choice step */}

    </div>
  );
}
