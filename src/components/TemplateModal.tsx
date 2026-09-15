import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from '../i18n';
import type { DietTemplate, DietTemplateCategory } from '../data/dietTemplates';
import { DIET_TEMPLATES } from '../data/dietTemplates';
import type { DayKey, StructuredDietBlock } from '../utils/dietStorage';
import { DAY_KEYS } from '../utils/dietStorage';
import { TIME_SLOTS } from '../data/dietData';
import {
  generateTemplateBlocks,
  SCHEDULE_INTERVAL_OPTIONS,
  BLOCK_COUNT_OPTIONS,
} from '../utils/scheduleGenerator';
import './TemplateModal.css';

export interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: DietTemplate, configuredBlocks?: StructuredDietBlock[]) => void;
  selectedDayKey?: DayKey;
  selectedDayName?: string;
  hasExistingDayBlocks?: boolean;
  onSelectDayKey?: (dayKey: DayKey) => void;
}

type ModalView = 'list' | 'preview' | 'confirm';

export default function TemplateModal({
  isOpen,
  onClose,
  onApply,
  selectedDayKey = 'mon',
  selectedDayName,
  hasExistingDayBlocks = false,
  onSelectDayKey,
}: TemplateModalProps) {
  const { t } = useTranslation();

  const [currentDayKey, setCurrentDayKey] = useState<DayKey>(selectedDayKey);
  const [activeCategory, setActiveCategory] = useState<DietTemplateCategory>('structured');
  const [selectedTemplate, setSelectedTemplate] = useState<DietTemplate | null>(null);
  const [view, setView] = useState<ModalView>('list');
  const modalRef = useRef<HTMLDivElement>(null);

  // Template Time-Block Builder State (Phase 7B)
  const [startTime, setStartTime] = useState<string>('08:00');
  const [blockCount, setBlockCount] = useState<number>(4);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(180); // 3 hours default

  const resolvedDayName =
    (t[`sdb_day_${currentDayKey}` as keyof typeof t] as string | undefined) ||
    selectedDayName ||
    'Monday';

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCurrentDayKey(selectedDayKey);
      setActiveCategory('structured');
      setSelectedTemplate(null);
      setView('list');
      setStartTime('08:00');
      setBlockCount(4);
      setIntervalMinutes(180);
    }
  }, [isOpen, selectedDayKey]);

  // When a template is selected, set smart default block count based on template blocks
  const handleSelectTemplate = (tpl: DietTemplate) => {
    setSelectedTemplate(tpl);
    const count = Math.min(Math.max(tpl.blocks?.length || 4, 2), 8);
    setBlockCount(count);
    setStartTime('08:00');
    setIntervalMinutes(180);
    setView('preview');
  };

  // Compute generated blocks and check midnight overflow using shared scheduleGenerator
  const generatedResult = useMemo(() => {
    if (!selectedTemplate) {
      return { blocks: [], times: [], isOverflow: false, mode: 'structured' as const };
    }
    return generateTemplateBlocks(selectedTemplate, startTime, blockCount, intervalMinutes);
  }, [selectedTemplate, startTime, blockCount, intervalMinutes]);

  const isOverflow = generatedResult.isOverflow;

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'confirm') {
          setView('preview');
        } else if (view === 'preview') {
          setView('list');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, onClose]);

  if (!isOpen) return null;

  const categoryTemplates = DIET_TEMPLATES.filter(
    tpl => tpl.category === activeCategory
  );

  const handleApplyClick = () => {
    if (!selectedTemplate || isOverflow) return;
    if (hasExistingDayBlocks) {
      setView('confirm');
    } else {
      handleConfirmApply();
    }
  };

  const handleConfirmApply = () => {
    if (!selectedTemplate || isOverflow) return;
    onApply(selectedTemplate, generatedResult.blocks);
    onClose();
  };

  return (
    <div
      className="tpl-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpl-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tpl-modal" ref={modalRef} role="document">
        {/* ── View 1: Template List / Browser ── */}
        {view === 'list' && (
          <div className="tpl-body">
            <div className="tpl-header">
              <div className="tpl-title-wrap">
                <span className="tpl-badge">📑 {t.sdb_templates}</span>
                <h2 id="tpl-modal-title" className="tpl-title">
                  {t.sdb_choose_template}
                </h2>
              </div>
              <button
                id="btn-tpl-close"
                type="button"
                className="tpl-close-btn"
                onClick={onClose}
                aria-label={t.sdb_qb_btn_cancel}
              >
                ✕
              </button>
            </div>

            {/* Target Day Indicator / Dropdown Banner (Phase 22) */}
            <div className="tpl-target-day-banner">
              <div className="tpl-target-day-left">
                <span className="tpl-target-day-icon">📅</span>
                <label htmlFor="tpl-day-select" className="tpl-target-day-label">
                  {t.sdb_day_select_label}:
                </label>
              </div>
              <div className="tpl-day-select-wrap">
                <select
                  id="tpl-day-select"
                  className="tpl-day-select"
                  value={currentDayKey}
                  onChange={(e) => {
                    const nextKey = e.target.value as DayKey;
                    setCurrentDayKey(nextKey);
                    onSelectDayKey?.(nextKey);
                  }}
                  aria-label={t.sdb_day_select_label}
                >
                  {DAY_KEYS.map((k) => {
                    const dayName = (t[`sdb_day_${k}` as keyof typeof t] as string | undefined) || k;
                    return (
                      <option key={k} id={`tpl-day-opt-${k}`} value={k}>
                        {dayName}
                      </option>
                    );
                  })}
                </select>
                <span className="tpl-day-select-chevron" aria-hidden="true">▾</span>
              </div>
            </div>

            {/* Category tabs: Structured (LEFT), Unstructured (RIGHT) */}
            <div className="tpl-category-tabs" role="tablist" aria-label={t.sdb_templates}>
              <button
                id="btn-tpl-cat-structured"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'structured'}
                className={`tpl-cat-tab ${activeCategory === 'structured' ? 'tpl-cat-tab--active' : ''}`}
                onClick={() => setActiveCategory('structured')}
              >
                {t.sdb_templates_structured} (7)
              </button>
              <button
                id="btn-tpl-cat-unstructured"
                type="button"
                role="tab"
                aria-selected={activeCategory === 'unstructured'}
                className={`tpl-cat-tab ${activeCategory === 'unstructured' ? 'tpl-cat-tab--active' : ''}`}
                onClick={() => setActiveCategory('unstructured')}
              >
                {t.sdb_templates_unstructured} (6)
              </button>
            </div>

            {/* Template Card List */}
            <div className="tpl-card-list">
              {categoryTemplates.map(tpl => {
                const title = String(t[tpl.nameKey as keyof typeof t]);
                const desc = String(t[tpl.descriptionKey as keyof typeof t]);

                return (
                  <div
                    key={tpl.id}
                    id={`tpl-card-${tpl.id}`}
                    className="tpl-card"
                    onClick={() => handleSelectTemplate(tpl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectTemplate(tpl);
                      }
                    }}
                  >
                    <div className="tpl-card-top">
                      <span className={`tpl-mode-tag ${tpl.targetMode === 'structured' ? 'tpl-mode-tag--struct' : 'tpl-mode-tag--unstruct'}`}>
                        {tpl.targetMode === 'structured' ? t.sdb_tpl_structured_label : t.sdb_tpl_unstructured_label}
                      </span>
                      <span className="tpl-summary-pill">{t.sdb_tpl_timeline_badge}</span>
                    </div>
                    <h3 className="tpl-card-title">{title}</h3>
                    <p className="tpl-card-desc">{desc}</p>
                    <div className="tpl-card-footer">
                      <span className="tpl-preview-link">
                        {t.sdb_tpl_preview} →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="tpl-modal-actions">
              <button
                id="btn-tpl-cancel"
                type="button"
                className="tpl-btn tpl-btn--cancel"
                onClick={onClose}
              >
                {t.sdb_qb_btn_cancel}
              </button>
            </div>
          </div>
        )}

        {/* ── View 2: Detailed 24-Hour Timeline Preview ── */}
        {view === 'preview' && selectedTemplate && (
          <div className="tpl-body">
            <div className="tpl-header">
              <div className="tpl-title-wrap">
                <div className="tpl-tag-row">
                  <span className={`tpl-mode-tag ${selectedTemplate.targetMode === 'structured' ? 'tpl-mode-tag--struct' : 'tpl-mode-tag--unstruct'}`}>
                    {selectedTemplate.targetMode === 'structured' ? t.sdb_tpl_structured_label : t.sdb_tpl_unstructured_label}
                  </span>
                  <span className="tpl-summary-pill">{t.sdb_tpl_timeline_badge}</span>
                </div>
                <h2 id="tpl-modal-title" className="tpl-title">
                  {String(t[selectedTemplate.nameKey as keyof typeof t])}
                </h2>
              </div>
              <button
                id="btn-tpl-preview-close"
                type="button"
                className="tpl-close-btn"
                onClick={onClose}
                aria-label={t.sdb_qb_btn_cancel}
              >
                ✕
              </button>
            </div>

            {/* Target Day Highlight */}
            <div className="tpl-target-day-banner">
              <span className="tpl-target-day-icon">🎯</span>
              <span className="tpl-target-day-text">
                {t.sdb_tpl_apply_to_day.replace('{day}', resolvedDayName)}
              </span>
            </div>

            <p className="tpl-desc-hint">
              {String(t[selectedTemplate.descriptionKey as keyof typeof t])}
            </p>

            {/* 24-Hour Timeline List */}
            <div className="tpl-preview-timeline" role="list" aria-label="24-Hour Timeline">
              {selectedTemplate.timeline.map((point, idx) => {
                const label = String(t[point.labelKey as keyof typeof t] ?? point.labelKey);

                return (
                  <div key={idx} className="tpl-timeline-row" role="listitem">
                    <div className="tpl-timeline-time-col">
                      <span className="tpl-timeline-time">{point.time}</span>
                      {point.isNextDay && (
                        <span className="tpl-timeline-next-day-pill">
                          +{t.sdb_tpl_next_day_ref}
                        </span>
                      )}
                    </div>
                    <div className="tpl-timeline-marker">
                      <span className="tpl-timeline-dot" />
                      {idx < selectedTemplate.timeline.length - 1 && (
                        <span className="tpl-timeline-line" />
                      )}
                    </div>
                    <div className="tpl-timeline-content">
                      <span className="tpl-timeline-label">{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Template Time-Block Builder (Phase 7B) ── */}
            <div className="tpl-builder-card" id="tpl-builder-card">
              <div className="tpl-builder-header">
                <span className="tpl-builder-icon">⚙️</span>
                <h3 className="tpl-builder-title">{t.sdb_tpl_builder_title}</h3>
              </div>

              <div className="tpl-builder-grid">
                {/* 1. Starting Time */}
                <div className="tpl-builder-field">
                  <label htmlFor="tpl-select-start-time" className="tpl-builder-label">
                    {t.sdb_tpl_start_time}
                  </label>
                  <select
                    id="tpl-select-start-time"
                    className="tpl-builder-select"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  >
                    {TIME_SLOTS.map(slot => (
                      <option key={slot.value} value={slot.value}>
                        {slot.value} ({slot.label})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Number of Blocks */}
                <div className="tpl-builder-field">
                  <label htmlFor="tpl-select-block-count" className="tpl-builder-label">
                    {t.sdb_tpl_num_blocks}
                  </label>
                  <select
                    id="tpl-select-block-count"
                    className="tpl-builder-select"
                    value={blockCount}
                    onChange={e => setBlockCount(Number(e.target.value))}
                  >
                    {BLOCK_COUNT_OPTIONS.map(num => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Interval */}
                <div className="tpl-builder-field">
                  <label htmlFor="tpl-select-interval" className="tpl-builder-label">
                    {t.sdb_tpl_interval}
                  </label>
                  <select
                    id="tpl-select-interval"
                    className="tpl-builder-select"
                    value={intervalMinutes}
                    onChange={e => setIntervalMinutes(Number(e.target.value))}
                  >
                    {SCHEDULE_INTERVAL_OPTIONS.map(opt => {
                      const hoursLabel = opt.hours === 1
                        ? t.sdb_qb_hour_unit_singular || '1 hour'
                        : opt.hours === 0.5
                        ? '30 min'
                        : opt.hours === 0.75
                        ? '45 min'
                        : (t.sdb_qb_hours_unit || '{hours} hours').replace('{hours}', String(opt.hours));
                      return (
                        <option key={opt.minutes} value={opt.minutes}>
                          {hoursLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Generated Schedule Preview */}
              <div className="tpl-builder-preview-box">
                <div className="tpl-builder-preview-label">{t.sdb_tpl_preview_times}:</div>
                {isOverflow ? (
                  <p className="tpl-builder-overflow-msg">⚠️ {t.sdb_tpl_overflow_warning}</p>
                ) : (
                  <div className="tpl-builder-times-row">
                    {generatedResult.blocks.map((block, idx) => (
                      <span key={idx} className="tpl-builder-time-chip" id={`tpl-time-chip-${idx}`}>
                        {block.startTime}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="tpl-modal-actions">
              <button
                id="btn-tpl-apply-trigger"
                type="button"
                className="tpl-btn tpl-btn--primary"
                onClick={handleApplyClick}
                disabled={isOverflow}
              >
                ✓ {t.sdb_tpl_apply_to_day.replace('{day}', resolvedDayName).toUpperCase()}
              </button>
              <button
                id="btn-tpl-back-to-list"
                type="button"
                className="tpl-btn tpl-btn--cancel"
                onClick={() => setView('list')}
              >
                ← {t.sdb_templates}
              </button>
            </div>
          </div>
        )}

        {/* ── View 3: Confirmation Dialog (Replace Selected Day Plan) ── */}
        {view === 'confirm' && selectedTemplate && (
          <div className="tpl-confirm-body" role="alertdialog" aria-labelledby="tpl-confirm-title">
            <div className="tpl-confirm-icon-wrap">
              <span className="tpl-confirm-icon">⚠️</span>
            </div>

            <h2 id="tpl-confirm-title" className="tpl-confirm-title">
              {t.sdb_tpl_btn_replace_day}
            </h2>
            <p className="tpl-confirm-desc">
              {t.sdb_tpl_replace_day_confirm.replace('{day}', resolvedDayName)}
            </p>

            <div className="tpl-confirm-actions">
              <button
                id="btn-tpl-confirm-replace"
                type="button"
                className="tpl-btn tpl-btn--replace"
                onClick={handleConfirmApply}
              >
                ↻ {t.sdb_tpl_btn_replace_day}
              </button>
              <button
                id="btn-tpl-confirm-cancel"
                type="button"
                className="tpl-btn tpl-btn--cancel"
                onClick={() => setView('preview')}
              >
                {t.sdb_qb_btn_cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
