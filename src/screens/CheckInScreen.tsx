import { useState, useRef, useCallback, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import { saveCheckIn } from '../utils/checkInStorage';
import type { CheckInStatus } from '../utils/checkInStorage';
import './CheckInScreen.css';

interface CheckInScreenProps {
  onNavigate: (screen: Screen) => void;
}

type CheckInStep = 'hold' | 'choice' | 'done';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_R     = 78;
const RING_CX    = 100;
const RING_CY    = 100;
const RING_CIRC  = 2 * Math.PI * RING_R;
const HOLD_MS    = 2500;
const DONE_DELAY = 1400;   // ms before auto-navigating home after confirmation

// ── Status option config ──────────────────────────────────────────────────────
interface StatusOption {
  id: CheckInStatus;
  mod: string;
  icon: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'on-structure', mod: 'on-structure', icon: '✓' },
  { id: 'near-slip',    mod: 'near-slip',    icon: '⚡' },
  { id: 'slip',         mod: 'slip',         icon: '↻' },
];

// ── Done state icon ───────────────────────────────────────────────────────────
const DONE_ICON: Record<CheckInStatus, string> = {
  'on-structure': '✓',
  'near-slip':    '⚡',
  'slip':         '↻',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function CheckInScreen({ onNavigate }: CheckInScreenProps) {
  const { t } = useTranslation();

  const [step, setStep]         = useState<CheckInStep>('hold');
  const [progress, setProgress] = useState(0);
  const [holding, setHolding]   = useState(false);
  const [selected, setSelected] = useState<CheckInStatus | null>(null);
  const [saved, setSaved]       = useState<CheckInStatus | null>(null);  // what was confirmed

  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // ── Auto-navigate home after done state ──────────────────────────────────────
  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(() => onNavigate('home'), DONE_DELAY);
    return () => clearTimeout(timer);
  }, [step, onNavigate]);

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
    e.preventDefault();
    if (step !== 'hold') return;

    setHolding(true);
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / HOLD_MS, 1);
      setProgress(p);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        startRef.current = null;
        setHolding(false);
        setProgress(1);
        if (navigator.vibrate) navigator.vibrate(60);
        setTimeout(() => {
          setProgress(0);
          setStep('choice');
        }, 250);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [step]);

  // ── Confirm check-in ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selected) return;
    saveCheckIn(selected);          // persist to localStorage
    setSaved(selected);
    if (navigator.vibrate) navigator.vibrate(40);
    setStep('done');
  }, [selected]);

  // ── Ring ─────────────────────────────────────────────────────────────────────
  const strokeOffset = RING_CIRC * (1 - progress);

  // ── i18n label maps ──────────────────────────────────────────────────────────
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
  const doneBody: Record<CheckInStatus, string> = {
    'on-structure': t.ci_done_on_structure,
    'near-slip':    t.ci_done_near_slip,
    'slip':         t.ci_done_slip,
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  // ══ DONE STEP ════════════════════════════════════════════════════════════════
  if (step === 'done' && saved) {
    return (
      <div className="screen ci-screen">
        <div className="ci-done-content">
          <div className={`ci-done-icon-wrap ci-done-icon-wrap--${saved}`}>
            <span className="ci-done-icon">{DONE_ICON[saved]}</span>
          </div>
          <span className="section-label">{t.ci_label}</span>
          <h1 className="ci-done-heading">{t.ci_done_heading}</h1>
          <p className="ci-done-status">{statusLabel[saved]}</p>
          <p className="ci-done-body">{doneBody[saved]}</p>
        </div>
      </div>
    );
  }

  // ══ HOLD + CHOICE (share header) ═════════════════════════════════════════════
  return (
    <div className="screen ci-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      {/* ══ HOLD STEP ══════════════════════════════════════════════════════════ */}
      {step === 'hold' && (
        <div className="ci-hold-content">
          <div className="ci-title-block">
            <span className="section-label">{t.ci_label}</span>
            <h1 className="ci-title">{t.ci_title}</h1>
            <p className="ci-supporting">{t.ci_supporting}</p>
          </div>

          <div className="ci-ring-area">
            <div className={`ci-ring-wrap${holding ? ' ci-ring-wrap--holding' : ''}`}>
              <svg className="ci-ring-svg" viewBox="0 0 200 200" aria-hidden="true">
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
                <circle
                  className="ci-ring-track"
                  cx={RING_CX} cy={RING_CY} r={RING_R}
                  fill="none" strokeWidth="5"
                />
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

              <button
                id="btn-ci-hold"
                className={`ci-hold-btn${holding ? ' ci-hold-btn--active' : ''}`}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onPointerCancel={cancelHold}
                onContextMenu={e => e.preventDefault()}
                aria-label={t.ci_hold_label}
              >
                {holding
                  ? <span className="ci-hold-pct">{Math.round(progress * 100)}</span>
                  : <span className="ci-hold-icon">◎</span>
                }
              </button>
            </div>

            <p className="ci-hold-label">
              {holding ? t.ci_holding_label : t.ci_hold_label}
            </p>
          </div>
        </div>
      )}

      {/* ══ CHOICE STEP ════════════════════════════════════════════════════════ */}
      {step === 'choice' && (
        <div className="ci-choice-content">
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
                onClick={() => setSelected(prev => prev === id ? null : id)}
              >
                <div className="ci-status-top">
                  <span className="ci-status-icon">{icon}</span>
                  <span className="ci-status-name">{statusLabel[id]}</span>
                  <span className="ci-status-check" aria-hidden="true">
                    {selected === id ? '●' : '○'}
                  </span>
                </div>
                <p className="ci-status-body">{statusBody[id]}</p>
              </button>
            ))}
          </div>

          {/* Confirm button */}
          <div className="ci-confirm-area">
            <button
              id="btn-ci-confirm"
              className="btn btn-primary btn-large ci-confirm-btn"
              disabled={selected === null}
              onClick={handleConfirm}
            >
              {t.ci_confirm_btn}
            </button>

            <button
              className="ci-redo-link"
              onClick={() => { setStep('hold'); setSelected(null); }}
            >
              ← Check in again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
