import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import { saveCheckIn } from '../utils/checkInStorage';
import type { CheckInStatus } from '../utils/checkInStorage';
import {
  loadPledge,
  recordNonNegotiableReview,
  MAX_NON_NEGOTIABLES,
} from '../utils/pledgeStorage';
import { saveReviewEvent } from '../utils/reviewStorage';
import { generateId } from '../utils';
import './CheckInScreen.css';

interface CheckInScreenProps {
  onNavigate: (screen: Screen) => void;
}

type CheckInStep   = 'hold' | 'choice' | 'celebrate' | 'review' | 'done';
type InlinePanel   = 'none' | 'why' | 'ability';

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_R    = 78;
const RING_CX   = 100;
const RING_CY   = 100;
const RING_CIRC = 2 * Math.PI * RING_R;
const HOLD_MS   = 2500;
const ON_STRUCTURE_DELAY = 1400;  // auto-nav delay for on-structure only

// ── Celebration variants ──────────────────────────────────────────────────────
const CELEBRATION_VARIANTS = ['confetti', 'sparks', 'particles', 'rings'] as const;
type CelebrationVariant = typeof CELEBRATION_VARIANTS[number];

function getRandomVariant(): CelebrationVariant {
  return CELEBRATION_VARIANTS[Math.floor(Math.random() * CELEBRATION_VARIANTS.length)];
}

// ── Status option config ──────────────────────────────────────────────────────
interface StatusOption { id: CheckInStatus; mod: string; icon: string; }

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'on-structure', mod: 'on-structure', icon: '✓' },
  { id: 'near-slip',    mod: 'near-slip',    icon: '⚡' },
  { id: 'slip',         mod: 'slip',         icon: '↻' },
];

const DONE_ICON: Record<CheckInStatus, string> = {
  'on-structure': '✓',
  'near-slip':    '⚡',
  'slip':         '↻',
};

// ── Support action config (Near Slip) ─────────────────────────────────────────
interface SupportAction {
  id: string;
  icon: string;
  labelKey: 'ci_action_motivation' | 'ci_action_timer' | 'ci_action_why' | 'ci_action_ability';
  mod: string;
}

const SUPPORT_ACTIONS: SupportAction[] = [
  { id: 'motivation', icon: '♫', labelKey: 'ci_action_motivation', mod: 'motivation' },
  { id: 'timer',      icon: '⏱', labelKey: 'ci_action_timer',      mod: 'timer'      },
  { id: 'why',        icon: '✦', labelKey: 'ci_action_why',         mod: 'why'        },
  { id: 'ability',    icon: '◎', labelKey: 'ci_action_ability',     mod: 'ability'    },
];

// ── Celebration Overlay ───────────────────────────────────────────────────────

interface CelebrationOverlayProps {
  variant: CelebrationVariant;
  heading: string;
  onComplete: () => void;
}

function CelebrationOverlay({ variant, heading, onComplete }: CelebrationOverlayProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const particles = useMemo(() => {
    if (variant === 'confetti') {
      return Array.from({ length: 22 }, (_, i) => (
        <div
          key={i}
          className="cel-confetti-piece"
          style={{ '--i': i, '--hue': (i * 23 + 40) % 360, left: `${5 + (i * 4.2) % 90}%` } as React.CSSProperties}
        />
      ));
    }
    if (variant === 'sparks') {
      return Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="cel-spark"
          style={{ '--i': i, '--angle': `${i * 30}deg` } as React.CSSProperties}
        />
      ));
    }
    if (variant === 'particles') {
      return Array.from({ length: 18 }, (_, i) => (
        <div
          key={i}
          className="cel-particle"
          style={{
            '--i': i,
            '--x': `${Math.cos((i / 18) * Math.PI * 2) * 120}px`,
            '--y': `${Math.sin((i / 18) * Math.PI * 2) * 110}px`,
          } as React.CSSProperties}
        />
      ));
    }
    return Array.from({ length: 4 }, (_, i) => (
      <div key={i} className="cel-ring" style={{ '--i': i } as React.CSSProperties} />
    ));
  }, [variant]);

  return (
    <div className={`cel-overlay cel-overlay--${variant}`} aria-live="polite" aria-atomic="true">
      <div className="cel-stage">
        {particles}
        <div className="cel-center">
          <div className="cel-checkmark">✓</div>
          <p className="cel-heading">{heading}</p>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CheckInScreen({ onNavigate }: CheckInScreenProps) {
  const { t } = useTranslation();

  // Load pledge data fresh on every mount (component re-mounts on each navigation)
  const pledge = useMemo(() => loadPledge(), []);

  const [step, setStep]             = useState<CheckInStep>('hold');
  const [progress, setProgress]     = useState(0);
  const [holding, setHolding]       = useState(false);
  const [selected, setSelected]     = useState<CheckInStatus | null>(null);
  const [saved, setSaved]           = useState<CheckInStatus | null>(null);
  const [panel, setPanel]           = useState<InlinePanel>('none');
  const [celebVariant, setCelebVariant] = useState<CelebrationVariant>('confetti');
  const [reviewToast, setReviewToast] = useState(false);

  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  // Duplicate-prevention for hold: one hold gesture = one advance to choice
  const holdCompletedRef = useRef(false);
  // Duplicate-prevention for review: one open = one count increment
  const reviewedRef = useRef(false);

  // ── Auto-nav: ON STRUCTURE only ────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'done' || saved !== 'on-structure') return;
    const timer = setTimeout(() => onNavigate('home'), ON_STRUCTURE_DELAY);
    return () => clearTimeout(timer);
  }, [step, saved, onNavigate]);

  // ── Hold mechanics ─────────────────────────────────────────────────────────
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
        setTimeout(() => { setProgress(0); setStep('choice'); }, 250);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [step]);

  // ── Confirm check-in ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!selected) return;
    saveCheckIn(selected);
    setSaved(selected);
    setPanel('none');
    if (navigator.vibrate) navigator.vibrate(40);

    if (selected === 'on-structure') {
      setCelebVariant(getRandomVariant());
      setStep('celebrate');
    } else {
      setStep('done');
    }
  }, [selected]);

  // ── Celebration complete ───────────────────────────────────────────────────
  const handleCelebrationComplete = useCallback(() => {
    setStep('done');
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleRedo = () => {
    holdCompletedRef.current = false;
    reviewedRef.current = false;
    setStep('hold');
    setSelected(null);
    setSaved(null);
    setPanel('none');
  };

  // ── Review: open + close ───────────────────────────────────────────────────
  const openReview = () => {
    reviewedRef.current = false; // reset so this opening can count once
    setStep('review');
  };

  const handleReviewDone = useCallback(() => {
    if (reviewedRef.current) return; // prevent double-tap
    reviewedRef.current = true;
    recordNonNegotiableReview();
    saveReviewEvent({ id: generateId(), timestamp: Date.now() });
    setReviewToast(true);
    setTimeout(() => {
      setReviewToast(false);
      setStep('hold');
    }, 2000);
  }, []);

  // ── Ring ───────────────────────────────────────────────────────────────────
  const strokeOffset = RING_CIRC * (1 - progress);

  // ── i18n label maps ────────────────────────────────────────────────────────
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

  const handleSupportAction = (id: string) => {
    switch (id) {
      case 'motivation': onNavigate('daily-audio');  break;
      case 'timer':      onNavigate('context');      break;
      case 'why':        setPanel('why');             break;
      case 'ability':    setPanel('ability');         break;
    }
  };

  // ── Pledge section helpers ─────────────────────────────────────────────────
  const firstReason      = pledge.reasons[0] ?? null;
  const nnCount          = pledge.nonNegotiables.length;
  const nnSub            = nnCount > 0
    ? `${nnCount} / ${MAX_NON_NEGOTIABLES}`
    : t.pledge_nn_empty;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  // ── Celebration overlay ────────────────────────────────────────────────────
  if (step === 'celebrate') {
    return (
      <div className="screen ci-screen">
        <CelebrationOverlay
          variant={celebVariant}
          heading={t.ci_win_heading}
          onComplete={handleCelebrationComplete}
        />
      </div>
    );
  }

  // ── Review step ────────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <div className="screen ci-screen">
        <div className="ci-review-wrap">
          <ScreenHeader
            onBack={() => setStep('hold')}
            onHome={() => onNavigate('home')}
          />

          <div className="ci-review-content">
            <div className="ci-title-block">
              <span className="section-label">{t.ci_label}</span>
              <h1 className="ci-title">{t.pledge_review_heading}</h1>
            </div>

            {pledge.nonNegotiables.length === 0 ? (
              <div className="ci-review-empty">
                <p>{t.pledge_review_empty}</p>
                <button
                  className="ci-pledge-manage-btn"
                  onClick={() => onNavigate('commitment')}
                >
                  {t.pledge_why_manage} →
                </button>
              </div>
            ) : (
              <ol className="ci-review-list" aria-label={t.pledge_review_heading}>
                {pledge.nonNegotiables.map((nn, idx) => (
                  <li key={idx} className="ci-review-item">
                    <span className="ci-review-num" aria-hidden="true">{idx + 1}</span>
                    <span className="ci-review-text">{nn}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="ci-review-footer">
            <button
              id="btn-review-done"
              className="btn btn-primary btn-large"
              onClick={handleReviewDone}
              disabled={reviewToast}
            >
              {t.pledge_review_done}
            </button>
          </div>

          {/* Subtle win toast */}
          {reviewToast && (
            <div className="ci-review-toast" role="status" aria-live="polite">
              <span className="ci-review-toast-icon">◉</span>
              {t.pledge_review_win}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── "Remember My Why" inline panel ────────────────────────────────────────
  if (step === 'done' && saved === 'near-slip' && panel === 'why') {
    return (
      <div className="screen ci-screen ci-panel-screen">
        <div className="ci-panel-content">
          <div className="ci-panel-badge ci-panel-badge--amber">{t.ci_why_heading}</div>
          <p className="ci-panel-body">
            {t.ci_why_body.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
          <button id="btn-ci-why-cta" className="btn btn-primary btn-large" onClick={() => setPanel('none')}>
            {t.ci_why_cta}
          </button>
        </div>
      </div>
    );
  }

  // ── "Use an Ability" inline panel ──────────────────────────────────────────
  if (step === 'done' && saved === 'near-slip' && panel === 'ability') {
    return (
      <div className="screen ci-screen ci-panel-screen">
        <div className="ci-panel-content">
          <div className="ci-panel-badge ci-panel-badge--amber">{t.ci_resumeability_heading}</div>
          <p className="ci-panel-body">{t.ci_ability_body}</p>
          <button id="btn-ci-ability-cta" className="btn btn-primary btn-large" onClick={() => onNavigate('context')}>
            {t.ci_ability_cta}
          </button>
          <button className="ci-panel-back" onClick={() => setPanel('none')}>← Back</button>
        </div>
      </div>
    );
  }

  // ── ON STRUCTURE done ──────────────────────────────────────────────────────
  if (step === 'done' && saved === 'on-structure') {
    return (
      <div className="screen ci-screen">
        <div className="ci-done-content">
          <div className="ci-done-icon-wrap ci-done-icon-wrap--on-structure">
            <span className="ci-done-icon">{DONE_ICON['on-structure']}</span>
          </div>
          <span className="section-label">{t.ci_label}</span>
          <h1 className="ci-done-heading">{t.ci_done_heading}</h1>
          <p className="ci-done-status">{statusLabel['on-structure']}</p>
          <p className="ci-done-body">{doneBody['on-structure']}</p>
        </div>
      </div>
    );
  }

  // ── NEAR SLIP done ─────────────────────────────────────────────────────────
  if (step === 'done' && saved === 'near-slip') {
    return (
      <div className="screen ci-screen">
        <div className="ci-done-header ci-done-header--near-slip">
          <div className="ci-done-icon-wrap ci-done-icon-wrap--near-slip ci-done-icon-wrap--sm">
            <span className="ci-done-icon">{DONE_ICON['near-slip']}</span>
          </div>
          <div className="ci-done-header-text">
            <span className="section-label">{t.ci_label}</span>
            <h1 className="ci-done-heading ci-done-heading--sm">{t.ci_done_heading}</h1>
            <p className="ci-done-status">{statusLabel['near-slip']}</p>
          </div>
        </div>
        <p className="ci-near-slip-win">{t.ci_near_slip_win}</p>
        <p className="ci-done-desc">{t.ci_done_near_slip_desc}</p>
        <div className="ci-support-section">
          <p className="ci-support-heading">{t.ci_near_support_heading}</p>
          <div className="ci-support-actions">
            {SUPPORT_ACTIONS.map(({ id, icon, labelKey, mod }) => (
              <button
                key={id}
                id={`ci-support-${id}`}
                className={`ci-support-action ci-support-action--${mod}`}
                onClick={() => handleSupportAction(id)}
              >
                <span className="ci-support-action-icon">{icon}</span>
                <span className="ci-support-action-text">{t[labelKey]}</span>
                <span className="ci-support-action-arrow">›</span>
              </button>
            ))}
          </div>
          <button className="ci-back-home" onClick={() => onNavigate('home')}>{t.ci_back_home}</button>
        </div>
      </div>
    );
  }

  // ── SLIP done ──────────────────────────────────────────────────────────────
  if (step === 'done' && saved === 'slip') {
    return (
      <div className="screen ci-screen">
        <div className="ci-done-header ci-done-header--slip">
          <div className="ci-done-icon-wrap ci-done-icon-wrap--slip ci-done-icon-wrap--sm">
            <span className="ci-done-icon">{DONE_ICON['slip']}</span>
          </div>
          <div className="ci-done-header-text">
            <span className="section-label">{t.ci_label}</span>
            <h1 className="ci-done-heading ci-done-heading--sm">{t.ci_done_heading}</h1>
            <p className="ci-done-status">{statusLabel['slip']}</p>
          </div>
        </div>
        <p className="ci-done-desc">{doneBody['slip']}</p>
        <div className="ci-recovery-section">
          <div className="ci-recovery-card">
            <div className="ci-recovery-badge">{t.ci_resumeability_heading}</div>
            <p className="ci-recovery-body">{t.ci_slip_recovery_body}</p>
            <button id="btn-ci-resume" className="btn btn-primary btn-large" onClick={() => onNavigate('context')}>
              {t.ci_slip_recovery_cta}
            </button>
          </div>
          <button className="ci-back-home" onClick={() => onNavigate('home')}>{t.ci_back_home}</button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOLD + CHOICE
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="screen ci-screen">
      <div className="ci-scrollable">
        <ScreenHeader
          onBack={() => onNavigate('home')}
          onHome={() => onNavigate('home')}
        />

        {/* ══ HOLD STEP ════════════════════════════════════════════════════════ */}
        {step === 'hold' && (
          <div className="ci-hold-content">
            {/* Title */}
            <div className="ci-title-block">
              <span className="section-label">{t.ci_label}</span>
              <h1 className="ci-title">{t.ci_title}</h1>
              <p className="ci-supporting">{t.ci_supporting}</p>
            </div>

            {/* ── Pledge section ──────────────────────────────────────────── */}
            <div className="ci-pledge-section">
              {/* ── WHY AM I DOING THIS? — prominent reason block ── */}
              <div className="ci-why-block" aria-label={t.pledge_why_question}>
                <span className="ci-why-question">{t.pledge_why_question}</span>
                <p className={`ci-why-reason${firstReason ? '' : ' ci-why-reason--empty'}`}>
                  {firstReason ?? t.pledge_why_empty}
                </p>
                <button
                  className="ci-pledge-manage-btn ci-why-manage-btn"
                  onClick={() => onNavigate('commitment')}
                  aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
                >
                  {t.pledge_why_manage} ›
                </button>
              </div>

              {/* Compact info cards — Non-Negotiables only */}
              <div className="ci-pledge-cards">
                {/* Non-Negotiables card */}
                <div className="ci-pledge-card">
                  <div className="ci-pledge-card-body">
                    <span className="ci-pledge-card-title">{t.pledge_nn_title}</span>
                    <span className={`ci-pledge-card-sub${nnCount === 0 ? ' ci-pledge-card-sub--empty' : ''}`}>
                      {nnSub}
                    </span>
                  </div>
                  <button
                    className="ci-pledge-manage-btn"
                    onClick={() => onNavigate('commitment')}
                    aria-label={`${t.pledge_why_manage} ${t.pledge_nn_title}`}
                  >
                    {t.pledge_why_manage} ›
                  </button>
                </div>
              </div>

              {/* Review button */}
              <button
                id="btn-review-nn"
                className="ci-pledge-review-btn"
                onClick={openReview}
              >
                <span className="ci-pledge-review-icon" aria-hidden="true">◎</span>
                {t.pledge_nn_review_btn}
              </button>
            </div>

            {/* ── Ring area ───────────────────────────────────────────────── */}
            <div className="ci-ring-area">
              <div className="ci-hold-instruction-block">
                <p className="ci-hold-instruction">PRESS AND HOLD TO CHECK IN</p>
                <span className="ci-hold-arrow" aria-hidden="true">↓</span>
              </div>

              <div className={`ci-ring-wrap${holding ? ' ci-ring-wrap--holding' : ''}`}>
                <svg className="ci-ring-svg" viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <linearGradient id="ci-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%"   stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                    <filter id="ci-ring-glow">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <circle className="ci-ring-track" cx={RING_CX} cy={RING_CY} r={RING_R}
                    fill="none" strokeWidth="5" />
                  {(holding || progress > 0) && (
                    <circle className="ci-ring-arc" cx={RING_CX} cy={RING_CY} r={RING_R}
                      fill="none" stroke="url(#ci-ring-grad)" strokeWidth="5"
                      strokeLinecap="round" strokeDasharray={RING_CIRC}
                      strokeDashoffset={strokeOffset}
                      transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                      filter="url(#ci-ring-glow)" />
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
                  aria-label="Press and hold to check in"
                >
                  {holding
                    ? <span className="ci-hold-pct">{Math.round(progress * 100)}</span>
                    : <span className="ci-hold-icon">◎</span>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ CHOICE STEP ══════════════════════════════════════════════════════ */}
        {step === 'choice' && (
          <div className="ci-choice-content">
            <div className="ci-title-block">
              <span className="section-label">{t.ci_label}</span>
              <h1 className="ci-title">{t.ci_status_label}</h1>
              <p className="ci-supporting">{t.ci_status_sub}</p>
            </div>

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

            <div className="ci-confirm-area">
              <button
                id="btn-ci-confirm"
                className="btn btn-primary btn-large ci-confirm-btn"
                disabled={selected === null}
                onClick={handleConfirm}
              >
                {t.ci_confirm_btn}
              </button>
              <button className="ci-redo-link" onClick={handleRedo}>
                ← Check in again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
