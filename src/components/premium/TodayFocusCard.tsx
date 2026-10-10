/**
 * Super Diet-Ability — Today's Focus card (Phase 2)
 *
 * Shows the user's actual current/next Structured Diet meal or beverage block
 * for today, derived read-only from the existing diet store. Never shows
 * placeholder meals; renders an honest empty state instead.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  loadWeeklyDiet,
  getDayPlanForDate,
  getBlockPrimaryDescription,
  getLocalDateKey,
} from '../../utils/dietStorage';
import { getNextPlannedBlock } from '../../utils/homeSelectors';
import { AppIcon } from '../icons/AppIcon';

interface TodayFocusCardProps {
  onNavigate: (screen: Screen) => void;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function TodayFocusCard({ onNavigate }: TodayFocusCardProps) {
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);

  // Re-evaluate once a minute so "Now" / "Next" stays accurate while Home is open.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const next = useMemo(() => {
    try {
      const diet = loadWeeklyDiet();
      const day = getDayPlanForDate(diet, getLocalDateKey());
      return getNextPlannedBlock(day, nowMinutes());
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const isBeverageOnly =
    !!next &&
    Array.isArray(next.block.foodCategories) &&
    next.block.foodCategories.length > 0 &&
    next.block.foodCategories.every((c) => c === 'beverages');

  return (
    <section className="sda-card sda-focus" aria-labelledby="sda-focus-title" id="home-today-focus">
      <header className="sda-card-head">
        <h2 id="sda-focus-title" className="sda-card-title">{t.home_focus_title}</h2>
        <button
          id="btn-home-focus-edit"
          type="button"
          className="sda-pill-btn"
          onClick={() => onNavigate('structured-diet')}
        >
          <AppIcon name="pencil" size={14} />
          <span>{t.home_focus_edit}</span>
        </button>
      </header>

      {next ? (
        <button
          id="btn-home-focus-next"
          type="button"
          className="sda-focus-row"
          onClick={() => onNavigate('structured-diet')}
        >
          <span className="sda-focus-icon" aria-hidden="true">
            <AppIcon name={isBeverageOnly ? 'droplet' : 'utensils'} size={20} />
          </span>
          <span className="sda-focus-text">
            <span className="sda-focus-kicker">
              {next.status === 'current' ? t.home_focus_now : t.home_focus_next_meal}
            </span>
            <span className="sda-focus-desc">{getBlockPrimaryDescription(next.block, t as unknown as Record<string, unknown>)}</span>
          </span>
          <span className="sda-focus-time">{next.block.startTime}</span>
        </button>
      ) : (
        <div className="sda-focus-empty">
          <span className="sda-focus-icon" aria-hidden="true">
            <AppIcon name="utensils" size={20} />
          </span>
          <span className="sda-focus-text">
            <span className="sda-focus-desc">{t.home_focus_empty_title}</span>
            <span className="sda-focus-sub">{t.home_focus_empty_body}</span>
          </span>
          <button
            id="btn-home-focus-plan"
            type="button"
            className="sda-pill-btn sda-pill-btn--accent"
            onClick={() => onNavigate('structured-diet')}
          >
            <AppIcon name="plus" size={14} />
            <span>{t.home_focus_empty_cta}</span>
          </button>
        </div>
      )}
    </section>
  );
}

export default TodayFocusCard;
