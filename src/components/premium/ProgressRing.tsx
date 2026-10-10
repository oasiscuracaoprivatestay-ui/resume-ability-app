/**
 * Super Diet-Ability — Premium Progress Ring (Phase 2)
 *
 * Accessible SVG ring with emerald→turquoise gradient. Purely presentational:
 * callers pass real values (e.g. Challenge currentDay / durationDays).
 */

import { useId, type ReactNode } from 'react';
import './ProgressRing.css';

interface ProgressRingProps {
  /** Progress between 0 and 1 (clamped). */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Accessible description, e.g. "Day 3 of 7 — 43% of the Challenge timeline". */
  ariaLabel: string;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({
  value,
  size = 132,
  strokeWidth = 10,
  ariaLabel,
  children,
  className,
}: ProgressRingProps) {
  const gradId = `sda-ring-${useId().replace(/:/g, '')}`;
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped);

  return (
    <div
      className={['sda-ring', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="55%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <circle
          className="sda-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="sda-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          data-progress={clamped.toFixed(4)}
          style={{ ['--sda-ring-from' as string]: String(c) }}
        />
      </svg>
      <div className="sda-ring-center" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

export default ProgressRing;
