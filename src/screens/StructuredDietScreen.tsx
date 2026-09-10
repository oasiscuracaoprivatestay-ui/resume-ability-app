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

// ── Block card ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
  block: StructuredDietBlock;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockCard({ block, onEdit, onDelete, t }: BlockCardProps) {
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
    <div className="sdb-block-card">
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

  const todayKey = getLocalTodayKey();
  const currentDay = getDayPlan(weekly, selectedDayKey);

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

  const sortedBlocks = sortBlocks(currentDay.blocks);
  const currentDayFullName = t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string;

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
              const isToday = k === todayKey;
              const shortLabel = t[`sdb_day_${k}_short` as keyof typeof t] as string;

              return (
                <button
                  key={k}
                  id={`sdb-day-${k}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className={`sdb-day-pill ${isSelected ? 'sdb-day-pill--active' : ''} ${isToday ? 'sdb-day-pill--today' : ''}`}
                  onClick={() => setSelectedDayKey(k)}
                >
                  <span className="sdb-day-pill-name">{shortLabel}</span>
                  {isToday && <span className="sdb-day-pill-dot" title={t.sdb_today} aria-label={t.sdb_today} />}
                </button>
              );
            })}
          </div>

          {/* ── Selected day header & Mode toggle ── */}
          <div className="sdb-day-header-card">
            <div className="sdb-day-title-row">
              <div className="sdb-day-title-wrap">
                <h2 className="sdb-day-name">{currentDayFullName}</h2>
                {selectedDayKey === todayKey && (
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
              <h3 className="sdb-unstructured-title">{t.sdb_unstructured_title}</h3>
              <p className="sdb-unstructured-desc">{t.sdb_unstructured_desc}</p>
              <div className="sdb-unstructured-safe-box">
                <span className="sdb-safe-box-icon">🔒</span>
                <p className="sdb-unstructured-safe-hint">{t.sdb_unstructured_safe_hint}</p>
              </div>
            </div>
          ) : (
            /* ── Structured day state (Block schedule) ── */
            <>
              {sortedBlocks.length === 0 ? (
                <div className="sdb-empty">
                  <div className="sdb-empty-icon">🥗</div>
                  <p className="sdb-empty-title">{t.sdb_empty_title}</p>
                  <p className="sdb-empty-sub">{t.sdb_empty_sub}</p>
                </div>
              ) : (
                <div className="sdb-block-list">
                  {sortedBlocks.map(block => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      onEdit={() => setEditingBlock(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      t={t}
                    />
                  ))}
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
