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
  getBlockPhotos,
  sanitiseBlock,
  getBlockPrimaryDescription,
  MEAL_TYPE_KEYS,
  isFreeDay,
  setFreeScheduleDates,
  clearDateOverride,
} from '../utils/dietStorage';
import type {
  DayKey,
  DayMode,
  StructuredDietBlock,
  WeeklyStructuredDiet,
  StructureDietStore,
  StructureGoalProfile,
  MealTypeKey,
} from '../utils/dietStorage';
import {
  getDailyDietVerification,
  loadAllDietVerifications,
  saveBlockVerification,
  saveUnplannedFoodLog,
  clearBlockVerification,
  toggleBlockResumed,
  getDailyVerificationStats,
  setBlockDriftState,
  isEligibleSlipForDrift,
  type DriftState,
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
import {
  getFoodOptionsForCategory,
  findFoodOption,
  getFoodQuantityKey,
  formatFoodItemQuantity,
  getDefaultFoodUnit,
  FOOD_QUANTITY_UNITS,
  type FoodSelectionsMap,
  type CustomFoodsMap,
  type FoodQuantitiesMap,
  type FoodQuantityUnit,
  type FoodItemQuantity,
} from '../data/foodOptions';
import QuickBuildModal from '../components/QuickBuildModal';
import TemplateModal from '../components/TemplateModal';
import type { DietTemplate } from '../data/dietTemplates';
import { applyDailyTemplateToDay } from '../data/dietTemplates';
import { hasCompletedDailyReview } from '../utils/dailyReviewStorage';
import { recordScoreEvent, type ScoreActivityType } from '../utils/scoringEngine';
import {
  type FoodPhotoMetadata,
  saveFoodPhoto,
  getFoodPhoto,
  getPhotoDataUrlSync,
  deleteFoodPhoto,
  preloadPhotos,
  isPhotoReferenced,
  isValidImageFile,
  getLocalizedPhotoErrorMessage,
} from '../utils/photoStorage';
import './StructuredDietScreen.css';

interface StructuredDietScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onStartTimer?: () => void;
}

// ── Food Photo Preview Modal (Phase 6B Multi-Photo) ───────────────────────────

export interface PhotoPreviewItem {
  id: string;
  dataUrl?: string | null;
  caption?: string;
}

interface PhotoPreviewModalProps {
  photos: PhotoPreviewItem[];
  initialIndex?: number;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function PhotoPreviewModal({ photos, initialIndex = 0, onClose, t }: PhotoPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0))
  );

  const currentPhoto = photos[currentIndex];
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (currentPhoto?.dataUrl) return currentPhoto.dataUrl;
    if (currentPhoto?.id) return getPhotoDataUrlSync(currentPhoto.id);
    return null;
  });

  useEffect(() => {
    if (!currentPhoto) return;
    if (currentPhoto.dataUrl) {
      setResolvedUrl(currentPhoto.dataUrl);
      return;
    }
    const sync = getPhotoDataUrlSync(currentPhoto.id);
    if (sync) {
      setResolvedUrl(sync);
      return;
    }
    let active = true;
    getFoodPhoto(currentPhoto.id).then(rec => {
      if (active && rec?.dataUrl) {
        setResolvedUrl(rec.dataUrl);
      }
    });
    return () => {
      active = false;
    };
  }, [currentPhoto]);

  const handlePrev = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  if (!currentPhoto) return null;

  const title = currentPhoto.caption || t.sdb_photo_preview_title || t.sdb_food_photos;
  const counterText = t.sdb_photo_counter
    ? t.sdb_photo_counter
        .replace('{current}', String(currentIndex + 1))
        .replace('{total}', String(photos.length))
    : `${currentIndex + 1} of ${photos.length}`;

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
          <div className="sdb-photo-modal-header-info">
            <span className="sdb-photo-modal-title">{title}</span>
            {photos.length > 1 && (
              <span className="sdb-photo-modal-counter">{counterText}</span>
            )}
          </div>
          <button
            type="button"
            id="btn-close-photo-modal"
            className="sdb-photo-modal-close"
            onClick={onClose}
            aria-label={t.sdb_close_preview}
          >
            ✕
          </button>
        </div>
        <div className="sdb-photo-modal-body">
          {photos.length > 1 && (
            <button
              type="button"
              id="btn-photo-prev"
              className="sdb-photo-modal-nav sdb-photo-modal-nav--prev"
              onClick={handlePrev}
              aria-label={t.sdb_photo_nav_prev}
              title={t.sdb_photo_nav_prev}
            >
              ‹
            </button>
          )}

          {resolvedUrl ? (
            <img src={resolvedUrl} alt={title} className="sdb-photo-modal-img" />
          ) : (
            <div className="sdb-photo-modal-loading">...</div>
          )}

          {photos.length > 1 && (
            <button
              type="button"
              id="btn-photo-next"
              className="sdb-photo-modal-nav sdb-photo-modal-nav--next"
              onClick={handleNext}
              aria-label={t.sdb_photo_nav_next}
              title={t.sdb_photo_nav_next}
            >
              ›
            </button>
          )}
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
  initialOutcome?: DetailedBlockOutcome | 'none';
  isToday?: boolean;
  onSave: (block: StructuredDietBlock, outcome?: DetailedBlockOutcome | 'none') => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function BlockEditor({ initial, initialOutcome, isToday, onSave, onCancel, t }: BlockEditorProps) {
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
  const [mealType, setMealType] = useState<MealTypeKey | undefined>(initial?.mealType);
  const [selectedOutcome, setSelectedOutcome] = useState<DetailedBlockOutcome | 'none'>(initialOutcome || 'none');

  // Specific Foods & Submenus state (Phase 7C)
  const [foodSelections, setFoodSelections] = useState<FoodSelectionsMap>(() => {
    if (initial?.foodSelections) return JSON.parse(JSON.stringify(initial.foodSelections));
    return {};
  });
  const [customFoods, setCustomFoods] = useState<CustomFoodsMap>(() => {
    if (initial?.customFoods) return JSON.parse(JSON.stringify(initial.customFoods));
    return {};
  });
  const [foodQuantities, setFoodQuantities] = useState<FoodQuantitiesMap>(() => {
    if (initial?.foodQuantities) return JSON.parse(JSON.stringify(initial.foodQuantities));
    return {};
  });
  const [activeCategorySubmenu, setActiveCategorySubmenu] = useState<FoodCategoryKey | null>(() => {
    if (initial?.foodCategories && initial.foodCategories.length > 0) {
      return initial.foodCategories[0];
    }
    return null;
  });
  const [customFoodInputs, setCustomFoodInputs] = useState<Record<string, string>>({});
  const [customFoodErrors, setCustomFoodErrors] = useState<Record<string, string>>({});

  // Multi-photo state (Phase 6B)
  const [foodPhotos, setFoodPhotos] = useState<FoodPhotoMetadata[]>(() => getBlockPhotos(initial));
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>(() => {
    const initialPhotos = getBlockPhotos(initial);
    const initialMap: Record<string, string> = {};
    for (const p of initialPhotos) {
      const sync = getPhotoDataUrlSync(p.id);
      if (sync) initialMap[p.id] = sync;
    }
    return initialMap;
  });
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError]         = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isSubscribed = true;
    for (const p of foodPhotos) {
      if (!photoPreviewUrls[p.id]) {
        getFoodPhoto(p.id).then(record => {
          if (isSubscribed && record?.dataUrl) {
            setPhotoPreviewUrls(prev => ({ ...prev, [p.id]: record.dataUrl }));
          }
        }).catch(() => {});
      }
    }
    return () => {
      isSubscribed = false;
    };
  }, [foodPhotos]);

  const handleAddPhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!isValidImageFile(file)) {
      setPhotoError(t.sdb_err_invalid_image);
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError('');

    try {
      const meta = await saveFoodPhoto(file);
      const dataUrl = getPhotoDataUrlSync(meta.id);
      setFoodPhotos(prev => [...prev, meta]);
      if (dataUrl) {
        setPhotoPreviewUrls(prev => ({ ...prev, [meta.id]: dataUrl }));
      }
    } catch (err) {
      console.error('Error adding photo:', err);
      setPhotoError(getLocalizedPhotoErrorMessage(err, t));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleTriggerReplace = (index: number) => {
    setReplacingIndex(index);
    replaceFileInputRef.current?.click();
  };

  const handleReplacePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || replacingIndex === null) return;
    const targetIdx = replacingIndex;
    e.target.value = '';

    if (!isValidImageFile(file)) {
      setPhotoError(t.sdb_err_invalid_image);
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError('');

    try {
      const oldPhoto = foodPhotos[targetIdx];
      const newMeta = await saveFoodPhoto(file);
      const dataUrl = getPhotoDataUrlSync(newMeta.id);
      setFoodPhotos(prev => prev.map((p, i) => (i === targetIdx ? newMeta : p)));
      if (dataUrl) {
        setPhotoPreviewUrls(prev => ({ ...prev, [newMeta.id]: dataUrl }));
      }
      // Check if old photo is orphaned
      if (oldPhoto?.id) {
        setTimeout(() => {
          const store = loadDietStore();
          const verifs = loadAllDietVerifications();
          if (!isPhotoReferenced(oldPhoto.id, store, verifs)) {
            deleteFoodPhoto(oldPhoto.id).catch(() => {});
          }
        }, 50);
      }
    } catch (err) {
      console.error('Error replacing photo:', err);
      setPhotoError(getLocalizedPhotoErrorMessage(err, t));
    } finally {
      setIsProcessingPhoto(false);
      setReplacingIndex(null);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const photoToRemove = foodPhotos[index];
    setFoodPhotos(prev => prev.filter((_, i) => i !== index));
    if (photoToRemove?.id) {
      setTimeout(() => {
        const store = loadDietStore();
        const verifs = loadAllDietVerifications();
        if (!isPhotoReferenced(photoToRemove.id, store, verifs)) {
          deleteFoodPhoto(photoToRemove.id).catch(() => {});
        }
      }, 50);
    }
  };

  // Trap focus inside modal
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('select,input,button');
    first?.focus();
  }, []);

  const toggleCategory = (key: FoodCategoryKey) => {
    const isSelected = foodCategories.includes(key);
    if (isSelected) {
      if (activeCategorySubmenu === key) {
        // Deselect category, close submenu, clear specific & custom foods for this category
        setFoodCategories(prev => prev.filter(c => c !== key));
        setFoodSelections(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCustomFoods(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setActiveCategorySubmenu(null);
      } else {
        // Category is selected, switch active submenu to it
        setActiveCategorySubmenu(key);
      }
    } else {
      // Select category and open its submenu
      setFoodCategories(prev => [...prev, key]);
      setActiveCategorySubmenu(key);
    }
  };

  const toggleSpecificFood = (cat: FoodCategoryKey, foodKey: string) => {
    setFoodSelections(prev => {
      const curList = prev[cat] || [];
      const isAdding = !curList.includes(foodKey);
      const nextList = isAdding
        ? [...curList, foodKey]
        : curList.filter(f => f !== foodKey);

      // Sergio's Phase 26I: When user selects a food item, prioritize actual food as main description
      const opt = findFoodOption(cat, foodKey);
      const foodLabel = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : foodKey;
      const formattedFood = foodLabel.charAt(0).toUpperCase() + foodLabel.slice(1).replace(/_/g, ' ');

      const defaultTypeName = (t[`sdb_type_${type}` as keyof typeof t] as string | undefined) || type;
      const curCustom = customText.trim();
      const isGenericDesc = !curCustom || curCustom.toLowerCase() === defaultTypeName.toLowerCase() || curCustom.toLowerCase() === type.toLowerCase();

      if (isAdding && isGenericDesc) {
        setCustomText(formattedFood);
      }

      if (!isAdding) {
        const qtyKey = getFoodQuantityKey(cat, foodKey, false);
        setFoodQuantities(q => {
          if (!q[qtyKey]) return q;
          const next = { ...q };
          delete next[qtyKey];
          return next;
        });
      }

      return { ...prev, [cat]: nextList };
    });
  };

  const handleAddCustomFood = (cat: FoodCategoryKey) => {
    const raw = (customFoodInputs[cat] || '').trim();
    if (!raw) return;

    const curCanonical = foodSelections[cat] || [];
    const curCustom = customFoods[cat] || [];

    const isCanonicalDup = curCanonical.some(k => {
      const opt = findFoodOption(cat, k);
      const label = opt ? (t[opt.i18nKey as keyof typeof t] as string | undefined) : k;
      return k.toLowerCase() === raw.toLowerCase() || label?.toLowerCase() === raw.toLowerCase();
    });
    const isCustomDup = curCustom.some(c => c.toLowerCase() === raw.toLowerCase());

    if (isCanonicalDup || isCustomDup) {
      setCustomFoodErrors(prev => ({ ...prev, [cat]: t.sdb_custom_food_duplicate }));
      return;
    }

    if (!customText.trim() || customText.trim().toLowerCase() === type.toLowerCase()) {
      setCustomText(raw);
    }

    setCustomFoods(prev => ({
      ...prev,
      [cat]: [...(prev[cat] || []), raw],
    }));
    setCustomFoodInputs(prev => ({ ...prev, [cat]: '' }));
    setCustomFoodErrors(prev => ({ ...prev, [cat]: '' }));
  };

  const handleRemoveCustomFood = (cat: FoodCategoryKey, foodText: string) => {
    setCustomFoods(prev => ({
      ...prev,
      [cat]: (prev[cat] || []).filter(f => f !== foodText),
    }));
    const qtyKey = getFoodQuantityKey(cat, foodText, true);
    setFoodQuantities(q => {
      if (!q[qtyKey]) return q;
      const next = { ...q };
      delete next[qtyKey];
      return next;
    });
  };

  const handleUpdateQuantity = (
    key: string,
    amount: number,
    unit: FoodQuantityUnit,
    customUnit?: string
  ) => {
    setFoodQuantities(prev => {
      if (isNaN(amount) || amount <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const item: FoodItemQuantity = {
        amount,
        unit,
      };
      if (customUnit !== undefined && customUnit.trim()) {
        item.customUnit = customUnit.trim();
      }
      return {
        ...prev,
        [key]: item,
      };
    });
  };

  const handleRemoveQuantity = (key: string) => {
    setFoodQuantities(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleItem = (key: string) => {
    setItems(prev =>
      prev.includes(key) ? prev.filter(i => i !== key) : [...prev, key]
    );
  };

  const validate = (): boolean => {
    setError('');
    if (!startTime) {
      setError(t.sdb_err_start_required);
      return false;
    }
    if (!endTime) {
      setError(t.sdb_err_end_required);
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;

    let finalCustom = customText.trim();
    if (!finalCustom && (Object.keys(foodSelections).length > 0 || Object.keys(customFoods).length > 0)) {
      const derived = getBlockPrimaryDescription({
        type,
        foodSelections,
        customFoods,
      }, t);
      if (derived && derived.toLowerCase() !== type.toLowerCase()) {
        finalCustom = derived;
      }
    }

    const block: StructuredDietBlock = {
      id: initial?.id ?? generateBlockId(),
      startTime,
      endTime,
      type,
      items,
      customText: finalCustom,
      mealType,
      foodCategories,
      foodSelections,
      customFoods,
      foodQuantities: Object.keys(foodQuantities).length > 0 ? foodQuantities : undefined,
      foodPhotos: foodPhotos.length > 0 ? foodPhotos : undefined,
      foodPhoto: foodPhotos.length > 0 ? foodPhotos[0] : undefined,
    };
    onSave(sanitiseBlock(block), selectedOutcome);
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
          {/* ── Food / Beverage Photo Attachment (Phase 6B: Top of Customize) ── */}
          <div className="sdb-field sdb-photo-field sdb-photo-field--top">
            <label className="sdb-label sdb-label--optional">
              <span>📷 {t.sdb_food_photos}</span>
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>

            {/* Hidden file input for direct camera photo capture (Phase 27) */}
            <input
              ref={cameraFileInputRef}
              id="sdb-photo-file-input-camera"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleAddPhotoFileSelect}
            />

            {/* Hidden file input for adding a new photo from gallery */}
            <input
              ref={addFileInputRef}
              id="sdb-photo-file-input-add"
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
              style={{ display: 'none' }}
              onChange={handleAddPhotoFileSelect}
            />

            {/* Hidden file input for replacing a specific photo */}
            <input
              ref={replaceFileInputRef}
              id="sdb-photo-file-input-replace"
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
              style={{ display: 'none' }}
              onChange={handleReplacePhotoFileSelect}
            />

            <div className="sdb-photo-gallery-editor">
              {foodPhotos.map((photo, idx) => {
                const url = photoPreviewUrls[photo.id] || getPhotoDataUrlSync(photo.id);
                return (
                  <div key={photo.id || idx} className="sdb-photo-item-card">
                    <button
                      type="button"
                      id={`btn-editor-photo-view-${idx}`}
                      className="sdb-photo-item-thumb-btn"
                      onClick={() => setPreviewPhotoIndex(idx)}
                      title={`${t.sdb_view_photo} (${idx + 1}/${foodPhotos.length})`}
                      aria-label={`${t.sdb_view_photo} ${idx + 1}`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={`${t.sdb_food_photo} ${idx + 1}`}
                          className="sdb-photo-item-img"
                        />
                      ) : (
                        <div className="sdb-photo-item-placeholder">📷</div>
                      )}
                      <span className="sdb-photo-item-zoom-icon" aria-hidden="true">🔍</span>
                    </button>
                    <div className="sdb-photo-item-actions">
                      <button
                        type="button"
                        id={`btn-editor-photo-replace-${idx}`}
                        className="sdb-btn-photo-mini sdb-btn-photo-mini--replace"
                        onClick={() => handleTriggerReplace(idx)}
                        disabled={isProcessingPhoto}
                        title={t.sdb_replace_photo}
                        aria-label={`${t.sdb_replace_photo} ${idx + 1}`}
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        id={`btn-editor-photo-remove-${idx}`}
                        className="sdb-btn-photo-mini sdb-btn-photo-mini--remove"
                        onClick={() => handleRemovePhoto(idx)}
                        disabled={isProcessingPhoto}
                        title={t.sdb_remove_photo}
                        aria-label={`${t.sdb_remove_photo} ${idx + 1}`}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="sdb-photo-actions-row">
                <button
                  type="button"
                  id="btn-take-food-photo"
                  className="sdb-btn-photo-action sdb-btn-photo-action--camera"
                  onClick={() => cameraFileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  title={t.sdb_take_photo}
                >
                  <span className="sdb-photo-btn-icon">📷</span>
                  <span className="sdb-photo-btn-label">{t.sdb_take_photo}</span>
                </button>
                <button
                  type="button"
                  id="btn-gallery-food-photo"
                  className="sdb-btn-photo-action sdb-btn-photo-action--gallery"
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  title={t.sdb_choose_gallery}
                >
                  <span className="sdb-photo-btn-icon">🖼️</span>
                  <span className="sdb-photo-btn-label">{t.sdb_choose_gallery}</span>
                </button>
                {/* Fallback backward-compatible target */}
                <button
                  type="button"
                  id="btn-add-food-photo"
                  style={{ display: 'none' }}
                  onClick={() => addFileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  aria-hidden="true"
                />
              </div>
            </div>

            {photoError && <p className="sdb-photo-error-msg" role="alert">{photoError}</p>}
          </div>

          {/* ── Time range ── */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_start_time}</label>
            <select
              id="sdb-start-time"
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
              id="sdb-end-time"
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

          {/* ── Custom note / Food Description ── */}
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

          {/* ── Food Categories (Primary Quick Food Classification) ── */}
          <div className="sdb-field sdb-field--food-categories">
            <label className="sdb-label sdb-label--primary-heading">{t.sdb_food_categories_label}</label>
            <div className="sdb-food-grid">
              {FOOD_CATEGORY_KEYS.map(key => {
                const isSelected = foodCategories.includes(key);
                const isSubmenuOpen = isSelected && activeCategorySubmenu === key;
                return (
                  <button
                    key={key}
                    id={`btn-cat-chip-${key}`}
                    type="button"
                    className={`sdb-food-chip ${isSelected ? 'sdb-food-chip--active sdb-cat-chip--active' : ''} ${isSubmenuOpen ? 'sdb-cat-chip--open' : ''}`}
                    onClick={() => toggleCategory(key)}
                    aria-pressed={isSelected}
                  >
                    <span className="sdb-chip-icon">{FOOD_CATEGORY_ICONS[key]}</span>
                    <span>{t[`sdb_cat_${key}` as keyof typeof t] as string}</span>
                    {isSelected && (
                      <span className="sdb-cat-chip-arrow" aria-hidden="true">
                        {isSubmenuOpen ? ' ▲' : ' ▼'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Phase 7C: Category Specific Food Submenu Accordion ── */}
            {activeCategorySubmenu && foodCategories.includes(activeCategorySubmenu) && (
              <div className="sdb-cat-submenu-container" id={`sdb-cat-submenu-${activeCategorySubmenu}`}>
                <div className="sdb-cat-submenu-header">
                  <span className="sdb-cat-submenu-title">
                    {FOOD_CATEGORY_ICONS[activeCategorySubmenu]} {t[`sdb_cat_${activeCategorySubmenu}` as keyof typeof t] as string}: {t.sdb_food_submenu_title}
                  </span>
                  <button
                    type="button"
                    id={`btn-close-submenu-${activeCategorySubmenu}`}
                    className="sdb-cat-submenu-close"
                    onClick={() => setActiveCategorySubmenu(null)}
                    title="Collapse submenu"
                    aria-label="Collapse submenu"
                  >
                    ▲
                  </button>
                </div>

                {/* Canonical Specific Food Chips */}
                <div className="sdb-specific-food-grid">
                  {getFoodOptionsForCategory(activeCategorySubmenu).map(opt => {
                    const isFoodSelected = (foodSelections[activeCategorySubmenu] || []).includes(opt.key);
                    const foodLabel = (t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key;
                    const qtyKey = getFoodQuantityKey(activeCategorySubmenu, opt.key);
                    const itemQty = foodQuantities[qtyKey];
                    const qtyBadge = isFoodSelected ? formatFoodItemQuantity(itemQty, t) : '';

                    return (
                      <button
                        key={opt.key}
                        id={`btn-food-chip-${opt.key}`}
                        type="button"
                        className={`sdb-food-child-chip ${isFoodSelected ? 'sdb-food-child-chip--active' : ''}`}
                        onClick={() => toggleSpecificFood(activeCategorySubmenu, opt.key)}
                        aria-pressed={isFoodSelected}
                      >
                        {isFoodSelected && <span className="sdb-child-chip-check">✓ </span>}
                        <span>{foodLabel}</span>
                        {isFoodSelected && qtyBadge && (
                          <span className="sdb-food-chip-qty-pill">· {qtyBadge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Foods List & Input */}
                <div className="sdb-custom-food-section">
                  {(customFoods[activeCategorySubmenu] || []).length > 0 && (
                    <div className="sdb-custom-foods-list">
                      {(customFoods[activeCategorySubmenu] || []).map(customItem => {
                        const qtyKey = getFoodQuantityKey(activeCategorySubmenu, customItem, true);
                        const itemQty = foodQuantities[qtyKey];
                        const qtyBadge = formatFoodItemQuantity(itemQty, t);

                        return (
                          <span key={customItem} className="sdb-custom-food-badge">
                            <span>{customItem}</span>
                            {qtyBadge && <span className="sdb-food-chip-qty-pill">· {qtyBadge}</span>}
                            <button
                              type="button"
                              id={`btn-remove-custom-${customItem}`}
                              className="sdb-custom-food-remove"
                              onClick={() => handleRemoveCustomFood(activeCategorySubmenu, customItem)}
                              aria-label={`${t.sdb_remove_custom_food} ${customItem}`}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="sdb-custom-food-input-row">
                    <input
                      id={`sdb-custom-food-input-${activeCategorySubmenu}`}
                      type="text"
                      className="sdb-custom-food-input"
                      value={customFoodInputs[activeCategorySubmenu] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setCustomFoodInputs(prev => ({ ...prev, [activeCategorySubmenu]: val }));
                        if (customFoodErrors[activeCategorySubmenu]) {
                          setCustomFoodErrors(prev => ({ ...prev, [activeCategorySubmenu]: '' }));
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomFood(activeCategorySubmenu);
                        }
                      }}
                      placeholder={t.sdb_custom_food_placeholder}
                      maxLength={50}
                    />
                    <button
                      type="button"
                      id={`btn-add-custom-food-${activeCategorySubmenu}`}
                      className="sdb-btn-add-custom"
                      onClick={() => handleAddCustomFood(activeCategorySubmenu)}
                    >
                      {t.sdb_add_custom_food_btn}
                    </button>
                  </div>
                  {customFoodErrors[activeCategorySubmenu] && (
                    <p className="sdb-custom-food-error" role="alert">
                      {customFoodErrors[activeCategorySubmenu]}
                    </p>
                  )}
                </div>

                {/* ── Phase 28: Optional Portion / Quantity Controls for Selected Foods ── */}
                {(() => {
                  const selectedCanonical = (foodSelections[activeCategorySubmenu] || []).map(k => {
                    const opt = findFoodOption(activeCategorySubmenu, k);
                    const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : k;
                    return { key: k, displayName: label, isCustom: false };
                  });
                  const selectedCustom = (customFoods[activeCategorySubmenu] || []).map(c => ({
                    key: c,
                    displayName: c,
                    isCustom: true,
                  }));
                  const allSelectedItems = [...selectedCanonical, ...selectedCustom];
                  if (allSelectedItems.length === 0) return null;

                  return (
                    <div className="sdb-food-portions-section" id={`sdb-portions-section-${activeCategorySubmenu}`}>
                      <div className="sdb-portions-header">
                        <span className="sdb-portions-title">⚖️ {t.sdb_quantity_breakdown}</span>
                        <span className="sdb-optional">({t.sdb_optional})</span>
                      </div>
                      <div className="sdb-portions-list">
                        {allSelectedItems.map(item => {
                          const qtyKey = getFoodQuantityKey(activeCategorySubmenu, item.key, item.isCustom);
                          const curQty = foodQuantities[qtyKey];
                          const isQuantified = !!(curQty && curQty.amount > 0);
                          const defaultUnit = getDefaultFoodUnit(activeCategorySubmenu, item.key);

                          return (
                            <div key={item.key} className="sdb-portion-item-row" id={`sdb-portion-row-${item.key}`}>
                              <span className="sdb-portion-item-name">{item.displayName}</span>
                              {isQuantified ? (
                                <div className="sdb-portion-controls">
                                  <button
                                    type="button"
                                    className="sdb-qty-btn sdb-qty-btn--minus"
                                    id={`btn-qty-minus-${item.key}`}
                                    onClick={() => {
                                      const next = Math.max(0, Number((curQty.amount - 1).toFixed(1)));
                                      if (next <= 0) {
                                        handleRemoveQuantity(qtyKey);
                                      } else {
                                        handleUpdateQuantity(qtyKey, next, curQty.unit, curQty.customUnit);
                                      }
                                    }}
                                    aria-label={`Decrease ${item.displayName}`}
                                  >
                                    –
                                  </button>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.1"
                                    id={`input-qty-amount-${item.key}`}
                                    className="sdb-qty-input"
                                    value={curQty.amount}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value);
                                      if (isNaN(val) || val <= 0) {
                                        handleRemoveQuantity(qtyKey);
                                      } else {
                                        handleUpdateQuantity(qtyKey, val, curQty.unit, curQty.customUnit);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="sdb-qty-btn sdb-qty-btn--plus"
                                    id={`btn-qty-plus-${item.key}`}
                                    onClick={() => {
                                      handleUpdateQuantity(qtyKey, Number((curQty.amount + 1).toFixed(1)), curQty.unit, curQty.customUnit);
                                    }}
                                    aria-label={`Increase ${item.displayName}`}
                                  >
                                    +
                                  </button>
                                  <select
                                    id={`select-qty-unit-${item.key}`}
                                    className="sdb-qty-unit-select"
                                    value={curQty.unit}
                                    onChange={e => {
                                      handleUpdateQuantity(qtyKey, curQty.amount, e.target.value as FoodQuantityUnit, curQty.customUnit);
                                    }}
                                  >
                                    {FOOD_QUANTITY_UNITS.map(u => (
                                      <option key={u} value={u}>
                                        {(t[`sdb_unit_${u}` as keyof typeof t] as string | undefined) || u}
                                      </option>
                                    ))}
                                  </select>
                                  {curQty.unit === 'custom' && (
                                    <input
                                      type="text"
                                      className="sdb-qty-custom-unit-input"
                                      id={`input-qty-custom-unit-${item.key}`}
                                      placeholder="unit..."
                                      value={curQty.customUnit || ''}
                                      onChange={e => {
                                        handleUpdateQuantity(qtyKey, curQty.amount, 'custom', e.target.value);
                                      }}
                                      maxLength={20}
                                    />
                                  )}
                                  <button
                                    type="button"
                                    className="sdb-qty-clear-btn"
                                    id={`btn-qty-clear-${item.key}`}
                                    title={t.sdb_qty_clear}
                                    onClick={() => handleRemoveQuantity(qtyKey)}
                                    aria-label={`${t.sdb_qty_clear} ${item.displayName}`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="sdb-add-qty-pill-btn"
                                  id={`btn-add-portion-${item.key}`}
                                  onClick={() => {
                                    handleUpdateQuantity(qtyKey, 1, defaultUnit);
                                  }}
                                >
                                  + {t.sdb_qty_add}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── Meal / Block Type (Secondary Metadata, Below Food Categories) ── */}
          <div className="sdb-field sdb-field--block-type">
            <label className="sdb-label sdb-label--secondary">{t.sdb_block_type}</label>
            <div className="sdb-type-grid">
              {BLOCK_TYPE_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  id={`btn-block-type-${key}`}
                  className={`sdb-type-chip ${type === key ? 'sdb-type-chip--active' : ''}`}
                  onClick={() => {
                    setType(key);
                    setMealType(key as MealTypeKey);
                  }}
                >
                  <span className="sdb-chip-icon">{BLOCK_TYPE_ICONS[key as BlockTypeKey]}</span>
                  <span className="sdb-chip-label">{t[`sdb_type_${key}` as keyof typeof t] as string}</span>
                </button>
              ))}
            </div>

            {/* Canonical Outcome / Status Dropdown (Phase 27 Requirement 3) */}
            {isToday && (
              <div className="sdb-outcome-select-row">
                <label className="sdb-sublabel" htmlFor="sdb-outcome-select">
                  {t.sdb_select_outcome}:
                </label>
                <select
                  id="sdb-outcome-select"
                  className="sdb-select sdb-select--sm"
                  value={selectedOutcome}
                  onChange={e => setSelectedOutcome(e.target.value as DetailedBlockOutcome | 'none')}
                  aria-label={t.sdb_select_outcome}
                >
                  <option value="none">{t.sdb_outcome_none}</option>
                  <option value="on_track">{t.sdb_outcome_on_track}</option>
                  <option value="adjusted_on_track">{t.sdb_outcome_adjusted_on_track}</option>
                  <option value="near_slip">{t.sdb_outcome_near_slip}</option>
                  <option value="structured_slip">{t.sdb_outcome_structured_slip}</option>
                  <option value="unstructured_slip">{t.sdb_outcome_unstructured_slip}</option>
                  <option value="planned_unstructured">{t.sdb_outcome_planned_unstructured}</option>
                  <option value="twenty_percent_off_track">{t.sdb_outcome_twenty_percent_off_track}</option>
                </select>
              </div>
            )}
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

      {previewPhotoIndex !== null && (
        <PhotoPreviewModal
          photos={foodPhotos.map((p, idx) => ({
            id: p.id,
            dataUrl: photoPreviewUrls[p.id] || getPhotoDataUrlSync(p.id),
            caption: `${t.sdb_food_photos} (${idx + 1}/${foodPhotos.length})`,
          }))}
          initialIndex={previewPhotoIndex}
          onClose={() => setPreviewPhotoIndex(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ── Lightweight Diet Slip Verification Modal ──────────────────────────────────

interface DietSlipModalProps {
  block: StructuredDietBlock;
  initialOutcome?: DetailedBlockOutcome;
  initialResumed?: boolean;
  initialDriftState?: DriftState;
  initialActualItems?: string[];
  initialActualCategories?: FoodCategoryKey[];
  initialCustomText?: string;
  onSave: (
    actualItems: string[],
    customText: string,
    outcome?: DetailedBlockOutcome,
    isResumed?: boolean,
    actualCategories?: FoodCategoryKey[],
    driftState?: DriftState
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
  initialDriftState = 'none',
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
  const [driftState, setDriftState] = useState<DriftState>(initialDriftState);
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

  const primaryDesc = getBlockPrimaryDescription(block, t);
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
            <span className="sdb-slip-modal-badge">{t.sdb_slip_modal_badge}</span>
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
              {formatTime(block.startTime)} - {formatTime(block.endTime)} · {primaryDesc.toLowerCase() !== typeName.toLowerCase() ? `${primaryDesc} (${typeName})` : primaryDesc}
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
                const def = (t[`sdb_outcome_def_${key}` as keyof typeof t] as string) || '';
                const isSelected = outcome === key;
                return (
                  <button
                    key={key}
                    id={`btn-modal-outcome-${key}`}
                    type="button"
                    className={`sdb-outcome-chip sdb-outcome-chip--slip ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                    onClick={() => setOutcome(key)}
                    aria-pressed={isSelected}
                    title={def || label}
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

          {/* Drift Lifecycle Selection (Eligible Slips) */}
          {(outcome === 'structured_slip' || outcome === 'unstructured_slip') && (
            <div className="sdb-field sdb-field--drift">
              <label className="sdb-label">{t.sdb_drift_title}:</label>
              <div className="sdb-drift-btn-group">
                <button
                  type="button"
                  id="btn-modal-drift-none"
                  className={`sdb-drift-chip ${(!driftState || driftState === 'none') ? 'sdb-drift-chip--active' : ''}`}
                  onClick={() => setDriftState('none')}
                >
                  {t.sdb_no_drift_entered}
                </button>
                <button
                  type="button"
                  id="btn-modal-drift-started"
                  className={`sdb-drift-chip ${driftState === 'started' ? 'sdb-drift-chip--active' : ''}`}
                  onClick={() => setDriftState('started')}
                >
                  🌊 {t.sdb_drift_start}
                </button>
                <button
                  type="button"
                  id="btn-modal-drift-drifting"
                  className={`sdb-drift-chip ${driftState === 'drifting' ? 'sdb-drift-chip--active' : ''}`}
                  onClick={() => setDriftState('drifting')}
                >
                  〰️ {t.sdb_drift_still}
                </button>
                <button
                  type="button"
                  id="btn-modal-drift-stopped"
                  className={`sdb-drift-chip ${driftState === 'stopped' ? 'sdb-drift-chip--active' : ''}`}
                  onClick={() => setDriftState('stopped')}
                >
                  🛑 {t.sdb_drift_stopped}
                </button>
              </div>
            </div>
          )}

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
            <label className="sdb-label">{t.sdb_slip_actual_items_label}:</label>
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
            <label className="sdb-label">{t.sdb_slip_notes_label}:</label>
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
              {t.sdb_slip_notes_label}
              <span className="sdb-optional">{t.sdb_optional}</span>
            </label>
            <input
              id="sdb-slip-custom-text"
              className="sdb-input"
              type="text"
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder={t.sdb_slip_notes_placeholder}
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
            onClick={() => onSave(actualItems, customText, outcome, isResumed, actualCategories, driftState)}
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
  onUpdateDriftState?: (state: DriftState) => void;
  onVerifyOnTrack?: () => void;
  onOpenSlipModal?: (outcome?: DetailedBlockOutcome) => void;
  onClearStatus?: () => void;
  onNavigate?: (screen: Screen) => void;
  onQuickUpdateTime?: (startTime: string, endTime: string) => void;
  onQuickUpdateDescription?: (customText: string) => void;
  onQuickUpdateCategories?: (foodCategories: FoodCategoryKey[]) => void;
  onPreviewPhotos?: (photos: PhotoPreviewItem[], initialIndex?: number) => void;
  onQuickAddPhoto?: (blockId: string, photo: FoodPhotoMetadata) => void;
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
  onUpdateDriftState,
  onVerifyOnTrack,
  onOpenSlipModal,
  onClearStatus,
  onNavigate,
  onQuickUpdateTime,
  onQuickUpdateDescription,
  onQuickUpdateCategories,
  onPreviewPhotos,
  onQuickAddPhoto,
}: BlockCardProps) {
  const typeKey = block.type as BlockTypeKey;
  const typeIcon = BLOCK_TYPE_ICONS[typeKey] ?? '🍽️';
  const typeName = (t[`sdb_type_${block.type}` as keyof typeof t] as string | undefined) ?? block.type;
  const overnight = isOvernightBlock(block);

  // Photos state: prioritize verification photos if present so attached photos remain visible
  const photos = useMemo(() => {
    if (verification?.foodPhotos && verification.foodPhotos.length > 0) {
      return verification.foodPhotos;
    }
    if (verification?.foodPhoto) {
      return [verification.foodPhoto];
    }
    return getBlockPhotos(block);
  }, [verification?.foodPhotos, verification?.foodPhoto, block]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of photos) {
      const sync = getPhotoDataUrlSync(p.id);
      if (sync) map[p.id] = sync;
    }
    return map;
  });
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [cardPhotoError, setCardPhotoError] = useState<string | null>(null);
  const cardPhotoErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const cardCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (cardPhotoErrorTimeoutRef.current) {
        clearTimeout(cardPhotoErrorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    for (const p of photos) {
      if (!photoUrls[p.id]) {
        getFoodPhoto(p.id).then(record => {
          if (isSubscribed && record?.dataUrl) {
            setPhotoUrls(prev => ({ ...prev, [p.id]: record.dataUrl }));
          }
        });
      }
    }
    return () => {
      isSubscribed = false;
    };
  }, [photos, photoUrls]);

  const handleCardPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (cardPhotoErrorTimeoutRef.current) {
      clearTimeout(cardPhotoErrorTimeoutRef.current);
      cardPhotoErrorTimeoutRef.current = null;
    }
    setCardPhotoError(null);

    if (!isValidImageFile(file)) {
      setCardPhotoError(t.sdb_err_invalid_image);
      cardPhotoErrorTimeoutRef.current = setTimeout(() => setCardPhotoError(null), 5000);
      return;
    }

    setIsAddingPhoto(true);
    try {
      const meta = await saveFoodPhoto(file);
      const sync = getPhotoDataUrlSync(meta.id);
      if (sync) {
        setPhotoUrls(prev => ({ ...prev, [meta.id]: sync }));
      }
      onQuickAddPhoto?.(block.id, meta);
    } catch (err) {
      console.error('Error adding photo directly:', err);
      const msg = getLocalizedPhotoErrorMessage(err, t);
      setCardPhotoError(msg);
      cardPhotoErrorTimeoutRef.current = setTimeout(() => setCardPhotoError(null), 5000);
    } finally {
      setIsAddingPhoto(false);
    }
  };

  // Food categories calculation (Phase 2)
  const blockCategories: FoodCategoryKey[] = Array.isArray(block.foodCategories) && block.foodCategories.length > 0
    ? block.foodCategories
    : (Array.isArray(block.items) ? mapLegacyItemsToCategories(block.items) : []);

  // Determine meal description:
  // Phase 26I: Prioritize actual food description over generic meal/block type
  const initialMealDescription = getBlockPrimaryDescription(block, t);

  const [desc, setDesc] = useState(initialMealDescription);
  const [activePicker, setActivePicker] = useState<'none' | 'on_track' | 'slip'>('none');
  const [isChanging, setIsChanging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStructureBlock = block.type === 'micro_fasting' || block.type === 'kitchen_closed';
  const primaryCategory = blockCategories[0];
  const cardIcon = isStructureBlock
    ? typeIcon
    : (desc.toLowerCase().includes('banana') ? '🍌' : null) || (primaryCategory ? FOOD_CATEGORY_ICONS[primaryCategory] : null) || typeIcon;

  const previewItems: PhotoPreviewItem[] = useMemo(
    () =>
      photos.map((p, idx) => ({
        id: p.id,
        dataUrl: photoUrls[p.id] || getPhotoDataUrlSync(p.id),
        caption: `${desc} (${idx + 1}/${photos.length})`,
      })),
    [photos, photoUrls, desc]
  );

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

  const isEligibleSlip = verification ? isEligibleSlipForDrift(verification) : false;

  return (
    <div
      className={`sdb-block-card ${isToday && verification ? `sdb-block-card--verified sdb-block-card--${verification.status}` : ''}`}
      id={`sdb-block-${block.id}`}
    >
      {/* ── Top row: Times + Delete ── */}
      <div className="sdb-block-top">
        <div className="sdb-block-times-row">
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
          <span className="sdb-block-arrow">→</span>
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
          {((desc && desc.trim().toLowerCase() !== typeName.trim().toLowerCase()) || block.mealType) && (
            <span className="sdb-block-meal-type-badge" id={`sdb-meal-type-badge-${block.id}`}>
              {block.mealType ? ((t[`sdb_meal_type_${block.mealType}` as keyof typeof t] as string | undefined) || block.mealType) : typeName}
            </span>
          )}
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

      {/* Hidden file inputs for direct camera photo capture and gallery fallback */}
      <input
        ref={cardCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCardPhotoSelect}
      />
      <input
        ref={cardFileInputRef}
        type="file"
        accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
        style={{ display: 'none' }}
        onChange={handleCardPhotoSelect}
      />

      {cardPhotoError && (
        <div
          className="sdb-block-photo-card-error"
          role="alert"
          onClick={() => setCardPhotoError(null)}
          title="Click to dismiss"
        >
          <span className="sdb-block-photo-card-error-icon" aria-hidden="true">⚠️</span>
          <span className="sdb-block-photo-card-error-text">{cardPhotoError}</span>
          <button
            type="button"
            className="sdb-block-photo-card-error-close"
            onClick={(e) => {
              e.stopPropagation();
              setCardPhotoError(null);
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="sdb-block-desc-row">
        <div className="sdb-block-media-group">
          {photos.length === 0 ? (
            <>
              <span className="sdb-block-icon" aria-hidden="true">{cardIcon}</span>
              <button
                type="button"
                id={`btn-direct-add-photo-${block.id}`}
                className="sdb-block-camera-btn"
                onClick={() => cardCameraInputRef.current?.click()}
                disabled={isAddingPhoto}
                aria-label={`${t.sdb_add_photo}: ${desc}`}
                title={t.sdb_take_photo || t.sdb_add_photo}
              >
                <span className="sdb-camera-icon">📷</span>
              </button>
            </>
          ) : (
            <div className="sdb-block-photos-cluster">
              {photos.slice(0, 2).map((p, idx) => {
                const url = photoUrls[p.id] || getPhotoDataUrlSync(p.id);
                return (
                  <button
                    key={p.id || idx}
                    type="button"
                    id={`btn-photo-thumb-${block.id}-${idx}`}
                    className="sdb-block-photo-thumb-btn"
                    onClick={() => onPreviewPhotos?.(previewItems, idx)}
                    aria-label={`${t.sdb_view_photo} ${idx + 1}: ${desc}`}
                    title={`${t.sdb_view_photo} (${idx + 1}/${photos.length})`}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`${desc || t.sdb_food_photo} (${idx + 1})`}
                        className="sdb-block-photo-thumb"
                      />
                    ) : (
                      <div className="sdb-block-photo-thumb-placeholder">📷</div>
                    )}
                  </button>
                );
              })}

              {photos.length > 2 && (
                <button
                  type="button"
                  id={`btn-photo-more-${block.id}`}
                  className="sdb-block-photo-more-btn"
                  onClick={() => onPreviewPhotos?.(previewItems, 2)}
                  aria-label={`+${photos.length - 2} more photos: ${desc}`}
                  title={`+${photos.length - 2} more photos`}
                >
                  +{photos.length - 2}
                </button>
              )}

              <button
                type="button"
                id={`btn-direct-add-photo-plus-${block.id}`}
                className="sdb-block-camera-btn sdb-block-camera-btn--plus"
                onClick={() => cardCameraInputRef.current?.click()}
                disabled={isAddingPhoto}
                aria-label={`${t.sdb_add_another_photo}: ${desc}`}
                title={t.sdb_take_photo || t.sdb_add_another_photo}
              >
                <span className="sdb-camera-icon">📷</span>
                <span className="sdb-camera-plus-badge">+</span>
              </button>
            </div>
          )}
        </div>

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

      {/* ── Phase 7C & Phase 28: Specific Food Selections & Portions Summary Line ── */}
      {(() => {
        const specificLabels: string[] = [];
        const quantities = verification?.actualFoodQuantities || verification?.foodQuantities || block.foodQuantities;

        if (block.foodSelections) {
          for (const [cat, foods] of Object.entries(block.foodSelections)) {
            if (Array.isArray(foods)) {
              for (const foodKey of foods) {
                const opt = findFoodOption(cat as FoodCategoryKey, foodKey);
                const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : foodKey;
                const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, foodKey);
                const qty = quantities?.[qtyKey];
                const qtyStr = formatFoodItemQuantity(qty, t);
                const displayItem = qtyStr ? `${qtyStr} ${label}` : label;
                if (displayItem && !specificLabels.includes(displayItem)) specificLabels.push(displayItem);
              }
            }
          }
        }
        if (block.customFoods) {
          for (const [cat, customList] of Object.entries(block.customFoods)) {
            if (Array.isArray(customList)) {
              for (const cFood of customList) {
                const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, cFood, true);
                const qty = quantities?.[qtyKey];
                const qtyStr = formatFoodItemQuantity(qty, t);
                const displayItem = qtyStr ? `${qtyStr} ${cFood}` : cFood;
                if (displayItem && !specificLabels.includes(displayItem)) specificLabels.push(displayItem);
              }
            }
          }
        }
        // Phase 26I: If primary description already matches this food and no quantity is set, avoid redundant duplication
        const remainingLabels = specificLabels.filter(label => {
          const lowerDesc = desc.toLowerCase();
          const lowerLabel = label.toLowerCase();
          return !lowerDesc.includes(lowerLabel) || label.includes(' ');
        });
        if (remainingLabels.length === 0) return null;

        const maxVisible = 4;
        const visibleLabels = remainingLabels.slice(0, maxVisible);
        const remainingCount = remainingLabels.length - maxVisible;

        return (
          <div className="sdb-block-specific-foods" id={`sdb-specific-foods-${block.id}`}>
            <span className="sdb-specific-foods-bullet">•</span>
            <span className="sdb-specific-foods-text">
              {visibleLabels.join(' • ')}
              {remainingCount > 0 && ` • +${remainingCount}`}
            </span>
          </div>
        );
      })()}

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

              {/* Recovery & Drift for Eligible Slips (Phase 26D) */}
              {isEligibleSlip && (
                <div className="sdb-recovery-drift-container">
                  <div className="sdb-recovery-row">
                    <span className="sdb-recovery-subhead">{t.sdb_recovery_section_title}</span>
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

                  <div className="sdb-drift-ctrl-wrap">
                    <span className="sdb-drift-subhead">{t.sdb_drift_title}</span>
                    <div className="sdb-drift-btn-group">
                      {(!verification.driftState || verification.driftState === 'none') && (
                        <button
                          id={`btn-drift-start-${block.id}`}
                          type="button"
                          className="sdb-drift-action-btn sdb-drift-action-btn--start"
                          onClick={() => onUpdateDriftState?.('started')}
                        >
                          <span className="sdb-drift-btn-icon">🌊</span>
                          <span>{t.sdb_drift_start}</span>
                        </button>
                      )}

                      {(verification.driftState === 'started' || verification.driftState === 'drifting') && (
                        <>
                          <button
                            id={`btn-drift-still-${block.id}`}
                            type="button"
                            className={`sdb-drift-action-btn sdb-drift-action-btn--drifting ${verification.driftState === 'drifting' ? 'sdb-drift-action-btn--active' : ''}`}
                            onClick={() => onUpdateDriftState?.('drifting')}
                          >
                            <span className="sdb-drift-btn-icon">〰️</span>
                            <span>{t.sdb_drift_still}</span>
                          </button>
                          <button
                            id={`btn-drift-stop-${block.id}`}
                            type="button"
                            className="sdb-drift-action-btn sdb-drift-action-btn--stop"
                            onClick={() => onUpdateDriftState?.('stopped')}
                          >
                            <span className="sdb-drift-btn-icon">🛑</span>
                            <span>{t.sdb_drift_stopped}</span>
                          </button>
                        </>
                      )}

                      {verification.driftState === 'stopped' && (
                        <div className="sdb-drift-stopped-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="sdb-drift-status-badge sdb-drift-status-badge--stopped">
                            <span className="sdb-drift-badge-icon">✓</span>
                            <span>{t.sdb_drift_stopped}</span>
                          </div>
                          {onNavigate && (
                            <button
                              id={`btn-drift-recommit-${block.id}`}
                              type="button"
                              className="sdb-drift-recommit-btn"
                              onClick={() => onNavigate('recommit')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                background: 'rgba(74, 222, 128, 0.15)',
                                border: '1px solid rgba(74, 222, 128, 0.35)',
                                borderRadius: '14px',
                                color: '#4ade80',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <span>⚡</span>
                              <span>{t.recommit_title || 'Re-Commit'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Show actual consumed details whenever present and recorded */}
              {(verification.actualItems?.length || (verification.actualCustomText && verification.actualCustomText.trim().toLowerCase() !== desc.trim().toLowerCase())) && (
                <div className="sdb-verified-actual-row">
                  <span className="sdb-actual-label">{t.sdb_v_actual_label || 'Actual'}:</span>
                  <span className="sdb-actual-text">
                    {[
                      ...(verification.actualItems?.map(k => (t[`sdb_food_${k}` as keyof typeof t] as string) ?? k) || []),
                      (verification.actualCustomText && verification.actualCustomText.trim().toLowerCase() !== desc.trim().toLowerCase() ? verification.actualCustomText : undefined),
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

              {/* Practice Resume-Ability & Re-Commit secondary links */}
              {verification.status === 'slip' && onNavigate && (
                <div className="sdb-slip-recovery-links" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                  <button
                    id={`btn-slip-recommit-${block.id}`}
                    type="button"
                    className="sdb-slip-recommit-btn"
                    onClick={() => onNavigate('recommit')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      background: 'rgba(74, 222, 128, 0.15)',
                      border: '1px solid rgba(74, 222, 128, 0.35)',
                      borderRadius: '14px',
                      color: '#4ade80',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <span>⚡</span>
                    <span>{t.recommit_title || 'Re-Commit'}</span>
                  </button>
                  <button
                    id={`btn-practice-ra-${block.id}`}
                    type="button"
                    className="sdb-practice-ra-link"
                    onClick={() => onNavigate('slip-type')}
                  >
                    {t.sdb_v_practice_ra} →
                  </button>
                </div>
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
                      const def = (t[`sdb_outcome_def_${key}` as keyof typeof t] as string) || '';
                      const isSelected = verification?.detailedOutcome === key;
                      return (
                        <button
                          key={key}
                          id={`btn-outcome-${key}-${block.id}`}
                          type="button"
                          className={`sdb-outcome-chip sdb-outcome-chip--ontrack ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                          onClick={() => handleSelectOutcome(key, 'on-track')}
                          title={def || label}
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
                      const def = (t[`sdb_outcome_def_${key}` as keyof typeof t] as string) || '';
                      const isSelected = verification?.detailedOutcome === key;
                      return (
                        <button
                          key={key}
                          id={`btn-outcome-${key}-${block.id}`}
                          type="button"
                          className={`sdb-outcome-chip sdb-outcome-chip--slip ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                          onClick={() => handleSelectOutcome(key, 'slip')}
                          title={def || label}
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

// ── Food Log Modal (Phase 26A: Flexible / In-the-Moment Logging) ──────────────
// Allows recording what actually happened WITHOUT a pre-existing planned block.
// Uses saveUnplannedFoodLog() so it never mutates the weekly plan.

interface FoodLogModalProps {
  onSave: (
    description: string,
    foodCategories: FoodCategoryKey[],
    outcome: DetailedBlockOutcome,
    status: DietVerificationStatus,
    mealType?: MealTypeKey,
    foodSelections?: Partial<Record<FoodCategoryKey, string[]>>,
    customFoods?: Partial<Record<FoodCategoryKey, string[]>>,
    foodPhotos?: FoodPhotoMetadata[],
    foodQuantities?: FoodQuantitiesMap
  ) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

// All outcomes are available for unplanned logs since there is no plan context.
// Ordering: positive outcomes first, then graded slip outcomes.
const ALL_LOG_OUTCOMES: readonly DetailedBlockOutcome[] = [
  'on_track',
  'adjusted_on_track',
  'planned_unstructured',
  'twenty_percent_off_track',
  'near_slip',
  'structured_slip',
  'unstructured_slip',
] as const;

// Map outcome → top-level status so saveUnplannedFoodLog gets the correct status
function outcomeToStatus(outcome: DetailedBlockOutcome): DietVerificationStatus {
  if (
    outcome === 'on_track' ||
    outcome === 'adjusted_on_track' ||
    outcome === 'planned_unstructured' ||
    outcome === 'twenty_percent_off_track'
  ) {
    return 'on-track';
  }
  return 'slip';
}

function FoodLogModal({ onSave, onCancel, t }: FoodLogModalProps) {
  const autoTime = useMemo(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }, []);

  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<MealTypeKey | undefined>('lunch');
  const [selectedCategories, setSelectedCategories] = useState<FoodCategoryKey[]>([]);
  const [activeCategorySubmenu, setActiveCategorySubmenu] = useState<FoodCategoryKey | null>(null);
  const [foodSelections, setFoodSelections] = useState<FoodSelectionsMap>({});
  const [customFoods, setCustomFoods] = useState<CustomFoodsMap>({});
  const [foodQuantities, setFoodQuantities] = useState<FoodQuantitiesMap>({});
  const [customFoodInputs, setCustomFoodInputs] = useState<Record<string, string>>({});
  const [customFoodErrors, setCustomFoodErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<DetailedBlockOutcome>('on_track');

  // Photo attachments state (Phase 27)
  const [foodPhotos, setFoodPhotos] = useState<FoodPhotoMetadata[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<Record<string, string>>({});
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handleAddPhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!isValidImageFile(file)) {
      setPhotoError(t.sdb_err_invalid_image);
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError('');

    try {
      const meta = await saveFoodPhoto(file);
      const dataUrl = getPhotoDataUrlSync(meta.id);
      setFoodPhotos(prev => [...prev, meta]);
      if (dataUrl) {
        setPhotoPreviewUrls(prev => ({ ...prev, [meta.id]: dataUrl }));
      }
    } catch (err) {
      console.error('Error adding photo:', err);
      setPhotoError(getLocalizedPhotoErrorMessage(err, t));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const photoToRemove = foodPhotos[index];
    setFoodPhotos(prev => prev.filter((_, i) => i !== index));
    if (photoToRemove?.id) {
      setTimeout(() => {
        const store = loadDietStore();
        const verifs = loadAllDietVerifications();
        if (!isPhotoReferenced(photoToRemove.id, store, verifs)) {
          deleteFoodPhoto(photoToRemove.id).catch(() => {});
        }
      }, 50);
    }
  };

  const toggleCategory = (key: FoodCategoryKey) => {
    const isSelected = selectedCategories.includes(key);
    if (isSelected) {
      if (activeCategorySubmenu === key) {
        setSelectedCategories(prev => prev.filter(k => k !== key));
        setFoodSelections(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setCustomFoods(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setActiveCategorySubmenu(null);
      } else {
        setActiveCategorySubmenu(key);
      }
    } else {
      setSelectedCategories(prev => [...prev, key]);
      setActiveCategorySubmenu(key);
    }
  };

  const toggleSpecificFood = (cat: FoodCategoryKey, foodKey: string) => {
    setFoodSelections(prev => {
      const curList = prev[cat] || [];
      const isAdding = !curList.includes(foodKey);
      const nextList = isAdding
        ? [...curList, foodKey]
        : curList.filter(f => f !== foodKey);

      const opt = findFoodOption(cat, foodKey);
      const foodLabel = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : foodKey;
      const formattedFood = foodLabel.charAt(0).toUpperCase() + foodLabel.slice(1).replace(/_/g, ' ');

      if (isAdding && !description.trim()) {
        setDescription(formattedFood);
      }

      if (!isAdding) {
        const qtyKey = getFoodQuantityKey(cat, foodKey, false);
        setFoodQuantities(q => {
          if (!q[qtyKey]) return q;
          const next = { ...q };
          delete next[qtyKey];
          return next;
        });
      }

      const next = { ...prev };
      if (nextList.length > 0) {
        next[cat] = nextList;
      } else {
        delete next[cat];
      }
      return next;
    });
  };

  const handleAddCustomFood = (cat: FoodCategoryKey) => {
    const raw = (customFoodInputs[cat] || '').trim();
    if (!raw) return;

    const curCanonical = foodSelections[cat] || [];
    const curCustom = customFoods[cat] || [];

    const isCanonicalDup = curCanonical.some(k => {
      const opt = findFoodOption(cat, k);
      const label = opt ? (t[opt.i18nKey as keyof typeof t] as string | undefined) : k;
      return k.toLowerCase() === raw.toLowerCase() || label?.toLowerCase() === raw.toLowerCase();
    });
    const isCustomDup = curCustom.some(c => c.toLowerCase() === raw.toLowerCase());

    if (isCanonicalDup || isCustomDup) {
      setCustomFoodErrors(prev => ({ ...prev, [cat]: t.sdb_custom_food_duplicate }));
      return;
    }

    if (!description.trim()) {
      setDescription(raw);
    }

    setCustomFoods(prev => ({
      ...prev,
      [cat]: [...(prev[cat] || []), raw],
    }));
    setCustomFoodInputs(prev => ({ ...prev, [cat]: '' }));
    setCustomFoodErrors(prev => ({ ...prev, [cat]: '' }));
  };

  const handleRemoveCustomFood = (cat: FoodCategoryKey, foodText: string) => {
    setCustomFoods(prev => ({
      ...prev,
      [cat]: (prev[cat] || []).filter(f => f !== foodText),
    }));
    const qtyKey = getFoodQuantityKey(cat, foodText, true);
    setFoodQuantities(q => {
      if (!q[qtyKey]) return q;
      const next = { ...q };
      delete next[qtyKey];
      return next;
    });
  };

  const handleUpdateQuantity = (
    key: string,
    amount: number,
    unit: FoodQuantityUnit,
    customUnit?: string
  ) => {
    setFoodQuantities(prev => {
      if (isNaN(amount) || amount <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const item: FoodItemQuantity = {
        amount,
        unit,
      };
      if (customUnit !== undefined && customUnit.trim()) {
        item.customUnit = customUnit.trim();
      }
      return {
        ...prev,
        [key]: item,
      };
    });
  };

  const handleRemoveQuantity = (key: string) => {
    setFoodQuantities(prev => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const handleSave = () => {
    let finalDesc = description.trim();
    if (!finalDesc && (Object.keys(foodSelections).length > 0 || Object.keys(customFoods).length > 0)) {
      const derived = getBlockPrimaryDescription({
        type: mealType || 'custom',
        foodSelections,
        customFoods,
      }, t);
      if (derived) finalDesc = derived;
    }
    onSave(
      finalDesc,
      selectedCategories,
      outcome,
      outcomeToStatus(outcome),
      mealType,
      foodSelections,
      customFoods,
      foodPhotos.length > 0 ? foodPhotos : undefined,
      Object.keys(foodQuantities).length > 0 ? foodQuantities : undefined
    );
  };

  return (
    <div
      className="sdb-overlay"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sdb-food-log-modal-title"
    >
      <div className="sdb-modal sdb-slip-modal sdb-food-log-modal" ref={modalRef}>
        <div className="sdb-modal-header">
          <div className="sdb-slip-modal-header-text">
            <span className="sdb-slip-modal-badge sdb-food-log-badge">{t.sdb_food_log_modal_badge}</span>
            <h2 id="sdb-food-log-modal-title" className="sdb-modal-title">
              {t.sdb_food_log_modal_title}
            </h2>
          </div>
          <button className="sdb-modal-close" onClick={onCancel} aria-label={t.commit_cancel}>
            ✕
          </button>
        </div>

        <div className="sdb-modal-body">
          {/* Automatic Timestamp Badge (No manual time selection required) */}
          <div className="sdb-food-log-time-badge" id="sdb-food-log-auto-time">
            <span className="sdb-time-clock-icon">🕒</span>
            <span>{t.sdb_food_log_auto_time}: {autoTime}</span>
          </div>

          {/* Meal Type Selection */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_block_type}:</label>
            <div className="sdb-type-grid">
              {MEAL_TYPE_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  id={`btn-food-log-type-${key}`}
                  className={`sdb-type-chip ${mealType === key ? 'sdb-type-chip--active' : ''}`}
                  onClick={() => setMealType(key)}
                >
                  <span className="sdb-chip-icon">
                    {key === 'breakfast' ? '🍳' : key === 'lunch' ? '🥗' : key === 'dinner' ? '🍲' : key === 'snack' ? '🍎' : '🍽️'}
                  </span>
                  <span className="sdb-chip-label">{(t[`sdb_meal_type_${key}` as keyof typeof t] as string | undefined) || key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Attachment (Phase 27 Requirement 4: Camera & Gallery) */}
          <div className="sdb-field sdb-photo-field">
            <label className="sdb-label">📷 {t.sdb_food_photos}:</label>
            <input
              ref={cameraFileInputRef}
              id="sdb-food-log-camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleAddPhotoFileSelect}
            />
            <input
              ref={galleryFileInputRef}
              id="sdb-food-log-gallery-input"
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
              style={{ display: 'none' }}
              onChange={handleAddPhotoFileSelect}
            />

            <div className="sdb-photo-gallery-editor">
              {foodPhotos.map((photo, idx) => {
                const url = photoPreviewUrls[photo.id] || getPhotoDataUrlSync(photo.id);
                return (
                  <div key={photo.id || idx} className="sdb-photo-item-card">
                    <button
                      type="button"
                      id={`btn-food-log-photo-view-${idx}`}
                      className="sdb-photo-item-thumb-btn"
                      onClick={() => setPreviewPhotoIndex(idx)}
                      title={`${t.sdb_view_photo} (${idx + 1}/${foodPhotos.length})`}
                      aria-label={`${t.sdb_view_photo} ${idx + 1}`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={`${t.sdb_food_photo} ${idx + 1}`}
                          className="sdb-photo-item-img"
                        />
                      ) : (
                        <div className="sdb-photo-item-placeholder">📷</div>
                      )}
                      <span className="sdb-photo-item-zoom-icon" aria-hidden="true">🔍</span>
                    </button>
                    <div className="sdb-photo-item-actions">
                      <button
                        type="button"
                        id={`btn-food-log-photo-remove-${idx}`}
                        className="sdb-btn-photo-mini sdb-btn-photo-mini--remove"
                        onClick={() => handleRemovePhoto(idx)}
                        disabled={isProcessingPhoto}
                        title={t.sdb_remove_photo}
                        aria-label={`${t.sdb_remove_photo} ${idx + 1}`}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="sdb-photo-actions-row">
                <button
                  type="button"
                  id="btn-food-log-take-photo"
                  className="sdb-btn-photo-action sdb-btn-photo-action--camera"
                  onClick={() => cameraFileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  title={t.sdb_take_photo}
                >
                  <span className="sdb-photo-btn-icon">📷</span>
                  <span className="sdb-photo-btn-label">{t.sdb_take_photo}</span>
                </button>
                <button
                  type="button"
                  id="btn-food-log-gallery-photo"
                  className="sdb-btn-photo-action sdb-btn-photo-action--gallery"
                  onClick={() => galleryFileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  title={t.sdb_choose_gallery}
                >
                  <span className="sdb-photo-btn-icon">🖼️</span>
                  <span className="sdb-photo-btn-label">{t.sdb_choose_gallery}</span>
                </button>
              </div>
            </div>
            {photoError && <p className="sdb-photo-error-msg" role="alert">{photoError}</p>}
          </div>

          {/* Description */}
          <div className="sdb-field">
            <label className="sdb-label" htmlFor="sdb-food-log-desc">
              {t.sdb_food_log_desc_label}
            </label>
            <input
              id="sdb-food-log-desc"
              className="sdb-input"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.sdb_food_log_desc_placeholder}
              maxLength={160}
              autoFocus
            />
          </div>

          {/* Food Category Chips */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_categories_label}:</label>
            <div className="sdb-food-grid">
              {FOOD_CATEGORY_KEYS.map(key => {
                const isSelected = selectedCategories.includes(key);
                const isSubmenuOpen = isSelected && activeCategorySubmenu === key;
                return (
                  <button
                    key={key}
                    id={`btn-food-log-cat-${key}`}
                    type="button"
                    className={`sdb-food-chip ${isSelected ? 'sdb-food-chip--active sdb-cat-chip--active' : ''} ${isSubmenuOpen ? 'sdb-cat-chip--open' : ''}`}
                    onClick={() => toggleCategory(key)}
                    aria-pressed={isSelected}
                  >
                    <span className="sdb-chip-icon">{FOOD_CATEGORY_ICONS[key]}</span>
                    <span>{t[`sdb_cat_${key}` as keyof typeof t] as string}</span>
                    {isSelected && (
                      <span className="sdb-cat-chip-arrow" aria-hidden="true">
                        {isSubmenuOpen ? ' ▲' : ' ▼'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Food Submenu Accordion for selected category */}
            {activeCategorySubmenu && selectedCategories.includes(activeCategorySubmenu) && (
              <div className="sdb-cat-submenu-container" id={`sdb-food-log-submenu-${activeCategorySubmenu}`}>
                <div className="sdb-cat-submenu-header">
                  <span className="sdb-cat-submenu-title">
                    {FOOD_CATEGORY_ICONS[activeCategorySubmenu]} {t[`sdb_cat_${activeCategorySubmenu}` as keyof typeof t] as string}: {t.sdb_food_submenu_title}
                  </span>
                  <button
                    type="button"
                    className="sdb-cat-submenu-close"
                    onClick={() => setActiveCategorySubmenu(null)}
                    aria-label={t.commit_cancel}
                  >
                    ✕
                  </button>
                </div>

                <div className="sdb-cat-food-grid sdb-specific-food-grid">
                  {getFoodOptionsForCategory(activeCategorySubmenu).map(opt => {
                    const isPicked = (foodSelections[activeCategorySubmenu] || []).includes(opt.key);
                    const optLabel = (t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key;
                    const qtyKey = getFoodQuantityKey(activeCategorySubmenu, opt.key);
                    const itemQty = foodQuantities[qtyKey];
                    const qtyBadge = isPicked ? formatFoodItemQuantity(itemQty, t) : '';

                    return (
                      <button
                        key={opt.key}
                        id={`btn-food-log-opt-${activeCategorySubmenu}-${opt.key}`}
                        type="button"
                        className={`sdb-food-child-chip sdb-food-option-btn ${isPicked ? 'sdb-food-child-chip--active sdb-food-option-btn--active' : ''}`}
                        onClick={() => toggleSpecificFood(activeCategorySubmenu, opt.key)}
                        aria-pressed={isPicked}
                      >
                        {isPicked && <span className="sdb-child-chip-check sdb-food-option-check">✓ </span>}
                        <span className="sdb-food-option-label">{optLabel}</span>
                        {isPicked && qtyBadge && (
                          <span className="sdb-food-chip-qty-pill">· {qtyBadge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom food items in this category */}
                <div className="sdb-custom-foods-section">
                  {(customFoods[activeCategorySubmenu] || []).length > 0 && (
                    <div className="sdb-custom-foods-list">
                      {(customFoods[activeCategorySubmenu] || []).map(cFood => {
                        const qtyKey = getFoodQuantityKey(activeCategorySubmenu, cFood, true);
                        const itemQty = foodQuantities[qtyKey];
                        const qtyBadge = formatFoodItemQuantity(itemQty, t);

                        return (
                          <span key={cFood} className="sdb-custom-food-tag">
                            <span className="sdb-custom-food-tag-icon">✨</span>
                            <span className="sdb-custom-food-tag-text">{cFood}</span>
                            {qtyBadge && <span className="sdb-food-chip-qty-pill">· {qtyBadge}</span>}
                            <button
                              type="button"
                              className="sdb-custom-food-remove-btn"
                              onClick={() => handleRemoveCustomFood(activeCategorySubmenu, cFood)}
                              aria-label={`${t.commit_delete}: ${cFood}`}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="sdb-custom-food-input-row">
                    <input
                      id={`input-food-log-custom-${activeCategorySubmenu}`}
                      type="text"
                      className="sdb-input sdb-custom-food-input"
                      placeholder={t.sdb_custom_food_placeholder}
                      value={customFoodInputs[activeCategorySubmenu] || ''}
                      onChange={e => {
                        const v = e.target.value;
                        setCustomFoodInputs(prev => ({ ...prev, [activeCategorySubmenu]: v }));
                        if (customFoodErrors[activeCategorySubmenu]) {
                          setCustomFoodErrors(prev => ({ ...prev, [activeCategorySubmenu]: '' }));
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomFood(activeCategorySubmenu);
                        }
                      }}
                      maxLength={60}
                    />
                    <button
                      type="button"
                      id={`btn-food-log-add-custom-${activeCategorySubmenu}`}
                      className="sdb-btn sdb-btn-add-custom-food"
                      onClick={() => handleAddCustomFood(activeCategorySubmenu)}
                    >
                      + {t.sdb_add_custom_food_btn}
                    </button>
                  </div>
                  {customFoodErrors[activeCategorySubmenu] && (
                    <p className="sdb-custom-food-error" role="alert">
                      {customFoodErrors[activeCategorySubmenu]}
                    </p>
                  )}
                </div>

                {/* ── Phase 28: Optional Portion / Quantity Controls for Food Log ── */}
                {(() => {
                  const selectedCanonical = (foodSelections[activeCategorySubmenu] || []).map(k => {
                    const opt = findFoodOption(activeCategorySubmenu, k);
                    const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : k;
                    return { key: k, displayName: label, isCustom: false };
                  });
                  const selectedCustom = (customFoods[activeCategorySubmenu] || []).map(c => ({
                    key: c,
                    displayName: c,
                    isCustom: true,
                  }));
                  const allSelectedItems = [...selectedCanonical, ...selectedCustom];
                  if (allSelectedItems.length === 0) return null;

                  return (
                    <div className="sdb-food-portions-section" id={`sdb-food-log-portions-${activeCategorySubmenu}`}>
                      <div className="sdb-portions-header">
                        <span className="sdb-portions-title">⚖️ {t.sdb_quantity_breakdown}</span>
                        <span className="sdb-optional">({t.sdb_optional})</span>
                      </div>
                      <div className="sdb-portions-list">
                        {allSelectedItems.map(item => {
                          const qtyKey = getFoodQuantityKey(activeCategorySubmenu, item.key, item.isCustom);
                          const curQty = foodQuantities[qtyKey];
                          const isQuantified = !!(curQty && curQty.amount > 0);
                          const defaultUnit = getDefaultFoodUnit(activeCategorySubmenu, item.key);

                          return (
                            <div key={item.key} className="sdb-portion-item-row" id={`sdb-food-log-portion-${item.key}`}>
                              <span className="sdb-portion-item-name">{item.displayName}</span>
                              {isQuantified ? (
                                <div className="sdb-portion-controls">
                                  <button
                                    type="button"
                                    className="sdb-qty-btn sdb-qty-btn--minus"
                                    id={`btn-food-log-qty-minus-${item.key}`}
                                    onClick={() => {
                                      const next = Math.max(0, Number((curQty.amount - 1).toFixed(1)));
                                      if (next <= 0) {
                                        handleRemoveQuantity(qtyKey);
                                      } else {
                                        handleUpdateQuantity(qtyKey, next, curQty.unit, curQty.customUnit);
                                      }
                                    }}
                                    aria-label={`Decrease ${item.displayName}`}
                                  >
                                    –
                                  </button>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.1"
                                    id={`input-food-log-qty-${item.key}`}
                                    className="sdb-qty-input"
                                    value={curQty.amount}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value);
                                      if (isNaN(val) || val <= 0) {
                                        handleRemoveQuantity(qtyKey);
                                      } else {
                                        handleUpdateQuantity(qtyKey, val, curQty.unit, curQty.customUnit);
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="sdb-qty-btn sdb-qty-btn--plus"
                                    id={`btn-food-log-qty-plus-${item.key}`}
                                    onClick={() => {
                                      handleUpdateQuantity(qtyKey, Number((curQty.amount + 1).toFixed(1)), curQty.unit, curQty.customUnit);
                                    }}
                                    aria-label={`Increase ${item.displayName}`}
                                  >
                                    +
                                  </button>
                                  <select
                                    id={`select-food-log-qty-unit-${item.key}`}
                                    className="sdb-qty-unit-select"
                                    value={curQty.unit}
                                    onChange={e => {
                                      handleUpdateQuantity(qtyKey, curQty.amount, e.target.value as FoodQuantityUnit, curQty.customUnit);
                                    }}
                                  >
                                    {FOOD_QUANTITY_UNITS.map(u => (
                                      <option key={u} value={u}>
                                        {(t[`sdb_unit_${u}` as keyof typeof t] as string | undefined) || u}
                                      </option>
                                    ))}
                                  </select>
                                  {curQty.unit === 'custom' && (
                                    <input
                                      type="text"
                                      className="sdb-qty-custom-unit-input"
                                      id={`input-food-log-custom-unit-${item.key}`}
                                      placeholder="unit..."
                                      value={curQty.customUnit || ''}
                                      onChange={e => {
                                        handleUpdateQuantity(qtyKey, curQty.amount, 'custom', e.target.value);
                                      }}
                                      maxLength={20}
                                    />
                                  )}
                                  <button
                                    type="button"
                                    className="sdb-qty-clear-btn"
                                    id={`btn-food-log-qty-clear-${item.key}`}
                                    title={t.sdb_qty_clear}
                                    onClick={() => handleRemoveQuantity(qtyKey)}
                                    aria-label={`${t.sdb_qty_clear} ${item.displayName}`}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="sdb-add-qty-pill-btn"
                                  id={`btn-food-log-add-portion-${item.key}`}
                                  onClick={() => {
                                    handleUpdateQuantity(qtyKey, 1, defaultUnit);
                                  }}
                                >
                                  + {t.sdb_qty_add}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Structural Outcome */}
          <div className="sdb-field">
            <label className="sdb-label">{t.sdb_food_log_outcome_label}:</label>
            <div className="sdb-outcome-modal-grid">
              {ALL_LOG_OUTCOMES.map(key => {
                const label = (t[`sdb_outcome_${key}` as keyof typeof t] as string) || key;
                const def = (t[`sdb_outcome_def_${key}` as keyof typeof t] as string) || '';
                const isSlipOutcome = outcomeToStatus(key) === 'slip';
                const isSelected = outcome === key;
                return (
                  <button
                    key={key}
                    id={`btn-food-log-outcome-${key}`}
                    type="button"
                    className={`sdb-outcome-chip ${isSlipOutcome ? 'sdb-outcome-chip--slip' : 'sdb-outcome-chip--ontrack'} ${isSelected ? 'sdb-outcome-chip--selected' : ''}`}
                    onClick={() => setOutcome(key)}
                    aria-pressed={isSelected}
                    title={def || label}
                  >
                    {isSelected ? '✓ ' : ''}{label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sdb-modal-footer">
          <button id="btn-sdb-cancel-food-log" className="sdb-btn sdb-btn--cancel" onClick={onCancel}>
            {t.commit_cancel}
          </button>
          <button
            id="btn-sdb-save-food-log"
            className="sdb-btn sdb-btn--save"
            onClick={handleSave}
          >
            {t.sdb_food_log_save_btn}
          </button>
        </div>
      </div>

      {/* Photo Preview Lightbox if previewing an attached photo */}
      {previewPhotoIndex !== null && foodPhotos[previewPhotoIndex] && (
        <PhotoPreviewModal
          photos={foodPhotos.map((p, i) => ({
            id: p.id,
            dataUrl: photoPreviewUrls[p.id] || getPhotoDataUrlSync(p.id),
            caption: `${description || t.sdb_food_photo} (${i + 1}/${foodPhotos.length})`,
          }))}
          initialIndex={previewPhotoIndex}
          onClose={() => setPreviewPhotoIndex(null)}
          t={t}
        />
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

function getDetailedOutcomeLabel(outcome: DetailedBlockOutcome, t: ReturnType<typeof useTranslation>['t']): string {
  const key = `sdb_outcome_${outcome}` as keyof typeof t;
  return (t[key] as string) || outcome;
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

  const { structureStats, resumeStats, driftStats, categoryStats } = summary;

  const activeCategories = useMemo(
    () => categoryStats.items.filter(item => item.count > 0),
    [categoryStats]
  );

  const activeOutcomes = useMemo(
    () => structureStats.detailedOutcomes.filter(item => item.count > 0),
    [structureStats.detailedOutcomes]
  );

  return (
    <div className="sdb-awareness-container" id="sdb-awareness-container">
      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 1: EATING STRUCTURE AWARENESS
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="sdb-awareness-card" id="sdb-eating-structure-card">
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

        {/* ── Structure Core vs Outside Core Awareness ── */}
        {structureStats.hasData ? (
          <div className="sdb-awareness-body">
            {/* Main comparison progress bar (non-judgmental styling) */}
            <div
              className="sdb-segmented-bar"
              id="sdb-segmented-bar"
              role="progressbar"
              aria-valuenow={structureStats.structuredCorePercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${t.sdb_stat_structured_core} ${structureStats.structuredCorePercentage}%, ${t.sdb_stat_outside_core} ${structureStats.outsideCorePercentage}%`}
            >
              <div
                className="sdb-segment sdb-segment--structured"
                style={{ width: `${structureStats.structuredCorePercentage}%` }}
                title={`${t.sdb_stat_structured_core}: ${structureStats.structuredCorePercentage}%`}
              />
              <div
                className="sdb-segment sdb-segment--outside-core"
                style={{ width: `${structureStats.outsideCorePercentage}%` }}
                title={`${t.sdb_stat_outside_core}: ${structureStats.outsideCorePercentage}%`}
              />
            </div>

            {/* Counts & Percentages Row: Structured Core vs Outside Core */}
            <div className="sdb-structure-metrics-row">
              <div className="sdb-metric-box sdb-metric-box--structured" id="sdb-stat-structured-box">
                <div className="sdb-metric-top">
                  <span className="sdb-metric-dot sdb-metric-dot--structured" />
                  <span className="sdb-metric-name">{t.sdb_stat_structured_core}</span>
                </div>
                <div className="sdb-metric-main">
                  <span className="sdb-metric-pct">{structureStats.structuredCorePercentage}%</span>
                  <span className="sdb-metric-count">
                    {structureStats.structuredCoreCount}{' '}
                    {structureStats.structuredCoreCount === 1 ? t.sdb_stat_record : t.sdb_stat_records}
                  </span>
                </div>
              </div>

              <div className="sdb-metric-box sdb-metric-box--outside-core" id="sdb-stat-outside-core-box">
                <div className="sdb-metric-top">
                  <span className="sdb-metric-dot sdb-metric-dot--outside-core" />
                  <span className="sdb-metric-name">{t.sdb_stat_outside_core}</span>
                </div>
                <div className="sdb-metric-main">
                  <span className="sdb-metric-pct">{structureStats.outsideCorePercentage}%</span>
                  <span className="sdb-metric-count">
                    {structureStats.outsideCoreCount}{' '}
                    {structureStats.outsideCoreCount === 1 ? t.sdb_stat_record : t.sdb_stat_records}
                  </span>
                </div>
              </div>
            </div>

            {/* ── 4 High-Level Behavioral Buckets Grid ── */}
            <div className="sdb-buckets-grid" id="sdb-buckets-grid">
              <div className="sdb-bucket-card sdb-bucket-card--core" id="sdb-bucket-core">
                <span className="sdb-bucket-name">{t.sdb_stat_structured_core}</span>
                <span className="sdb-bucket-val">{structureStats.buckets.structuredCore.count}</span>
                <span className="sdb-bucket-pct">{structureStats.buckets.structuredCore.percentage}%</span>
              </div>
              <div className="sdb-bucket-card sdb-bucket-card--flex" id="sdb-bucket-flex">
                <span className="sdb-bucket-name">{t.sdb_stat_flex_off_track}</span>
                <span className="sdb-bucket-val">{structureStats.buckets.flexOffTrack.count}</span>
                <span className="sdb-bucket-pct">{structureStats.buckets.flexOffTrack.percentage}%</span>
              </div>
              <div className="sdb-bucket-card sdb-bucket-card--risk" id="sdb-bucket-risk">
                <span className="sdb-bucket-name">{t.sdb_stat_risk_near_slip}</span>
                <span className="sdb-bucket-val">{structureStats.buckets.risk.count}</span>
                <span className="sdb-bucket-pct">{structureStats.buckets.risk.percentage}%</span>
              </div>
              <div className="sdb-bucket-card sdb-bucket-card--slip" id="sdb-bucket-slip">
                <span className="sdb-bucket-name">{t.sdb_stat_slip_bucket}</span>
                <span className="sdb-bucket-val">{structureStats.buckets.slip.count}</span>
                <span className="sdb-bucket-pct">{structureStats.buckets.slip.percentage}%</span>
              </div>
            </div>

            {/* ── Detailed Outcome Distribution (only outcomes with > 0 records) ── */}
            <div className="sdb-detailed-outcomes-wrap" id="sdb-detailed-outcomes-section">
              <h4 className="sdb-sub-heading">{t.sdb_detailed_outcomes_title}</h4>
              {activeOutcomes.length > 0 ? (
                <div className="sdb-detailed-outcomes-list">
                  {activeOutcomes.map(item => (
                    <div key={item.outcome} className={`sdb-detailed-outcome-chip sdb-detailed-outcome-chip--${item.outcome}`}>
                      <span className="sdb-outcome-chip-label">{getDetailedOutcomeLabel(item.outcome, t)}</span>
                      <span className="sdb-outcome-chip-stats">
                        <strong>{item.count}</strong> ({item.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sdb-awareness-empty-text sdb-awareness-empty-text--sub">{t.sdb_no_outcomes_in_period}</p>
              )}
            </div>

            {/* ── Compact Resume Recovery Section ── */}
            <div className="sdb-resume-section" id="sdb-resume-recovery-section">
              <div className="sdb-resume-header">
                <span className="sdb-resume-title">⟲ {t.sdb_resumed_label}</span>
                {resumeStats.hasEligibleSlips ? (
                  <span className="sdb-resume-rate-badge" id="sdb-resume-rate-badge">
                    {t.sdb_stat_resume_rate}: {resumeStats.resumeRate}%
                  </span>
                ) : (
                  <span className="sdb-resume-rate-badge sdb-resume-rate-badge--none" id="sdb-resume-rate-badge">
                    {t.sdb_no_eligible_slips}
                  </span>
                )}
              </div>
              <div className="sdb-resume-stats-row">
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_stat_eligible_slips}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-eligible-slips-val">{resumeStats.eligibleCount}</strong>
                </div>
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_stat_resume_count}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-resumed-count-val">{resumeStats.resumeCount}</strong>
                </div>
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_stat_resume_rate}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-resume-rate-val">
                    {resumeStats.hasEligibleSlips ? `${resumeStats.resumeRate}%` : '—'}
                  </strong>
                </div>
              </div>
            </div>

            {/* ── Compact Drift Section (Phase 26D) ── */}
            <div className="sdb-drift-section" id="sdb-drift-awareness-section">
              <div className="sdb-resume-header">
                <span className="sdb-resume-title">🌊 {t.sdb_drift_title}</span>
                {driftStats.hasEligibleSlips ? (
                  <span className="sdb-resume-rate-badge sdb-drift-rate-badge" id="sdb-drift-rate-badge">
                    {t.sdb_drift_rate}: {driftStats.driftRate}%
                  </span>
                ) : (
                  <span className="sdb-resume-rate-badge sdb-resume-rate-badge--none" id="sdb-drift-rate-badge">
                    {t.sdb_no_eligible_slips}
                  </span>
                )}
              </div>
              <div className="sdb-resume-stats-row sdb-drift-stats-row">
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_drift_entered}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-drift-entered-val">{driftStats.enteredDriftCount}</strong>
                </div>
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_drift_currently}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-drift-currently-val">{driftStats.currentlyDriftingCount}</strong>
                </div>
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_drift_stopped_stat}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-drift-stopped-val">{driftStats.stoppedDriftCount}</strong>
                </div>
                <div className="sdb-resume-stat-item">
                  <span className="sdb-resume-stat-lbl">{t.sdb_drift_rate}:</span>
                  <strong className="sdb-resume-stat-val" id="sdb-drift-rate-val">
                    {driftStats.hasEligibleSlips ? `${driftStats.driftRate}%` : '—'}
                  </strong>
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
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          CARD 2: FOOD CATEGORY AWARENESS
         ══════════════════════════════════════════════════════════════════════════ */}
      <div className="sdb-awareness-card sdb-category-awareness-card" id="sdb-food-category-card">
        <div className="sdb-awareness-header">
          <div className="sdb-awareness-titles">
            <div className="sdb-awareness-badge sdb-awareness-badge--categories">
              <span>🥗</span>
              <span>{t.sdb_category_awareness_title}</span>
            </div>
            <p className="sdb-category-rate-note">{t.sdb_category_rate_note}</p>
          </div>
          {categoryStats.recordsWithCategories > 0 && (
            <span className="sdb-category-records-badge">
              {t.sdb_records_with_categories.replace('{count}', String(categoryStats.recordsWithCategories))}
            </span>
          )}
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
                      style={{ width: `${Math.max(4, Math.min(100, cat.percentage))}%` }}
                    />
                  </div>
                  <div className="sdb-cat-dist-stats">
                    <span className="sdb-cat-dist-count">
                      {cat.count} {cat.count === 1 ? t.sdb_stat_record : t.sdb_stat_records}
                    </span>
                    <span className="sdb-cat-dist-pct">• {cat.percentage}%</span>
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

        {/* ── Food Portions & Quantities Breakdown (Phase 28) ── */}
        {(categoryStats.totalPortionsLogged || 0) > 0 && (
          <div className="sdb-awareness-portions-breakdown" id="sdb-awareness-portions-breakdown">
            <div className="sdb-awareness-portions-header">
              <h4 className="sdb-sub-heading">⚖️ {t.sdb_quantity_breakdown}</h4>
              <p className="sdb-sub-desc">{t.sdb_quantity_breakdown_desc}</p>
            </div>
            <div className="sdb-awareness-portions-grid">
              {(Object.keys(categoryStats.itemizedPortions || {}) as FoodCategoryKey[]).map(catKey => {
                const portions = (categoryStats.itemizedPortions?.[catKey] || []).filter(
                  item => Object.keys(item.quantitiesByUnit || {}).length > 0
                );
                if (portions.length === 0) return null;
                const catIcon = FOOD_CATEGORY_ICONS[catKey] || '🍽️';
                const catName = (t[`sdb_cat_${catKey}` as keyof typeof t] as string | undefined) || catKey;
                return (
                  <div key={catKey} className="sdb-awareness-cat-portion-card">
                    <div className="sdb-cat-portion-card-header">
                      <span className="sdb-cat-portion-icon">{catIcon}</span>
                      <span className="sdb-cat-portion-name">{catName}</span>
                    </div>
                    <div className="sdb-cat-portion-items">
                      {portions.flatMap(foodStat => {
                        const unitEntries = Object.values(foodStat.quantitiesByUnit || {});
                        const foodLabel = foodStat.isCustom
                          ? foodStat.key
                          : (() => {
                              const opt = findFoodOption(catKey, foodStat.key);
                              return opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || foodStat.key) : foodStat.key;
                            })();

                        return unitEntries.map((u, uIdx) => {
                          const unitLabel = u.unit === 'custom' && u.customUnit
                            ? u.customUnit
                            : (t[`sdb_unit_${u.unit}` as keyof typeof t] as string | undefined) || u.unit;
                          const pluralUnit = (u.totalAmount > 1 && !['gram', 'oz', 'ml'].includes(u.unit))
                            ? `${unitLabel}s`
                            : unitLabel;
                          return (
                            <div key={`${foodStat.key}-${u.unit}-${uIdx}`} className="sdb-awareness-portion-item">
                              <span className="sdb-portion-item-name">{foodLabel}</span>
                              <span className="sdb-portion-item-qty">
                                <strong>{u.totalAmount}</strong> {pluralUnit}
                              </span>
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StructuredDietScreen({ onNavigate, onBack, onStartTimer }: StructuredDietScreenProps) {
  const { t } = useTranslation();
  const [dietStore, setDietStore] = useState<StructureDietStore>(() => loadDietStore());
  const activeProfile = getActiveProfile(dietStore);
  const [weekly, setWeekly] = useState<WeeklyStructuredDiet>(() => activeProfile.diet);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StructureGoalProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<StructureGoalProfile | null>(null);

  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>(() => getLocalTodayKey());
  const [activeView, setActiveView] = useState<'daily' | 'settings'>('daily');
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
  // Modal state for unplanned / in-the-moment food logging (Phase 26A)
  const [showFoodLogModal, setShowFoodLogModal] = useState(false);
  // Modal state for food photo preview (Phase 6B Multi-Photo)
  const [previewPhotos, setPreviewPhotos] = useState<{ photos: PhotoPreviewItem[]; initialIndex?: number } | null>(null);

  const todayKey = getLocalTodayKey();
  const isToday = selectedDayKey === todayKey;
  const todayDateKey = getLocalDateKey();
  const currentDay = isToday && weekly.dateOverrides?.[todayDateKey]
    ? weekly.dateOverrides[todayDateKey]
    : getDayPlan(weekly, selectedDayKey);
  const isReviewCompletedToday = hasCompletedDailyReview(getLocalDateKey(), activeProfile.id);

  // Preload photos for current day blocks for instant UI rendering (Phase 6B)
  useEffect(() => {
    const photoIds: string[] = [];
    for (const b of currentDay.blocks) {
      for (const p of getBlockPhotos(b)) {
        if (p?.id) photoIds.push(p.id);
      }
    }
    if (photoIds.length > 0) {
      preloadPhotos(photoIds);
    }
  }, [currentDay.blocks]);

  const handleHeaderBack = () => {
    if (activeView === 'settings') {
      setActiveView('daily');
      return;
    }
    if (previewPhotos) {
      setPreviewPhotos(null);
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
    updateWeekly(w => {
      let nextW = setDayMode(w, selectedDayKey, mode);
      const curDateKey = getLocalDateKey();
      if (isToday && nextW.dateOverrides?.[curDateKey]) {
        nextW = clearDateOverride(nextW, curDateKey);
      }
      return nextW;
    });
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

  // ── Template actions (Task 6 & Phase 7B: Daily Scope & Builder) ───────────
  const handleApplyTemplate = (
    template: DietTemplate,
    configuredBlocks?: StructuredDietBlock[],
    selectedDates?: string[]
  ) => {
    if (template.id === 'free-schedule-days' || template.targetMode === 'free') {
      const datesToApply = selectedDates && selectedDates.length > 0
        ? selectedDates
        : [selectedDayKey];
      updateWeekly(w => setFreeScheduleDates(w, datesToApply));
      setShowTemplateModal(false);
      const feedbackMsg = (t.sdb_free_day_applied_feedback || 'Free Schedule Day applied to {count} date(s)')
        .replace('{count}', String(datesToApply.length));
      setCopyFeedback(feedbackMsg);
      setTimeout(() => {
        setCopyFeedback(null);
      }, 3200);
      return;
    }

    const mode = template.targetMode;
    const blocks = configuredBlocks && configuredBlocks.length > 0
      ? configuredBlocks
      : applyDailyTemplateToDay(template).blocks;
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
  const handleSaveBlock = (block: StructuredDietBlock, outcome?: DetailedBlockOutcome | 'none') => {
    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => {
        const existing = day.blocks.findIndex(b => b.id === block.id);
        const blocks = existing >= 0
          ? day.blocks.map((b, i) => (i === existing ? block : b))
          : [...day.blocks, block];
        return { ...day, blocks: sortBlocks(blocks) };
      })
    );
    if (isToday && outcome) {
      if (outcome === 'none') {
        handleClearStatus(block.id);
      } else {
        handleVerifyOutcome(block, outcome, outcomeToStatus(outcome));
      }
    }
    setEditingBlock(null);
  };

  const handleDeleteBlock = (id: string) => {
    const blockToDelete = currentDay.blocks.find(b => b.id === id);
    const photosToClean = blockToDelete ? getBlockPhotos(blockToDelete) : [];

    updateWeekly(w =>
      updateDayPlan(w, selectedDayKey, day => ({
        ...day,
        blocks: day.blocks.filter(b => b.id !== id),
      }))
    );

    if (photosToClean.length > 0) {
      setTimeout(() => {
        const store = loadDietStore();
        const verifs = loadAllDietVerifications();
        for (const p of photosToClean) {
          if (!isPhotoReferenced(p.id, store, verifs)) {
            deleteFoodPhoto(p.id).catch(() => {});
          }
        }
      }, 50);
    }
  };

  // ── Direct Schedule Photo Addition (Phase 6B) ──────────────────────────────
  const handleQuickAddPhoto = (blockId: string, photo: FoodPhotoMetadata) => {
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
          const existingPhotos = getBlockPhotos(b);
          const nextPhotos = [...existingPhotos, photo];
          return {
            ...b,
            foodPhotos: nextPhotos,
            foodPhoto: nextPhotos[0],
          };
        });
        return {
          ...day,
          blocks: sortBlocks(nextBlocks),
        };
      });
    });
    playFeedback('neutral');
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
    const activityType: ScoreActivityType =
      outcome === 'twenty_percent_off_track'
        ? 'DIET_TWENTY_PERCENT_OFF_TRACK'
        : status === 'on-track'
        ? 'DIET_ON_TRACK'
        : 'SLIP_REPORTED';

    recordScoreEvent({
      activityType,
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
    actualCategories?: FoodCategoryKey[],
    driftState?: DriftState
  ) => {
    if (!slipModalBlock) return;
    const dateKey = getLocalDateKey();
    saveBlockVerification({
      plannedBlock: slipModalBlock,
      status: 'slip',
      detailedOutcome: outcome ?? 'structured_slip',
      isResumed,
      driftState,
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

  const handleUpdateDriftState = (plannedBlockId: string, state: DriftState) => {
    setBlockDriftState(plannedBlockId, state);
    playFeedback('neutral');
    refreshVerifications();
  };

  const handleClearStatus = (blockId: string) => {
    clearBlockVerification(blockId);
    refreshVerifications();
  };

  // ── Unplanned / in-the-moment food log handler (Phase 26A / Phase 27) ───────────
  const handleSaveFoodLog = (
    description: string,
    foodCategories: FoodCategoryKey[],
    outcome: DetailedBlockOutcome,
    status: DietVerificationStatus,
    mealType?: MealTypeKey,
    foodSelections?: FoodSelectionsMap,
    customFoods?: CustomFoodsMap,
    foodPhotos?: FoodPhotoMetadata[],
    foodQuantities?: FoodQuantitiesMap
  ) => {
    const dateKey = getLocalDateKey();
    const activityType: ScoreActivityType =
      outcome === 'twenty_percent_off_track'
        ? 'DIET_TWENTY_PERCENT_OFF_TRACK'
        : status === 'on-track'
        ? 'DIET_ON_TRACK'
        : 'SLIP_REPORTED';

    const savedEntry = saveUnplannedFoodLog({
      description,
      foodCategories,
      detailedOutcome: outcome,
      status,
      mealType,
      foodSelections,
      customFoods,
      foodQuantities,
      foodPhotos,
      foodPhoto: foodPhotos && foodPhotos.length > 0 ? foodPhotos[0] : undefined,
      sourcePlanName: weekly.planName,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
    });

    // Deterministic sourceId: bound to this entry's unique synthetic block ID
    // prevents duplicate point farming on repeated submissions
    const sourceId = `diet_unplanned_${dateKey}_${savedEntry.plannedBlockId}`;
    recordScoreEvent({
      activityType,
      dateKey,
      sourceId,
      profileId: activeProfile.id,
      profileName: getGoalDisplayName(activeProfile, t),
    });

    if (status === 'on-track') {
      playFeedback('win');
    } else {
      playFeedback('neutral');
    }
    setShowFoodLogModal(false);
    refreshVerifications();
  };

  const sortedBlocks = sortBlocks(currentDay.blocks);
  const currentDayFullName = t[`sdb_day_${selectedDayKey}` as keyof typeof t] as string;

  // Stats for today's verification
  const verificationStats = isToday
    ? getDailyVerificationStats(sortedBlocks.length)
    : null;

  // Unplanned food logs: logged on Today without a pre-existing planned block (Phase 26A)
  const unplannedVerifications = isToday && todayVerification
    ? todayVerification.entries.filter(
        e => e.isUnplanned || e.plannedBlockId.startsWith('unplanned_')
      )
    : [];

  // Orphaned verifications: planned blocks that were verified and later deleted from the plan
  const orphanedVerifications = isToday && todayVerification
    ? todayVerification.entries.filter(
        e => !e.isUnplanned && !e.plannedBlockId.startsWith('unplanned_') && !sortedBlocks.some(b => b.id === e.plannedBlockId)
      )
    : [];

  // ── Render helper for spontaneous unplanned food log cards (shared across Free, Unstructured, Structured modes) ──
  const renderUnplannedCard = (log: DietBlockVerification) => {
    const desc = log.actualCustomText?.trim() || log.plannedSnapshot.customText?.trim() || (log.actualFoodCategories && log.actualFoodCategories.length > 0 ? log.actualFoodCategories.map(c => (t[`sdb_cat_${c}` as keyof typeof t] as string | undefined) || c).join(', ') : t.sdb_food_log_modal_badge);
    const outcomeKey = log.detailedOutcome;
    const outcomeLabel = outcomeKey ? (t[`sdb_outcome_${outcomeKey}` as keyof typeof t] as string) || outcomeKey : '';
    const isOntrack = log.status === 'on-track';
    const isTwentyPercent = outcomeKey === 'twenty_percent_off_track';

    const logMealType = log.mealType || log.plannedSnapshot.mealType;
    const mealTypeLabel = logMealType ? ((t[`sdb_meal_type_${logMealType}` as keyof typeof t] as string | undefined) || logMealType) : '';
    const autoTime = log.plannedSnapshot.startTime;

    const specificFoodNames: string[] = [];
    const selections = log.actualFoodSelections || log.foodSelections || log.plannedSnapshot.foodSelections;
    const quantities = log.actualFoodQuantities || log.foodQuantities || log.plannedSnapshot.foodQuantities;

    if (selections) {
      for (const [cat, keys] of Object.entries(selections)) {
        if (keys && Array.isArray(keys)) {
          for (const k of keys) {
            const opt = findFoodOption(cat as FoodCategoryKey, k);
            const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : k;
            const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, k);
            const qty = quantities?.[qtyKey];
            const qtyStr = formatFoodItemQuantity(qty, t);
            specificFoodNames.push(qtyStr ? `${qtyStr} ${label}` : label);
          }
        }
      }
    }
    const customs = log.actualCustomFoods || log.customFoods || log.plannedSnapshot.customFoods;
    if (customs) {
      for (const [cat, cList] of Object.entries(customs)) {
        if (cList && Array.isArray(cList)) {
          for (const cFood of cList) {
            const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, cFood, true);
            const qty = quantities?.[qtyKey];
            const qtyStr = formatFoodItemQuantity(qty, t);
            specificFoodNames.push(qtyStr ? `${qtyStr} ${cFood}` : cFood);
          }
        }
      }
    }

    const logPhotos = log.foodPhotos || (log.foodPhoto ? [log.foodPhoto] : log.plannedSnapshot.foodPhotos || (log.plannedSnapshot.foodPhoto ? [log.plannedSnapshot.foodPhoto] : []));

    return (
      <div
        key={log.id}
        className={`sdb-unplanned-card sdb-unplanned-card--${log.status}${isTwentyPercent ? ' sdb-unplanned-card--twenty-percent' : ''}`}
      >
        <div className="sdb-unplanned-card-top">
          <div className="sdb-unplanned-card-badges">
            <span className="sdb-unplanned-pill">{t.sdb_food_log_unplanned_tag}</span>
            {autoTime && (
              <span className="sdb-food-log-time-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '0.75rem' }}>
                🕒 {autoTime}
              </span>
            )}
            {mealTypeLabel && (
              <span className="sdb-block-meal-type-badge">
                {mealTypeLabel}
              </span>
            )}
            {outcomeLabel && (
              <span className={`sdb-outcome-pill sdb-outcome-pill--${isOntrack ? 'ontrack' : 'slip'}`}>
                {outcomeLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            className="sdb-verified-link sdb-verified-link--clear"
            onClick={() => handleClearStatus(log.plannedBlockId)}
            aria-label={t.sdb_v_clear_status}
          >
            {t.sdb_v_clear_status}
          </button>
        </div>
        {desc && <div className="sdb-unplanned-desc">{desc}</div>}
        {log.actualFoodCategories && log.actualFoodCategories.length > 0 && (
          <div className="sdb-unplanned-categories">
            {log.actualFoodCategories.map(cat => (
              <span key={cat} className="sdb-unplanned-category-chip">
                {FOOD_CATEGORY_ICONS[cat]} {t[`sdb_cat_${cat}` as keyof typeof t] as string}
              </span>
            ))}
          </div>
        )}
        {specificFoodNames.length > 0 && (
          <div className="sdb-unplanned-specific-foods">
            <span>• {specificFoodNames.join(', ')}</span>
          </div>
        )}
        {logPhotos.length > 0 && (
          <div className="sdb-unplanned-photos sdb-block-photos-cluster">
            {logPhotos.map((p, idx) => {
              const url = getPhotoDataUrlSync(p.id);
              return (
                <button
                  key={p.id || idx}
                  type="button"
                  className="sdb-block-photo-thumb-btn"
                  onClick={() => setPreviewPhotos({
                    photos: logPhotos.map((item, pIdx) => ({
                      id: item.id,
                      dataUrl: getPhotoDataUrlSync(item.id),
                      caption: `${desc} (${t.sdb_food_photo} ${pIdx + 1})`,
                    })),
                    initialIndex: idx,
                  })}
                  title={`${t.sdb_view_photo} (${idx + 1}/${logPhotos.length})`}
                >
                  {url ? (
                    <img src={url} alt={`${desc} photo ${idx + 1}`} className="sdb-block-photo-thumb" />
                  ) : (
                    <div className="sdb-block-photo-thumb-placeholder">📷</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Recovery & Drift for Eligible Slips (Phase 26D) */}
        {isEligibleSlipForDrift(log) && (
          <div className="sdb-recovery-drift-container sdb-recovery-drift-container--unplanned">
            <div className="sdb-recovery-row">
              <span className="sdb-recovery-subhead">{t.sdb_recovery_section_title}</span>
              <button
                id={`btn-unplanned-resumed-daily-${log.id}`}
                type="button"
                className={`sdb-resumed-toggle-btn ${log.isResumed ? 'sdb-resumed-toggle-btn--active' : ''}`}
                onClick={() => handleToggleResumed(log.plannedBlockId)}
                aria-pressed={!!log.isResumed}
              >
                <span className="sdb-resumed-toggle-icon" aria-hidden="true">
                  {log.isResumed ? '✓' : '⟲'}
                </span>
                <span className="sdb-resumed-toggle-text">
                  {log.isResumed ? t.sdb_marked_resumed : t.sdb_mark_resumed}
                </span>
              </button>
            </div>

            <div className="sdb-drift-ctrl-wrap">
              <span className="sdb-drift-subhead">{t.sdb_drift_title}</span>
              <div className="sdb-drift-btn-group">
                {(!log.driftState || log.driftState === 'none') && (
                  <button
                    id={`btn-unplanned-drift-start-daily-${log.id}`}
                    type="button"
                    className="sdb-drift-action-btn sdb-drift-action-btn--start"
                    onClick={() => handleUpdateDriftState(log.plannedBlockId, 'started')}
                  >
                    <span className="sdb-drift-btn-icon">🌊</span>
                    <span>{t.sdb_drift_start}</span>
                  </button>
                )}

                {(log.driftState === 'started' || log.driftState === 'drifting') && (
                  <>
                    <button
                      id={`btn-unplanned-drift-still-daily-${log.id}`}
                      type="button"
                      className={`sdb-drift-action-btn sdb-drift-action-btn--drifting ${log.driftState === 'drifting' ? 'sdb-drift-action-btn--active' : ''}`}
                      onClick={() => handleUpdateDriftState(log.plannedBlockId, 'drifting')}
                    >
                      <span className="sdb-drift-btn-icon">〰️</span>
                      <span>{t.sdb_drift_still}</span>
                    </button>
                    <button
                      id={`btn-unplanned-drift-stop-daily-${log.id}`}
                      type="button"
                      className="sdb-drift-action-btn sdb-drift-action-btn--stop"
                      onClick={() => handleUpdateDriftState(log.plannedBlockId, 'stopped')}
                    >
                      <span className="sdb-drift-btn-icon">🛑</span>
                      <span>{t.sdb_drift_stopped}</span>
                    </button>
                  </>
                )}

                {log.driftState === 'stopped' && (
                  <div className="sdb-drift-stopped-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="sdb-drift-status-badge sdb-drift-status-badge--stopped">
                      <span className="sdb-drift-badge-icon">✓</span>
                      <span>{t.sdb_drift_stopped}</span>
                    </div>
                    {onNavigate && (
                      <button
                        id={`btn-unplanned-drift-recommit-daily-${log.id}`}
                        type="button"
                        className="sdb-drift-recommit-btn"
                        onClick={() => onNavigate('recommit')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          background: 'rgba(74, 222, 128, 0.15)',
                          border: '1px solid rgba(74, 222, 128, 0.35)',
                          borderRadius: '14px',
                          color: '#4ade80',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <span>⚡</span>
                        <span>{t.recommit_title || 'Re-Commit'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="screen sdb-screen">
      <div className="sdb-inner">
        <ScreenHeader
          onBack={handleHeaderBack}
          onHome={() => onNavigate('home')}
        />

        <div className="sdb-content">
          {activeView === 'settings' ? (
            /* ── SETTINGS VIEW (Phase 7B) ── */
            <div className="sdb-settings-view" id="sdb-settings-view">
              {/* Back to Daily button */}
              <div className="sdb-settings-nav-bar">
                <button
                  id="btn-sdb-back-to-daily"
                  type="button"
                  className="sdb-btn-back-to-daily"
                  onClick={() => setActiveView('daily')}
                >
                  ← {t.sdb_back_to_daily}
                </button>
              </div>

              <div className="sdb-settings-heading">
                <h2 className="sdb-settings-title">{t.sdb_structure_settings}</h2>
                <p className="sdb-settings-desc">{t.sdb_settings_desc}</p>
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

              <div className="sdb-settings-done-row">
                <button
                  id="btn-sdb-done-settings"
                  type="button"
                  className="sdb-btn-done-settings"
                  onClick={() => setActiveView('daily')}
                >
                  ✓ {t.sdb_back_to_daily}
                </button>
              </div>
            </div>
          ) : (
            /* ── DAILY-FIRST VIEW (Phase 7B) ── */
            <div className="sdb-daily-view" id="sdb-daily-view">
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

              {/* ── Compact Profile Bar with Structure Settings Button (Phase 7B) ── */}
              <div className="sdb-daily-profile-bar" id="sdb-daily-profile-bar">
                <div className="sdb-daily-profile-info">
                  <span className="sdb-daily-profile-icon" aria-hidden="true">🎯</span>
                  <div className="sdb-daily-profile-names">
                    <span className="sdb-daily-profile-label">{t.sdb_active_profile_label}:</span>
                    <strong className="sdb-daily-profile-name" id="sdb-daily-active-goal-name">
                      {getGoalDisplayName(activeProfile, t)}
                    </strong>
                  </div>
                </div>
                <div className="sdb-daily-profile-actions">
                  <button
                    id="btn-sdb-open-settings"
                    type="button"
                    className="sdb-btn-open-settings"
                    onClick={() => setActiveView('settings')}
                    title={t.sdb_structure_settings}
                  >
                    <span>⚙️</span>
                    <span>{t.sdb_structure_settings}</span>
                  </button>
                </div>
              </div>

              {/* ── Quick Timer Launch Banner (Phase 29A) ── */}
              <div className="sdb-timer-banner">
                <button
                  id="btn-sdb-timer"
                  type="button"
                  className="sdb-timer-btn"
                  onClick={onStartTimer ?? (() => onNavigate('mode'))}
                  aria-label={t.sdb_timer_btn}
                >
                  <span className="sdb-timer-icon" aria-hidden="true">⏱</span>
                  <span className="sdb-timer-text">{t.sdb_timer_btn}</span>
                </button>
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
                <button
                  id="sdb-mode-btn-free"
                  type="button"
                  role="radio"
                  aria-checked={currentDay.mode === 'free'}
                  className={`sdb-mode-pill ${currentDay.mode === 'free' ? 'sdb-mode-pill--active' : ''}`}
                  onClick={() => handleSetMode('free')}
                >
                  🌴 {t.sdb_free_day_target_mode_label || 'Free'}
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
          {isFreeDay(currentDay) ? (
            /* ── Free Schedule Day State ── */
            <div className="sdb-free-day-card" id="sdb-free-schedule-day-card">
              <div className="sdb-free-day-badge-pill">
                <span>🌴</span>
                <span>{t.sdb_free_day_badge || '🌴 Free Schedule Day'}</span>
              </div>
              <h3 className="sdb-free-day-heading">{t.sdb_free_day_title || 'Free Schedule Day'}</h3>
              <p className="sdb-free-day-description">{t.sdb_free_day_desc}</p>

              <div className="sdb-free-day-callouts">
                <div className="sdb-free-day-callout-item">
                  <span className="sdb-free-callout-icon">🛡️</span>
                  <div className="sdb-free-callout-content">
                    <strong>Zero Penalties</strong>
                    <span>No unlogged meal deductions or missing verification marks.</span>
                  </div>
                </div>
                <div className="sdb-free-day-callout-item">
                  <span className="sdb-free-callout-icon">⚡</span>
                  <div className="sdb-free-callout-content">
                    <strong>Streaks & Score Protected</strong>
                    <span>Lifetime Score and previous XP remain 100% safe.</span>
                  </div>
                </div>
                <div className="sdb-free-day-callout-item">
                  <span className="sdb-free-callout-icon">⚖️</span>
                  <div className="sdb-free-callout-content">
                    <strong>Distinguishable from Slips</strong>
                    <span>Intentionally scheduled break — never classified as a slip or deviation.</span>
                  </div>
                </div>
              </div>

              <div className="sdb-free-day-actions">
                <button
                  id="btn-sdb-free-log-food"
                  type="button"
                  className="sdb-free-btn sdb-free-btn--log"
                  onClick={() => setShowFoodLogModal(true)}
                >
                  🍽️ {t.sdb_free_day_log_spontaneous || 'Log Food (Optional)'}
                </button>
                <button
                  id="btn-sdb-free-switch-mode"
                  type="button"
                  className="sdb-free-btn sdb-free-btn--switch"
                  onClick={() => handleSetMode('structured')}
                >
                  ⚙️ {t.sdb_free_day_switch_back || 'Switch to Structured / Unstructured'}
                </button>
              </div>

              {/* ── Optional Spontaneous Food Logs on Free Day ── */}
              {isToday && unplannedVerifications.length > 0 && (
                <div className="sdb-unplanned-section" id="sdb-unplanned-food-logs-free">
                  <div className="sdb-unplanned-header">
                    <span className="sdb-unplanned-section-badge">🍽️ {t.sdb_food_log_modal_badge}</span>
                    <span className="sdb-unplanned-section-tag">{t.sdb_food_log_unplanned_tag}</span>
                  </div>
                  <div className="sdb-unplanned-list">
                    {unplannedVerifications.map(renderUnplannedCard)}
                  </div>
                </div>
              )}
            </div>
          ) : currentDay.mode === 'unstructured' ? (
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
                    id="btn-sdb-unstructured-log-food"
                    type="button"
                    className="sdb-empty-log-food-btn"
                    onClick={() => isToday ? setShowFoodLogModal(true) : setEditingBlock('new')}
                  >
                    🍽️ {t.sdb_log_food}
                  </button>
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
                {/* ── Unplanned Food Logs on Unstructured Day ── */}
                {isToday && unplannedVerifications.length > 0 && (
                  <div className="sdb-unplanned-section" id="sdb-unplanned-food-logs-unstructured">
                    <div className="sdb-unplanned-header">
                      <span className="sdb-unplanned-section-badge">🍽️ {t.sdb_food_log_modal_badge}</span>
                      <span className="sdb-unplanned-section-tag">{t.sdb_food_log_unplanned_tag}</span>
                    </div>
                    <div className="sdb-unplanned-list">
                      {unplannedVerifications.map(log => {
                        const desc = log.actualCustomText?.trim() || log.plannedSnapshot.customText?.trim() || (log.actualFoodCategories && log.actualFoodCategories.length > 0 ? log.actualFoodCategories.map(c => (t[`sdb_cat_${c}` as keyof typeof t] as string | undefined) || c).join(', ') : t.sdb_food_log_modal_badge);
                        const outcomeKey = log.detailedOutcome;
                        const outcomeLabel = outcomeKey ? (t[`sdb_outcome_${outcomeKey}` as keyof typeof t] as string) || outcomeKey : '';
                        const isOntrack = log.status === 'on-track';
                        const isTwentyPercent = outcomeKey === 'twenty_percent_off_track';

                        const logMealType = log.mealType || log.plannedSnapshot.mealType;
                        const mealTypeLabel = logMealType ? ((t[`sdb_meal_type_${logMealType}` as keyof typeof t] as string | undefined) || logMealType) : '';
                        const autoTime = log.plannedSnapshot.startTime;

                        const specificFoodNames: string[] = [];
                        const selections = log.actualFoodSelections || log.foodSelections || log.plannedSnapshot.foodSelections;
                        const quantities = log.actualFoodQuantities || log.foodQuantities || log.plannedSnapshot.foodQuantities;

                        if (selections) {
                          for (const [cat, keys] of Object.entries(selections)) {
                            if (keys && Array.isArray(keys)) {
                              for (const k of keys) {
                                const opt = findFoodOption(cat as FoodCategoryKey, k);
                                const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : k;
                                const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, k);
                                const qty = quantities?.[qtyKey];
                                const qtyStr = formatFoodItemQuantity(qty, t);
                                specificFoodNames.push(qtyStr ? `${qtyStr} ${label}` : label);
                              }
                            }
                          }
                        }
                        const customs = log.actualCustomFoods || log.customFoods || log.plannedSnapshot.customFoods;
                        if (customs) {
                          for (const [cat, cList] of Object.entries(customs)) {
                            if (cList && Array.isArray(cList)) {
                              for (const cFood of cList) {
                                const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, cFood, true);
                                const qty = quantities?.[qtyKey];
                                const qtyStr = formatFoodItemQuantity(qty, t);
                                specificFoodNames.push(qtyStr ? `${qtyStr} ${cFood}` : cFood);
                              }
                            }
                          }
                        }

                        const logPhotos = log.foodPhotos || (log.foodPhoto ? [log.foodPhoto] : log.plannedSnapshot.foodPhotos || (log.plannedSnapshot.foodPhoto ? [log.plannedSnapshot.foodPhoto] : []));

                        return (
                          <div
                            key={log.id}
                            className={`sdb-unplanned-card sdb-unplanned-card--${log.status}${isTwentyPercent ? ' sdb-unplanned-card--twenty-percent' : ''}`}
                          >
                            <div className="sdb-unplanned-card-top">
                              <div className="sdb-unplanned-card-badges">
                                <span className="sdb-unplanned-pill">{t.sdb_food_log_unplanned_tag}</span>
                                {autoTime && (
                                  <span className="sdb-food-log-time-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '0.75rem' }}>
                                    🕒 {autoTime}
                                  </span>
                                )}
                                {mealTypeLabel && (
                                  <span className="sdb-block-meal-type-badge">
                                    {mealTypeLabel}
                                  </span>
                                )}
                                {outcomeLabel && (
                                  <span className={`sdb-outcome-pill sdb-outcome-pill--${isOntrack ? 'ontrack' : 'slip'}`}>
                                    {outcomeLabel}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="sdb-verified-link sdb-verified-link--clear"
                                onClick={() => handleClearStatus(log.plannedBlockId)}
                                aria-label={t.sdb_v_clear_status}
                              >
                                {t.sdb_v_clear_status}
                              </button>
                            </div>
                            {desc && <div className="sdb-unplanned-desc">{desc}</div>}
                            {log.actualFoodCategories && log.actualFoodCategories.length > 0 && (
                              <div className="sdb-unplanned-categories">
                                {log.actualFoodCategories.map(cat => (
                                  <span key={cat} className="sdb-unplanned-category-chip">
                                    {FOOD_CATEGORY_ICONS[cat]} {t[`sdb_cat_${cat}` as keyof typeof t] as string}
                                  </span>
                                ))}
                              </div>
                            )}
                            {specificFoodNames.length > 0 && (
                              <div className="sdb-unplanned-specific-foods">
                                <span>• {specificFoodNames.join(', ')}</span>
                              </div>
                            )}
                            {logPhotos.length > 0 && (
                              <div className="sdb-unplanned-photos sdb-block-photos-cluster">
                                {logPhotos.map((p, idx) => {
                                  const url = getPhotoDataUrlSync(p.id);
                                  return (
                                    <button
                                      key={p.id || idx}
                                      type="button"
                                      className="sdb-block-photo-thumb-btn"
                                      onClick={() => setPreviewPhotos({
                                        photos: logPhotos.map((item, pIdx) => ({
                                          id: item.id,
                                          dataUrl: getPhotoDataUrlSync(item.id),
                                          caption: `${desc} (${t.sdb_food_photo} ${pIdx + 1})`,
                                        })),
                                        initialIndex: idx,
                                      })}
                                      title={`${t.sdb_view_photo} (${idx + 1}/${logPhotos.length})`}
                                    >
                                      {url ? (
                                        <img src={url} alt={`${desc} photo ${idx + 1}`} className="sdb-block-photo-thumb" />
                                      ) : (
                                        <div className="sdb-block-photo-thumb-placeholder">📷</div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Recovery & Drift for Eligible Slips (Phase 26D) */}
                            {isEligibleSlipForDrift(log) && (
                              <div className="sdb-recovery-drift-container sdb-recovery-drift-container--unplanned">
                                <div className="sdb-recovery-row">
                                  <span className="sdb-recovery-subhead">{t.sdb_recovery_section_title}</span>
                                  <button
                                    id={`btn-unplanned-resumed-${log.id}`}
                                    type="button"
                                    className={`sdb-resumed-toggle-btn ${log.isResumed ? 'sdb-resumed-toggle-btn--active' : ''}`}
                                    onClick={() => handleToggleResumed(log.plannedBlockId)}
                                    aria-pressed={!!log.isResumed}
                                  >
                                    <span className="sdb-resumed-toggle-icon" aria-hidden="true">
                                      {log.isResumed ? '✓' : '⟲'}
                                    </span>
                                    <span className="sdb-resumed-toggle-text">
                                      {log.isResumed ? t.sdb_marked_resumed : t.sdb_mark_resumed}
                                    </span>
                                  </button>
                                </div>

                                <div className="sdb-drift-ctrl-wrap">
                                  <span className="sdb-drift-subhead">{t.sdb_drift_title}</span>
                                  <div className="sdb-drift-btn-group">
                                    {(!log.driftState || log.driftState === 'none') && (
                                      <button
                                        id={`btn-unplanned-drift-start-${log.id}`}
                                        type="button"
                                        className="sdb-drift-action-btn sdb-drift-action-btn--start"
                                        onClick={() => handleUpdateDriftState(log.plannedBlockId, 'started')}
                                      >
                                        <span className="sdb-drift-btn-icon">🌊</span>
                                        <span>{t.sdb_drift_start}</span>
                                      </button>
                                    )}

                                    {(log.driftState === 'started' || log.driftState === 'drifting') && (
                                      <>
                                        <button
                                          id={`btn-unplanned-drift-still-${log.id}`}
                                          type="button"
                                          className={`sdb-drift-action-btn sdb-drift-action-btn--drifting ${log.driftState === 'drifting' ? 'sdb-drift-action-btn--active' : ''}`}
                                          onClick={() => handleUpdateDriftState(log.plannedBlockId, 'drifting')}
                                        >
                                          <span className="sdb-drift-btn-icon">〰️</span>
                                          <span>{t.sdb_drift_still}</span>
                                        </button>
                                        <button
                                          id={`btn-unplanned-drift-stop-${log.id}`}
                                          type="button"
                                          className="sdb-drift-action-btn sdb-drift-action-btn--stop"
                                          onClick={() => handleUpdateDriftState(log.plannedBlockId, 'stopped')}
                                        >
                                          <span className="sdb-drift-btn-icon">🛑</span>
                                          <span>{t.sdb_drift_stopped}</span>
                                        </button>
                                      </>
                                    )}

                                    {log.driftState === 'stopped' && (
                                      <div className="sdb-drift-status-badge sdb-drift-status-badge--stopped">
                                        <span className="sdb-drift-badge-icon">✓</span>
                                        <span>{t.sdb_drift_stopped}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                      onQuickUpdateCategories={(foodCategories) => handleQuickUpdateBlock(block.id, { foodCategories })}
                      onPreviewPhotos={(photos, idx) => setPreviewPhotos({ photos, initialIndex: idx })}
                      onQuickAddPhoto={handleQuickAddPhoto}
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
                    id="btn-sdb-log-food"
                    type="button"
                    className="sdb-log-food-btn"
                    onClick={() => isToday ? setShowFoodLogModal(true) : setEditingBlock('new')}
                  >
                    <span className="sdb-add-btn-icon">🍽️</span>
                    {t.sdb_log_food}
                  </button>
                  <button
                    id="btn-sdb-add-block"
                    type="button"
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
                      id="btn-sdb-empty-log-food"
                      type="button"
                      className="sdb-empty-log-food-btn"
                      onClick={() => isToday ? setShowFoodLogModal(true) : setEditingBlock('new')}
                    >
                      🍽️ {t.sdb_log_food}
                    </button>
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
                        onPreviewPhotos={(photos, idx) => setPreviewPhotos({ photos, initialIndex: idx })}
                        onQuickAddPhoto={handleQuickAddPhoto}
                        onUpdateDriftState={(state) => handleUpdateDriftState(block.id, state)}
                      />
                    );
                  })}
                </div>
              )}

              {/* ── Unplanned / In-the-Moment Food Logs Today (Phase 26A) ── */}
              {isToday && unplannedVerifications.length > 0 && (
                <div className="sdb-unplanned-section" id="sdb-unplanned-food-logs">
                  <div className="sdb-unplanned-header">
                    <span className="sdb-unplanned-section-badge">🍽️ {t.sdb_food_log_modal_badge}</span>
                    <span className="sdb-unplanned-section-tag">{t.sdb_food_log_unplanned_tag}</span>
                  </div>
                  <div className="sdb-unplanned-list">
                    {unplannedVerifications.map(log => {
                      const desc = log.actualCustomText?.trim() || log.plannedSnapshot.customText?.trim() || (log.actualFoodCategories && log.actualFoodCategories.length > 0 ? log.actualFoodCategories.map(c => (t[`sdb_cat_${c}` as keyof typeof t] as string | undefined) || c).join(', ') : t.sdb_food_log_modal_badge);
                      const outcomeKey = log.detailedOutcome;
                      const outcomeLabel = outcomeKey ? (t[`sdb_outcome_${outcomeKey}` as keyof typeof t] as string) || outcomeKey : '';
                      const isOntrack = log.status === 'on-track';
                      const isTwentyPercent = outcomeKey === 'twenty_percent_off_track';

                      const logMealType = log.mealType || log.plannedSnapshot.mealType;
                      const mealTypeLabel = logMealType ? ((t[`sdb_meal_type_${logMealType}` as keyof typeof t] as string | undefined) || logMealType) : '';
                      const autoTime = log.plannedSnapshot.startTime;

                      const specificFoodNames: string[] = [];
                      const selections = log.actualFoodSelections || log.foodSelections || log.plannedSnapshot.foodSelections;
                      const quantities = log.actualFoodQuantities || log.foodQuantities || log.plannedSnapshot.foodQuantities;

                      if (selections) {
                        for (const [cat, keys] of Object.entries(selections)) {
                          if (keys && Array.isArray(keys)) {
                            for (const k of keys) {
                              const opt = findFoodOption(cat as FoodCategoryKey, k);
                              const label = opt ? ((t[opt.i18nKey as keyof typeof t] as string | undefined) || opt.key) : k;
                              const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, k);
                              const qty = quantities?.[qtyKey];
                              const qtyStr = formatFoodItemQuantity(qty, t);
                              specificFoodNames.push(qtyStr ? `${qtyStr} ${label}` : label);
                            }
                          }
                        }
                      }
                      const customs = log.actualCustomFoods || log.customFoods || log.plannedSnapshot.customFoods;
                      if (customs) {
                        for (const [cat, cList] of Object.entries(customs)) {
                          if (cList && Array.isArray(cList)) {
                            for (const cFood of cList) {
                              const qtyKey = getFoodQuantityKey(cat as FoodCategoryKey, cFood, true);
                              const qty = quantities?.[qtyKey];
                              const qtyStr = formatFoodItemQuantity(qty, t);
                              specificFoodNames.push(qtyStr ? `${qtyStr} ${cFood}` : cFood);
                            }
                          }
                        }
                      }

                      const logPhotos = log.foodPhotos || (log.foodPhoto ? [log.foodPhoto] : log.plannedSnapshot.foodPhotos || (log.plannedSnapshot.foodPhoto ? [log.plannedSnapshot.foodPhoto] : []));

                      return (
                        <div
                          key={log.id}
                          className={`sdb-unplanned-card sdb-unplanned-card--${log.status}${isTwentyPercent ? ' sdb-unplanned-card--twenty-percent' : ''}`}
                        >
                          <div className="sdb-unplanned-card-top">
                            <div className="sdb-unplanned-card-badges">
                              <span className="sdb-unplanned-pill">{t.sdb_food_log_unplanned_tag}</span>
                              {autoTime && (
                                <span className="sdb-food-log-time-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '0.75rem' }}>
                                  🕒 {autoTime}
                                </span>
                              )}
                              {mealTypeLabel && (
                                <span className="sdb-block-meal-type-badge">
                                  {mealTypeLabel}
                                </span>
                              )}
                              {outcomeLabel && (
                                <span className={`sdb-outcome-pill sdb-outcome-pill--${isOntrack ? 'ontrack' : 'slip'}`}>
                                  {outcomeLabel}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="sdb-verified-link sdb-verified-link--clear"
                              onClick={() => handleClearStatus(log.plannedBlockId)}
                              aria-label={t.sdb_v_clear_status}
                            >
                              {t.sdb_v_clear_status}
                            </button>
                          </div>
                          {desc && <div className="sdb-unplanned-desc">{desc}</div>}
                          {log.actualFoodCategories && log.actualFoodCategories.length > 0 && (
                            <div className="sdb-unplanned-categories">
                              {log.actualFoodCategories.map(cat => (
                                <span key={cat} className="sdb-unplanned-category-chip">
                                  {FOOD_CATEGORY_ICONS[cat]} {t[`sdb_cat_${cat}` as keyof typeof t] as string}
                                </span>
                              ))}
                            </div>
                          )}
                          {specificFoodNames.length > 0 && (
                            <div className="sdb-unplanned-specific-foods">
                              <span>• {specificFoodNames.join(', ')}</span>
                            </div>
                          )}
                          {logPhotos.length > 0 && (
                            <div className="sdb-unplanned-photos sdb-block-photos-cluster">
                              {logPhotos.map((p, idx) => {
                                const url = getPhotoDataUrlSync(p.id);
                                return (
                                  <button
                                    key={p.id || idx}
                                    type="button"
                                    className="sdb-block-photo-thumb-btn"
                                    onClick={() => setPreviewPhotos({
                                      photos: logPhotos.map((item, pIdx) => ({
                                        id: item.id,
                                        dataUrl: getPhotoDataUrlSync(item.id),
                                        caption: `${desc} (${t.sdb_food_photo} ${pIdx + 1})`,
                                      })),
                                      initialIndex: idx,
                                    })}
                                    title={`${t.sdb_view_photo} (${idx + 1}/${logPhotos.length})`}
                                  >
                                    {url ? (
                                      <img src={url} alt={`${desc} photo ${idx + 1}`} className="sdb-block-photo-thumb" />
                                    ) : (
                                      <div className="sdb-block-photo-thumb-placeholder">📷</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Recovery & Drift for Eligible Slips (Phase 26D) */}
                          {isEligibleSlipForDrift(log) && (
                            <div className="sdb-recovery-drift-container sdb-recovery-drift-container--unplanned">
                              <div className="sdb-recovery-row">
                                <span className="sdb-recovery-subhead">{t.sdb_recovery_section_title}</span>
                                <button
                                  id={`btn-unplanned-resumed-daily-${log.id}`}
                                  type="button"
                                  className={`sdb-resumed-toggle-btn ${log.isResumed ? 'sdb-resumed-toggle-btn--active' : ''}`}
                                  onClick={() => handleToggleResumed(log.plannedBlockId)}
                                  aria-pressed={!!log.isResumed}
                                >
                                  <span className="sdb-resumed-toggle-icon" aria-hidden="true">
                                    {log.isResumed ? '✓' : '⟲'}
                                  </span>
                                  <span className="sdb-resumed-toggle-text">
                                    {log.isResumed ? t.sdb_marked_resumed : t.sdb_mark_resumed}
                                  </span>
                                </button>
                              </div>

                              <div className="sdb-drift-ctrl-wrap">
                                <span className="sdb-drift-subhead">{t.sdb_drift_title}</span>
                                <div className="sdb-drift-btn-group">
                                  {(!log.driftState || log.driftState === 'none') && (
                                    <button
                                      id={`btn-unplanned-drift-start-daily-${log.id}`}
                                      type="button"
                                      className="sdb-drift-action-btn sdb-drift-action-btn--start"
                                      onClick={() => handleUpdateDriftState(log.plannedBlockId, 'started')}
                                    >
                                      <span className="sdb-drift-btn-icon">🌊</span>
                                      <span>{t.sdb_drift_start}</span>
                                    </button>
                                  )}

                                  {(log.driftState === 'started' || log.driftState === 'drifting') && (
                                    <>
                                      <button
                                        id={`btn-unplanned-drift-still-daily-${log.id}`}
                                        type="button"
                                        className={`sdb-drift-action-btn sdb-drift-action-btn--drifting ${log.driftState === 'drifting' ? 'sdb-drift-action-btn--active' : ''}`}
                                        onClick={() => handleUpdateDriftState(log.plannedBlockId, 'drifting')}
                                      >
                                        <span className="sdb-drift-btn-icon">〰️</span>
                                        <span>{t.sdb_drift_still}</span>
                                      </button>
                                      <button
                                        id={`btn-unplanned-drift-stop-daily-${log.id}`}
                                        type="button"
                                        className="sdb-drift-action-btn sdb-drift-action-btn--stop"
                                        onClick={() => handleUpdateDriftState(log.plannedBlockId, 'stopped')}
                                      >
                                        <span className="sdb-drift-btn-icon">🛑</span>
                                        <span>{t.sdb_drift_stopped}</span>
                                      </button>
                                    </>
                                  )}

                                  {log.driftState === 'stopped' && (
                                    <div className="sdb-drift-stopped-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div className="sdb-drift-status-badge sdb-drift-status-badge--stopped">
                                        <span className="sdb-drift-badge-icon">✓</span>
                                        <span>{t.sdb_drift_stopped}</span>
                                      </div>
                                      {onNavigate && (
                                        <button
                                          id={`btn-unplanned-drift-recommit-daily-${log.id}`}
                                          type="button"
                                          className="sdb-drift-recommit-btn"
                                          onClick={() => onNavigate('recommit')}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            background: 'rgba(74, 222, 128, 0.15)',
                                            border: '1px solid rgba(74, 222, 128, 0.35)',
                                            borderRadius: '14px',
                                            color: '#4ade80',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <span>⚡</span>
                                          <span>{t.recommit_title || 'Re-Commit'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                  id="btn-sdb-log-food"
                  type="button"
                  className="sdb-log-food-btn"
                  onClick={() => isToday ? setShowFoodLogModal(true) : setEditingBlock('new')}
                >
                  <span className="sdb-add-btn-icon">🍽️</span>
                  {t.sdb_log_food}
                </button>
                <button
                  id="btn-sdb-add-block"
                  type="button"
                  className="sdb-add-btn"
                  onClick={() => setEditingBlock('new')}
                >
                  <span className="sdb-add-btn-icon">+</span>
                  {t.sdb_add_block}
                </button>
              </div>
            </>
          )}

          {/* ── Eating Structure & Food Category Awareness (Phase 26C) ── */}
          <StructureAwarenessCard
            allVerifications={allVerifications}
            activeProfileId={activeProfile.id}
            selectedPeriod={structurePeriod}
            onSelectPeriod={setStructurePeriod}
            t={t}
          />
        </div>
      )}
    </div>
  </div>

      {/* ── Block editor modal ── */}
      {editingBlock && (
        <BlockEditor
          initial={editingBlock === 'new' ? null : editingBlock}
          initialOutcome={
            isToday && editingBlock !== 'new'
              ? todayVerification?.entries.find(e => e.plannedBlockId === editingBlock.id)?.detailedOutcome ?? 'none'
              : undefined
          }
          isToday={isToday}
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
          initialDriftState={
            todayVerification?.entries.find(e => e.plannedBlockId === slipModalBlock.id)?.driftState
          }
          onSave={handleSaveSlipVerification}
          onCancel={() => setSlipModalBlock(null)}
          t={t}
        />
      )}

      {/* ── Unplanned Food Log Modal (Phase 26A) ── */}
      {showFoodLogModal && (
        <FoodLogModal
          onSave={handleSaveFoodLog}
          onCancel={() => setShowFoodLogModal(false)}
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

      {/* ── Food Photo Preview Modal (Phase 6B Multi-Photo) ── */}
      {previewPhotos && (
        <PhotoPreviewModal
          photos={previewPhotos.photos}
          initialIndex={previewPhotos.initialIndex}
          onClose={() => setPreviewPhotos(null)}
          t={t}
        />
      )}
    </div>
  );
}
