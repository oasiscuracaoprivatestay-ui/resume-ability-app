import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './icons/AppIcon';
import { useTranslation } from '../i18n';
import { getLocalDateKey } from '../utils/dietStorage';
import {
  getWeeklyReflections,
  saveWeeklyReflection,
} from '../utils/progressVictoriesStorage';
import {
  recordContinueExistingStructure,
  reviewActiveMaintenanceAdjustment,
  saveEarlyDriftRecord,
  saveFoodReadinessRecord,
  saveOneMaintenanceAdjustment,
  type AdjustmentCategory,
  type EarlyDriftRecord,
  type EarlyDriftResponseKind,
  type EarlyDriftSignalKind,
  type FoodReadinessActionKind,
  type FoodReadinessGapKind,
  type FoodReadinessRecord,
  type MaintenanceAdjustmentRecord,
  type NextScheduledBlockInfo,
} from '../challenges';
import './Book2PracticeModals.css';

export type Book2ActiveModalKind =
  | 'food_readiness'
  | 'early_drift'
  | 'weekly_review'
  | 'adjustment'
  | null;

interface Book2PracticeModalsProps {
  activeModal: Book2ActiveModalKind;
  onClose: () => void;
  onSwitchModal: (next: Book2ActiveModalKind) => void;
  onRefreshLoop: () => void;
  onOpenStructuredDiet: () => void;
  onOpenFullWeeklyHistory: () => void;
  onOpenTimerShortcut: () => void;
  nextScheduledBlock: NextScheduledBlockInfo | null;
  activeProfileName: string;
  nonNegotiablesCount: number;
  foodReadinessToday: FoodReadinessRecord | null;
  earlyDriftToday: EarlyDriftRecord | null;
  activeAdjustment: MaintenanceAdjustmentRecord | null;
  adjustmentHistory: MaintenanceAdjustmentRecord[];
}

export const Book2PracticeModals: React.FC<Book2PracticeModalsProps> = ({
  activeModal,
  onClose,
  onSwitchModal,
  onRefreshLoop,
  onOpenStructuredDiet,
  onOpenFullWeeklyHistory,
  onOpenTimerShortcut,
  nextScheduledBlock,
  activeProfileName,
  nonNegotiablesCount,
  foodReadinessToday,
  earlyDriftToday,
  activeAdjustment,
  adjustmentHistory,
}) => {
  const { t } = useTranslation();

  // ── 1. Food Readiness State ──
  const [frIsReadyChoice, setFrIsReadyChoice] = useState<'ready' | 'not_ready'>('ready');
  const [frGapKind, setFrGapKind] = useState<FoodReadinessGapKind>('missing_ingredient');
  const [frGapNote, setFrGapNote] = useState('');
  const [frActionKind, setFrActionKind] = useState<FoodReadinessActionKind>('prep_simple_whole_food');
  const [frActionNote, setFrActionNote] = useState('');

  // ── 2. Early Signs of Drift State ──
  const [edSignal, setEdSignal] = useState<EarlyDriftSignalKind>('grazing_urge');
  const [edNote, setEdNote] = useState('');
  const [edResponse, setEdResponse] = useState<EarlyDriftResponseKind>('anchor_next_block');
  const [edSavedShortcutKind, setEdSavedShortcutKind] = useState<
    'pause_15_min' | 'check_food_readiness' | null
  >(null);

  // ── 3. Weekly Review State ──
  const [wrHelped, setWrHelped] = useState('');
  const [wrDifficult, setWrDifficult] = useState('');
  const [wrReadiness, setWrReadiness] = useState<'solid' | 'mixed' | 'gapped'>('solid');
  const [wrDrift, setWrDrift] = useState<'none' | 'caught_early' | 'recurring'>('none');
  const [wrNextStep, setWrNextStep] = useState<'continue' | 'test_one'>('continue');
  const [wrAdjDecision, setWrAdjDecision] = useState<'kept' | 'testing' | 'retired'>('kept');
  const [wrAdjNote, setWrAdjNote] = useState('');
  const [wrError, setWrError] = useState('');

  // ── 4. Test One Adjustment State ──
  const [adjCategory, setAdjCategory] = useState<AdjustmentCategory>('food_readiness');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjOutcomeNote, setAdjOutcomeNote] = useState('');
  const [adjError, setAdjError] = useState('');
  const [isPastAdjustmentsOpen, setIsPastAdjustmentsOpen] = useState(false);
  const prevModalRef = useRef<Book2ActiveModalKind>(null);

  // Hydrate modal defaults only when transitioning into a newly opened modal
  useEffect(() => {
    if (prevModalRef.current === activeModal) return;
    prevModalRef.current = activeModal;
    if (!activeModal) return;

    if (activeModal === 'food_readiness') {
      if (foodReadinessToday) {
        setFrIsReadyChoice(foodReadinessToday.status === 'ready' ? 'ready' : 'not_ready');
        setFrGapKind(foodReadinessToday.gapKind || 'missing_ingredient');
        setFrGapNote(foodReadinessToday.gapNote || '');
        setFrActionKind(foodReadinessToday.selectedAction || 'prep_simple_whole_food');
        setFrActionNote(foodReadinessToday.actionNote || '');
      } else {
        setFrIsReadyChoice('ready');
        setFrGapKind('missing_ingredient');
        setFrGapNote('');
        setFrActionKind('prep_simple_whole_food');
        setFrActionNote('');
      }
    } else if (activeModal === 'early_drift') {
      setEdSavedShortcutKind(null);
      if (earlyDriftToday) {
        setEdSignal(earlyDriftToday.signalKind);
        setEdNote(earlyDriftToday.note || '');
        setEdResponse(earlyDriftToday.plannedResponse || 'anchor_next_block');
      } else {
        setEdSignal('grazing_urge');
        setEdNote('');
        setEdResponse('anchor_next_block');
      }
    } else if (activeModal === 'weekly_review') {
      const todayKey = getLocalDateKey();
      const todayExisting = getWeeklyReflections().find((r) => r.weekStartDateKey === todayKey);
      setWrHelped(todayExisting?.biggestVictory || '');
      setWrDifficult('');
      setWrReadiness(
        foodReadinessToday?.status === 'needs_prep' ? 'mixed' : 'solid'
      );
      setWrDrift(earlyDriftToday ? 'caught_early' : 'none');
      setWrNextStep('continue');
      setWrAdjDecision('kept');
      setWrAdjNote(activeAdjustment?.reviewOutcomeNote || '');
      setWrError('');
    } else if (activeModal === 'adjustment') {
      setAdjCategory(activeAdjustment?.category || 'food_readiness');
      setAdjDesc('');
      setAdjReason('');
      setAdjOutcomeNote(activeAdjustment?.reviewOutcomeNote || '');
      setAdjError('');
      setIsPastAdjustmentsOpen(false);
    }
  }, [activeModal, foodReadinessToday, earlyDriftToday, activeAdjustment]);

  // Escape key closes open modal
  useEffect(() => {
    if (!activeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, onClose]);

  if (!activeModal) return null;

  const blockSummaryStr = nextScheduledBlock
    ? `${nextScheduledBlock.startTime}–${nextScheduledBlock.endTime} · ${nextScheduledBlock.primaryDescription}`
    : undefined;

  const renderNextBlockCallout = (label: string) => (
    <div className="sda-b2-block-callout" id="b2-modal-next-block-callout">
      <div className="sda-b2-block-callout-top">
        <span className="sda-b2-block-callout-label">{label}</span>
        {nextScheduledBlock && (
          <span
            className={`sda-b2-block-tag ${
              nextScheduledBlock.isFasting ? 'sda-b2-block-tag--fasting' : ''
            }`}
          >
            {nextScheduledBlock.isFasting ? t.pl_next_fasting_badge : t.pl_next_meal_badge}
          </span>
        )}
      </div>
      {nextScheduledBlock ? (
        <>
          <span className="sda-b2-block-time">
            {nextScheduledBlock.isTomorrow
              ? `${t.pl_next_tomorrow_tag} · `
              : nextScheduledBlock.timingState === 'active_now'
              ? `${t.pl_next_now_tag} · `
              : ''}
            {nextScheduledBlock.startTime} – {nextScheduledBlock.endTime}
          </span>
          <span className="sda-b2-block-desc">{nextScheduledBlock.primaryDescription}</span>
        </>
      ) : (
        <span className="sda-b2-block-desc">{t.pl_next_no_block_empty}</span>
      )}
    </div>
  );

  // ── Handlers: Food Readiness ──
  const handleConfirmFoodReady = () => {
    saveFoodReadinessRecord({
      status: 'ready',
      targetBlockId: nextScheduledBlock?.blockId,
      targetBlockSummary: blockSummaryStr,
    });
    onRefreshLoop();
    onClose();
  };

  const handleSaveFoodPrepAction = () => {
    saveFoodReadinessRecord({
      status: 'action_planned',
      targetBlockId: nextScheduledBlock?.blockId,
      targetBlockSummary: blockSummaryStr,
      gapKind: frGapKind,
      gapNote: frGapNote,
      selectedAction: frActionKind,
      actionNote: frActionNote,
    });
    onRefreshLoop();
    onClose();
  };

  const handleFlagFoodNeedsPrep = () => {
    saveFoodReadinessRecord({
      status: 'needs_prep',
      targetBlockId: nextScheduledBlock?.blockId,
      targetBlockSummary: blockSummaryStr,
      gapKind: frGapKind,
      gapNote: frGapNote,
    });
    onRefreshLoop();
    onClose();
  };

  // ── Handlers: Early Signs of Drift (Strictly Non-Slip, Zero XP Side Effects) ──
  const handleSaveDriftResponse = () => {
    saveEarlyDriftRecord({
      signalKind: edSignal,
      note: edNote,
      plannedResponse: edResponse,
    });
    onRefreshLoop();
    if (edResponse === 'pause_15_min' || edResponse === 'check_food_readiness') {
      setEdSavedShortcutKind(edResponse);
    } else {
      onClose();
    }
  };

  const handleAckDriftOnly = () => {
    saveEarlyDriftRecord({
      signalKind: edSignal,
      note: edNote,
    });
    onRefreshLoop();
    onClose();
  };

  // ── Handlers: Maintenance Weekly Review ──
  const handleSubmitWeeklyReview = (e: React.FormEvent) => {
    e.preventDefault();
    const helpedTrim = wrHelped.trim();
    const diffTrim = wrDifficult.trim();
    if (!helpedTrim && !diffTrim) {
      setWrError(t.pl_b2_wr_err_required);
      return;
    }

    const readinessLabel =
      wrReadiness === 'solid'
        ? t.pl_b2_wr_readiness_solid
        : wrReadiness === 'mixed'
        ? t.pl_b2_wr_readiness_mixed
        : t.pl_b2_wr_readiness_gapped;

    const driftLabel =
      wrDrift === 'none'
        ? t.pl_b2_wr_drift_none
        : wrDrift === 'caught_early'
        ? t.pl_b2_wr_drift_caught_early
        : t.pl_b2_wr_drift_recurring;

    const nextFocusLabel =
      wrNextStep === 'test_one' ? t.pl_b2_wr_next_test_one : t.pl_b2_wr_next_continue;

    const summaryLines: string[] = [];
    if (diffTrim) summaryLines.push(`${t.pl_b2_wr_q_difficult} ${diffTrim}`);
    summaryLines.push(`${t.pl_b2_action_readiness_title}: ${readinessLabel}`);
    summaryLines.push(`${t.pl_b2_action_drift_title}: ${driftLabel}`);

    if (activeAdjustment) {
      reviewActiveMaintenanceAdjustment({
        decision: wrAdjDecision,
        outcomeNote: wrAdjNote,
      });
    }

    const todayKey = getLocalDateKey();
    saveWeeklyReflection({
      weekStartDateKey: todayKey,
      biggestVictory: helpedTrim || readinessLabel,
      reflectionText: summaryLines.join(' | '),
      nextWeekFocus: nextFocusLabel,
    });

    onRefreshLoop();

    if (wrNextStep === 'test_one' && (!activeAdjustment || wrAdjDecision !== 'testing')) {
      onSwitchModal('adjustment');
    } else {
      onClose();
    }
  };

  // ── Handlers: Test One Adjustment ──
  const handleSaveNewAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjDesc.trim()) {
      setAdjError(t.pl_b2_adj_err_required);
      return;
    }
    saveOneMaintenanceAdjustment({
      category: adjCategory,
      description: adjDesc.trim(),
      reason: adjReason.trim() || undefined,
    });
    onRefreshLoop();
    onClose();
  };

  const handleContinueExistingStructure = () => {
    recordContinueExistingStructure();
    onRefreshLoop();
    onClose();
  };

  const handleReviewAdjustmentDirect = (decision: 'testing' | 'kept' | 'retired') => {
    reviewActiveMaintenanceAdjustment({
      decision,
      outcomeNote: adjOutcomeNote,
    });
    onRefreshLoop();
    onClose();
  };

  return (
    <div
      className="sda-b2-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ── MODAL 1: FOOD READINESS ── */}
      {activeModal === 'food_readiness' && (
        <div className="sda-b2-modal" id="modal-b2-food-readiness">
          <div className="sda-b2-modal-head">
            <div className="sda-b2-modal-title-group">
              <span className="sda-b2-modal-eyebrow">{t.pl_b2_pill_short}</span>
              <h3 className="sda-b2-modal-title">{t.pl_b2_fr_modal_title}</h3>
            </div>
            <button
              type="button"
              id="btn-close-b2-modal"
              className="sda-b2-modal-close"
              aria-label={t.pv_close_modal_aria}
              onClick={onClose}
            >
              <AppIcon name="x" size={18} />
            </button>
          </div>

          <p className="sda-b2-modal-sub">{t.pl_b2_fr_modal_sub}</p>

          {renderNextBlockCallout(t.pl_b2_fr_next_block_label)}

          <div className="sda-b2-field-group">
            <span className="sda-b2-field-label">{t.pl_b2_fr_ready_question}</span>
            <div className="sda-b2-toggle-grid">
              <button
                type="button"
                id="btn-b2-fr-opt-ready"
                className={`sda-b2-choice-btn ${frIsReadyChoice === 'ready' ? 'is-selected' : ''}`}
                onClick={() => setFrIsReadyChoice('ready')}
              >
                <span>{t.pl_b2_fr_opt_ready}</span>
                <AppIcon name="check-circle" size={16} />
              </button>
              <button
                type="button"
                id="btn-b2-fr-opt-not-ready"
                className={`sda-b2-choice-btn ${frIsReadyChoice === 'not_ready' ? 'is-selected' : ''}`}
                onClick={() => setFrIsReadyChoice('not_ready')}
              >
                <span>{t.pl_b2_fr_opt_not_ready}</span>
                <AppIcon name="utensils" size={16} />
              </button>
            </div>
          </div>

          {frIsReadyChoice === 'not_ready' && (
            <>
              <div className="sda-b2-field-group">
                <span className="sda-b2-field-label">{t.pl_b2_fr_gap_label}</span>
                <div className="sda-b2-toggle-grid">
                  {(
                    [
                      ['missing_ingredient', t.pl_b2_fr_gap_missing_ingredient],
                      ['meal_not_prepped', t.pl_b2_fr_gap_meal_not_prepped],
                      ['away_or_busy', t.pl_b2_fr_gap_away_or_busy],
                      ['unsure_what_to_eat', t.pl_b2_fr_gap_unsure],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      id={`btn-b2-fr-gap-${val}`}
                      className={`sda-b2-choice-btn ${frGapKind === val ? 'is-selected' : ''}`}
                      onClick={() => setFrGapKind(val)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <input
                  id="input-b2-fr-gap-note"
                  type="text"
                  className="sda-b2-input"
                  value={frGapNote}
                  maxLength={140}
                  placeholder={t.pl_b2_fr_gap_note_placeholder}
                  onChange={(e) => setFrGapNote(e.target.value)}
                />
              </div>

              <div className="sda-b2-field-group">
                <span className="sda-b2-field-label">{t.pl_b2_fr_action_label}</span>
                <div className="sda-b2-toggle-grid">
                  {(
                    [
                      ['prep_simple_whole_food', t.pl_b2_fr_act_simple_whole],
                      ['gather_missing_item', t.pl_b2_fr_act_gather_item],
                      ['use_backup_option', t.pl_b2_fr_act_backup_option],
                      ['confirm_planned_block', t.pl_b2_fr_act_confirm_block],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      id={`btn-b2-fr-act-${val}`}
                      className={`sda-b2-choice-btn ${frActionKind === val ? 'is-selected' : ''}`}
                      onClick={() => setFrActionKind(val)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <input
                  id="input-b2-fr-action-note"
                  type="text"
                  className="sda-b2-input"
                  value={frActionNote}
                  maxLength={140}
                  placeholder={t.pl_b2_fr_action_note_placeholder}
                  onChange={(e) => setFrActionNote(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="sda-b2-actions-stack">
            {frIsReadyChoice === 'ready' ? (
              <button
                type="button"
                id="btn-b2-fr-confirm-ready"
                className="sda-b2-primary-btn"
                onClick={handleConfirmFoodReady}
              >
                <AppIcon name="check" size={16} />
                <span>{t.pl_b2_fr_btn_confirm_ready}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  id="btn-b2-fr-save-action"
                  className="sda-b2-primary-btn"
                  onClick={handleSaveFoodPrepAction}
                >
                  <AppIcon name="check" size={16} />
                  <span>{t.pl_b2_fr_btn_save_action}</span>
                </button>
                <button
                  type="button"
                  id="btn-b2-fr-flag-later"
                  className="sda-b2-secondary-btn"
                  onClick={handleFlagFoodNeedsPrep}
                >
                  <span>{t.pl_b2_fr_btn_flag_later}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 2: EARLY SIGNS OF DRIFT (Strictly Non-Slip) ── */}
      {activeModal === 'early_drift' && (
        <div className="sda-b2-modal" id="modal-b2-early-drift">
          <div className="sda-b2-modal-head">
            <div className="sda-b2-modal-title-group">
              <span className="sda-b2-modal-eyebrow">{t.pl_b2_pill_short}</span>
              <h3 className="sda-b2-modal-title">{t.pl_b2_ed_modal_title}</h3>
            </div>
            <button
              type="button"
              id="btn-close-b2-modal"
              className="sda-b2-modal-close"
              aria-label={t.pv_close_modal_aria}
              onClick={onClose}
            >
              <AppIcon name="x" size={18} />
            </button>
          </div>

          <p className="sda-b2-modal-sub">{t.pl_b2_ed_modal_sub}</p>

          <div className="sda-b2-notice-banner sda-b2-notice-banner--violet" id="notice-b2-ed-non-slip">
            <AppIcon name="shield" size={15} />
            <span>{t.pl_b2_ed_non_slip_notice}</span>
          </div>

          {edSavedShortcutKind ? (
            <div className="sda-b2-saved-panel" id="panel-b2-ed-saved-shortcuts">
              <div className="sda-b2-saved-banner">
                <span className="sda-b2-saved-banner-icon" aria-hidden="true">
                  <AppIcon name="check-circle" size={18} />
                </span>
                <div className="sda-b2-saved-banner-copy">
                  <span className="sda-b2-saved-banner-title">{t.pl_b2_ed_saved_title}</span>
                  <p className="sda-b2-saved-banner-sub">{t.pl_b2_ed_saved_sub}</p>
                </div>
              </div>

              <div className="sda-b2-block-callout" id="box-b2-ed-structure">
                <div className="sda-b2-block-callout-top">
                  <span className="sda-b2-block-callout-label">{t.pl_b2_ed_structure_box_label}</span>
                  {nextScheduledBlock && (
                    <span
                      className={`sda-b2-block-tag ${
                        nextScheduledBlock.isFasting ? 'sda-b2-block-tag--fasting' : ''
                      }`}
                    >
                      {nextScheduledBlock.isFasting ? t.pl_next_fasting_badge : t.pl_next_meal_badge}
                    </span>
                  )}
                </div>
                {nextScheduledBlock ? (
                  <>
                    <span className="sda-b2-block-time">
                      {nextScheduledBlock.startTime} – {nextScheduledBlock.endTime}
                    </span>
                    <span className="sda-b2-block-desc">{nextScheduledBlock.primaryDescription}</span>
                  </>
                ) : (
                  <span className="sda-b2-block-desc">{t.pl_next_no_block_empty}</span>
                )}
              </div>

              <div className="sda-b2-actions-stack">
                {edSavedShortcutKind === 'pause_15_min' && (
                  <button
                    type="button"
                    id="btn-b2-ed-shortcut-timer"
                    className="sda-b2-primary-btn"
                    onClick={() => {
                      onClose();
                      onOpenTimerShortcut();
                    }}
                  >
                    <AppIcon name="clock" size={16} />
                    <span>{t.pl_b2_ed_shortcut_timer}</span>
                  </button>
                )}

                {edSavedShortcutKind === 'check_food_readiness' && (
                  <button
                    type="button"
                    id="btn-b2-ed-shortcut-readiness"
                    className="sda-b2-primary-btn"
                    onClick={() => onSwitchModal('food_readiness')}
                  >
                    <AppIcon name="utensils" size={16} />
                    <span>{t.pl_b2_ed_shortcut_readiness}</span>
                  </button>
                )}

                <button
                  type="button"
                  id="btn-b2-ed-return-loop"
                  className="sda-b2-secondary-btn"
                  onClick={onClose}
                >
                  <span>{t.pl_b2_ed_btn_return_loop}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="sda-b2-field-group">
                <span className="sda-b2-field-label">{t.pl_b2_ed_signal_label}</span>
                <div className="sda-b2-toggle-grid">
                  {(
                    [
                      ['grazing_urge', t.pl_b2_ed_sig_grazing],
                      ['schedule_slipping', t.pl_b2_ed_sig_timing],
                      ['portion_creep', t.pl_b2_ed_sig_portions],
                      ['stress_fatigue', t.pl_b2_ed_sig_stress],
                      ['environment_temptation', t.pl_b2_ed_sig_environment],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      id={`btn-b2-ed-sig-${val}`}
                      className={`sda-b2-choice-btn ${edSignal === val ? 'is-selected' : ''}`}
                      onClick={() => setEdSignal(val)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <input
                  id="input-b2-ed-note"
                  type="text"
                  className="sda-b2-input"
                  value={edNote}
                  maxLength={140}
                  placeholder={t.pl_b2_ed_note_placeholder}
                  onChange={(e) => setEdNote(e.target.value)}
                />
              </div>

              <div className="sda-b2-block-callout" id="box-b2-ed-structure">
                <div className="sda-b2-block-callout-top">
                  <span className="sda-b2-block-callout-label">{t.pl_b2_ed_structure_box_label}</span>
                  {nextScheduledBlock && (
                    <span
                      className={`sda-b2-block-tag ${
                        nextScheduledBlock.isFasting ? 'sda-b2-block-tag--fasting' : ''
                      }`}
                    >
                      {nextScheduledBlock.isFasting ? t.pl_next_fasting_badge : t.pl_next_meal_badge}
                    </span>
                  )}
                </div>
                {nextScheduledBlock ? (
                  <>
                    <span className="sda-b2-block-time">
                      {nextScheduledBlock.startTime} – {nextScheduledBlock.endTime}
                    </span>
                    <span className="sda-b2-block-desc">{nextScheduledBlock.primaryDescription}</span>
                  </>
                ) : (
                  <span className="sda-b2-block-desc">{t.pl_next_no_block_empty}</span>
                )}
                <div className="sda-b2-structure-meta">
                  <span>{activeProfileName}</span>
                  <span>
                    {t.pl_b2_ed_anchors_count.replace('{count}', String(nonNegotiablesCount))}
                  </span>
                </div>
              </div>

              <div className="sda-b2-field-group">
                <span className="sda-b2-field-label">{t.pl_b2_ed_response_label}</span>
                <div className="sda-b2-toggle-grid">
                  {(
                    [
                      ['anchor_next_block', t.pl_b2_ed_resp_anchor_block],
                      ['pause_15_min', t.pl_b2_ed_resp_pause_15],
                      ['check_food_readiness', t.pl_b2_ed_resp_food_readiness],
                      ['revisit_non_negotiables', t.pl_b2_ed_resp_non_negotiables],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      id={`btn-b2-ed-resp-${val}`}
                      className={`sda-b2-choice-btn ${edResponse === val ? 'is-selected' : ''}`}
                      onClick={() => setEdResponse(val)}
                    >
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="sda-b2-actions-stack">
                <button
                  type="button"
                  id="btn-b2-ed-save-response"
                  className="sda-b2-primary-btn"
                  onClick={handleSaveDriftResponse}
                >
                  <AppIcon name="check" size={16} />
                  <span>{t.pl_b2_ed_btn_save_response}</span>
                </button>
                <button
                  type="button"
                  id="btn-b2-ed-ack-only"
                  className="sda-b2-secondary-btn"
                  onClick={handleAckDriftOnly}
                >
                  <span>{t.pl_b2_ed_btn_ack_only}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL 3: BOOK 2 MAINTENANCE WEEKLY REVIEW ── */}
      {activeModal === 'weekly_review' && (
        <form
          className="sda-b2-modal"
          id="modal-b2-weekly-review"
          onSubmit={handleSubmitWeeklyReview}
        >
          <div className="sda-b2-modal-head">
            <div className="sda-b2-modal-title-group">
              <span className="sda-b2-modal-eyebrow">{t.pl_b2_pill_short}</span>
              <h3 className="sda-b2-modal-title">{t.pl_b2_wr_modal_title}</h3>
            </div>
            <button
              type="button"
              id="btn-close-b2-modal"
              className="sda-b2-modal-close"
              aria-label={t.pv_close_modal_aria}
              onClick={onClose}
            >
              <AppIcon name="x" size={18} />
            </button>
          </div>

          <p className="sda-b2-modal-sub">{t.pl_b2_wr_modal_sub}</p>

          {activeAdjustment && (
            <div className="sda-b2-active-adj-card" id="section-b2-wr-active-adj">
              <span className="sda-b2-active-adj-title">{t.pl_b2_wr_adj_review_heading}</span>
              <span className="sda-b2-active-adj-desc">{activeAdjustment.description}</span>
              <div className="sda-b2-chip-wrap">
                {(
                  [
                    ['kept', t.pl_b2_wr_adj_keep],
                    ['testing', t.pl_b2_wr_adj_continue_testing],
                    ['retired', t.pl_b2_wr_adj_retire],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    id={`btn-b2-wr-adj-${val}`}
                    className={`sda-b2-chip-btn ${wrAdjDecision === val ? 'is-selected' : ''}`}
                    onClick={() => setWrAdjDecision(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                id="input-b2-wr-adj-note"
                type="text"
                className="sda-b2-input"
                value={wrAdjNote}
                maxLength={140}
                placeholder={t.pl_b2_adj_outcome_ph}
                onChange={(e) => setWrAdjNote(e.target.value)}
              />
            </div>
          )}

          <div className="sda-b2-field-group">
            <label htmlFor="textarea-b2-wr-helped" className="sda-b2-field-label">
              {t.pl_b2_wr_q_helped}
            </label>
            <textarea
              id="textarea-b2-wr-helped"
              className="sda-b2-textarea"
              rows={2}
              maxLength={280}
              value={wrHelped}
              placeholder={t.pl_b2_wr_q_helped_ph}
              onChange={(e) => {
                setWrHelped(e.target.value);
                if (wrError) setWrError('');
              }}
            />
          </div>

          <div className="sda-b2-field-group">
            <label htmlFor="textarea-b2-wr-difficult" className="sda-b2-field-label">
              {t.pl_b2_wr_q_difficult}
            </label>
            <textarea
              id="textarea-b2-wr-difficult"
              className="sda-b2-textarea"
              rows={2}
              maxLength={280}
              value={wrDifficult}
              placeholder={t.pl_b2_wr_q_difficult_ph}
              onChange={(e) => {
                setWrDifficult(e.target.value);
                if (wrError) setWrError('');
              }}
            />
          </div>

          <div className="sda-b2-field-group">
            <span className="sda-b2-field-label">{t.pl_b2_wr_q_readiness}</span>
            <div className="sda-b2-toggle-grid">
              {(
                [
                  ['solid', t.pl_b2_wr_readiness_solid],
                  ['mixed', t.pl_b2_wr_readiness_mixed],
                  ['gapped', t.pl_b2_wr_readiness_gapped],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  id={`btn-b2-wr-readiness-${val}`}
                  className={`sda-b2-choice-btn ${wrReadiness === val ? 'is-selected' : ''}`}
                  onClick={() => setWrReadiness(val)}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sda-b2-field-group">
            <span className="sda-b2-field-label">{t.pl_b2_wr_q_drift}</span>
            <div className="sda-b2-toggle-grid">
              {(
                [
                  ['none', t.pl_b2_wr_drift_none],
                  ['caught_early', t.pl_b2_wr_drift_caught_early],
                  ['recurring', t.pl_b2_wr_drift_recurring],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  id={`btn-b2-wr-drift-${val}`}
                  className={`sda-b2-choice-btn ${wrDrift === val ? 'is-selected' : ''}`}
                  onClick={() => setWrDrift(val)}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sda-b2-field-group">
            <span className="sda-b2-field-label">{t.pl_b2_wr_q_next_step}</span>
            <div className="sda-b2-toggle-grid">
              {(
                [
                  ['continue', t.pl_b2_wr_next_continue],
                  ['test_one', t.pl_b2_wr_next_test_one],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  id={`btn-b2-wr-next-${val}`}
                  className={`sda-b2-choice-btn ${wrNextStep === val ? 'is-selected' : ''}`}
                  onClick={() => setWrNextStep(val)}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {wrError && (
            <p className="sda-b2-error" role="alert">
              {wrError}
            </p>
          )}

          <div className="sda-b2-actions-stack">
            <button type="submit" id="btn-b2-wr-submit" className="sda-b2-primary-btn">
              <AppIcon name="check" size={16} />
              <span>{t.pl_b2_wr_btn_save}</span>
            </button>
            <button
              type="button"
              id="btn-b2-wr-full-history"
              className="sda-b2-ghost-link"
              onClick={() => {
                onClose();
                onOpenFullWeeklyHistory();
              }}
            >
              {t.pl_b2_wr_link_full_history}
            </button>
          </div>
        </form>
      )}

      {/* ── MODAL 4: TEST ONE ADJUSTMENT ── */}
      {activeModal === 'adjustment' && (
        <div className="sda-b2-modal" id="modal-b2-adjustment">
          <div className="sda-b2-modal-head">
            <div className="sda-b2-modal-title-group">
              <span className="sda-b2-modal-eyebrow">{t.pl_b2_pill_short}</span>
              <h3 className="sda-b2-modal-title">{t.pl_b2_adj_modal_title}</h3>
            </div>
            <button
              type="button"
              id="btn-close-b2-modal"
              className="sda-b2-modal-close"
              aria-label={t.pv_close_modal_aria}
              onClick={onClose}
            >
              <AppIcon name="x" size={18} />
            </button>
          </div>

          <p className="sda-b2-modal-sub">{t.pl_b2_adj_modal_sub}</p>

          <div className="sda-b2-notice-banner" id="notice-b2-adj-single">
            <AppIcon name="sparkles" size={14} />
            <span>{t.pl_b2_adj_single_notice}</span>
          </div>

          {activeAdjustment ? (
            <>
              <div className="sda-b2-active-adj-card" id="box-b2-active-adjustment">
                <span className="sda-b2-active-adj-title">{t.pl_b2_adj_active_heading}</span>
                <span className="sda-b2-active-adj-desc">{activeAdjustment.description}</span>
                {activeAdjustment.reason && (
                  <span className="sda-b2-active-adj-reason">{activeAdjustment.reason}</span>
                )}
              </div>

              <input
                id="input-b2-adj-outcome"
                type="text"
                className="sda-b2-input"
                value={adjOutcomeNote}
                maxLength={160}
                placeholder={t.pl_b2_adj_outcome_ph}
                onChange={(e) => setAdjOutcomeNote(e.target.value)}
              />

              <div className="sda-b2-actions-stack">
                <button
                  type="button"
                  id="btn-b2-adj-keep-testing"
                  className="sda-b2-primary-btn"
                  onClick={() => handleReviewAdjustmentDirect('testing')}
                >
                  <span>{t.pl_b2_adj_btn_keep_testing}</span>
                </button>
                <button
                  type="button"
                  id="btn-b2-adj-mark-kept"
                  className="sda-b2-secondary-btn"
                  onClick={() => handleReviewAdjustmentDirect('kept')}
                >
                  <AppIcon name="check" size={15} />
                  <span>{t.pl_b2_adj_btn_mark_kept}</span>
                </button>
                <button
                  type="button"
                  id="btn-b2-adj-retire"
                  className="sda-b2-secondary-btn"
                  onClick={() => handleReviewAdjustmentDirect('retired')}
                >
                  <span>{t.pl_b2_adj_btn_retire}</span>
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSaveNewAdjustment} className="sda-b2-field-group">
              <span className="sda-b2-field-label">{t.pl_b2_adj_cat_label}</span>
              <div className="sda-b2-chip-wrap">
                {(
                  [
                    ['food_readiness', t.pl_b2_adj_cat_readiness],
                    ['meal_timing', t.pl_b2_adj_cat_timing],
                    ['portion_satiety', t.pl_b2_adj_cat_satiety],
                    ['evening_boundary', t.pl_b2_adj_cat_evening],
                    ['custom', t.pl_b2_adj_cat_custom],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    id={`btn-b2-adj-cat-${val}`}
                    className={`sda-b2-chip-btn ${adjCategory === val ? 'is-selected' : ''}`}
                    onClick={() => setAdjCategory(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label htmlFor="textarea-b2-adj-desc" className="sda-b2-field-label">
                {t.pl_b2_adj_desc_label}
              </label>
              <textarea
                id="textarea-b2-adj-desc"
                className="sda-b2-textarea"
                rows={2}
                maxLength={180}
                value={adjDesc}
                placeholder={t.pl_b2_adj_desc_ph}
                onChange={(e) => {
                  setAdjDesc(e.target.value);
                  if (adjError) setAdjError('');
                }}
              />

              <label htmlFor="input-b2-adj-reason" className="sda-b2-field-label">
                {t.pl_b2_adj_reason_label}
              </label>
              <input
                id="input-b2-adj-reason"
                type="text"
                className="sda-b2-input"
                maxLength={140}
                value={adjReason}
                placeholder={t.pl_b2_adj_reason_ph}
                onChange={(e) => setAdjReason(e.target.value)}
              />

              {adjError && (
                <p className="sda-b2-error" role="alert">
                  {adjError}
                </p>
              )}

              <div className="sda-b2-actions-stack">
                <button type="submit" id="btn-b2-adj-save" className="sda-b2-primary-btn">
                  <AppIcon name="check" size={16} />
                  <span>{t.pl_b2_adj_btn_save_one}</span>
                </button>
                <button
                  type="button"
                  id="btn-b2-adj-continue-structure"
                  className="sda-b2-secondary-btn"
                  onClick={handleContinueExistingStructure}
                >
                  <span>{t.pl_b2_adj_btn_continue_structure}</span>
                </button>
              </div>
            </form>
          )}

          {/* Compact Collapsible Past Adjustments Section (Collapsed by Default, Read-Only) */}
          <div className="sda-b2-past-adj-section" id="section-b2-past-adjustments">
            <button
              type="button"
              id="btn-b2-toggle-past-adjustments"
              className={`sda-b2-past-adj-toggle ${isPastAdjustmentsOpen ? 'is-open' : ''}`}
              aria-expanded={isPastAdjustmentsOpen}
              aria-controls="panel-b2-past-adjustments"
              onClick={() => setIsPastAdjustmentsOpen((prev) => !prev)}
            >
              <span className="sda-b2-past-adj-toggle-left">
                <AppIcon name="history" size={14} />
                <span>{t.pl_b2_adj_past_heading}</span>
                <span className="sda-b2-past-adj-count" id="badge-b2-past-adj-count">
                  {adjustmentHistory.length}
                </span>
              </span>
              <AppIcon name="chevron-down" size={14} className="sda-b2-past-adj-chevron" />
            </button>

            {isPastAdjustmentsOpen && (
              <div id="panel-b2-past-adjustments">
                {adjustmentHistory.length === 0 ? (
                  <p className="sda-b2-past-adj-empty" id="empty-b2-past-adjustments">
                    {t.pl_b2_adj_past_empty}
                  </p>
                ) : (
                  <ul className="sda-b2-past-adj-list" id="list-b2-past-adjustments">
                    {adjustmentHistory.map((item) => {
                      const isKept = item.status === 'kept';
                      const reviewDate = item.lastReviewedDateKey || item.createdDateKey;
                      return (
                        <li
                          key={item.id}
                          className="sda-b2-past-adj-item"
                          data-adj-id={item.id}
                          data-adj-outcome={item.status}
                        >
                          <div className="sda-b2-past-adj-item-top">
                            <span className="sda-b2-past-adj-date">
                              {t.pl_b2_adj_past_reviewed_on.replace('{date}', reviewDate)}
                            </span>
                            <span
                              className={`sda-b2-past-adj-outcome ${
                                isKept
                                  ? 'sda-b2-past-adj-outcome--kept'
                                  : 'sda-b2-past-adj-outcome--retired'
                              }`}
                            >
                              {isKept ? t.pl_b2_adj_outcome_kept : t.pl_b2_adj_outcome_retired}
                            </span>
                          </div>
                          <span className="sda-b2-past-adj-desc">{item.description}</span>
                          {item.reviewOutcomeNote && (
                            <span className="sda-b2-past-adj-note">{item.reviewOutcomeNote}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            id="btn-b2-adj-open-diet-editor"
            className="sda-b2-ghost-link"
            onClick={() => {
              onClose();
              onOpenStructuredDiet();
            }}
          >
            {t.pl_b2_adj_link_edit_diet}
          </button>
        </div>
      )}
    </div>
  );
};
