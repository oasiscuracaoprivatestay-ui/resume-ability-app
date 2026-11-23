/**
 * Super Diet-Ability — Today's Focus card (Phase 2 & Phase 45 Improvement)
 *
 * Shows the user's actual current/next Structured Diet meal or beverage block
 * for today, derived read-only from the existing diet store.
 *
 * Requirements:
 * - Clear identification of NEXT MEAL, NEXT BEVERAGE, CURRENT MEAL, CURRENT BEVERAGE
 * - Display meal/beverage type badge
 * - Full food/beverage description (no ellipsis truncation, wraps naturally)
 * - Start and end time range (e.g. 12:30 – 13:00)
 * - Automatically advances past completed/verified blocks
 * - Handles overlapping schedules deterministically
 * - Handles midnight / carried-over overnight blocks
 * - Reactive to meal additions, edits, deletions, and verifications
 * - Honest empty states ("Nothing scheduled yet" & "All meals completed")
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  loadWeeklyDiet,
  getDayPlanForDate,
  getBlockPrimaryDescription,
  getBlockAlternativeDescription,
  getLocalDateKey,
  getYesterdayDateKey,
  DIET_UPDATED_EVENT,
} from '../../utils/dietStorage';
import {
  getDailyDietVerification,
  DIET_VERIFICATION_UPDATED_EVENT,
} from '../../utils/dietVerificationStorage';
import {
  getNextPlannedBlock,
  isBeverageBlock,
  getBlockTypeDisplay,
} from '../../utils/homeSelectors';
import { SCORE_UPDATED_EVENT } from '../../utils/scoringEngine';
import { STATS_RESET_EVENT } from '../../utils/resetStats';
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
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    // 1. Data change listeners
    const events = [
      DIET_UPDATED_EVENT,
      DIET_VERIFICATION_UPDATED_EVENT,
      SCORE_UPDATED_EVENT,
      STATS_RESET_EVENT,
    ];
    events.forEach((evt) => window.addEventListener(evt, refresh));

    // 2. Tab visibility & window focus listeners
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);

    // 3. Accurate minute-boundary timer so status flips at the exact clock minute
    let timeoutId: number | undefined;
    let intervalId: number | undefined;

    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    timeoutId = window.setTimeout(() => {
      refresh();
      intervalId = window.setInterval(refresh, 60_000);
    }, Math.max(500, msUntilNextMinute));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, refresh));
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [refresh]);

  const focusData = useMemo(() => {
    try {
      const todayKey = getLocalDateKey();
      const yesterdayKey = getYesterdayDateKey();

      const diet = loadWeeklyDiet();
      const todayDay = getDayPlanForDate(diet, todayKey);
      const yesterdayDay = getDayPlanForDate(diet, yesterdayKey);

      const todayVerification = getDailyDietVerification(todayKey);
      const yesterdayVerification = getDailyDietVerification(yesterdayKey);

      const completedBlockIds = new Set<string>();
      if (todayVerification?.entries) {
        todayVerification.entries.forEach((e) => {
          if (e.plannedBlockId) completedBlockIds.add(e.plannedBlockId);
          if (e.id) completedBlockIds.add(e.id);
        });
      }

      const yesterdayCompletedBlockIds = new Set<string>();
      if (yesterdayVerification?.entries) {
        yesterdayVerification.entries.forEach((e) => {
          if (e.plannedBlockId) yesterdayCompletedBlockIds.add(e.plannedBlockId);
          if (e.id) yesterdayCompletedBlockIds.add(e.id);
        });
      }

      const nextResult = getNextPlannedBlock(todayDay, nowMinutes(), {
        completedBlockIds,
        yesterdayDay,
        yesterdayCompletedBlockIds,
      });

      // Check whether all scheduled meals/beverages for today were completed (excluding rejected proposed meals)
      const NON_MEAL_TYPES = new Set(['micro_fasting', 'kitchen_closed']);
      const scheduledMealBlocks = (todayDay?.blocks || []).filter(
        (b) =>
          b &&
          b.approvalStatus !== 'rejected' &&
          !NON_MEAL_TYPES.has(String(b.type || '').trim().toLowerCase())
      );
      const hasPlannedMeals = scheduledMealBlocks.length > 0;
      const allCompleted =
        hasPlannedMeals &&
        scheduledMealBlocks.every((b) => completedBlockIds.has(b.id));

      return {
        next: nextResult,
        hasPlannedMeals,
        allCompleted,
      };
    } catch {
      return {
        next: null,
        hasPlannedMeals: false,
        allCompleted: false,
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const next = focusData.next;
  const isBeverage = !!next && isBeverageBlock(next.block);
  const isCurrent = !!next && next.status === 'current';

  const statusKicker = useMemo(() => {
    if (!next) return '';
    if (isCurrent) {
      return isBeverage
        ? (t.home_focus_now_beverage || 'Current beverage')
        : (t.home_focus_now_meal || 'Current meal');
    }
    return isBeverage
      ? (t.home_focus_next_beverage || 'Next beverage')
      : (t.home_focus_next_meal || 'Next meal');
  }, [next, isCurrent, isBeverage, t]);

  const typeDisplay = useMemo(() => {
    if (!next) return '';
    return getBlockTypeDisplay(next.block, t as unknown as Record<string, any>);
  }, [next, t]);

  const foodDescription = useMemo(() => {
    if (!next) return '';
    return getBlockPrimaryDescription(next.block, t as unknown as Record<string, any>);
  }, [next, t]);

  const altDescription = useMemo(() => {
    if (!next) return '';
    return getBlockAlternativeDescription(next.block, t as unknown as Record<string, any>);
  }, [next, t]);

  const timeRange = useMemo(() => {
    if (!next) return '';
    const start = next.block.startTime || '';
    const end = next.block.endTime || '';
    if (start && end && start !== end) {
      return `${start} – ${end}`;
    }
    return start || end;
  }, [next]);

  return (
    <section className="sda-card sda-focus" aria-labelledby="sda-focus-title" id="home-today-focus">
      <header className="sda-card-head">
        <span className="sda-card-title-group">
          <span className="sda-card-title-icon" aria-hidden="true">
            <AppIcon name="target" size={18} />
          </span>
          <h2 id="sda-focus-title" className="sda-card-title">{t.home_focus_title}</h2>
        </span>
        <button
          id="btn-home-focus-edit"
          type="button"
          className="sda-inline-link"
          onClick={() => onNavigate('structured-diet')}
          aria-label={t.home_focus_edit}
        >
          <span>{t.home_focus_edit_schedule}</span>
          <AppIcon name="chevron-right" size={15} />
        </button>
      </header>

      {next ? (
        <button
          id="btn-home-focus-next"
          type="button"
          className="sda-focus-row sda-focus-row--prominent"
          onClick={() => onNavigate('structured-diet')}
        >
          <div className="sda-focus-split">
            <div className="sda-focus-primary">
              <span
                className={`sda-focus-icon-wrap ${isCurrent ? 'sda-focus-icon-wrap--current' : ''}`}
                aria-hidden="true"
              >
                <AppIcon name={isBeverage ? 'droplet' : 'utensils'} size={20} />
              </span>
              <div className="sda-focus-primary-meta">
                <div className="sda-focus-top-bar">
                  <span className="sda-focus-block-title">
                    {typeDisplay || statusKicker}
                  </span>
                  <span className="sda-focus-kicker-badge">
                    {statusKicker}
                  </span>
                </div>
                {timeRange && (
                  <span className="sda-focus-time-pill" title={timeRange}>
                    <AppIcon name="clock" size={13} />
                    <span>{timeRange}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="sda-focus-content-wrap">
              {altDescription ? (
                <div className="sda-focus-desc sda-focus-desc--full sda-focus-desc--with-alt">
                  <div className="sda-focus-plan-line" id="home-focus-planned-line">
                    <strong className="sda-focus-line-label">
                      {t.meal_planned_prefix || 'Planned:'}
                    </strong>{' '}
                    <span>{foodDescription || typeDisplay}</span>
                  </div>
                  <div className="sda-focus-alt-line" id="home-focus-alt-line">
                    <strong className="sda-focus-line-label sda-focus-line-label--alt">
                      {t.meal_alternative_prefix || 'Alternative:'}
                    </strong>{' '}
                    <span>{altDescription}</span>
                  </div>
                </div>
              ) : (
                <div className="sda-focus-desc sda-focus-desc--full">
                  {foodDescription || typeDisplay}
                </div>
              )}
              <AppIcon name="chevron-right" size={18} className="sda-focus-chevron" />
            </div>
          </div>
        </button>
      ) : focusData.allCompleted ? (
        <div className="sda-focus-empty sda-focus-empty--completed">
          <span className="sda-focus-icon sda-focus-icon--completed" aria-hidden="true">
            <AppIcon name="check" size={20} />
          </span>
          <span className="sda-focus-text">
            <span className="sda-focus-desc">{t.home_focus_all_completed_title}</span>
            <span className="sda-focus-sub">{t.home_focus_all_completed_sub}</span>
          </span>
          <button
            id="btn-home-focus-plan"
            type="button"
            className="sda-pill-btn sda-pill-btn--accent"
            onClick={() => onNavigate('structured-diet')}
          >
            <AppIcon name="calendar" size={15} />
            <span>{t.home_focus_view_diet}</span>
          </button>
        </div>
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
            <AppIcon name="plus" size={15} />
            <span>{t.home_focus_empty_cta}</span>
          </button>
        </div>
      )}
    </section>
  );
}

export default TodayFocusCard;