import React, { useMemo } from 'react';
import { AppIcon } from '../icons/AppIcon';
import { useReducedMotion } from './useReducedMotion';
import './motionTokens.css';

export interface CelebrationActionItem {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface SuccessCelebrationProps {
  id?: string;
  variant: 'resume' | 'repledge';
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  actions: CelebrationActionItem[];
}

/**
 * Shared Midnight Intelligence × Premium Wellness confirmation presentation layer
 * for Animation A (Resume Celebration) and Animation B (Daily Re-Pledge Confirmation).
 *
 * Purely presentational — never mutates storage, creates check-in/pledge records,
 * or awards XP on mount.
 */
export const SuccessCelebration: React.FC<SuccessCelebrationProps> = ({
  id,
  variant,
  title,
  subtitle,
  children,
  actions,
}) => {
  const reducedMotion = useReducedMotion();

  const particleSpecs = useMemo(() => {
    const count = variant === 'resume' ? 10 : 8;
    const radiusBase = variant === 'resume' ? 46 : 44;
    return Array.from({ length: count }, (_, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const dist = radiusBase + (idx % 2 === 0 ? 6 : -4);
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist);
      const delayMs = 80 + idx * 35;
      return { idx, tx, ty, delayMs, alt: idx % 2 === 1 };
    });
  }, [variant]);

  return (
    <div
      id={id}
      className={`sda-celebration sda-celebration--${variant}`}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      <div className="sda-celebration-stage" aria-hidden="true">
        {!reducedMotion && (
          <>
            <span className="sda-celebration-ring" />
            <span className="sda-celebration-ring sda-celebration-ring--secondary" />
            <div className="sda-celebration-particles">
              {particleSpecs.map((p) => (
                <span
                  key={p.idx}
                  className={`sda-celebration-particle ${
                    p.alt ? 'sda-celebration-particle--alt' : ''
                  }`}
                  style={
                    {
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                      '--p-delay': `${p.delayMs}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </>
        )}

        <div className="sda-celebration-emblem">
          {variant === 'resume' ? (
            <AppIcon name="check" size={30} />
          ) : (
            <AppIcon name="shield" size={30} />
          )}
        </div>
      </div>

      <h3 className="sda-celebration-title" id={id ? `${id}-title` : undefined}>
        {title}
      </h3>
      <p className="sda-celebration-sub">{subtitle}</p>

      {children && <div className="sda-celebration-slot">{children}</div>}

      <div className="sda-celebration-actions">
        {actions.map((act, index) => {
          const isPrimary = (act.variant ?? (index === 0 ? 'primary' : 'secondary')) === 'primary';
          return (
            <button
              key={act.id}
              id={act.id}
              type="button"
              className={
                isPrimary ? 'sda-celebration-btn-primary' : 'sda-celebration-btn-secondary'
              }
              onClick={act.onClick}
            >
              <span>{act.label}</span>
              {isPrimary && <AppIcon name="chevron-right" size={15} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
