import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { playFeedback, FeedbackType } from '../utils/feedback';
import './HoldCommitButton.css';

export interface HoldCommitButtonProps {
  variant?: 'commit' | 'recommit' | 'review';
  label?: string;
  holdingLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  durationMs?: number;
  onComplete: () => void;
  id?: string;
  className?: string;
}

const DEFAULT_HOLD_MS = 2500;
const RING_SIZE = 140;
const RING_CX = 70;
const RING_CY = 70;
const RING_R = 56;
const RING_CIRC = 2 * Math.PI * RING_R;

export const HoldCommitButton: React.FC<HoldCommitButtonProps> = ({
  variant = 'commit',
  label,
  holdingLabel,
  disabled = false,
  disabledReason,
  durationMs = DEFAULT_HOLD_MS,
  onComplete,
  id = 'btn-hold-commit-ritual',
  className = '',
}) => {
  const { t } = useTranslation();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);

  // Derive default localized labels based on variant
  const defaultLabel = React.useMemo(() => {
    switch (variant) {
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
      case 'recommit':
        return 'recovery';
      case 'review':
        return 'check-in';
      case 'commit':
      default:
        return 'commit';
    }
  }, [variant]);

  // Cancel hold if finger/pointer lifts, leaves, or key is released
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

  // Complete action
  const completeHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    holdCompletedRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(1);

    playFeedback(feedbackType);
    onComplete();
  }, [feedbackType, onComplete]);

  // Pointer start
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || holdCompletedRef.current) return;
      e.preventDefault();
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
    },
    [disabled, durationMs, completeHold],
  );

  // Keyboard accessibility (Space / Enter hold)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled || holdCompletedRef.current || holding) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
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
      }
    },
    [disabled, holding, durationMs, completeHold],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        cancelHold();
      }
    },
    [cancelHold],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const strokeOffset = RING_CIRC * (1 - progress);
  const displayLabel = label || defaultLabel;
  const pct = Math.round(progress * 100);

  return (
    <div
      className={`hold-commit-ritual-container hold-commit-ritual--${variant} ${disabled ? 'hold-commit-ritual--disabled' : ''} ${className}`}
    >
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
      >
        <svg
          className="hold-commit-svg"
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`hold-grad-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
            <filter id={`hold-glow-${variant}`}>
              <feGaussianBlur stdDeviation="2.5" result="blur" />
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
            strokeWidth="5"
          />

          {/* Active progress arc */}
          {(holding || progress > 0) && (
            <circle
              className="hold-commit-ring-arc"
              cx={RING_CX}
              cy={RING_CY}
              r={RING_R}
              fill="none"
              stroke={`url(#hold-grad-${variant})`}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={strokeOffset}
              transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
              filter={`url(#hold-glow-${variant})`}
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
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={`${displayLabel} - ${holding ? (holdingLabel || `${pct}%`) : 'Press and hold'}`}
        >
          {holding ? (
            <span className="hold-commit-pct">{pct}%</span>
          ) : (
            <span className="hold-commit-center-icon">{defaultIcon}</span>
          )}
        </button>
      </div>

      <p className="hold-commit-sub-instruction">
        {holding
          ? holdingLabel || `${pct}%`
          : disabled
            ? disabledReason || t.nn_review_check_all_first
            : t.commit_hold_instruction || 'Press and hold'}
      </p>
    </div>
  );
};

export default HoldCommitButton;
