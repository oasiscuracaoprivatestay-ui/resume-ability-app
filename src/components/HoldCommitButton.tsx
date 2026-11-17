import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { playFeedback, FeedbackType } from '../utils/feedback';
import { AppIcon } from './icons/AppIcon';
import './HoldCommitButton.css';

export interface HoldCommitButtonProps {
  variant?: 'commit' | 'recommit' | 'review' | 'repledge';
  label?: string;
  holdingLabel?: string;
  subLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  durationMs?: number;
  /** Return `false` if persistence failed so the hold resets without locking or celebrating. */
  onComplete: () => boolean | void;
  showAccessibleConfirm?: boolean;
  accessibleConfirmLabel?: string;
  id?: string;
  className?: string;
}

const DEFAULT_HOLD_MS = 2500;
const RING_SIZE = 148;
const RING_CX = 74;
const RING_CY = 74;
const RING_R = 59;
const RING_CIRC = 2 * Math.PI * RING_R;

export const HoldCommitButton: React.FC<HoldCommitButtonProps> = ({
  variant = 'commit',
  label,
  holdingLabel,
  subLabel,
  icon,
  disabled = false,
  disabledReason,
  durationMs = DEFAULT_HOLD_MS,
  onComplete,
  showAccessibleConfirm = false,
  accessibleConfirmLabel,
  id = 'btn-hold-commit-ritual',
  className = '',
}) => {
  const { t } = useTranslation();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [srAnnouncement, setSrAnnouncement] = useState('');

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);

  // Derive default localized labels based on variant
  const defaultLabel = React.useMemo(() => {
    switch (variant) {
      case 'repledge':
        return `→ ${t.anim_repledge_hold_cue}`;
      case 'recommit':
        return `→ ${t.recommit_hold_btn || 'HOLD TO RE-COMMIT'}`;
      case 'review':
        return `→ ${t.sz_hold_to_confirm_review || 'HOLD TO CONFIRM REVIEW'}`;
      case 'commit':
      default:
        return `→ ${t.commit_hold_btn || 'HOLD TO COMMIT'}`;
    }
  }, [variant, t]);

  const defaultIcon = React.useMemo(() => {
    switch (variant) {
      case 'repledge':
        return <AppIcon name="shield" size={30} />;
      case 'recommit':
        return '🔄';
      case 'review':
        return '🛡️';
      case 'commit':
      default:
        return '⚡';
    }
  }, [variant]);

  const feedbackType: FeedbackType = React.useMemo(() => {
    switch (variant) {
      case 'repledge':
        return 'commit';
      case 'recommit':
        return 'recovery';
      case 'review':
        return 'check-in';
      case 'commit':
      default:
        return 'commit';
    }
  }, [variant]);

  // Cancel hold if finger/pointer lifts, leaves, blurs, or key is released early
  const cancelHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    const wasHolding = startRef.current !== null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
    if (wasHolding) {
      setSrAnnouncement(t.anim_repledge_canceled_sr);
    }
  }, [t.anim_repledge_canceled_sr]);

  // Complete action (single-fire guarded; resets cleanly if save returns false)
  const completeHold = useCallback(() => {
    if (disabled || holdCompletedRef.current) return;
    holdCompletedRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(1);

    const result = onComplete();
    if (result === false) {
      // Persistence failed — unlock and reset ring without playing success feedback
      holdCompletedRef.current = false;
      setProgress(0);
      return;
    }

    playFeedback(feedbackType);
  }, [disabled, feedbackType, onComplete]);

  const startHoldLoop = useCallback(() => {
    if (disabled || holdCompletedRef.current || startRef.current !== null) return;
    setSrAnnouncement('');
    setHolding(true);
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        completeHold();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, durationMs, completeHold]);

  // Pointer start (mouse & touch)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || holdCompletedRef.current) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      startHoldLoop();
    },
    [disabled, startHoldLoop]
  );

  // Keyboard accessibility (Space / Enter hold)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled || holdCompletedRef.current) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) {
          startHoldLoop();
        }
      }
    },
    [disabled, startHoldLoop]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        cancelHold();
      }
    },
    [cancelHold]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const strokeOffset = RING_CIRC * (1 - progress);
  const displayLabel = label || defaultLabel;
  const pct = Math.round(progress * 100);
  const gradId = `hold-grad-${variant}-${id}`;
  const glowId = `hold-glow-${variant}-${id}`;

  const activeHoldingText = holdingLabel
    ? holdingLabel.replace('{pct}', String(pct))
    : variant === 'repledge'
    ? t.anim_repledge_holding_status.replace('{pct}', String(pct))
    : `${pct}%`;

  const idleSubText =
    subLabel ||
    (variant === 'repledge'
      ? t.anim_repledge_hold_sub
      : t.commit_hold_instruction || 'Press and hold');

  return (
    <div
      className={`hold-commit-ritual-container hold-commit-ritual--${variant} ${
        disabled ? 'hold-commit-ritual--disabled' : ''
      } ${className}`}
    >
      {/* Screen-reader live region */}
      <span className="hold-commit-sr-live" role="status" aria-live="polite">
        {srAnnouncement}
      </span>

      {/* Disabled reason cue if review is gated */}
      {disabled && disabledReason && (
        <div className="hold-commit-gated-banner" role="status">
          <span className="hold-commit-gated-icon" aria-hidden="true">
            ⓘ
          </span>
          <span className="hold-commit-gated-text">{disabledReason}</span>
        </div>
      )}

      {/* Main direction / instruction cue */}
      <div className="hold-commit-instruction-wrap">
        <span className="hold-commit-cue-text">{displayLabel}</span>
      </div>

      {/* Circular Hold Ring area */}
      <div
        className={`hold-commit-ring-wrap ${holding ? 'hold-commit-ring-wrap--holding' : ''}`}
        data-hold-progress={pct}
      >
        <svg
          className="hold-commit-svg"
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              {variant === 'repledge' && (
                <>
                  <stop offset="0%" stopColor="#7dd3fc" />
                  <stop offset="52%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#2dd4b3" />
                </>
              )}
              {variant === 'commit' && (
                <>
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </>
              )}
              {variant === 'recommit' && (
                <>
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#16a34a" />
                </>
              )}
              {variant === 'review' && (
                <>
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </>
              )}
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle
            className="hold-commit-ring-track"
            cx={RING_CX}
            cy={RING_CY}
            r={RING_R}
            fill="none"
            strokeWidth="5.5"
          />

          {/* Active progress arc */}
          {(holding || progress > 0) && (
            <circle
              className="hold-commit-ring-arc"
              cx={RING_CX}
              cy={RING_CY}
              r={RING_R}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={strokeOffset}
              transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
              filter={`url(#${glowId})`}
            />
          )}
        </svg>

        <button
          id={id}
          type="button"
          disabled={disabled}
          className={`hold-commit-button ${holding ? 'hold-commit-button--active' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onBlur={cancelHold}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`${displayLabel} — ${holding ? activeHoldingText : idleSubText}`}
        >
          {holding ? (
            <span className="hold-commit-pct">{pct}%</span>
          ) : (
            <span className="hold-commit-center-icon">{icon ?? defaultIcon}</span>
          )}
        </button>
      </div>

      <p className="hold-commit-sub-instruction">
        {holding
          ? activeHoldingText
          : disabled
          ? disabledReason || t.nn_review_check_all_first
          : idleSubText}
      </p>

      {/* Accessible single-action confirmation alternative (keyboard / switch / reduced-dexterity) */}
      {showAccessibleConfirm && !disabled && (
        <button
          type="button"
          id={`${id}-accessible-confirm`}
          className="hold-commit-accessible-alt-btn"
          onClick={completeHold}
        >
          {accessibleConfirmLabel || t.anim_repledge_accessible_btn}
        </button>
      )}
    </div>
  );
};

export default HoldCommitButton;
