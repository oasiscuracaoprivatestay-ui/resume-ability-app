import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import TermHelp from '../components/TermHelp';
import {
  saveWeeklyDiet,
  loadDietStore,
  getActiveProfile,
  setActiveProfile,
  createCustomProfile,
  updateCustomProfile,
  deleteCustomProfile,
  getGoalDisplayName,
  getGoalDisplayDescription,
  getDayPlan,
  updateDayPlan,
  setDayMode,
  copyDayPlan,
  getLocalTodayKey,
  getLocalDateKey,
  generateBlockId,
  isOvernightBlock,
  sortBlocks,
  DAY_KEYS,
  calculateShiftedEndTime,
  snapshotHistoryDate,
} from '../utils/dietStorage';
import type {
  DayKey,
  DayMode,
  StructuredDietBlock,
  WeeklyStructuredDiet,
  StructureDietStore,
  StructureGoalProfile,
} from '../utils/dietStorage';
import {
  getDailyDietVerification,
  loadAllDietVerifications,
  saveBlockVerification,
  clearBlockVerification,
  toggleBlockResumed,
  getDailyVerificationStats,
  ON_TRACK_OUTCOMES,
  SLIP_OUTCOMES,
} from '../utils/dietVerificationStorage';
import {
  type StructureTimePeriod,
  getAwarenessSummary,
} from '../utils/dietStructureAnalytics';
import { playFeedback } from '../utils/feedback';
import type {
  DietBlockVerification,
  DailyDietVerification,
  DetailedBlockOutcome,
  DietVerificationStatus,
} from '../utils/dietVerificationStorage';
import {
  BLOCK_TYPE_KEYS,
  BLOCK_TYPE_ICONS,
  FOOD_OPTION_KEYS,
  FOOD_CATEGORY_KEYS,
  FOOD_CATEGORY_ICONS,
  TIME_SLOTS,
  formatTime,
  mapLegacyItemsToCategories,
} from '../data/dietData';
import type { BlockTypeKey, FoodCategoryKey } from '../data/dietData';
import QuickBuildModal from '../components/QuickBuildModal';
import TemplateModal from '../components/TemplateModal';
import type { DietTemplate } from '../data/dietTemplates';
import { applyDailyTemplateToDay } from '../data/dietTemplates';
import { hasCompletedDailyReview } from '../utils/dailyReviewStorage';
import { recordScoreEvent } from '../utils/scoringEngine';
import {
  type FoodPhotoMetadata,
  saveFoodPhoto,
  getFoodPhoto,
  getPhotoDataUrlSync,
  deleteFoodPhoto,
  preloadPhotos,
  isPhotoReferenced,
} from '../utils/photoStorage';
import './StructuredDietScreen.css';

interface StructuredDietScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

// ── Food Photo Preview Modal (Phase 6) ─────────────────────────────────────────

interface PhotoPreviewModalProps {
  photoUrl: string;
  title?: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function PhotoPreviewModal({ photoUrl, title, onClose, t }: PhotoPreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="sdb-photo-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.sdb_photo_preview_title}
    >
      <div className="sdb-photo-modal-content" onClick={e => e.stopPropagation()}>
        <div className="sdb-photo-modal-header">
          <span className="sdb-photo-modal-title">{title || t.sdb_food_photo}</span>
          <button
            type="button"
            className="sdb-photo-modal-close"
            onClick={onClose}
            aria-label={t.sdb_close_preview}
          >
            ✕
          </button>
        </div>
        <div className="sdb-photo-modal-body">
          <img src={photoUrl} alt={title || t.sdb_food_photo} className="sdb-photo-modal-img" />
        </div>
        <div className="sdb-photo-modal-footer">
          <button type="button" className="sdb-btn sdb-btn--cancel" onClick={onClose}>
            {t.sdb_close_preview}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Block editor modal ─────────────────────────────────────────────────────────

interface BlockEditorProps {
  initial: StructuredDietBlock | null; // null = new block
  onSave: (block: StructuredDietBlock) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockEditor({ initial, onSave, onCancel, t }: BlockEditorProps) {
  const getDefaultTimes = () => {
    const now = new Date();
    const h = now.getHours();
    const rawM = now.getMinutes();
    let m = '00';
    if (rawM >= 45) m = '45';
    else if (rawM >= 30) m = '30';
    else if (rawM >= 15) m = '15';
    else m = '00';
    const start = `${String(h).padStart(2, '0')}:${m}`;
    const nextH = (h + 1) % 24;
    const end = `${String(nextH).padStart(2, '0')}:${m}`;
    return { start, end };
  };

  const defaultTimes = getDefaultTimes();
  const [startTime, setStartTime] = useState(initial?.startTime ?? defaultTimes.start);
  const [endTime, setEndTime]     = useState(initial?.endTime   ?? defaultTimes.end);
  const [type, setType]           = useState<string>(initial?.type ?? 'breakfast');
  const [items, setItems]         = useState<string[]>(initial?.items ?? []);
  const [foodCategories, setFoodCategories] = useState<FoodCategoryKey[]>(() => {
    if (initial?.foodCategories && initial.foodCategories.length > 0) {
      return [...initial.foodCategories];
    }
    if (initial?.items && initial.items.length > 0) {
      return mapLegacyItemsToCategories(initial.items);
    }
    return [];
  });
  const [customText, setCustomText] = useState(initial?.customText ?? '');
  const [foodPhoto, setFoodPhoto] = useState<FoodPhotoMetadata | undefined>(initial?.foodPhoto);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(() => {
    if (initial?.foodPhoto?.id) {
      return getPhotoDataUrlSync(initial.foodPhoto.id);
    }
    return null;
  });
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError]         = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isSubscribed = true;
    if (initial?.foodPhoto?.id && !photoPreviewUrl) {
      getFoodPhoto(initial.foodPhoto.id).then(record => {
        if (isSubscribed && record?.dataUrl) {
          setPhotoPreviewUrl(record.dataUrl);
        }
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [initial?.foodPhoto?.id, photoPreviewUrl]);

  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setPhotoError(t.sdb_err_process_photo);
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError('');

    try {
      const meta = await saveFoodPhoto(file);
      const dataUrl = getPhotoDataUrlSync(meta.id);
      setFoodPhoto(meta);
      setPhotoPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Error saving photo:', err);
      setPhotoError(t.sdb_err_save_photo);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setFoodPhoto(undefined);
    setPhotoPreviewUrl(null);
  };

  // Trap focus inside modal
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('select,input,button');
    first?.focus();
  }, []);

  const toggleCategory = (key: FoodCategoryKey) => {
    setFoodCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

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
      foodCategories,
      foodPhoto,
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

          {/* ── Food Categories (Primary Quick Food Classification) ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_categories_label}</label>
            <div className="sdb-food-grid">
              {FOOD_CATEGORY_KEYS.map(key => {
                const isSelected = foodCategories.includes(key);
                return (
                  <button
                    key={key}
                    id={`btn-cat-chip-${key}`}
                    type="button"
                    className={`sdb-food-chip ${isSelected ? 'sdb-food-chip--active sdb-cat-chip--active' : ''}`}
                    onClick={() => toggleCategory(key)}
                    aria-pressed={isSelected}
                  >
                    <span className="sdb-chip-icon">{FOOD_CATEGORY_ICONS[key]}</span>
                    <span>{t[`sdb_cat_${key}` as keyof typeof t] as string}</span>
                  </button>
                );
              })}
            </div>
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

          {/* ── Food / Beverage Photo Attachment (Phase 6) ── */}
          <div className="sdb-field sdb-photo-field">
            <label className="sdb-label sdb-label--optional">
              <span>📷 {t.sdb_food_photo}</span>
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>

            <input
              ref={fileInputRef}
              id="sdb-photo-file-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoFileSelect}
            />

            {photoPreviewUrl ? (
              <div className="sdb-photo-preview-box">
                <img
                  src={photoPreviewUrl}
                  alt={t.sdb_food_photo}
                  className="sdb-photo-preview-img"
                />
                <div className="sdb-photo-actions-row">
                  <button
                    id="btn-replace-photo"
                    type="button"
                    className="sdb-btn-photo-action sdb-btn-photo-replace"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                  >
                    🔄 {t.sdb_replace_photo}
                  </button>
                  <button
                    id="btn-remove-photo"
                    type="button"
                    className="sdb-btn-photo-action sdb-btn-photo-remove"
                    onClick={handleRemovePhoto}
                    disabled={isProcessingPhoto}
                  >
                    🗑 {t.sdb_remove_photo}
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="btn-add-food-photo"
                type="button"
                className="sdb-btn-add-photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
              >
                <span>📷</span>
                <span>{isProcessingPhoto ? '...' : t.sdb_add_food_photo}</span>
              </button>
            )}

            {photoError && <p className="sdb-photo-error-msg" role="alert">{photoError}</p>}
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
  initialOutcome?: DetailedBlockOutcome;
  initialResumed?: boolean;
  initialActualItems?: string[];
  initialActualCategories?: FoodCategoryKey[];
  initialCustomText?: string;
  onSave: (
    actualItems: string[],
    customText: string,
    outcome?: DetailedBlockOutcome,
    isResumed?: boolean,
    actualCategories?: FoodCategoryKey[]
  ) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const SLIP_NOTE_KEYS = [
  'ate_off_plan',
  'late_night',
  'social_meal',
  'stress_eating',
  'extra_portion',
  'skipped_meal',
] as const;

function DietSlipModal({
  block,
  initialOutcome,
  initialResumed = false,
  initialActualItems = [],
  initialActualCategories,
  initialCustomText = '',
  onSave,
  onCancel,
  t,
}: DietSlipModalProps) {
  const [outcome, setOutcome] = useState<DetailedBlockOutcome>(() =>
    initialOutcome && (SLIP_OUTCOMES as readonly string[]).includes(initialOutcome)
      ? initialOutcome
      : 'structured_slip'
  );
  const [isResumed, setIsResumed] = useState<boolean>(initialResumed);
  const [actualItems, setActualItems] = useState<string[]>(initialActualItems);
  const [actualCategories, setActualCategories] = useState<FoodCategoryKey[]>(() => {
    if (initialActualCategories && initialActualCategories.length > 0) {
      return [...initialActualCategories];
    }
    if (block.foodCategories && block.foodCategories.length > 0) {
      return [...block.foodCategories];
    }
    if (block.items && block.items.length > 0) {
      return mapLegacyItemsToCategories(block.items);
    }
    return [];
  });
  const [customText, setCustomText] = useState(initialCustomText);
  const [selectedNotes, setSelectedNotes] = useState<string[]>(() => {
    const lower = initialCustomText.toLowerCase();
    return SLIP_NOTE_KEYS.filter(k => {
      const lbl = (t[`sdb_note_${k}` as keyof typeof t] as string | undefined)?.toLowerCase();
      return lbl && lower.includes(lbl);
    });
  });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const toggleCategory = (key: FoodCategoryKey) => {
    setActualCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const toggleItem = (key: string) => {
    setActualItems(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const toggleNote = (noteKey: string) => {
    const label = (t[`sdb_note_${noteKey}` as keyof typeof t] as string) || noteKey;
    setSelectedNotes(prev => {
      const isSelected = prev.includes(noteKey);
      const next = isSelected ? prev.filter(k => k !== noteKey) : [...prev, noteKey];

      setCustomText(current => {
        let items = current ? current.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (isSelected) {
          items = items.filter(item => item.toLowerCase() !== label.toLowerCase());
        } else {
          if (!items.some(item => item.toLowerCase() === label.toLowerCase())) {
            items.push(label);
          }
        }
        return items.join(', ');
      });

      return next;
    });
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

          {/* Detailed Outcome Selector (Labels only) */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_select_outcome}:</label>
            <div className="sdb-outcome-modal-grid">
              {SLIP_OUTCOMES.map(key => {
                const label = (t[`sdb_outcome_${key}` as keyof typeof t] as string) || key;
                const isSelected = outcome === key;
                return (
                  <button
                    key={key}
                    id={`btn-modal-outcome-${key}`}
                    type="button"
                    className={`sdb-outcome-chip sdb-outcome-chip--slip ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                    onClick={() => setOutcome(key)}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumed Toggle / Checkbox */}
          <div className="sdb-field sdb-field--resumed">
            <button
              id="btn-modal-toggle-resumed"
              type="button"
              className={`sdb-resumed-toggle-btn ${isResumed ? 'sdb-resumed-toggle-btn--active' : ''}`}
              onClick={() => setIsResumed(prev => !prev)}
              aria-pressed={isResumed}
            >
              <span className="sdb-resumed-toggle-icon">{isResumed ? '✓' : '⟲'}</span>
              <span className="sdb-resumed-toggle-text">
                {isResumed ? t.sdb_marked_resumed : t.sdb_mark_resumed}
              </span>
            </button>
          </div>

          {/* Food Categories Consumed */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_categories_label} (optional):</label>
            <div className="sdb-food-grid">
              {FOOD_CATEGORY_KEYS.map(key => {
                const isSelected = actualCategories.includes(key);
                return (
                  <button
                    key={key}
                    id={`btn-slip-cat-${key}`}
                    type="button"
                    className={`sdb-food-chip ${isSelected ? 'sdb-food-chip--active sdb-cat-chip--active' : ''}`}
                    onClick={() => toggleCategory(key)}
                    aria-pressed={isSelected}
                  >
                    <span className="sdb-chip-icon">{FOOD_CATEGORY_ICONS[key]}</span>
                    <span>{t[`sdb_cat_${key}` as keyof typeof t] as string}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
                  aria-pressed={actualItems.includes(key)}
                >
                  {t[`sdb_food_${key}` as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>

          {/* Selectable notes chips */}
          <div className="sdb-field">
            <label className="sdb-label">Quick Notes / Tags (tap to toggle):</label>
            <div className="sdb-food-grid">
              {SLIP_NOTE_KEYS.map(key => {
                const isSelected = selectedNotes.includes(key);
                return (
                  <button
                    key={key}
                    id={`btn-slip-note-${key}`}
                    type="button"
                    className={`sdb-food-chip ${isSelected ? 'sdb-food-chip--active' : ''}`}
                    onClick={() => toggleNote(key)}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {t[`sdb_note_${key}` as keyof typeof t] as string}
                  </button>
                );
              })}
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
            onClick={() => onSave(actualItems, customText, outcome, isResumed, actualCategories)}
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
  onVerifyOutcome?: (outcome: DetailedBlockOutcome, status: DietVerificationStatus) => void;
  onToggleResumed?: () => void;
  onVerifyOnTrack?: () => void;
  onOpenSlipModal?: (outcome?: DetailedBlockOutcome) => void;
  onClearStatus?: () => void;
  onNavigate?: (screen: Screen) => void;
  onQuickUpdateTime?: (startTime: string, endTime: string) => void;
  onQuickUpdateDescription?: (customText: string) => void;
  onQuickUpdateCategories?: (foodCategories: FoodCategoryKey[]) => void;
  onPreviewPhoto?: (photoUrl: string, title?: string) => void;
}

function BlockCard({
  block,
  onEdit,
  onDelete,
  t,
  isToday,
  verification,
  onVerifyOutcome,
  onToggleResumed,
  onVerifyOnTrack,
  onOpenSlipModal,
  onClearStatus,
  onNavigate,
  onQuickUpdateTime,
  onQuickUpdateDescription,
  onQuickUpdateCategories,
  onPreviewPhoto,
}: BlockCardProps) {
  const typeKey = block.type as BlockTypeKey;
  const icon = BLOCK_TYPE_ICONS[typeKey] ?? '🍽️';
  const typeName = (t[`sdb_type_${block.type}` as keyof typeof t] as string | undefined) ?? block.type;
  const overnight = isOvernightBlock(block);

  // Photo state (Phase 6)
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    if (!block.foodPhoto?.id) return null;
    return getPhotoDataUrlSync(block.foodPhoto.id);
  });

  useEffect(() => {
    let isSubscribed = true;
    if (!block.foodPhoto?.id) {
      setPhotoUrl(null);
      return;
    }
    const sync = getPhotoDataUrlSync(block.foodPhoto.id);
    if (sync) {
      setPhotoUrl(sync);
      return;
    }
    getFoodPhoto(block.foodPhoto.id).then(record => {
      if (isSubscribed && record?.dataUrl) {
        setPhotoUrl(record.dataUrl);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [block.foodPhoto?.id]);

  // Determine meal description:
  // Use custom description/text if present; otherwise fall back to localized meal type name.
  const rawCustom = block.customText?.trim() ?? '';
  const translatedCustom = rawCustom
    ? ((t[rawCustom as keyof typeof t] as string | undefined) ?? rawCustom)
    : '';
  const initialMealDescription = translatedCustom.trim() || typeName;

  const [desc, setDesc] = useState(initialMealDescription);
  const [activePicker, setActivePicker] = useState<'none' | 'on_track' | 'slip'>('none');
  const [isChanging, setIsChanging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDesc(initialMealDescription);
  }, [initialMealDescription, block.id]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
    }
  }, [desc]);

  const saveDescription = (val: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const trimmed = val.trim();
    if (trimmed !== (block.customText ?? '')) {
      onQuickUpdateDescription?.(trimmed);
    }
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDesc(nextVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveDescription(nextVal);
    }, 400);
  };

  const handleDescBlur = () => {
    saveDescription(desc);
  };

  const handleStartTimeChange = (newStart: string) => {
    const newEnd = calculateShiftedEndTime(newStart, block.startTime, block.endTime);
    onQuickUpdateTime?.(newStart, newEnd);
  };

  const handleEndTimeChange = (newEnd: string) => {
    onQuickUpdateTime?.(block.startTime, newEnd);
  };

  const handleRemoveCategory = (catKey: FoodCategoryKey, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickUpdateCategories) {
      const next = blockCategories.filter(c => c !== catKey);
      onQuickUpdateCategories(next);
    }
  };

  // Food categories calculation (Phase 2)
  const blockCategories: FoodCategoryKey[] = Array.isArray(block.foodCategories) && block.foodCategories.length > 0
    ? block.foodCategories
    : (Array.isArray(block.items) ? mapLegacyItemsToCategories(block.items) : []);

  // Build secondary food items list without duplicating the primary meal description or categories
  const foodLabels = (block.items || [])
    .filter(key => !(FOOD_CATEGORY_KEYS as readonly string[]).includes(key))
    .map(key => (t[`sdb_food_${key}` as keyof typeof t] as string | undefined) ?? key)
    .filter(label => label.trim().toLowerCase() !== desc.trim().toLowerCase());

  // Determine display label for verified banner
  const verifiedBadgeLabel = (() => {
    if (!verification) return '';
    if (verification.detailedOutcome) {
      const label = t[`sdb_outcome_${verification.detailedOutcome}` as keyof typeof t] as string | undefined;
      if (label) {
        return verification.status === 'on-track' ? `✓ ${label}` : `⚠ ${label}`;
      }
    }
    // Backward compatibility with legacy records
    return verification.status === 'on-track' ? `✓ ${t.sdb_v_on_track}` : `⚠ ${t.sdb_v_slip_reported}`;
  })();

  const handleSelectOutcome = (outcome: DetailedBlockOutcome, status: DietVerificationStatus) => {
    if (onVerifyOutcome) {
      onVerifyOutcome(outcome, status);
    } else if (status === 'on-track') {
      onVerifyOnTrack?.();
    } else {
      onOpenSlipModal?.(outcome);
    }
    setActivePicker('none');
    setIsChanging(false);
  };

  const isSlipRecord = verification?.status === 'slip' ||
    (verification?.detailedOutcome && (SLIP_OUTCOMES as readonly string[]).includes(verification.detailedOutcome));

  return (
    <div className={`sdb-block-card ${verification?.status ? `sdb-block-card--${verification.status}` : ''}`}>
      <div className="sdb-block-time-row">
        <div className="sdb-block-time-quick-edit">
          <select
            id={`select-block-start-${block.id}`}
            className="sdb-block-time-select"
            value={block.startTime}
            onChange={e => handleStartTimeChange(e.target.value)}
            aria-label={`${t.sdb_start_time}: ${desc}`}
          >
            {TIME_SLOTS.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="sdb-block-time-sep" aria-hidden="true">→</span>
          <select
            id={`select-block-end-${block.id}`}
            className="sdb-block-time-select"
            value={block.endTime}
            onChange={e => handleEndTimeChange(e.target.value)}
            aria-label={`${t.sdb_end_time}: ${desc}`}
          >
            {TIME_SLOTS.map(s => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {overnight && <span className="sdb-block-overnight">{' '}({t.sdb_next_day})</span>}
        </div>
        <div className="sdb-block-actions">
          <button
            className="sdb-icon-btn sdb-icon-btn--delete"
            onClick={onDelete}
            aria-label={`${t.commit_delete}: ${desc}`}
            title={t.commit_delete}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="sdb-block-desc-row">
        {photoUrl ? (
          <button
            type="button"
            id={`btn-photo-thumb-${block.id}`}
            className="sdb-block-photo-thumb-btn"
            onClick={() => onPreviewPhoto?.(photoUrl, desc)}
            aria-label={`${t.sdb_view_photo}: ${desc}`}
            title={t.sdb_view_photo}
          >
            <img
              src={photoUrl}
              alt={desc || t.sdb_food_photo}
              className="sdb-block-photo-thumb"
            />
          </button>
        ) : (
          <span className="sdb-block-icon" aria-hidden="true">{icon}</span>
        )}
        <div className="sdb-block-desc-wrap">
          <div className="sdb-block-desc-input-container">
            <span className="sdb-block-desc-sizer" aria-hidden="true">
              {desc || t.sdb_custom_placeholder || 'Meal description...'}
            </span>
            <textarea
              ref={textareaRef}
              id={`input-block-desc-${block.id}`}
              className="sdb-block-meal-desc-input"
              value={desc}
              onChange={handleDescChange}
              onBlur={handleDescBlur}
              placeholder={t.sdb_custom_placeholder || 'Meal description...'}
              rows={1}
              aria-label={`${t.sdb_custom_label}: ${desc}`}
            />
          </div>
          <button
            type="button"
            id={`btn-edit-desc-${block.id}`}
            className="sdb-block-desc-edit-btn"
            onClick={() => {
              const el = textareaRef.current;
              if (el) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
              }
            }}
            aria-label={`${t.commit_edit || 'Edit'}: ${desc}`}
            title={t.commit_edit || 'Edit'}
          >
            ✎
          </button>
        </div>
      </div>

      <div className="sdb-block-customize-row">
        <button
          id={`btn-customize-block-${block.id}`}
          type="button"
          className="sdb-customize-btn"
          onClick={onEdit}
          aria-label={`${t.sdb_btn_customize}: ${desc}`}
        >
          <span className="sdb-customize-icon" aria-hidden="true">✎</span>
          <span>{t.sdb_btn_customize}</span>
        </button>
      </div>

      {blockCategories.length > 0 && (
        <div className="sdb-block-categories-row" aria-label={t.sdb_food_categories_label}>
          {blockCategories.map(catKey => {
            const catLabel = (t[`sdb_cat_${catKey}` as keyof typeof t] as string | undefined) ?? catKey;
            const catIcon = FOOD_CATEGORY_ICONS[catKey] ?? '•';
            return (
              <span key={catKey} className="sdb-cat-badge">
                <span className="sdb-cat-badge-icon" aria-hidden="true">{catIcon}</span>
                <span className="sdb-cat-badge-label">{catLabel}</span>
                {onQuickUpdateCategories && (
                  <button
                    type="button"
                    className="sdb-cat-badge-remove"
                    onClick={(e) => handleRemoveCategory(catKey, e)}
                    aria-label={`Remove ${catLabel}`}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {foodLabels.length > 0 && (
        <p className="sdb-block-items">{foodLabels.join(', ')}</p>
      )}

      {/* ── Today Daily Verification Controls ── */}
      {isToday && (
        <div className="sdb-verification-box">
          {/* Selected Status Visual Banner if verified and not actively changing */}
          {verification && !isChanging && (
            <div className={`sdb-verified-status-banner sdb-verified-status-banner--${verification.status}`}>
              <div className="sdb-verified-badge-top">
                <span className="sdb-verified-badge-label" id={`verified-badge-label-${block.id}`}>
                  {verifiedBadgeLabel}
                </span>
                <div className="sdb-verified-controls">
                  <button
                    id={`btn-change-status-${block.id}`}
                    type="button"
                    className="sdb-verified-link sdb-verified-link--change"
                    onClick={() => {
                      setIsChanging(true);
                      setActivePicker('none');
                    }}
                  >
                    {t.sdb_v_change_status}
                  </button>
                  <span className="sdb-verified-ctrl-dot">·</span>
                  <button
                    id={`btn-clear-status-${block.id}`}
                    type="button"
                    className="sdb-verified-link sdb-verified-link--clear"
                    onClick={() => {
                      setIsChanging(false);
                      setActivePicker('none');
                      onClearStatus?.();
                    }}
                  >
                    {t.sdb_v_clear_status}
                  </button>
                </div>
              </div>

              {/* Resumed Toggle Button for any Slip record */}
              {isSlipRecord && (
                <div className="sdb-resumed-row">
                  <button
                    id={`btn-toggle-resumed-${block.id}`}
                    type="button"
                    className={`sdb-resumed-toggle-btn ${verification.isResumed ? 'sdb-resumed-toggle-btn--active' : ''}`}
                    onClick={onToggleResumed}
                    aria-pressed={!!verification.isResumed}
                  >
                    <span className="sdb-resumed-toggle-icon" aria-hidden="true">
                      {verification.isResumed ? '✓' : '⟲'}
                    </span>
                    <span className="sdb-resumed-toggle-text">
                      {verification.isResumed ? t.sdb_marked_resumed : t.sdb_mark_resumed}
                    </span>
                  </button>
                </div>
              )}

              {/* If Slip, show actual consumed details */}
              {verification.status === 'slip' && (verification.actualItems?.length || verification.actualCustomText) && (
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

              {/* Edit Slip details link */}
              {verification.status === 'slip' && (
                <div className="sdb-slip-details-edit-row">
                  <button
                    id={`btn-edit-slip-details-${block.id}`}
                    type="button"
                    className="sdb-slip-details-link"
                    onClick={() => onOpenSlipModal?.(verification.detailedOutcome)}
                  >
                    ✎ {verification.actualItems?.length || verification.actualCustomText ? t.commit_edit || 'Edit details' : t.sdb_v_what_had || 'Add details'}
                  </button>
                </div>
              )}

              {/* Practice Resume-Ability secondary link */}
              {verification.status === 'slip' && onNavigate && (
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

          {/* Outcome Selection Flow: Level 1 (On Track / Slip) & Level 2 (Detailed Outcome Labels) */}
          {(!verification || isChanging) && (
            <div className="sdb-verify-actions">
              {!verification && activePicker === 'none' && (
                <span className="sdb-verify-status-label">{t.sdb_v_not_reported}</span>
              )}

              {isChanging && activePicker === 'none' && (
                <div className="sdb-change-header-row">
                  <span className="sdb-change-header-title">{t.sdb_select_outcome}</span>
                  <button
                    type="button"
                    className="sdb-change-cancel-btn"
                    onClick={() => {
                      setIsChanging(false);
                      setActivePicker('none');
                    }}
                    aria-label={t.commit_cancel}
                    title={t.commit_cancel}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Level 1: Quick Choice (ON TRACK vs SLIP) */}
              {activePicker === 'none' && (
                <div className="sdb-verify-btn-group">
                  <button
                    id={`btn-verify-ontrack-${block.id}`}
                    type="button"
                    className={`sdb-verify-btn sdb-verify-btn--ontrack ${verification?.status === 'on-track' ? 'sdb-verify-btn--active' : ''}`}
                    onClick={() => setActivePicker('on_track')}
                    aria-pressed={verification?.status === 'on-track'}
                  >
                    ✓ {t.sdb_v_on_track}
                  </button>
                  <button
                    id={`btn-verify-slip-${block.id}`}
                    type="button"
                    className={`sdb-verify-btn sdb-verify-btn--slip ${verification?.status === 'slip' ? 'sdb-verify-btn--active' : ''}`}
                    onClick={() => setActivePicker('slip')}
                    aria-pressed={verification?.status === 'slip'}
                  >
                    ⚠ {t.sdb_v_slip}
                  </button>
                </div>
              )}

              {/* Level 2: ON TRACK Detailed Outcomes (Labels only) */}
              {activePicker === 'on_track' && (
                <div className="sdb-outcome-picker-wrap" id={`outcome-picker-ontrack-${block.id}`}>
                  <div className="sdb-outcome-picker-top">
                    <button
                      type="button"
                      id={`btn-outcome-back-${block.id}`}
                      className="sdb-outcome-back-btn"
                      onClick={() => setActivePicker('none')}
                      aria-label={t.global_back || 'Back'}
                      title={t.global_back || 'Back'}
                    >
                      ←
                    </button>
                    <span className="sdb-outcome-picker-title">{t.sdb_v_on_track}</span>
                    {isChanging && (
                      <button
                        type="button"
                        className="sdb-change-cancel-btn"
                        onClick={() => {
                          setIsChanging(false);
                          setActivePicker('none');
                        }}
                        aria-label={t.commit_cancel}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="sdb-outcome-chips-grid">
                    {ON_TRACK_OUTCOMES.map(key => {
                      const label = (t[`sdb_outcome_${key}` as keyof typeof t] as string) || key;
                      const isSelected = verification?.detailedOutcome === key;
                      return (
                        <button
                          key={key}
                          id={`btn-outcome-${key}-${block.id}`}
                          type="button"
                          className={`sdb-outcome-chip sdb-outcome-chip--ontrack ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                          onClick={() => handleSelectOutcome(key, 'on-track')}
                        >
                          {isSelected ? '✓ ' : ''}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Level 2: SLIP Detailed Outcomes (Labels only) */}
              {activePicker === 'slip' && (
                <div className="sdb-outcome-picker-wrap" id={`outcome-picker-slip-${block.id}`}>
                  <div className="sdb-outcome-picker-top">
                    <button
                      type="button"
                      id={`btn-outcome-back-${block.id}`}
                      className="sdb-outcome-back-btn"
                      onClick={() => setActivePicker('none')}
                      aria-label={t.global_back || 'Back'}
                      title={t.global_back || 'Back'}
                    >
                      ←
                    </button>
                    <span className="sdb-outcome-picker-title">{t.sdb_v_slip}</span>
                    {isChanging && (
                      <button
                        type="button"
                        className="sdb-change-cancel-btn"
                        onClick={() => {
                          setIsChanging(false);
                          setActivePicker('none');
                        }}
                        aria-label={t.commit_cancel}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="sdb-outcome-chips-grid">
                    {SLIP_OUTCOMES.map(key => {
                      const label = (t[`sdb_outcome_${key}` as keyof typeof t] as string) || key;
                      const isSelected = verification?.detailedOutcome === key;
                      return (
                        <button
                          key={key}
                          id={`btn-outcome-${key}-${block.id}`}
                          type="button"
                          className={`sdb-outcome-chip sdb-outcome-chip--slip ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                          onClick={() => handleSelectOutcome(key, 'slip')}
                        >
                          {isSelected ? '⚠ ' : ''}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
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

// ── Profile Modals (Phase 26) ───────────────────────────────────────────────

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  activeProfileId: string;
  profiles: StructureGoalProfile[];
  onSelectProfile: (id: string) => void;
  onOpenCreate: () => void;
  onOpenEdit: (p: StructureGoalProfile) => void;
  onOpenDelete: (p: StructureGoalProfile) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function ProfileSwitcherModal({
  isOpen,
  activeProfileId,
  profiles,
  onSelectProfile,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
  onClose,
  t,
}: ProfileSwitcherModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const builtInProfiles = profiles.filter(p => p.type === 'builtin');
  const customProfiles = profiles.filter(p => p.type === 'custom');

  return (
    <div
      className="sdb-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-profile-switcher-title"
    >
      <div className="sdb-modal sdb-profile-modal" ref={modalRef} role="document">
        <div className="sdb-modal-header">
          <div className="sdb-profile-modal-header-title">
            <span className="sdb-modal-icon">🎯</span>
            <h2 id="sdb-profile-switcher-title" className="sdb-modal-title">
              {t.sdb_profile_modal_title}
            </h2>
          </div>
          <button
            id="btn-close-profile-modal"
            type="button"
            className="sdb-modal-close"
            onClick={onClose}
            aria-label={t.commit_cancel}
          >
            ✕
          </button>
        </div>

        <div className="sdb-modal-body sdb-profile-modal-body">
          {/* Built-in Profiles Section */}
          <div className="sdb-profile-section">
            <h3 className="sdb-profile-section-title">
              <span>🌟</span>
              <span>{t.sdb_profile_builtin_section}</span>
            </h3>
            <div className="sdb-profile-list">
              {builtInProfiles.map(p => {
                const isActive = p.id === activeProfileId;
                const displayName = getGoalDisplayName(p, t);
                const displayDesc = getGoalDisplayDescription(p, t);

                return (
                  <div
                    key={p.id}
                    id={`profile-card-${p.id}`}
                    className={`sdb-profile-item ${isActive ? 'sdb-profile-item--active' : ''}`}
                  >
                    <div className="sdb-profile-item-header">
                      <div className="sdb-profile-item-title-wrap">
                        <span className="sdb-profile-item-name">{displayName}</span>
                        <span className="sdb-goal-type-badge sdb-goal-type-badge--builtin">
                          {t.sdb_profile_built_in_badge}
                        </span>
                        {isActive && (
                          <span className="sdb-profile-active-tag">
                            ✓ {t.sdb_profile_active_label}
                          </span>
                        )}
                      </div>
                      {!isActive && (
                        <button
                          id={`btn-select-profile-${p.id}`}
                          type="button"
                          className="sdb-profile-select-btn"
                          onClick={() => onSelectProfile(p.id)}
                        >
                          {t.sdb_profile_select_btn}
                        </button>
                      )}
                    </div>
                    {displayDesc && (
                      <p className="sdb-profile-item-desc">{displayDesc}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Profiles Section */}
          <div className="sdb-profile-section">
            <h3 className="sdb-profile-section-title">
              <span>✏️</span>
              <span>{t.sdb_profile_custom_section}</span>
            </h3>
            {customProfiles.length === 0 ? (
              <p className="sdb-profile-empty-hint">{t.sdb_profile_no_custom_hint}</p>
            ) : (
              <div className="sdb-profile-list">
                {customProfiles.map(p => {
                  const isActive = p.id === activeProfileId;

                  return (
                    <div
                      key={p.id}
                      id={`profile-card-${p.id}`}
                      className={`sdb-profile-item ${isActive ? 'sdb-profile-item--active' : ''}`}
                    >
                      <div className="sdb-profile-item-header">
                        <div className="sdb-profile-item-title-wrap">
                          <span className="sdb-profile-item-name">{p.name}</span>
                          <span className="sdb-goal-type-badge sdb-goal-type-badge--custom">
                            {t.sdb_profile_custom_badge}
                          </span>
                          {isActive && (
                            <span className="sdb-profile-active-tag">
                              ✓ {t.sdb_profile_active_label}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.description && (
                        <p className="sdb-profile-item-desc">{p.description}</p>
                      )}
                      <div className="sdb-profile-item-actions">
                        {!isActive && (
                          <button
                            id={`btn-select-profile-${p.id}`}
                            type="button"
                            className="sdb-profile-select-btn"
                            onClick={() => onSelectProfile(p.id)}
                          >
                            {t.sdb_profile_select_btn}
                          </button>
                        )}
                        <button
                          id={`btn-edit-profile-${p.id}`}
                          type="button"
                          className="sdb-profile-edit-btn"
                          onClick={() => onOpenEdit(p)}
                        >
                          ✎ {t.sdb_profile_edit_btn}
                        </button>
                        <button
                          id={`btn-delete-profile-${p.id}`}
                          type="button"
                          className="sdb-profile-delete-btn"
                          onClick={() => onOpenDelete(p)}
                        >
                          🗑 {t.sdb_profile_delete_btn}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="sdb-modal-footer sdb-profile-modal-footer">
          <button
            id="btn-open-create-profile"
            type="button"
            className="sdb-btn sdb-btn--primary"
            onClick={onOpenCreate}
          >
            <span>+</span>
            <span>{t.sdb_profile_create_btn}</span>
          </button>
          <button
            id="btn-close-profile-switcher"
            type="button"
            className="sdb-btn sdb-btn--cancel"
            onClick={onClose}
          >
            {t.commit_cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateProfileModalProps {
  isOpen: boolean;
  onSave: (name: string, description: string, cloneCurrent: boolean) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function CreateProfileModal({ isOpen, onSave, onClose, t }: CreateProfileModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cloneCurrent, setCloneCurrent] = useState(true);
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCloneCurrent(true);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t.sdb_profile_name_required);
      return;
    }
    onSave(cleanName, description.trim(), cloneCurrent);
  };

  return (
    <div
      className="sdb-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-create-profile-title"
    >
      <div className="sdb-modal sdb-profile-form-modal" ref={modalRef} role="document">
        <form onSubmit={handleSubmit}>
          <div className="sdb-modal-header">
            <h2 id="sdb-create-profile-title" className="sdb-modal-title">
              {t.sdb_profile_create_modal_title}
            </h2>
            <button
              id="btn-close-create-profile-modal"
              type="button"
              className="sdb-modal-close"
              onClick={onClose}
              aria-label={t.commit_cancel}
            >
              ✕
            </button>
          </div>

          <div className="sdb-modal-body">
            {error && <div className="sdb-field-error" role="alert">{error}</div>}

            <div className="sdb-field-group">
              <label htmlFor="input-create-profile-name" className="sdb-field-label">
                {t.sdb_profile_name_label} *
              </label>
              <input
                id="input-create-profile-name"
                type="text"
                className="sdb-field-input"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder={t.sdb_profile_name_placeholder}
                maxLength={60}
                autoFocus
              />
            </div>

            <div className="sdb-field-group">
              <label htmlFor="input-create-profile-desc" className="sdb-field-label">
                {t.sdb_profile_desc_label}
              </label>
              <textarea
                id="input-create-profile-desc"
                className="sdb-field-input sdb-field-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t.sdb_profile_desc_placeholder}
                maxLength={200}
                rows={3}
              />
            </div>

            <div className="sdb-profile-checkbox-wrap">
              <label className="sdb-checkbox-label">
                <input
                  id="chk-create-profile-clone"
                  type="checkbox"
                  checked={cloneCurrent}
                  onChange={e => setCloneCurrent(e.target.checked)}
                />
                <span>{t.sdb_profile_clone_from_active}</span>
              </label>
            </div>
          </div>

          <div className="sdb-modal-footer">
            <button
              id="btn-cancel-create-profile"
              type="button"
              className="sdb-btn sdb-btn--cancel"
              onClick={onClose}
            >
              {t.commit_cancel}
            </button>
            <button
              id="btn-confirm-create-profile"
              type="submit"
              className="sdb-btn sdb-btn--save"
            >
              {t.sdb_profile_create_btn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditProfileModalProps {
  profile: StructureGoalProfile | null;
  onSave: (profileId: string, name: string, description: string) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function EditProfileModal({ profile, onSave, onClose, t }: EditProfileModalProps) {
  const [name, setName] = useState(profile?.name ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [error, setError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description ?? '');
      setError('');
    }
  }, [profile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (profile) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profile, onClose]);

  if (!profile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t.sdb_profile_name_required);
      return;
    }
    onSave(profile.id, cleanName, description.trim());
  };

  return (
    <div
      className="sdb-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-edit-profile-title"
    >
      <div className="sdb-modal sdb-profile-form-modal" ref={modalRef} role="document">
        <form onSubmit={handleSubmit}>
          <div className="sdb-modal-header">
            <h2 id="sdb-edit-profile-title" className="sdb-modal-title">
              {t.sdb_profile_edit_modal_title}
            </h2>
            <button
              id="btn-close-edit-profile-modal"
              type="button"
              className="sdb-modal-close"
              onClick={onClose}
              aria-label={t.commit_cancel}
            >
              ✕
            </button>
          </div>

          <div className="sdb-modal-body">
            {error && <div className="sdb-field-error" role="alert">{error}</div>}

            <div className="sdb-field-group">
              <label htmlFor="input-edit-profile-name" className="sdb-field-label">
                {t.sdb_profile_name_label} *
              </label>
              <input
                id="input-edit-profile-name"
                type="text"
                className="sdb-field-input"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder={t.sdb_profile_name_placeholder}
                maxLength={60}
                autoFocus
              />
            </div>

            <div className="sdb-field-group">
              <label htmlFor="input-edit-profile-desc" className="sdb-field-label">
                {t.sdb_profile_desc_label}
              </label>
              <textarea
                id="input-edit-profile-desc"
                className="sdb-field-input sdb-field-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t.sdb_profile_desc_placeholder}
                maxLength={200}
                rows={3}
              />
            </div>
          </div>

          <div className="sdb-modal-footer">
            <button
              id="btn-cancel-edit-profile"
              type="button"
              className="sdb-btn sdb-btn--cancel"
              onClick={onClose}
            >
              {t.commit_cancel}
            </button>
            <button
              id="btn-confirm-edit-profile"
              type="submit"
              className="sdb-btn sdb-btn--save"
            >
              {t.commit_save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteProfileModalProps {
  profile: StructureGoalProfile | null;
  isActive: boolean;
  onConfirm: (profileId: string) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function DeleteProfileModal({
  profile,
  isActive,
  onConfirm,
  onClose,
  t,
}: DeleteProfileModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (profile) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profile, onClose]);

  if (!profile) return null;

  return (
    <div
      className="sdb-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-delete-profile-title"
    >
      <div className="sdb-modal sdb-confirm-modal" role="document">
        <div className="sdb-modal-header">
          <h2 id="sdb-delete-profile-title" className="sdb-modal-title">
            ⚠️ {t.sdb_profile_delete_confirm_title}
          </h2>
          <button
            id="btn-close-delete-profile-modal"
            type="button"
            className="sdb-modal-close"
            onClick={onClose}
            aria-label={t.commit_cancel}
          >
            ✕
          </button>
        </div>

        <div className="sdb-modal-body">
          <div className="sdb-confirm-icon">🗑️</div>
          <p className="sdb-confirm-prompt">
            <strong>{profile.name}</strong>
          </p>
          {isActive ? (
            <div className="sdb-delete-active-warning">
              <span className="sdb-warning-icon">⚠️</span>
              <p>{t.sdb_profile_delete_active_warning}</p>
            </div>
          ) : (
            <p className="sdb-confirm-prompt">{t.sdb_profile_delete_confirm}</p>
          )}
        </div>

        <div className="sdb-modal-footer">
          <button
            id="btn-cancel-delete-profile"
            type="button"
            className="sdb-btn sdb-btn--cancel"
            onClick={onClose}
          >
            {t.commit_cancel}
          </button>
          <button
            id="btn-confirm-delete-profile"
            type="button"
            className="sdb-btn sdb-btn--delete-danger"
            onClick={() => onConfirm(profile.id)}
          >
            {t.sdb_profile_delete_btn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Structure Awareness Card (Phase 3) ────────────────────────────────────────

interface StructureAwarenessCardProps {
  allVerifications: Record<string, DailyDietVerification>;
  activeProfileId: string;
  selectedPeriod: StructureTimePeriod;
  onSelectPeriod: (p: StructureTimePeriod) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function StructureAwarenessCard({
  allVerifications,
  activeProfileId,
  selectedPeriod,
  onSelectPeriod,
  t,
}: StructureAwarenessCardProps) {
  const summary = useMemo(
    () => getAwarenessSummary(allVerifications, selectedPeriod, { activeProfileId }),
    [allVerifications, selectedPeriod, activeProfileId]
  );

  const { structureStats, resumeStats, categoryStats } = summary;

  const activeCategories = useMemo(
    () => categoryStats.items.filter(item => item.count > 0),
    [categoryStats]
  );

  return (
    <div className="sdb-awareness-card" id="sdb-awareness-section">
      {/* ── Header ── */}
      <div className="sdb-awareness-header">
        <div className="sdb-awareness-titles">
          <div className="sdb-awareness-badge">
            <span>🧠</span>
            <span>{t.sdb_awareness_title}</span>
          </div>
          <h3 className="sdb-awareness-question">
            {selectedPeriod === 'today' ? t.sdb_awareness_how_structured : t.sdb_stat_eating_structure}
          </h3>
        </div>

        {/* ── Period Selector Tabs ── */}
        <div className="sdb-period-tabs" role="tablist" aria-label={t.sdb_awareness_title}>
          {(['today', '7d', '30d', 'all'] as const).map(period => (
            <button
              key={period}
              id={`btn-period-${period}`}
              type="button"
              role="tab"
              aria-selected={selectedPeriod === period}
              className={`sdb-period-tab ${selectedPeriod === period ? 'sdb-period-tab--active' : ''}`}
              onClick={() => onSelectPeriod(period)}
            >
              {period === 'today' && t.sdb_period_today}
              {period === '7d' && t.sdb_period_7d}
              {period === '30d' && t.sdb_period_30d}
              {period === 'all' && t.sdb_period_all}
            </button>
          ))}
        </div>
      </div>

      {/* ── Structure vs Unstructured Awareness ── */}
      {structureStats.hasData ? (
        <div className="sdb-awareness-body">
          {/* Ratio bar */}
          <div
            className="sdb-segmented-bar"
            id="sdb-segmented-bar"
            role="progressbar"
            aria-valuenow={structureStats.structuredPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${t.sdb_stat_structured} ${structureStats.structuredPercentage}%, ${t.sdb_stat_unstructured} ${structureStats.unstructuredPercentage}%`}
          >
            <div
              className="sdb-segment sdb-segment--structured"
              style={{ width: `${structureStats.structuredPercentage}%` }}
              title={`${t.sdb_stat_structured}: ${structureStats.structuredPercentage}%`}
            />
            <div
              className="sdb-segment sdb-segment--unstructured"
              style={{ width: `${structureStats.unstructuredPercentage}%` }}
              title={`${t.sdb_stat_unstructured}: ${structureStats.unstructuredPercentage}%`}
            />
          </div>

          {/* Counts & Percentages Row */}
          <div className="sdb-structure-metrics-row">
            <div className="sdb-metric-box sdb-metric-box--structured" id="sdb-stat-structured-box">
              <div className="sdb-metric-top">
                <span className="sdb-metric-dot sdb-metric-dot--structured" />
                <span className="sdb-metric-name">{t.sdb_stat_structured}</span>
              </div>
              <div className="sdb-metric-main">
                <span className="sdb-metric-pct">{structureStats.structuredPercentage}%</span>
                <span className="sdb-metric-count">
                  {structureStats.structuredCount} {structureStats.structuredCount === 1 ? t.sdb_stat_record : t.sdb_stat_records}
                </span>
              </div>
            </div>

            <div className="sdb-metric-box sdb-metric-box--unstructured" id="sdb-stat-unstructured-box">
              <div className="sdb-metric-top">
                <span className="sdb-metric-dot sdb-metric-dot--unstructured" />
                <span className="sdb-metric-name">{t.sdb_stat_unstructured}</span>
              </div>
              <div className="sdb-metric-main">
                <span className="sdb-metric-pct">{structureStats.unstructuredPercentage}%</span>
                <span className="sdb-metric-count">
                  {structureStats.unstructuredCount} {structureStats.unstructuredCount === 1 ? t.sdb_stat_record : t.sdb_stat_records}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sdb-awareness-empty" id="sdb-awareness-empty">
          <span className="sdb-awareness-empty-icon">🌱</span>
          <p className="sdb-awareness-empty-text">{t.sdb_no_structure_data}</p>
        </div>
      )}

      {/* ── Resume Rate Indicator ── */}
      {resumeStats.hasEligibleSlips ? (
        <div className="sdb-resume-pill" id="sdb-resume-summary-pill">
          <span className="sdb-resume-icon">⟲</span>
          <span className="sdb-resume-text">
            {t.sdb_resume_summary_format
              .replace('{rate}', String(resumeStats.resumeRate))
              .replace('{resumed}', String(resumeStats.resumeCount))
              .replace('{eligible}', String(resumeStats.eligibleCount))}
          </span>
        </div>
      ) : structureStats.hasData ? (
        <div className="sdb-resume-pill sdb-resume-pill--clean" id="sdb-resume-summary-pill">
          <span className="sdb-resume-icon">✓</span>
          <span className="sdb-resume-text">{t.sdb_resume_no_slips}</span>
        </div>
      ) : null}

      {/* ── Food Category Distribution ── */}
      <div className="sdb-categories-dist-wrap">
        <div className="sdb-categories-dist-title">
          <span>📊</span>
          <span>{t.sdb_stat_category_distribution}</span>
        </div>

        {activeCategories.length > 0 ? (
          <div className="sdb-categories-dist-list" id="sdb-categories-dist-list">
            {activeCategories.map(cat => {
              const icon = FOOD_CATEGORY_ICONS[cat.category] || '🍽️';
              const name = (t[`sdb_cat_${cat.category}` as keyof typeof t] as string | undefined) || cat.category;
              return (
                <div key={cat.category} className="sdb-cat-dist-row">
                  <div className="sdb-cat-dist-info">
                    <span className="sdb-cat-dist-icon">{icon}</span>
                    <span className="sdb-cat-dist-name">{name}</span>
                  </div>
                  <div className="sdb-cat-dist-bar-track">
                    <div
                      className="sdb-cat-dist-bar-fill"
                      style={{ width: `${Math.max(4, cat.percentage)}%` }}
                    />
                  </div>
                  <div className="sdb-cat-dist-stats">
                    <span className="sdb-cat-dist-count">{cat.count}</span>
                    <span className="sdb-cat-dist-pct">({cat.percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sdb-categories-empty" id="sdb-categories-empty">
            <p>{t.sdb_no_category_data}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StructuredDietScreen({ onNavigate, onBack }: StructuredDietScreenProps) {
  const { t } = useTranslation();
  const [dietStore, setDietStore] = useState<StructureDietStore>(() => loadDietStore());
  const activeProfile = getActiveProfile(dietStore);
  const [weekly, setWeekly] = useState<WeeklyStructuredDiet>(() => activeProfile.diet);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StructureGoalProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<StructureGoalProfile | null>(null);

  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>(() => getLocalTodayKey());
  const [editingBlock, setEditingBlock] = useState<StructuredDietBlock | null | 'new'>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(weekly.planName);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [showQuickBuildModal, setShowQuickBuildModal] = useState(false);
  const [showUnstructuredConfirmModal, setShowUnstructuredConfirmModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Daily verification state (today's verifications)
  const [todayVerification, setTodayVerification] = useState<DailyDietVerification | null>(
    () => getDailyDietVerification()
  );
  const [allVerifications, setAllVerifications] = useState<Record<string, DailyDietVerification>>(
    () => loadAllDietVerifications()
  );
  const [structurePeriod, setStructurePeriod] = useState<StructureTimePeriod>('today');
  // Modal state for reporting a Slip on a block
  const [slipModalBlock, setSlipModalBlock] = useState<StructuredDietBlock | null>(null);
  // Modal state for food photo preview (Phase 6)
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title?: string } | null>(null);

  const todayKey = getLocalTodayKey();
  const isToday = selectedDayKey === todayKey;
  const currentDay = getDayPlan(weekly, selectedDayKey);
  const isReviewCompletedToday = hasCompletedDailyReview(getLocalDateKey(), activeProfile.id);

  // Preload photos for current day blocks for instant UI rendering (Phase 6)
  useEffect(() => {
    const photoIds = currentDay.blocks
      .map(b => b.foodPhoto?.id)
      .filter((id): id is string => Boolean(id));
    if (photoIds.length > 0) {
      preloadPhotos(photoIds);
    }
  }, [currentDay.blocks]);

  const handleHeaderBack = () => {
    if (previewPhoto) {
      setPreviewPhoto(null);
      return;
    }
    if (showProfileSwitcher) {
      setShowProfileSwitcher(false);
      return;
    }
    if (showCreateProfileModal) {
      setShowCreateProfileModal(false);
      return;
    }
    if (editingProfile) {
      setEditingProfile(null);
      return;
    }
    if (deletingProfile) {
      setDeletingProfile(null);
      return;
    }
    if (editingBlock) {
      setEditingBlock(null);
      return;
    }
    if (slipModalBlock) {
      setSlipModalBlock(null);
      return;
    }
    if (showTemplateModal) {
      setShowTemplateModal(false);
      return;
    }
    if (showQuickBuildModal) {
      setShowQuickBuildModal(false);
      return;
    }
    if (showCopyModal) {
      setShowCopyModal(false);
      return;
    }
    if (showUnstructuredConfirmModal) {
      setShowUnstructuredConfirmModal(false);
      return;
    }
    if (onBack) {
      onBack();
    } else {
      onNavigate('home');
    }
  };

  // Reload verifications whenever needed
  const refreshVerifications = useCallback(() => {
    setTodayVerification(getDailyDietVerification());
    setAllVerifications(loadAllDietVerifications());
  }, []);

  // ── Persist helper ─────────────────────────────────────────────────────────
  const updateWeekly = (updater: (w: WeeklyStructuredDiet) => WeeklyStructuredDiet) => {
    setWeekly(prev => {
      const next = updater({ ...prev });
      saveWeeklyDiet(next);
      setDietStore(loadDietStore());
      return next;
    });
  };

  // ── Profile actions (Phase 26) ─────────────────────────────────────────────
  const handleSelectProfile = (profileId: string) => {
    const updated = setActiveProfile(profileId);
    setDietStore(loadDietStore());
    setWeekly(updated.diet);
    setNameText(updated.diet.planName);
    setShowProfileSwitcher(false);
    playFeedback('neutral');
  };

  const handleCreateProfile = (name: string, description: string, cloneCurrent: boolean) => {
    const created = createCustomProfile({
      name,
      description: description || undefined,
      cloneFromDiet: cloneCurrent ? weekly : undefined,
    });
    setDietStore(loadDietStore());
    setWeekly(created.diet);
    setNameText(created.diet.planName);
    setShowCreateProfileModal(false);
    setShowProfileSwitcher(false);
    playFeedback('win');
  };

  const handleUpdateProfile = (profileId: string, name: string, description: string) => {
    const updated = updateCustomProfile(profileId, { name, description });
    const store = loadDietStore();
    setDietStore(store);
    if (store.activeProfileId === profileId && updated) {
      setWeekly(updated.diet);
      setNameText(updated.diet.planName);
    }
    setEditingProfile(null);
    playFeedback('neutral');
  };

  const handleDeleteProfile = (profileId: string) => {
    const result = deleteCustomProfile(profileId);
    setDietStore(loadDietStore());
    setWeekly(result.newActiveProfile.diet);
    setNameText(result.newActiveProfile.diet.planName);
    setDeletingProfile(null);
    playFeedback('neutral');
  };

  const handleSetMode = (mode: DayMode) => {
    updateWeekly(w => setDayMode(w, selectedDayKey, mode));
  };

  const commitName = () => {
    const trimmed = nameText.trim();
    if (trimmed) {
      updateWeekly(w => ({ ...w, planName: trimmed }));
    } else {
      setNameText(weekly.planName);
    }
    setEditingName(false);
  };

  // ── Quick Build actions (Task 5: Day-level Quick Build) ────────────────────
  const handleOpenQuickBuild = () => {
    if (currentDay.mode === 'unstructured') {
      setShowUnstructuredConfirmModal(true);
    } else {
      setShowQuickBuildModal(true);
    }
  };

  const handleQuickBuildConfirm = (
    newBlocks: StructuredDietBlock[],
    mode: 'add' | 'replace'
  ) => {
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => {
        const combined = mode === 'add' ? [...day.blocks, ...newBlocks] : [...newBlocks];
        return {
          ...day,
          mode: 'structured',
          blocks: sortBlocks(combined),
        };
      })
    );
    setShowQuickBuildModal(false);
    setCopyFeedback(t.sdb_qb_success);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 2800);
  };

  // ── Template actions (Task 6: Daily Scope) ────────────────────────────────
  const handleApplyTemplate = (template: DietTemplate) => {
    const { mode, blocks } = applyDailyTemplateToDay(template);
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, d => ({
        ...d,
        mode,
        blocks,
      }))
    );
    setShowTemplateModal(false);
    const dayName = (t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string | undefined) ?? selectedDayKey;
    setCopyFeedback(`${t.sdb_tpl_applied_feedback} (${dayName})`);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 3200);
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
    const blockToDelete = currentDay.blocks.find(b => b.id === id);
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => ({
        ...day,
        blocks: day.blocks.filter(b => b.id !== id),
      }))
    );
    if (blockToDelete?.foodPhoto?.id) {
      const photoId = blockToDelete.foodPhoto.id;
      // Asynchronously clean up orphan photo if unreferenced anywhere
      setTimeout(() => {
        const store = loadDietStore();
        const verifs = loadAllDietVerifications();
        if (!isPhotoReferenced(photoId, store, verifs)) {
          deleteFoodPhoto(photoId).catch(() => {});
        }
      }, 50);
    }
  };

  // ── Quick Edit block action ────────────────────────────────────────────────
  const handleQuickUpdateBlock = (blockId: string, updates: Partial<StructuredDietBlock>) => {
    // 1. Snapshot yesterday / past date if needed to guarantee history immutability
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterdayDate);

    updateWeekly(prevWeekly => {
      let nextWeekly = prevWeekly;
      if (!nextWeekly.historySnapshots || !nextWeekly.historySnapshots[yesterdayKey]) {
        nextWeekly = snapshotHistoryDate(nextWeekly, yesterdayKey);
      }
      return updateDayPlan(nextWeekly, selectedDayKey, day => {
        const nextBlocks = day.blocks.map(b => {
          if (b.id !== blockId) return b;
          return {
            ...b,
            ...updates,
          };
        });
        return {
          ...day,
          blocks: sortBlocks(nextBlocks),
        };
      });
    });
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
  const handleVerifyOutcome = (
    block: StructuredDietBlock,
    outcome: DetailedBlockOutcome,
    status: DietVerificationStatus
  ) => {
    const dateKey = getLocalDateKey();
    saveBlockVerification({
      plannedBlock: block,
      status,
      detailedOutcome: outcome,
      sourcePlanName: weekly.planName,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
    });
    recordScoreEvent({
      activityType: status === 'on-track' ? 'DIET_ON_TRACK' : 'SLIP_REPORTED',
      dateKey,
      sourceId: `diet_block_${dateKey}_${block.id}`,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
    });
    if (status === 'on-track') {
      playFeedback('win');
    } else {
      playFeedback('neutral');
    }
    refreshVerifications();
  };

  const handleToggleResumed = (blockId: string) => {
    toggleBlockResumed(blockId);
    playFeedback('win');
    refreshVerifications();
  };

  const handleVerifyOnTrack = (block: StructuredDietBlock) => {
    handleVerifyOutcome(block, 'on_track', 'on-track');
  };

  const handleSaveSlipVerification = (
    actualItems: string[],
    customText: string,
    outcome?: DetailedBlockOutcome,
    isResumed?: boolean,
    actualCategories?: FoodCategoryKey[]
  ) => {
    if (!slipModalBlock) return;
    const dateKey = getLocalDateKey();
    saveBlockVerification({
      plannedBlock: slipModalBlock,
      status: 'slip',
      detailedOutcome: outcome ?? 'structured_slip',
      isResumed,
      actualItems,
      actualFoodCategories: actualCategories,
      actualCustomText: customText,
      sourcePlanName: weekly.planName,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
    });
    recordScoreEvent({
      activityType: 'SLIP_REPORTED',
      dateKey,
      sourceId: `diet_block_${dateKey}_${slipModalBlock.id}`,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
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
          onBack={handleHeaderBack}
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

          {/* ── Structure Goal / Master Profile Card (Phase 26) ── */}
          <div className="sdb-goal-card" id="sdb-goal-card">
            <div className="sdb-goal-top">
              <div className="sdb-goal-badge-wrap">
                <span className="sdb-goal-icon" aria-hidden="true">🎯</span>
                <span className="sdb-goal-badge-label">{t.sdb_profile_title}</span>
                <span className={`sdb-goal-type-badge ${activeProfile.type === 'builtin' ? 'sdb-goal-type-badge--builtin' : 'sdb-goal-type-badge--custom'}`}>
                  {activeProfile.type === 'builtin' ? t.sdb_profile_built_in_badge : t.sdb_profile_custom_badge}
                </span>
              </div>
              <button
                id="btn-profile-switcher"
                type="button"
                className="sdb-goal-switcher-btn"
                onClick={() => setShowProfileSwitcher(true)}
                title={t.sdb_profile_switch_btn}
              >
                <span>🔄</span>
                <span>{t.sdb_profile_switch_btn}</span>
              </button>
            </div>

            <div className="sdb-goal-details">
              <div className="sdb-goal-name-row">
                <h2 className="sdb-goal-name" id="sdb-active-goal-name">
                  {getGoalDisplayName(activeProfile, t)}
                </h2>
                {activeProfile.type === 'custom' && (
                  <button
                    id="btn-edit-active-profile"
                    type="button"
                    className="sdb-icon-btn sdb-goal-edit-btn"
                    onClick={() => setEditingProfile(activeProfile)}
                    title={t.sdb_profile_edit_btn}
                    aria-label={t.sdb_profile_edit_btn}
                  >
                    ✎
                  </button>
                )}
              </div>
              {getGoalDisplayDescription(activeProfile, t) && (
                <p className="sdb-goal-desc">{getGoalDisplayDescription(activeProfile, t)}</p>
              )}
            </div>
          </div>

          {/* ── Daily Review Entry Point (Phase 27) ── */}
          <div className="sdb-daily-review-card" id="sdb-daily-review-card">
            <div className="sdb-daily-review-left">
              <div className="sdb-daily-review-badge-row">
                <span className="sdb-daily-review-icon">📝</span>
                <span className="sdb-daily-review-title">{t.dr_entry_title}</span>
                <span
                  className={`sdb-daily-review-status-badge ${
                    isReviewCompletedToday
                      ? 'sdb-daily-review-status-badge--completed'
                      : 'sdb-daily-review-status-badge--pending'
                  }`}
                >
                  {isReviewCompletedToday ? t.dr_entry_badge_completed : t.dr_entry_badge_pending}
                </span>
              </div>
              <p className="sdb-daily-review-sub">{t.dr_entry_subtitle}</p>
            </div>
            <button
              id="btn-open-daily-review"
              type="button"
              className="sdb-daily-review-btn"
              onClick={() => onNavigate('daily-review')}
            >
              <span>{t.dr_entry_action}</span>
              <span aria-hidden="true">→</span>
            </button>
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

          {/* ── Day Selector Dropdown (Phase 22) ── */}
          <div className="sdb-day-dropdown-card">
            <div className="sdb-day-dropdown-header">
              <label htmlFor="sdb-day-select" className="sdb-day-dropdown-label">
                <span className="sdb-day-dropdown-icon">📅</span>
                <span>{t.sdb_day_select_label}</span>
              </label>
              {isToday && (
                <span className="sdb-today-badge sdb-today-badge--dropdown">{t.sdb_today}</span>
              )}
            </div>
            <div className="sdb-day-dropdown-wrapper">
              <select
                id="sdb-day-select"
                className="sdb-day-select sdb-day-select--main"
                value={selectedDayKey}
                onChange={e => setSelectedDayKey(e.target.value as DayKey)}
                aria-label={t.sdb_day_select_label}
              >
                {DAY_KEYS.map(k => {
                  const dayName = t[`sdb_day_${k}` as keyof typeof t] as string;
                  const isTodayPill = k === todayKey;
                  return (
                    <option key={k} id={`sdb-day-${k}`} value={k}>
                      {dayName}{isTodayPill ? ` (${t.sdb_today})` : ''}
                    </option>
                  );
                })}
              </select>
              <span className="sdb-day-dropdown-chevron" aria-hidden="true">▾</span>
            </div>
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

              <div className="sdb-day-actions-header">
                <button
                  id="btn-sdb-templates-header"
                  type="button"
                  className="sdb-templates-trigger-btn"
                  onClick={() => setShowTemplateModal(true)}
                  title={t.sdb_choose_template}
                >
                  <span>📑</span>
                  <span className="sdb-tpl-btn-text">{t.sdb_templates}</span>
                </button>
                <button
                  id="btn-sdb-quick-build-header"
                  type="button"
                  className="sdb-quick-build-trigger-btn"
                  onClick={handleOpenQuickBuild}
                  title={t.sdb_quick_build}
                >
                  <span>⚡</span>
                  <span className="sdb-qb-btn-text">{t.sdb_quick_build}</span>
                </button>
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

          {/* ── Eating Structure Awareness & Food Category Analytics (Phase 3) ── */}
          <StructureAwarenessCard
            allVerifications={allVerifications}
            activeProfileId={activeProfile.id}
            selectedPeriod={structurePeriod}
            onSelectPeriod={setStructurePeriod}
            t={t}
          />

          {/* ── Content depending on Day Mode ── */}
          {currentDay.mode === 'unstructured' ? (
            currentDay.blocks.length === 0 ? (
              /* ── Unstructured day state (No blocks) ── */
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
                <div className="sdb-empty-actions">
                  <button
                    id="btn-sdb-unstructured-tpl"
                    type="button"
                    className="sdb-empty-tpl-btn"
                    onClick={() => setShowTemplateModal(true)}
                  >
                    📑 {t.sdb_choose_template}
                  </button>
                  <button
                    id="btn-sdb-unstructured-qb"
                    type="button"
                    className="sdb-empty-qb-btn"
                    onClick={handleOpenQuickBuild}
                  >
                    ⚡ {t.sdb_quick_build}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Unstructured day with template timeline guidance ── */
              <div className="sdb-unstructured-guidance-wrap">
                <div className="sdb-unstructured-guidance-banner">
                  <div className="sdb-unstructured-guidance-top">
                    <span className="sdb-unstructured-guidance-badge">🌱 {t.sdb_mode_unstructured}</span>
                    <span className="sdb-unstructured-guidance-tag">🧭 {t.sdb_tpl_unstructured_guidance_badge}</span>
                  </div>
                  <p className="sdb-unstructured-guidance-hint">{t.sdb_unstructured_safe_hint}</p>
                </div>

                <div className="sdb-block-list">
                  {sortedBlocks.map(block => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      onEdit={() => setEditingBlock(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      t={t}
                      isToday={false}
                      verification={undefined}
                      onVerifyOnTrack={() => {}}
                      onOpenSlipModal={() => {}}
                      onClearStatus={() => {}}
                      onNavigate={onNavigate}
                      onQuickUpdateTime={(startTime, endTime) => handleQuickUpdateBlock(block.id, { startTime, endTime })}
                      onQuickUpdateDescription={(customText) => handleQuickUpdateBlock(block.id, { customText })}
                      onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
                    />
                  ))}
                </div>

                <div className="sdb-actions">
                  <button
                    id="btn-sdb-quick-build"
                    type="button"
                    className="sdb-quick-build-btn"
                    onClick={handleOpenQuickBuild}
                  >
                    <span className="sdb-add-btn-icon">⚡</span>
                    {t.sdb_quick_build}
                  </button>
                  <button
                    id="btn-sdb-choose-template"
                    type="button"
                    className="sdb-template-btn"
                    onClick={() => setShowTemplateModal(true)}
                  >
                    <span className="sdb-add-btn-icon">📑</span>
                    {t.sdb_choose_template}
                  </button>
                  <button
                    id="btn-sdb-add-block"
                    className="sdb-add-btn"
                    onClick={() => setEditingBlock('new')}
                  >
                    <span className="sdb-add-btn-icon">+</span>
                    {t.sdb_add_block}
                  </button>
                </div>
              </div>
            )
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
                      {verificationStats.eligibleSlipCount > 0 && (
                        <span className="sdb-prog-pill sdb-prog-pill--resumed" id="sdb-progress-resume-rate">
                          ⟲ {verificationStats.resumeCount}/{verificationStats.eligibleSlipCount} {t.sdb_resumed_label} ({verificationStats.resumeRate}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sortedBlocks.length === 0 ? (
                <div className="sdb-empty">
                  <div className="sdb-empty-icon">🥗</div>
                  <p className="sdb-empty-title">{t.sdb_empty_title}</p>
                  <p className="sdb-empty-sub">{t.sdb_empty_sub}</p>
                  <div className="sdb-empty-actions">
                    <button
                      id="btn-sdb-empty-template"
                      type="button"
                      className="sdb-empty-tpl-btn"
                      onClick={() => setShowTemplateModal(true)}
                    >
                      📑 {t.sdb_choose_template}
                    </button>
                    <button
                      id="btn-sdb-empty-quick-build"
                      type="button"
                      className="sdb-empty-qb-btn"
                      onClick={handleOpenQuickBuild}
                    >
                      ⚡ {t.sdb_quick_build}
                    </button>
                  </div>
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
                        onVerifyOutcome={(outcome, status) => handleVerifyOutcome(block, outcome, status)}
                        onToggleResumed={() => handleToggleResumed(block.id)}
                        onVerifyOnTrack={() => handleVerifyOnTrack(block)}
                        onOpenSlipModal={() => setSlipModalBlock(block)}
                        onClearStatus={() => handleClearStatus(block.id)}
                        onNavigate={onNavigate}
                        onQuickUpdateTime={(startTime, endTime) => handleQuickUpdateBlock(block.id, { startTime, endTime })}
                        onQuickUpdateDescription={(customText) => handleQuickUpdateBlock(block.id, { customText })}
                        onQuickUpdateCategories={(foodCategories) => handleQuickUpdateBlock(block.id, { foodCategories })}
                        onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
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

              {/* ── Planning actions row: Quick Build · Choose Template · Add Block ── */}
              <div className="sdb-add-actions-row">
                <button
                  id="btn-sdb-quick-build"
                  type="button"
                  className="sdb-quick-build-btn"
                  onClick={handleOpenQuickBuild}
                >
                  <span className="sdb-add-btn-icon">⚡</span>
                  {t.sdb_quick_build}
                </button>
                <button
                  id="btn-sdb-choose-template"
                  type="button"
                  className="sdb-template-btn"
                  onClick={() => setShowTemplateModal(true)}
                >
                  <span className="sdb-add-btn-icon">📑</span>
                  {t.sdb_choose_template}
                </button>
                <button
                  id="btn-sdb-add-block"
                  className="sdb-add-btn"
                  onClick={() => setEditingBlock('new')}
                >
                  <span className="sdb-add-btn-icon">+</span>
                  {t.sdb_add_block}
                </button>
              </div>
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
          initialOutcome={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.detailedOutcome
          }
          initialResumed={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.isResumed
          }
          initialActualItems={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.actualItems
          }
          initialActualCategories={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.actualFoodCategories
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

      {/* ── Quick Build modal ── */}
      <QuickBuildModal
        isOpen={showQuickBuildModal}
        dayKey={selectedDayKey}
        dayName={currentDayFullName}
        hasExistingBlocks={currentDay.blocks.length > 0}
        onClose={() => setShowQuickBuildModal(false)}
        onConfirm={handleQuickBuildConfirm}
      />

      {/* ── Unstructured to Structured Confirmation Modal ── */}
      {showUnstructuredConfirmModal && (
        <div
          className="sdb-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sdb-unstructured-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowUnstructuredConfirmModal(false);
          }}
        >
          <div className="sdb-modal sdb-confirm-modal" role="document">
            <div className="sdb-modal-header">
              <h2 id="sdb-unstructured-confirm-title" className="sdb-modal-title">
                {t.sdb_quick_build}
              </h2>
              <button
                className="sdb-modal-close"
                onClick={() => setShowUnstructuredConfirmModal(false)}
                aria-label={t.commit_cancel}
              >
                ✕
              </button>
            </div>
            <div className="sdb-modal-body">
              <div className="sdb-confirm-icon">⚙️</div>
              <p className="sdb-confirm-prompt">{t.sdb_qb_unstructured_prompt}</p>
            </div>
            <div className="sdb-modal-footer">
              <button
                id="btn-qb-unstructured-cancel"
                type="button"
                className="sdb-btn sdb-btn--cancel"
                onClick={() => setShowUnstructuredConfirmModal(false)}
              >
                {t.commit_cancel}
              </button>
              <button
                id="btn-qb-change-structured"
                type="button"
                className="sdb-btn sdb-btn--save"
                onClick={() => {
                  handleSetMode('structured');
                  setShowUnstructuredConfirmModal(false);
                  setShowQuickBuildModal(true);
                }}
              >
                {t.sdb_qb_btn_change_structured}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Choose Template modal (Task 6: Daily Scope) ── */}
      <TemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApply={handleApplyTemplate}
        selectedDayKey={selectedDayKey}
        selectedDayName={(t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string | undefined) ?? selectedDayKey}
        hasExistingDayBlocks={currentDay.blocks.length > 0}
        onSelectDayKey={setSelectedDayKey}
      />

      {/* ── Structure Goal Profile Switcher Modal ── */}
      <ProfileSwitcherModal
        isOpen={showProfileSwitcher}
        activeProfileId={activeProfile.id}
        profiles={dietStore.profiles}
        onSelectProfile={handleSelectProfile}
        onOpenCreate={() => {
          setShowProfileSwitcher(false);
          setShowCreateProfileModal(true);
        }}
        onOpenEdit={p => {
          setShowProfileSwitcher(false);
          setEditingProfile(p);
        }}
        onOpenDelete={p => {
          setShowProfileSwitcher(false);
          setDeletingProfile(p);
        }}
        onClose={() => setShowProfileSwitcher(false)}
        t={t}
      />

      {/* ── Create Profile Modal ── */}
      <CreateProfileModal
        isOpen={showCreateProfileModal}
        onSave={handleCreateProfile}
        onClose={() => setShowCreateProfileModal(false)}
        t={t}
      />

      {/* ── Edit Custom Profile Modal ── */}
      <EditProfileModal
        profile={editingProfile}
        onSave={handleUpdateProfile}
        onClose={() => setEditingProfile(null)}
        t={t}
      />

      {/* ── Delete Profile Confirmation Modal ── */}
      <DeleteProfileModal
        profile={deletingProfile}
        isActive={deletingProfile?.id === activeProfile.id}
        onConfirm={handleDeleteProfile}
        onClose={() => setDeletingProfile(null)}
        t={t}
      />

      {/* ── Food Photo Preview Modal (Phase 6) ── */}
      {previewPhoto && (
        <PhotoPreviewModal
          photoUrl={previewPhoto.url}
          title={previewPhoto.title}
          onClose={() => setPreviewPhoto(null)}
          t={t}
        />
      )}
    </div>
  );
}
