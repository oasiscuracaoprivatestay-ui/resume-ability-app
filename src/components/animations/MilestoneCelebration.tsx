import React, { useEffect, useMemo, useRef } from 'react';
import { AppIcon } from '../icons/AppIcon';
import { useTranslation } from '../../i18n';
import type { NinetyDayMilestoneDay } from '../../challenges/ninetyDayJourneyStorage';
import { useReducedMotion } from './useReducedMotion';
import './motionTokens.css';

export type MilestoneCelebrationTier = 'small' | 'medium' | 'distinctive';

export function getMilestoneCelebrationTier(
  day: NinetyDayMilestoneDay
): MilestoneCelebrationTier {
  if (day === 3 || day === 7) return 'small';
  if (day === 14 || day === 30) return 'medium';
  return 'distinctive'; // Days 60 and 90
}

export interface MilestoneCelebrationProps {
  milestoneDay: NinetyDayMilestoneDay;
  shouldNavigateToDiet?: boolean;
  children?: React.ReactNode;
  onDismiss: () => void;
}

/**
 * Animation C — 90-Day Milestone Celebration Modal.
 *
 * Triggered ONLY when a milestone review (Days 3, 7, 14, 30, 60, 90) is newly
 * submitted and persisted. Scales subtly across 3 intensity tiers:
 * - Days 3 & 7: small
 * - Days 14 & 30: medium
 * - Days 60 & 90: distinctive
 */
export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestoneDay,
  shouldNavigateToDiet = false,
  children,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const tier = getMilestoneCelebrationTier(milestoneDay);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 40);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [onDismiss]);

  const particleSpecs = useMemo(() => {
    const count = tier === 'small' ? 8 : tier === 'medium' ? 12 : 16;
    const radius = tier === 'small' ? 54 : tier === 'medium' ? 62 : 68;
    return Array.from({ length: count }, (_, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const dist = radius + (idx % 2 === 0 ? 5 : -4);
      const tx = Math.round(Math.cos(angle) * dist);
      const ty = Math.round(Math.sin(angle) * dist);
      const isGold = tier !== 'small' && idx % 2 === 1;
      const delayMs = 90 + idx * 32;
      return { idx, tx, ty, isGold, delayMs };
    });
  }, [tier]);

  const subtitle =
    tier === 'small'
      ? t.anim_ms_tier_small_sub
      : tier === 'medium'
      ? t.anim_ms_tier_medium_sub
      : t.anim_ms_tier_distinctive_sub;

  const dayStr = String(milestoneDay);

  return (
    <div
      className="sda-ms-celebration-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div
        id="celebration-milestone-90d"
        className={`sda-ms-celebration-card sda-ms-celebration-card--${tier}`}
        data-milestone-day={milestoneDay}
        data-milestone-tier={tier}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="heading-ms-celebration"
      >
        <button
          type="button"
          id="btn-close-ms-celebration"
          className="sda-ms-celebration-close"
          aria-label={t.anim_dismiss_aria}
          onClick={onDismiss}
        >
          <AppIcon name="x" size={16} />
        </button>

        <div className="sda-ms-stage" aria-hidden="true">
          {!reducedMotion && (
            <>
              <span className="sda-ms-ring" />
              {(tier === 'medium' || tier === 'distinctive') && (
                <span className="sda-ms-ring sda-ms-ring--gold" />
              )}
              {particleSpecs.map((p) => (
                <span
                  key={p.idx}
                  className={`sda-ms-particle ${p.isGold ? 'sda-ms-particle--gold' : ''}`}
                  style={
                    {
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                      '--p-delay': `${p.delayMs}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </>
          )}

          <div className="sda-ms-emblem">
            <span className="sda-ms-emblem-star">
              {tier === 'distinctive' ? '★ ★ ★' : tier === 'medium' ? '★ ★' : '★'}
            </span>
            <span className="sda-ms-emblem-day-num" id="celebration-ms-day-number">
              {dayStr}
            </span>
            <span className="sda-ms-emblem-day-caption">
              {t.anim_ms_badge_day.replace('{day}', dayStr)}
            </span>
          </div>
        </div>

        <span className="sda-ms-pill">
          {t.journey90_day_of_90.replace('{day}', dayStr)}
        </span>

        <h3 className="sda-ms-title" id="heading-ms-celebration">
          {t.anim_ms_complete_title.replace('{day}', dayStr)}
        </h3>

        <p className="sda-ms-sub">{subtitle}</p>

        {children && <div className="sda-ms-slot">{children}</div>}

        <button
          ref={primaryBtnRef}
          type="button"
          id="btn-continue-ms-celebration"
          className="sda-ms-celebration-btn"
          onClick={onDismiss}
        >
          <AppIcon name="check" size={16} />
          <span>
            {shouldNavigateToDiet ? t.anim_ms_adjust_diet_btn : t.anim_ms_continue_btn}
          </span>
        </button>
      </div>
    </div>
  );
};
