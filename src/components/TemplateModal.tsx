import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import type { DietTemplate, DietTemplateCategory } from '../data/dietTemplates';
import { DIET_TEMPLATES } from '../data/dietTemplates';
import type { DayKey } from '../utils/dietStorage';
import './TemplateModal.css';

export interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: DietTemplate) => void;
  selectedDayKey?: DayKey;
  selectedDayName?: string;
  hasExistingDayBlocks?: boolean;
}

type ModalView = 'list' | 'preview' | 'confirm';

export default function TemplateModal({
  isOpen,
  onClose,
  onApply,
  selectedDayKey = 'mon',
  selectedDayName,
  hasExistingDayBlocks = false,
}: TemplateModalProps) {
  const { t } = useTranslation();

  const [activeCategory, setActiveCategory] = useState<DietTemplateCategory>('unstructured');
  const [selectedTemplate, setSelectedTemplate] = useState<DietTemplate | null>(null);
  const [view, setView] = useState<ModalView>('list');
  const modalRef = useRef<HTMLDivElement>(null);

  const resolvedDayName =
    selectedDayName ||
    (t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string | undefined) ||
    'Monday';

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setActiveCategory('unstructured');
      setSelectedTemplate(null);
      setView('list');
    }
  }, [isOpen]);

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

  const handleSelectTemplate = (tpl: DietTemplate) => {
    setSelectedTemplate(tpl);
    setView('preview');
  };

  const handleApplyClick = () => {
    if (!selectedTemplate) return;
    if (hasExistingDayBlocks) {
      setView('confirm');
    } else {
      handleConfirmApply();
    }
  };

  const handleConfirmApply = () => {
    if (!selectedTemplate) return;
    onApply(selectedTemplate);
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

            {/* Target Day Indicator Banner */}
            <div className="tpl-target-day-banner">
              <span className="tpl-target-day-icon">📅</span>
              <span className="tpl-target-day-text">
                {t.sdb_tpl_apply_to_day.replace('{day}', resolvedDayName)}
              </span>
            </div>

            {/* Category tabs */}
            <div className="tpl-category-tabs" role="tablist" aria-label={t.sdb_templates}>
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

            <div className="tpl-modal-actions">
              <button
                id="btn-tpl-apply-trigger"
                type="button"
                className="tpl-btn tpl-btn--primary"
                onClick={handleApplyClick}
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
