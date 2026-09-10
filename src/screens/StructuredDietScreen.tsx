import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import TermHelp from '../components/TermHelp';
import {
  loadWeeklyDiet,
  saveWeeklyDiet,
  getDayPlan,
  updateDayPlan,
  setDayMode,
  copyDayPlan,
  getLocalTodayKey,
  generateBlockId,
  isOvernightBlock,
  sortBlocks,
  DAY_KEYS,
} from '../utils/dietStorage';
import type {
  DayKey,
  DayMode,
  StructuredDietBlock,
  WeeklyStructuredDiet,
} from '../utils/dietStorage';
import {
  getDailyDietVerification,
  saveBlockVerification,
  clearBlockVerification,
  getDailyVerificationStats,
} from '../utils/dietVerificationStorage';
import type {
  DietBlockVerification,
  DailyDietVerification,
} from '../utils/dietVerificationStorage';
import {
  BLOCK_TYPE_KEYS,
  BLOCK_TYPE_ICONS,
  FOOD_OPTION_KEYS,
  TIME_SLOTS,
  formatTime,
} from '../data/dietData';
import type { BlockTypeKey } from '../data/dietData';
import './StructuredDietScreen.css';

interface StructuredDietScreenProps {
  onNavigate: (screen: Screen) => void;
}

// ── Block editor modal ─────────────────────────────────────────────────────────

interface BlockEditorProps {
  initial: StructuredDietBlock | null; // null = new block
  onSave: (block: StructuredDietBlock) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockEditor({ initial, onSave, onCancel, t }: BlockEditorProps) {
  const [startTime, setStartTime] = useState(initial?.startTime ?? '08:00');
  const [endTime, setEndTime]     = useState(initial?.endTime   ?? '09:00');
  const [type, setType]           = useState<string>(initial?.type ?? 'breakfast');
  const [items, setItems]         = useState<string[]>(initial?.items ?? []);
  const [customText, setCustomText] = useState(initial?.customText ?? '');
  const [error, setError]         = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Trap focus inside modal
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('select,input,button');
    first?.focus();
  }, []);

  const toggleItem = (key: string) => {
    setItems(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const validate = (): boolean => {
    if (!startTime) { setError(t.sdb_err_start_required); return false; }
    if (!endTime)   { setError(t.sdb_err_end_required);   return false; }
    if (!type)      { setError(t.sdb_err_type_required);  return false; }
    setError('');
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const block: StructuredDietBlock = {
      id: initial?.id ?? generateBlockId(),
      startTime,
      endTime,
      type,
      items,
      customText: customText.trim(),
    };
    onSave(block);
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const overnight = isOvernightBlock({ startTime, endTime });

  return (
    <div className="sdb-overlay" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label={t.sdb_editor_title}>
      <div className="sdb-modal" ref={modalRef}>
        <div className="sdb-modal-header">
          <h2 className="sdb-modal-title">
            {initial ? t.sdb_edit_block : t.sdb_add_block}
          </h2>
          <button className="sdb-modal-close" onClick={onCancel} aria-label={t.commit_cancel}>✕</button>
        </div>

        <div className="sdb-modal-body">
          {/* ── Time range ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_start_time}</label>
            <select
              className="sdb-select"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              aria-label={t.sdb_start_time}
            >
              {TIME_SLOTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_end_time}</label>
            <select
              className="sdb-select"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              aria-label={t.sdb_end_time}
            >
              {TIME_SLOTS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {overnight && (
              <span className="sdb-overnight-badge">{t.sdb_overnight}</span>
            )}
          </div>

          {/* ── Block type ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_block_type}</label>
            <div className="sdb-type-grid">
              {BLOCK_TYPE_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`sdb-type-chip ${type === key ? 'sdb-type-chip--active' : ''}`}
                  onClick={() => setType(key)}
                >
                  <span className="sdb-chip-icon">{BLOCK_TYPE_ICONS[key as BlockTypeKey]}</span>
                  <span className="sdb-chip-label">{t[`sdb_type_${key}` as keyof typeof t] as string}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Food / structure options ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_label}</label>
            <div className="sdb-food-grid">
              {FOOD_OPTION_KEYS.map(key => (
                <div key={key} className="sdb-food-chip-wrap">
                  <button
                    type="button"
                    className={`sdb-food-chip ${items.includes(key) ? 'sdb-food-chip--active' : ''}`}
                    onClick={() => toggleItem(key)}
                  >
                    {t[`sdb_food_${key}` as keyof typeof t] as string}
                  </button>
                  {key === 'micro_fasting' && (
                    <TermHelp termKey="mf" btnId="btn-help-microfasting" />
                  )}
                </div>
              ))}
            </div>
            {items.includes('micro_fasting') && (
              <p className="sdb-microfasting-hint">
                {t.sda_term_mf_def}
              </p>
            )}
          </div>

          {/* ── Custom note ── */}
          <div className="sdb-field">
            <label className="sdb-label sdb-label--optional">
              {t.sdb_custom_label}
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>
            <input
              id="sdb-custom-text"
              className="sdb-input"
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder={t.sdb_custom_placeholder}
              maxLength={120}
              aria-label={t.sdb_custom_label}
            />
          </div>

          {error && <p className="sdb-error" role="alert">{error}</p>}
        </div>

        <div className="sdb-modal-footer">
          <button className="sdb-btn sdb-btn--cancel" onClick={onCancel}>
            {t.commit_cancel}
          </button>
          <button className="sdb-btn sdb-btn--save" onClick={handleSave}>
            {t.commit_save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lightweight Diet Slip Verification Modal ──────────────────────────────────

interface DietSlipModalProps {
  block: StructuredDietBlock;
  initialActualItems?: string[];
  initialCustomText?: string;
  onSave: (actualItems: string[], customText: string) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function DietSlipModal({
  block,
  initialActualItems = [],
  initialCustomText = '',
  onSave,
  onCancel,
  t,
}: DietSlipModalProps) {
  const [actualItems, setActualItems] = useState<string[]>(initialActualItems);
  const [customText, setCustomText] = useState(initialCustomText);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const toggleItem = (key: string) => {
    setActualItems(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const typeName = (t[`sdb_type_${block.type}` as keyof typeof t] as string | undefined) ?? block.type;
  const isFoodBlock = ['breakfast', 'lunch', 'dinner', 'snack', 'protein_shake'].includes(block.type);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="sdb-overlay"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-slip-modal-title"
    >
      <div className="sdb-modal sdb-slip-modal" ref={modalRef}>
        <div className="sdb-modal-header">
          <div className="sdb-slip-modal-header-text">
            <span className="sdb-slip-modal-badge">SLIP VERIFICATION</span>
            <h2 id="sdb-slip-modal-title" className="sdb-modal-title">
              {isFoodBlock ? t.sdb_v_what_had : t.sdb_v_what_happened}
            </h2>
          </div>
          <button className="sdb-modal-close" onClick={onCancel} aria-label={t.commit_cancel}>
            ✕
          </button>
        </div>

        <div className="sdb-modal-body">
          {/* Planned Context Banner */}
          <div className="sdb-slip-planned-context">
            <span className="sdb-slip-planned-label">Planned:</span>
            <span className="sdb-slip-planned-val">
              {formatTime(block.startTime)} - {formatTime(block.endTime)} · {typeName}
            </span>
          </div>

          <p className="sdb-slip-hint-text">
            {t.sdb_v_slip_hint}
          </p>

          {/* Actual items chips */}
          <div className="sdb-field">
            <label className="sdb-label">Select Items Consumed (optional):</label>
            <div className="sdb-food-grid">
              {FOOD_OPTION_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  className={`sdb-food-chip ${actualItems.includes(key) ? 'sdb-food-chip--active' : ''}`}
                  onClick={() => toggleItem(key)}
                >
                  {t[`sdb_food_${key}` as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>

          {/* Custom text */}
          <div className="sdb-field">
            <label className="sdb-label sdb-label--optional">
              Notes / Custom Items
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>
            <input
              id="sdb-slip-custom-text"
              className="sdb-input"
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="e.g. Pizza with coworkers, soda..."
              maxLength={120}
            />
          </div>
        </div>

        <div className="sdb-modal-footer">
          <button id="btn-sdb-cancel-slip" className="sdb-btn sdb-btn--cancel" onClick={onCancel}>
            {t.commit_cancel}
          </button>
          <button
            id="btn-sdb-save-slip"
            className="sdb-btn sdb-btn--save sdb-btn--save-slip"
            onClick={() => onSave(actualItems, customText)}
          >
            {t.sdb_v_save_slip}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Block card ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
  block: StructuredDietBlock;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslation>['t'];
  isToday: boolean;
  verification?: DietBlockVerification;
  onVerifyOnTrack?: () => void;
  onOpenSlipModal?: () => void;
  onClearStatus?: () => void;
  onNavigate?: (screen: Screen) => void;
}

function BlockCard({
  block,
  onEdit,
  onDelete,
  t,
  isToday,
  verification,
  onVerifyOnTrack,
  onOpenSlipModal,
  onClearStatus,
  onNavigate,
}: BlockCardProps) {
  const typeKey = block.type as BlockTypeKey;
  const icon = BLOCK_TYPE_ICONS[typeKey] ?? '🍽️';
  const typeName = (t[`sdb_type_${block.type}` as keyof typeof t] as string | undefined) ?? block.type;
  const overnight = isOvernightBlock(block);

  // Build display items list
  const foodLabels = block.items.map(key =>
    (t[`sdb_food_${key}` as keyof typeof t] as string | undefined) ?? key
  );
  if (block.customText) foodLabels.push(block.customText);

  return (
    <div className={`sdb-block-card ${verification?.status ? `sdb-block-card--${verification.status}` : ''}`}>
      <div className="sdb-block-time-row">
        <span className="sdb-block-time">
          {formatTime(block.startTime)} → {formatTime(block.endTime)}
          {overnight && <span className="sdb-block-overnight">{' '}({t.sdb_next_day})</span>}
        </span>
        <div className="sdb-block-actions">
          <button
            className="sdb-icon-btn"
            onClick={onEdit}
            aria-label={`${t.commit_edit}: ${typeName}`}
            title={t.commit_edit}
          >
            ✎
          </button>
          <button
            className="sdb-icon-btn sdb-icon-btn--delete"
            onClick={onDelete}
            aria-label={`${t.commit_delete}: ${typeName}`}
            title={t.commit_delete}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sdb-block-type-row">
        <span className="sdb-block-icon">{icon}</span>
        <span className="sdb-block-type-label">{typeName.toUpperCase()}</span>
      </div>

      {foodLabels.length > 0 && (
        <p className="sdb-block-items">{foodLabels.join(', ')}</p>
      )}

      {/* ── Today Daily Verification Controls ── */}
      {isToday && (
        <div className="sdb-verification-box">
          {!verification ? (
            /* Not Reported State */
            <div className="sdb-verify-actions">
              <span className="sdb-verify-status-label">{t.sdb_v_not_reported}</span>
              <div className="sdb-verify-btn-group">
                <button
                  id={`btn-verify-ontrack-${block.id}`}
                  type="button"
                  className="sdb-verify-btn sdb-verify-btn--ontrack"
                  onClick={onVerifyOnTrack}
                >
                  ✓ {t.sdb_v_on_track}
                </button>
                <button
                  id={`btn-verify-slip-${block.id}`}
                  type="button"
                  className="sdb-verify-btn sdb-verify-btn--slip"
                  onClick={onOpenSlipModal}
                >
                  ⚠ {t.sdb_v_slip}
                </button>
              </div>
            </div>
          ) : verification.status === 'on-track' ? (
            /* Verified On Track State */
            <div className="sdb-verified-badge sdb-verified-badge--ontrack">
              <div className="sdb-verified-badge-top">
                <span className="sdb-verified-badge-label">✓ {t.sdb_v_on_track}</span>
                <div className="sdb-verified-controls">
                  <button
                    type="button"
                    className="sdb-verified-link"
                    onClick={onOpenSlipModal}
                  >
                    {t.sdb_v_change_status}
                  </button>
                  <span className="sdb-verified-ctrl-dot">·</span>
                  <button
                    id={`btn-clear-status-${block.id}`}
                    type="button"
                    className="sdb-verified-link sdb-verified-link--clear"
                    onClick={onClearStatus}
                  >
                    {t.sdb_v_clear_status}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Verified Slip State */
            <div className="sdb-verified-badge sdb-verified-badge--slip">
              <div className="sdb-verified-badge-top">
                <span className="sdb-verified-badge-label">⚠ {t.sdb_v_slip_reported}</span>
                <div className="sdb-verified-controls">
                  <button
                    type="button"
                    className="sdb-verified-link"
                    onClick={onOpenSlipModal}
                  >
                    {t.commit_edit}
                  </button>
                  <span className="sdb-verified-ctrl-dot">·</span>
                  <button
                    id={`btn-clear-status-${block.id}`}
                    type="button"
                    className="sdb-verified-link sdb-verified-link--clear"
                    onClick={onClearStatus}
                  >
                    {t.sdb_v_clear_status}
                  </button>
                </div>
              </div>

              {/* Actual consumed details */}
              {(verification.actualItems?.length || verification.actualCustomText) && (
                <div className="sdb-verified-actual-row">
                  <span className="sdb-actual-label">{t.sdb_v_actual_label}:</span>
                  <span className="sdb-actual-text">
                    {[
                      ...(verification.actualItems?.map(k => (t[`sdb_food_${k}` as keyof typeof t] as string) ?? k) || []),
                      verification.actualCustomText,
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {/* Practice Resume-Ability secondary link */}
              {onNavigate && (
                <button
                  id={`btn-practice-ra-${block.id}`}
                  type="button"
                  className="sdb-practice-ra-link"
                  onClick={() => onNavigate('slip-type')}
                >
                  {t.sdb_v_practice_ra} →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Copy Day Modal ────────────────────────────────────────────────────────────

interface CopyDayModalProps {
  sourceDayKey: DayKey;
  weekly: WeeklyStructuredDiet;
  onCopy: (targets: DayKey[]) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function CopyDayModal({ sourceDayKey, weekly, onCopy, onCancel, t }: CopyDayModalProps) {
  const otherDays = DAY_KEYS.filter(k => k !== sourceDayKey);
  const [selectedTargets, setSelectedTargets] = useState<DayKey[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const toggleTarget = (key: DayKey) => {
    setSelectedTargets(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    if (selectedTargets.length === otherDays.length) {
      setSelectedTargets([]);
    } else {
      setSelectedTargets([...otherDays]);
    }
  };

  const sourceDayName = t[`sdb_day_${sourceDayKey}` as keyof typeof t] as string;

  // Check if any selected target day currently has non-empty blocks
  const willOverwrite = selectedTargets.some(k => {
    const day = getDayPlan(weekly, k);
    return day.blocks.length > 0;
  });

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="sdb-overlay"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-copy-title"
    >
      <div className="sdb-modal sdb-copy-modal" ref={modalRef}>
        <div className="sdb-modal-header">
          <h2 id="sdb-copy-title" className="sdb-modal-title">
            {t.sdb_copy_modal_title}
          </h2>
          <button className="sdb-modal-close" onClick={onCancel} aria-label={t.commit_cancel}>
            ✕
          </button>
        </div>

        <div className="sdb-modal-body">
          <p className="sdb-copy-sub">
            {t.sdb_copy_modal_sub.replace('{day}', sourceDayName)}
          </p>

          <div className="sdb-copy-select-all-row">
            <button
              type="button"
              className="sdb-btn-select-all"
              onClick={handleSelectAll}
            >
              {t.sdb_select_all}
            </button>
          </div>

          <div className="sdb-copy-targets-list">
            {otherDays.map(k => {
              const dayName = t[`sdb_day_${k}` as keyof typeof t] as string;
              const isChecked = selectedTargets.includes(k);
              const targetDay = getDayPlan(weekly, k);
              const blockCount = targetDay.blocks.length;

              return (
                <label key={k} className="sdb-copy-target-item">
                  <input
                    type="checkbox"
                    className="sdb-copy-checkbox"
                    checked={isChecked}
                    onChange={() => toggleTarget(k)}
                  />
                  <span className="sdb-copy-target-name">{dayName}</span>
                  <span className="sdb-copy-target-badge">
                    {targetDay.mode === 'unstructured'
                      ? t.sdb_mode_unstructured
                      : `${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}`}
                  </span>
                </label>
              );
            })}
          </div>

          {willOverwrite && (
            <div className="sdb-copy-overwrite-alert" role="alert">
              ⚠️ {t.sdb_copy_confirm_overwrite}
            </div>
          )}
        </div>

        <div className="sdb-modal-footer">
          <button className="sdb-btn sdb-btn--cancel" onClick={onCancel}>
            {t.commit_cancel}
          </button>
          <button
            id="btn-sdb-copy-confirm"
            className="sdb-btn sdb-btn--save"
            disabled={selectedTargets.length === 0}
            onClick={() => onCopy(selectedTargets)}
          >
            {t.sdb_copy_btn_submit} ({selectedTargets.length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StructuredDietScreen({ onNavigate }: StructuredDietScreenProps) {
  const { t } = useTranslation();
  const [weekly, setWeekly] = useState<WeeklyStructuredDiet>(() => loadWeeklyDiet());
  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>(() => getLocalTodayKey());
  const [editingBlock, setEditingBlock] = useState<StructuredDietBlock | null | 'new'>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(weekly.planName);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Daily verification state (today's verifications)
  const [todayVerification, setTodayVerification] = useState<DailyDietVerification | null>(
    () => getDailyDietVerification()
  );
  // Modal state for reporting a Slip on a block
  const [slipModalBlock, setSlipModalBlock] = useState<StructuredDietBlock | null>(null);

  const todayKey = getLocalTodayKey();
  const isToday = selectedDayKey === todayKey;
  const currentDay = getDayPlan(weekly, selectedDayKey);

  // Reload verifications whenever needed
  const refreshVerifications = useCallback(() => {
    setTodayVerification(getDailyDietVerification());
  }, []);

  // ── Persist helper ─────────────────────────────────────────────────────────
  const updateWeekly = useCallback((updater: (w: WeeklyStructuredDiet) => WeeklyStructuredDiet) => {
    setWeekly(prev => {
      const next = updater({ ...prev });
      saveWeeklyDiet(next);
      return next;
    });
  }, []);

  // ── Plan Name edit ─────────────────────────────────────────────────────────
  const commitName = () => {
    const trimmed = nameText.trim();
    const finalName = trimmed || t.sdb_default_plan_name || 'My Structured Diet';
    setNameText(finalName);
    updateWeekly(w => ({ ...w, planName: finalName }));
    setEditingName(false);
  };

  // ── Day Mode toggle ────────────────────────────────────────────────────────
  const handleSetMode = (mode: DayMode) => {
    updateWeekly(w => setDayMode(w, selectedDayKey, mode));
  };

  // ── Block CRUD for current day ─────────────────────────────────────────────
  const handleSaveBlock = (block: StructuredDietBlock) => {
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => {
        const existing = day.blocks.findIndex(b => b.id === block.id);
        const blocks = existing >= 0
          ? day.blocks.map((b, i) => (i === existing ? block : b))
          : [...day.blocks, block];
        return { ...day, blocks: sortBlocks(blocks) };
      })
    );
    setEditingBlock(null);
  };

  const handleDeleteBlock = (id: string) => {
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => ({
        ...day,
        blocks: day.blocks.filter(b => b.id !== id),
      }))
    );
  };

  // ── Copy day action ────────────────────────────────────────────────────────
  const handleExecuteCopy = (targets: DayKey[]) => {
    updateWeekly(w => copyDayPlan(w, selectedDayKey, targets));
    setShowCopyModal(false);
    setCopyFeedback(t.sdb_copy_success);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 2800);
  };

  // ── Verification actions ───────────────────────────────────────────────────
  const handleVerifyOnTrack = (block: StructuredDietBlock) => {
    saveBlockVerification({
      plannedBlock: block,
      status: 'on-track',
      sourcePlanName: weekly.planName,
    });
    refreshVerifications();
  };

  const handleSaveSlipVerification = (actualItems: string[], customText: string) => {
    if (!slipModalBlock) return;
    saveBlockVerification({
      plannedBlock: slipModalBlock,
      status: 'slip',
      actualItems,
      actualCustomText: customText,
      sourcePlanName: weekly.planName,
    });
    setSlipModalBlock(null);
    refreshVerifications();
  };

  const handleClearStatus = (blockId: string) => {
    clearBlockVerification(blockId);
    refreshVerifications();
  };

  const sortedBlocks = sortBlocks(currentDay.blocks);
  const currentDayFullName = t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string;

  // Stats for today's verification
  const verificationStats = isToday
    ? getDailyVerificationStats(sortedBlocks.length)
    : null;

  // Orphaned verifications: verified blocks whose plannedBlockId is no longer in sortedBlocks
  const orphanedVerifications = isToday && todayVerification
    ? todayVerification.entries.filter(
        e => !sortedBlocks.some(b => b.id === e.plannedBlockId)
      )
    : [];

  return (
    <div className="screen sdb-screen">
      <div className="sdb-inner">
        <ScreenHeader
          onBack={() => onNavigate('commitment')}
          onHome={() => onNavigate('home')}
        />

        <div className="sdb-content">
          {/* ── Heading ── */}
          <div className="sdb-heading-block">
            <div className="sdb-title-row">
              <span className="section-label">{t.sdb_label}</span>
              <TermHelp termKey="sd" btnId="btn-help-sd" />
            </div>
            <h1 className="sdb-heading">{t.sdb_heading}</h1>
            <p className="sdb-sub">{t.sdb_sub}</p>
            <p className="sdb-desc-hint">{t.sda_term_sd_def}</p>
          </div>

          {/* ── Overall Weekly Plan Name ── */}
          <div className="sdb-plan-name-row">
            {editingName ? (
              <div className="sdb-name-edit">
                <input
                  id="sdb-plan-name-input"
                  className="sdb-name-input"
                  value={nameText}
                  onChange={e => setNameText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') {
                      setNameText(weekly.planName);
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                  maxLength={60}
                  aria-label={t.sdb_plan_name_label}
                />
                <div className="sdb-name-actions">
                  <button className="commit-btn commit-btn--save" onClick={commitName}>
                    {t.commit_save}
                  </button>
                  <button
                    className="commit-btn commit-btn--cancel"
                    onClick={() => {
                      setNameText(weekly.planName);
                      setEditingName(false);
                    }}
                  >
                    {t.commit_cancel}
                  </button>
                </div>
              </div>
            ) : (
              <div className="sdb-name-display">
                <span className="sdb-plan-name">{weekly.planName}</span>
                <button
                  className="sdb-icon-btn"
                  onClick={() => {
                    setNameText(weekly.planName);
                    setEditingName(true);
                  }}
                  aria-label={t.sdb_rename_plan}
                  title={t.sdb_rename_plan}
                >
                  ✎
                </button>
              </div>
            )}
          </div>

          {/* ── Compact 7-day selector ── */}
          <div className="sdb-week-selector" role="tablist" aria-label="Days of the week">
            {DAY_KEYS.map(k => {
              const isSelected = k === selectedDayKey;
              const isTodayPill = k === todayKey;
              const shortLabel = t[`sdb_day_${k}_short` as keyof typeof t] as string;

              return (
                <button
                  key={k}
                  id={`sdb-day-${k}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-current={isTodayPill ? 'date' : undefined}
                  className={`sdb-day-pill ${isSelected ? 'sdb-day-pill--active' : ''} ${isTodayPill ? 'sdb-day-pill--today' : ''}`}
                  onClick={() => setSelectedDayKey(k)}
                >
                  <span className="sdb-day-pill-name">{shortLabel}</span>
                  {isTodayPill && <span className="sdb-day-pill-dot" title={t.sdb_today} aria-label={t.sdb_today} />}
                </button>
              );
            })}
          </div>

          {/* ── Selected day header & Mode toggle ── */}
          <div className="sdb-day-header-card">
            <div className="sdb-day-title-row">
              <div className="sdb-day-title-wrap">
                <h2 className="sdb-day-name">{currentDayFullName}</h2>
                {isToday && (
                  <span className="sdb-today-badge">{t.sdb_today}</span>
                )}
              </div>

              <button
                id="btn-sdb-copy-day"
                type="button"
                className="sdb-copy-trigger-btn"
                onClick={() => setShowCopyModal(true)}
                title={t.sdb_btn_copy_day}
              >
                <span>📋</span>
                <span className="sdb-copy-btn-text">{t.sdb_btn_copy_day}</span>
              </button>
            </div>

            {/* Mode selector */}
            <div className="sdb-day-mode-row">
              <span className="sdb-day-mode-label">{t.sdb_day_type}:</span>
              <div className="sdb-day-mode-toggle" role="radiogroup" aria-label={t.sdb_day_type}>
                <button
                  id="sdb-mode-btn-structured"
                  type="button"
                  role="radio"
                  aria-checked={currentDay.mode === 'structured'}
                  className={`sdb-mode-pill ${currentDay.mode === 'structured' ? 'sdb-mode-pill--active' : ''}`}
                  onClick={() => handleSetMode('structured')}
                >
                  {t.sdb_mode_structured}
                </button>
                <button
                  id="sdb-mode-btn-unstructured"
                  type="button"
                  role="radio"
                  aria-checked={currentDay.mode === 'unstructured'}
                  className={`sdb-mode-pill ${currentDay.mode === 'unstructured' ? 'sdb-mode-pill--active' : ''}`}
                  onClick={() => handleSetMode('unstructured')}
                >
                  {t.sdb_mode_unstructured}
                </button>
              </div>
            </div>
          </div>

          {/* Copy transient feedback toast */}
          {copyFeedback && (
            <div className="sdb-toast-feedback" role="status">
              ✓ {copyFeedback}
            </div>
          )}

          {/* ── Content depending on Day Mode ── */}
          {currentDay.mode === 'unstructured' ? (
            /* ── Unstructured day state ── */
            <div className="sdb-unstructured-card">
              <div className="sdb-unstructured-icon">🌱</div>
              <h3 className="sdb-unstructured-title">
                {isToday ? t.sdb_today_unstructured_title : t.sdb_unstructured_title}
              </h3>
              <p className="sdb-unstructured-desc">
                {isToday ? t.sdb_today_unstructured_desc : t.sdb_unstructured_desc}
              </p>
              <div className="sdb-unstructured-safe-box">
                <span className="sdb-safe-box-icon">🔒</span>
                <p className="sdb-unstructured-safe-hint">{t.sdb_unstructured_safe_hint}</p>
              </div>
            </div>
          ) : (
            /* ── Structured day state (Block schedule) ── */
            <>
              {/* Today's Progress Card (shown only on Today) */}
              {isToday && verificationStats && (
                <div className="sdb-today-progress-card">
                  <div className="sdb-today-progress-top">
                    <span className="sdb-progress-badge">{t.sdb_v_today_progress}</span>
                    <span className="sdb-progress-summary" id="sdb-progress-summary">
                      {t.sdb_v_reported_summary
                        .replace('{reported}', String(verificationStats.reportedCount))
                        .replace('{total}', String(verificationStats.plannedCount))}
                    </span>
                  </div>
                  {verificationStats.reportedCount > 0 && (
                    <div className="sdb-progress-breakdown" id="sdb-progress-breakdown">
                      <span className="sdb-prog-pill sdb-prog-pill--ontrack">
                        ✓ {verificationStats.onTrackCount} {t.sdb_v_on_track}
                      </span>
                      <span className="sdb-prog-pill sdb-prog-pill--slip">
                        ⚠ {verificationStats.slipCount} {t.sdb_v_slip}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {sortedBlocks.length === 0 ? (
                <div className="sdb-empty">
                  <div className="sdb-empty-icon">🥗</div>
                  <p className="sdb-empty-title">{t.sdb_empty_title}</p>
                  <p className="sdb-empty-sub">{t.sdb_empty_sub}</p>
                </div>
              ) : (
                <div className="sdb-block-list">
                  {sortedBlocks.map(block => {
                    const verification = isToday && todayVerification
                      ? todayVerification.entries.find(e => e.plannedBlockId === block.id)
                      : undefined;

                    return (
                      <BlockCard
                        key={block.id}
                        block={block}
                        onEdit={() => setEditingBlock(block)}
                        onDelete={() => handleDeleteBlock(block.id)}
                        t={t}
                        isToday={isToday}
                        verification={verification}
                        onVerifyOnTrack={() => handleVerifyOnTrack(block)}
                        onOpenSlipModal={() => setSlipModalBlock(block)}
                        onClearStatus={() => handleClearStatus(block.id)}
                        onNavigate={onNavigate}
                      />
                    );
                  })}
                </div>
              )}

              {/* ── Orphaned / Earlier Verified Blocks Today ── */}
              {isToday && orphanedVerifications.length > 0 && (
                <div className="sdb-orphaned-section">
                  <span className="sdb-orphaned-label">{t.sdb_v_earlier_verified}</span>
                  <div className="sdb-orphaned-list">
                    {orphanedVerifications.map(orphan => {
                      const typeName =
                        (t[`sdb_type_${orphan.plannedSnapshot.type}` as keyof typeof t] as string | undefined) ??
                        orphan.plannedSnapshot.type;

                      return (
                        <div
                          key={orphan.id}
                          className={`sdb-orphaned-card sdb-orphaned-card--${orphan.status}`}
                        >
                          <div className="sdb-orphaned-info">
                            <span className="sdb-orphaned-time">
                              {formatTime(orphan.plannedSnapshot.startTime)} →{' '}
                              {formatTime(orphan.plannedSnapshot.endTime)} · {typeName}
                            </span>
                            <span className="sdb-orphaned-status">
                              {orphan.status === 'on-track' ? `✓ ${t.sdb_v_on_track}` : `⚠ ${t.sdb_v_slip_reported}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="sdb-verified-link sdb-verified-link--clear"
                            onClick={() => handleClearStatus(orphan.plannedBlockId)}
                          >
                            {t.sdb_v_clear_status}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Add block CTA ── */}
              <button
                id="btn-sdb-add-block"
                className="sdb-add-btn"
                onClick={() => setEditingBlock('new')}
              >
                <span className="sdb-add-btn-icon">+</span>
                {t.sdb_add_block}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Block editor modal ── */}
      {editingBlock && (
        <BlockEditor
          initial={editingBlock === 'new' ? null : editingBlock}
          onSave={handleSaveBlock}
          onCancel={() => setEditingBlock(null)}
          t={t}
        />
      )}

      {/* ── Slip Verification Modal ── */}
      {slipModalBlock && (
        <DietSlipModal
          block={slipModalBlock}
          initialActualItems={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.actualItems
          }
          initialCustomText={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.actualCustomText
          }
          onSave={handleSaveSlipVerification}
          onCancel={() => setSlipModalBlock(null)}
          t={t}
        />
      )}

      {/* ── Copy Day Plan modal ── */}
      {showCopyModal && (
        <CopyDayModal
          sourceDayKey={selectedDayKey}
          weekly={weekly}
          onCopy={handleExecuteCopy}
          onCancel={() => setShowCopyModal(false)}
          t={t}
        />
      )}
    </div>
  );
}
