/**
 * Super Diet-Ability — Premium Next Action After Recommit (Phase 5)
 *
 * Dedicated post-recommitment experience connecting successful challenge recovery
 * to a meaningful next behavioral step.
 *
 * Features:
 * - Triggered exactly once after confirmed successful recommitment.
 * - 6 structured actions:
 *   1. Plan My Next Meal or Beverage (Primary recommended — interactive Structured Diet planner)
 *   2. Review My Structured Diet
 *   3. Review My Commitments
 *   4. Review My Non-Negotiables
 *   5. Review My Progress & Victories
 *   6. Return to My Challenge
 * - Direct skippable control ("Skip for now" / Escape key).
 * - Real Structured Diet scheduling reusing existing time blocks and models.
 * - Invariant: Zero extra XP, no duplicate check-ins/recommitments, no calendar events.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Screen } from '../../types';
import { useTranslation } from '../../i18n';
import AppIcon from '../icons/AppIcon';
import {
  loadWeeklyDiet,
  saveWeeklyDiet,
  getLocalTodayKey,
  getLocalDateKey,
  getDayPlanForDate,
  updateDatePlan,
  sortBlocks,
  generateBlockId,
  getBlockPrimaryDescription,
  type StructuredDietBlock,
} from '../../utils/dietStorage';
import { getNextPlannedBlock } from '../../utils/homeSelectors';
import { playFeedback } from '../../utils/feedback';
import './NextActionModal.css';

export interface NextActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  currentScreen?: Screen;
}

type ModalView = 'menu' | 'schedule' | 'scheduled-success';

export const NextActionModal: React.FC<NextActionModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  currentScreen = 'challenges',
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ModalView>('menu');

  // Schedule subflow state
  const [selectedBlockId, setSelectedBlockId] = useState<string>('custom');
  const [plannedFoodText, setPlannedFoodText] = useState<string>('');
  const [customStartTime, setCustomStartTime] = useState<string>('12:30');
  const [customEndTime, setCustomEndTime] = useState<string>('13:00');
  const [customMealType, setCustomMealType] = useState<string>('Lunch');
  const [savedSummary, setSavedSummary] = useState<{ meal: string; time: string }>({
    meal: '',
    time: '',
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Load today's Structured Diet day plan (effective date-specific plan)
  const todayKey = useMemo(() => getLocalTodayKey(), [isOpen]);
  const todayDateKey = useMemo(() => getLocalDateKey(), [isOpen]);
  const weeklyDiet = useMemo(() => (isOpen ? loadWeeklyDiet() : null), [isOpen]);
  const todayPlan = useMemo(() => {
    if (!weeklyDiet) return null;
    return getDayPlanForDate(weeklyDiet, todayDateKey);
  }, [weeklyDiet, todayDateKey]);

  // Extract meal-worthy blocks for today (ignoring micro_fasting and kitchen_closed)
  const availableBlocks = useMemo(() => {
    if (!todayPlan || !Array.isArray(todayPlan.blocks)) return [];
    return todayPlan.blocks.filter((b) => {
      const type = (b.type || '').trim().toLowerCase();
      return type !== 'micro_fasting' && type !== 'kitchen_closed';
    });
  }, [todayPlan]);

  // Initialize schedule form when switching to 'schedule' view
  useEffect(() => {
    if (view === 'schedule' && todayPlan) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const nextPlanned = getNextPlannedBlock(todayPlan, nowMinutes);

      if (nextPlanned && nextPlanned.block) {
        setSelectedBlockId(nextPlanned.block.id);
        const desc = getBlockPrimaryDescription(nextPlanned.block, t);
        setPlannedFoodText(desc || nextPlanned.block.customText || '');
        setCustomStartTime(nextPlanned.block.startTime || '12:30');
        setCustomEndTime(nextPlanned.block.endTime || '13:00');
        setCustomMealType(nextPlanned.block.type || 'Lunch');
      } else if (availableBlocks.length > 0) {
        const first = availableBlocks[0];
        setSelectedBlockId(first.id);
        const desc = getBlockPrimaryDescription(first, t);
        setPlannedFoodText(desc || first.customText || '');
        setCustomStartTime(first.startTime || '12:30');
        setCustomEndTime(first.endTime || '13:00');
        setCustomMealType(first.type || 'Lunch');
      } else {
        setSelectedBlockId('custom');
        setPlannedFoodText('');
        setCustomStartTime('12:30');
        setCustomEndTime('13:00');
        setCustomMealType('Lunch');
      }
    }
  }, [view, todayPlan, availableBlocks, t]);

  // Handle block selection change in schedule view
  const handleBlockSelect = (blockId: string) => {
    setSelectedBlockId(blockId);
    if (blockId === 'custom') {
      setPlannedFoodText('');
      setCustomStartTime('12:30');
      setCustomEndTime('13:00');
      setCustomMealType('Lunch');
    } else {
      const block = availableBlocks.find((b) => b.id === blockId);
      if (block) {
        const desc = getBlockPrimaryDescription(block, t);
        setPlannedFoodText(desc || block.customText || '');
        setCustomStartTime(block.startTime || '12:30');
        setCustomEndTime(block.endTime || '13:00');
        setCustomMealType(block.type || 'Lunch');
      }
    }
  };

  // Keyboard accessibility: Escape to dismiss
  useEffect(() => {
    if (!isOpen) {
      setView('menu');
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // ── Confirmation Handler for Structured Diet Scheduling ──
  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyDiet || !todayPlan) return;

    const trimmedFood = plannedFoodText.trim();
    let updatedBlocks: StructuredDietBlock[] = [...todayPlan.blocks];
    let mealLabel = customMealType;
    let timeLabel = `${customStartTime} – ${customEndTime}`;

    if (selectedBlockId !== 'custom') {
      // Update existing block in place
      const targetIndex = updatedBlocks.findIndex((b) => b.id === selectedBlockId);
      if (targetIndex !== -1) {
        const existing = updatedBlocks[targetIndex];
        mealLabel = existing.type || customMealType;
        timeLabel = `${existing.startTime} – ${existing.endTime}`;

        updatedBlocks[targetIndex] = {
          ...existing,
          customText: trimmedFood || existing.customText,
        };
      }
    } else {
      // Create a new block for today
      const newBlock: StructuredDietBlock = {
        id: generateBlockId(),
        startTime: customStartTime,
        endTime: customEndTime,
        type: customMealType,
        items: trimmedFood ? [trimmedFood] : [],
        customText: trimmedFood,
      };
      updatedBlocks.push(newBlock);
      updatedBlocks = sortBlocks(updatedBlocks);
    }

    // Persist to active Structured Diet profile (specific to today's date override)
    const updatedDiet = updateDatePlan(
      weeklyDiet,
      todayDateKey,
      (d) => ({
        ...d,
        blocks: updatedBlocks,
      }),
      { dayKey: todayKey }
    );
    saveWeeklyDiet(updatedDiet);

    // Audio confirmation
    playFeedback('win');

    setSavedSummary({
      meal: trimmedFood ? `${mealLabel} ("${trimmedFood}")` : mealLabel,
      time: timeLabel,
    });
    setView('scheduled-success');
  };

  // ── Navigation Handlers for the 6 Actions ──
  const handleReviewDiet = () => {
    onClose();
    onNavigate('structured-diet');
  };

  const handleReviewCommitments = () => {
    onClose();
    onNavigate('commitment');
  };

  const handleReviewNonNegotiables = () => {
    onClose();
    if (currentScreen === 'challenges') {
      const el = document.getElementById('section-my-non-negotiables');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    try {
      sessionStorage.setItem('commitment_focus', 'nn');
    } catch {
      // ignore
    }
    onNavigate('commitment');
  };

  const handleReviewProgress = () => {
    onClose();
    onNavigate('progress-victories');
  };

  const handleReturnChallenge = () => {
    onClose();
    if (currentScreen !== 'challenges') {
      onNavigate('challenges');
    }
  };

  return (
    <div
      className="next-action-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        id="next-action-modal"
        className="next-action-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-action-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close / Skip button at top right */}
        <button
          type="button"
          id="btn-next-action-close"
          className="next-action-close-btn"
          onClick={onClose}
          aria-label={t.next_action_skip || 'Skip for now'}
        >
          <AppIcon name="x" size={18} />
        </button>

        {/* ── VIEW 1: MAIN NEXT ACTION MENU ── */}
        {view === 'menu' && (
          <div className="next-action-content">
            <div className="next-action-header">
              <div className="next-action-recommitted-pill" id="badge-recommitted-success">
                <span className="next-action-pill-check">✓</span>
                <span className="next-action-pill-text">
                  {t.challenge_checkin_recommitted_success || 'Re-commitment registered'}
                </span>
              </div>

              <h2 id="next-action-modal-title" className="next-action-title">
                {t.next_action_modal_title ||
                  "You're recommitted. What's your next step to stay on track?"}
              </h2>

              <p className="next-action-subtitle">
                {t.next_action_modal_subtitle ||
                  'Choose an action below to regain momentum and solidify your structure.'}
              </p>
            </div>

            <div className="next-action-list" role="list">
              {/* ACTION 1: Plan My Next Meal or Beverage (PRIMARY RECOMMENDED) */}
              <button
                type="button"
                id="btn-next-action-plan-meal"
                className="next-action-item next-action-item--primary"
                onClick={() => setView('schedule')}
              >
                <div className="next-action-item-icon next-action-item-icon--primary">
                  <AppIcon name="utensils" size={22} />
                </div>
                <div className="next-action-item-body">
                  <div className="next-action-item-title-row">
                    <span className="next-action-item-title">
                      {t.next_action_plan_meal_title || 'Plan My Next Meal or Beverage'}
                    </span>
                    <span
                      id="badge-next-action-recommended"
                      className="next-action-recommended-badge"
                    >
                      {t.next_action_recommended_badge || 'Recommended'}
                    </span>
                  </div>
                  <p className="next-action-item-desc">
                    {t.next_action_plan_meal_desc ||
                      'Identify and schedule your next planned meal or beverage in your Structured Diet.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>

              {/* ACTION 2: Review My Structured Diet */}
              <button
                type="button"
                id="btn-next-action-review-diet"
                className="next-action-item"
                onClick={handleReviewDiet}
              >
                <div className="next-action-item-icon">
                  <AppIcon name="calendar" size={20} />
                </div>
                <div className="next-action-item-body">
                  <span className="next-action-item-title">
                    {t.next_action_review_diet_title || 'Review My Structured Diet'}
                  </span>
                  <p className="next-action-item-desc">
                    {t.next_action_review_diet_desc ||
                      'Inspect your full daily rhythm, time windows, and meal boundaries.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>

              {/* ACTION 3: Review My Commitments */}
              <button
                type="button"
                id="btn-next-action-review-commitments"
                className="next-action-item"
                onClick={handleReviewCommitments}
              >
                <div className="next-action-item-icon">
                  <AppIcon name="shield" size={20} />
                </div>
                <div className="next-action-item-body">
                  <span className="next-action-item-title">
                    {t.next_action_review_commitments_title || 'Review My Commitments'}
                  </span>
                  <p className="next-action-item-desc">
                    {t.next_action_review_commitments_desc ||
                      'Reconnect with your daily commitments and core motivations.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>

              {/* ACTION 4: Review My Non-Negotiables */}
              <button
                type="button"
                id="btn-next-action-review-nn"
                className="next-action-item"
                onClick={handleReviewNonNegotiables}
              >
                <div className="next-action-item-icon">
                  <AppIcon name="award" size={20} />
                </div>
                <div className="next-action-item-body">
                  <span className="next-action-item-title">
                    {t.next_action_review_nn_title || 'Review My Non-Negotiables'}
                  </span>
                  <p className="next-action-item-desc">
                    {t.next_action_review_nn_desc ||
                      'Re-anchor your unbreakable boundaries and protection rules.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>

              {/* ACTION 5: Review My Progress & Victories */}
              <button
                type="button"
                id="btn-next-action-review-progress"
                className="next-action-item"
                onClick={handleReviewProgress}
              >
                <div className="next-action-item-icon">
                  <AppIcon name="trophy" size={20} />
                </div>
                <div className="next-action-item-body">
                  <span className="next-action-item-title">
                    {t.next_action_review_progress_title || 'Review My Progress & Victories'}
                  </span>
                  <p className="next-action-item-desc">
                    {t.next_action_review_progress_desc ||
                      'Celebrate non-scale victories, consistency streaks, and habit milestones.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>

              {/* ACTION 6: Return to My Challenge */}
              <button
                type="button"
                id="btn-next-action-return-challenge"
                className="next-action-item next-action-item--return"
                onClick={handleReturnChallenge}
              >
                <div className="next-action-item-icon">
                  <AppIcon name="sparkles" size={20} />
                </div>
                <div className="next-action-item-body">
                  <span className="next-action-item-title">
                    {t.next_action_return_challenge_title || 'Return to My Challenge'}
                  </span>
                  <p className="next-action-item-desc">
                    {t.next_action_return_challenge_desc ||
                      'Resume your active challenge with fresh clarity and focus.'}
                  </p>
                </div>
                <div className="next-action-item-chevron">
                  <AppIcon name="chevron-right" size={18} />
                </div>
              </button>
            </div>

            {/* Skip CTA */}
            <div className="next-action-footer">
              <button
                type="button"
                id="btn-next-action-skip"
                className="next-action-skip-btn"
                onClick={onClose}
              >
                {t.next_action_skip || 'Skip for now'}
              </button>
            </div>
          </div>
        )}

        {/* ── VIEW 2: STRUCTURED DIET SCHEDULING FLOW ── */}
        {view === 'schedule' && (
          <form className="next-action-content" onSubmit={handleConfirmSchedule}>
            <div className="next-action-header">
              <button
                type="button"
                id="btn-next-action-back"
                className="next-action-back-link"
                onClick={() => setView('menu')}
              >
                {t.next_action_btn_back_to_actions || '← Back to Actions'}
              </button>

              <h2 id="next-action-modal-title" className="next-action-title">
                {t.next_action_schedule_heading ||
                  'Schedule Your Next Planned Meal or Beverage'}
              </h2>

              <p className="next-action-subtitle">
                {t.next_action_schedule_sub ||
                  'Select an upcoming time block and review what you will eat or drink.'}
              </p>
            </div>

            <div className="next-action-form-body">
              {/* Block Selection */}
              <div className="next-action-field-group">
                <label
                  htmlFor="select-next-action-block"
                  className="next-action-field-label"
                >
                  {t.next_action_select_block_label || 'Time Window'}
                </label>

                {availableBlocks.length > 0 ? (
                  <select
                    id="select-next-action-block"
                    className="next-action-select"
                    value={selectedBlockId}
                    onChange={(e) => handleBlockSelect(e.target.value)}
                  >
                    {availableBlocks.map((b) => {
                      const desc = getBlockPrimaryDescription(b, t);
                      const displayTitle = desc ? `${b.type} (${desc})` : b.type;
                      return (
                        <option key={b.id} value={b.id}>
                          {b.startTime} – {b.endTime} • {displayTitle}
                        </option>
                      );
                    })}
                    <option value="custom">+ Add Custom Time Window</option>
                  </select>
                ) : (
                  <div className="next-action-notice">
                    <p className="next-action-notice-text">
                      {t.next_action_no_blocks_today ||
                        'No scheduled blocks remaining today. You can add one below.'}
                    </p>
                  </div>
                )}
              </div>

              {/* If Custom Block or No Blocks, allow setting Time & Meal Type */}
              {selectedBlockId === 'custom' && (
                <div className="next-action-custom-time-row">
                  <div className="next-action-field-group">
                    <label
                      htmlFor="input-next-action-start-time"
                      className="next-action-field-label"
                    >
                      {t.next_action_start_time || 'Start Time'}
                    </label>
                    <input
                      id="input-next-action-start-time"
                      type="time"
                      className="next-action-input"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="next-action-field-group">
                    <label
                      htmlFor="input-next-action-end-time"
                      className="next-action-field-label"
                    >
                      {t.next_action_end_time || 'End Time'}
                    </label>
                    <input
                      id="input-next-action-end-time"
                      type="time"
                      className="next-action-input"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="next-action-field-group">
                    <label
                      htmlFor="select-next-action-meal-type"
                      className="next-action-field-label"
                    >
                      {t.next_action_type_label || 'Type'}
                    </label>
                    <select
                      id="select-next-action-meal-type"
                      className="next-action-select"
                      value={customMealType}
                      onChange={(e) => setCustomMealType(e.target.value)}
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Snack">Snack</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Beverage">Beverage</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Planned Food or Beverage Input */}
              <div className="next-action-field-group">
                <label
                  htmlFor="input-next-action-meal"
                  className="next-action-field-label"
                >
                  {t.next_action_meal_name_label || 'Planned Food or Beverage'}
                </label>
                <input
                  id="input-next-action-meal"
                  type="text"
                  className="next-action-input"
                  value={plannedFoodText}
                  onChange={(e) => setPlannedFoodText(e.target.value)}
                  placeholder={
                    t.next_action_meal_name_placeholder ||
                    'e.g., Grilled chicken salad with olive oil, sparkling water'
                  }
                  required
                />
                <span className="next-action-field-hint">
                  {t.home_focus_empty_body ||
                    'Plan your next meal or beverage in your Structured Diet.'}
                </span>
              </div>
            </div>

            <div className="next-action-form-actions">
              <button
                type="submit"
                id="btn-confirm-next-action-schedule"
                className="next-action-primary-submit-btn"
              >
                <span>
                  {t.next_action_btn_confirm_schedule ||
                    'Confirm & Save to Diet Plan'}
                </span>
                <span>→</span>
              </button>

              <button
                type="button"
                id="btn-cancel-schedule-subflow"
                className="next-action-skip-btn"
                onClick={() => setView('menu')}
              >
                {t.pv_btn_cancel || 'Cancel'}
              </button>
            </div>
          </form>
        )}

        {/* ── VIEW 3: SCHEDULED COMPLETION CONFIRMATION ── */}
        {view === 'scheduled-success' && (
          <div className="next-action-content" id="next-action-schedule-success">
            <div className="next-action-success-icon-wrap">
              <span className="next-action-success-icon">✓</span>
            </div>

            <h2 className="next-action-success-title">
              {t.next_action_schedule_success_title || 'Next action confirmed!'}
            </h2>

            <p className="next-action-success-desc">
              {(
                t.next_action_schedule_success_desc ||
                'Your planned {meal} ({time}) has been scheduled in your Structured Diet.'
              )
                .replace('{meal}', savedSummary.meal)
                .replace('{time}', savedSummary.time)}
            </p>

            <div className="next-action-success-actions">
              <button
                type="button"
                id="btn-next-action-view-diet"
                className="next-action-primary-submit-btn"
                onClick={handleReviewDiet}
              >
                <span>
                  {t.next_action_btn_view_in_diet || 'View in Structured Diet'}
                </span>
                <span>→</span>
              </button>

              <button
                type="button"
                id="btn-next-action-done"
                className="next-action-secondary-btn"
                onClick={handleReturnChallenge}
              >
                {t.next_action_btn_done || 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NextActionModal;
