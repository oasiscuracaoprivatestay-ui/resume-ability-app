/**
 * Super Diet-Ability — Personal Meal Library Modal (Final Completion Phase 2)
 *
 * Connects the Phase 1 Personal Meal Library (`mealLibraryStorage.ts`) to the
 * Structured Diet interface:
 * - Browse, search, and filter saved reusable custom meals
 * - Create or edit custom meals with uploaded photos OR zero-duplication reuse of existing uploaded photos
 * - Apply a saved meal directly to a scheduled block (`apply_to_block`), add as an alternative (`add_alternative`),
 *   or insert into the active day's schedule (`browse`)
 * - Photo-safe deletion via `deleteLibraryMeal()`
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import {
  FOOD_CATEGORY_KEYS,
  FOOD_CATEGORY_ICONS,
  type FoodCategoryKey,
  getTimeSlotOptions,
} from '../data/dietData';
import {
  getFoodOptionsForCategory,
  type FoodSelectionsMap,
  type CustomFoodsMap,
  type FoodQuantitiesMap,
  type SoupPortionKey,
  SOUP_PORTION_KEYS,
} from '../data/foodOptions';
import {
  MEAL_TYPE_KEYS,
  type MealTypeKey,
  type StructuredDietBlock,
  calculateEndTimeFromStart,
} from '../utils/dietStorage';
import {
  saveFoodPhoto,
  getFoodPhoto,
  getPhotoDataUrlSync,
  isValidImageFile,
  type FoodPhotoMetadata,
} from '../utils/photoStorage';
import {
  listLibraryMeals,
  saveLibraryMeal,
  deleteLibraryMeal,
  listReusableUploadedPhotos,
  getLibraryMealPhotos,
  MEAL_LIBRARY_UPDATED_EVENT,
  type PersonalMealLibraryItem,
} from '../utils/mealLibraryStorage';
import {
  resolveMealStockPhoto,
  translateBuiltInFoodItem,
} from '../utils/mealStockPhotos';
import './PersonalMealLibraryModal.css';

export type MealLibraryModalMode = 'browse' | 'apply_to_block' | 'add_alternative';

interface PersonalMealLibraryModalProps {
  isOpen: boolean;
  mode: MealLibraryModalMode;
  targetBlock?: StructuredDietBlock | null;
  onClose: () => void;
  onSelectMeal: (
    meal: PersonalMealLibraryItem,
    timeSlot?: { startTime: string; endTime: string }
  ) => void;
}

export const PersonalMealLibraryModal: React.FC<PersonalMealLibraryModalProps> = ({
  isOpen,
  mode,
  targetBlock,
  onClose,
  onSelectMeal,
}) => {
  const { t, lang } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealTypeFilter, setSelectedMealTypeFilter] = useState<MealTypeKey | 'all'>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  // Create / Edit sub-view state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalMealLibraryItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMealType, setFormMealType] = useState<MealTypeKey>('lunch');
  const [formCategories, setFormCategories] = useState<FoodCategoryKey[]>([]);
  const [activeCategorySub, setActiveCategorySub] = useState<FoodCategoryKey | null>(null);
  const [formSelections, setFormSelections] = useState<FoodSelectionsMap>({});
  const [formCustomFoods, setFormCustomFoods] = useState<CustomFoodsMap>({});
  const [formQuantities, setFormQuantities] = useState<FoodQuantitiesMap>({});
  const [formSoupPortion, setFormSoupPortion] = useState<SoupPortionKey | undefined>(undefined);
  const [customFoodInput, setCustomFoodInput] = useState('');
  const [formPhotos, setFormPhotos] = useState<FoodPhotoMetadata[]>([]);
  const [showReusePhotoPicker, setShowReusePhotoPicker] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [formError, setFormError] = useState('');

  // Time picker when adding directly to day in 'browse' mode
  const [insertStartTime, setInsertStartTime] = useState('12:30');
  const [insertEndTime, setInsertEndTime] = useState('13:00');

  // Resolved data URLs for displayed photos
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedMealTypeFilter('all');
    setIsFormOpen(false);
    setEditingItem(null);
    setShowReusePhotoPicker(false);
    setFormError('');
    if (targetBlock) {
      setInsertStartTime(targetBlock.startTime);
      setInsertEndTime(targetBlock.endTime);
    }
  }, [isOpen, targetBlock]);

  useEffect(() => {
    if (!isOpen) return;
    const onLibUpdate = () => setRefreshTick(v => v + 1);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener(MEAL_LIBRARY_UPDATED_EVENT, onLibUpdate);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(MEAL_LIBRARY_UPDATED_EVENT, onLibUpdate);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const meals = useMemo(() => {
    if (!isOpen) return [];
    return listLibraryMeals({
      mealType: selectedMealTypeFilter === 'all' ? undefined : selectedMealTypeFilter,
      query: searchQuery,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedMealTypeFilter, searchQuery, refreshTick]);

  const reusablePhotos = useMemo(() => {
    if (!isOpen) return [];
    return listReusableUploadedPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, refreshTick, formPhotos]);

  // Hydrate photo URLs from IndexedDB when needed
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const idsToLoad = new Set<string>();
    for (const m of meals) {
      for (const p of getLibraryMealPhotos(m)) {
        idsToLoad.add(p.id);
      }
    }
    for (const p of reusablePhotos) {
      idsToLoad.add(p.id);
    }
    for (const p of formPhotos) {
      idsToLoad.add(p.id);
    }

    for (const id of idsToLoad) {
      if (!id) continue;
      const syncUrl = getPhotoDataUrlSync(id);
      if (syncUrl && !photoUrls[id]) {
        setPhotoUrls(prev => ({ ...prev, [id]: syncUrl }));
      } else if (!syncUrl && !photoUrls[id]) {
        getFoodPhoto(id)
          .then(rec => {
            if (active && rec?.dataUrl) {
              setPhotoUrls(prev => ({ ...prev, [id]: rec.dataUrl }));
            }
          })
          .catch(() => {});
      }
    }
    return () => {
      active = false;
    };
  }, [isOpen, meals, reusablePhotos, formPhotos, photoUrls]);

  if (!isOpen) return null;

  const openCreateForm = () => {
    setEditingItem(null);
    setFormName('');
    setFormDesc('');
    setFormMealType(
      (targetBlock?.mealType as MealTypeKey) ||
        (['breakfast', 'lunch', 'dinner', 'snack'].includes(
          (targetBlock?.type || '').toLowerCase()
        )
          ? ((targetBlock?.type || '').toLowerCase() as MealTypeKey)
          : 'lunch')
    );
    setFormCategories([]);
    setActiveCategorySub(null);
    setFormSelections({});
    setFormCustomFoods({});
    setFormQuantities({});
    setFormSoupPortion(undefined);
    setCustomFoodInput('');
    setFormPhotos([]);
    setShowReusePhotoPicker(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: PersonalMealLibraryItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.description || '');
    setFormMealType(item.mealType || 'lunch');
    setFormCategories([...item.foodCategories]);
    setActiveCategorySub(item.foodCategories[0] || null);
    setFormSelections(item.foodSelections ? JSON.parse(JSON.stringify(item.foodSelections)) : {});
    setFormCustomFoods(item.customFoods ? JSON.parse(JSON.stringify(item.customFoods)) : {});
    setFormQuantities(item.foodQuantities ? JSON.parse(JSON.stringify(item.foodQuantities)) : {});
    setFormSoupPortion(item.soupPortion);
    setCustomFoodInput('');
    setFormPhotos(getLibraryMealPhotos(item));
    setShowReusePhotoPicker(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!isValidImageFile(file)) {
      setFormError(t.sdb_err_invalid_image);
      return;
    }
    setIsUploadingPhoto(true);
    setFormError('');
    try {
      const meta = await saveFoodPhoto(file);
      const sync = getPhotoDataUrlSync(meta.id);
      if (sync) {
        setPhotoUrls(prev => ({ ...prev, [meta.id]: sync }));
      }
      setFormPhotos(prev => [meta, ...prev.filter(p => p.id !== meta.id)]);
    } catch {
      setFormError(t.sdb_err_invalid_image);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleReuseExistingPhoto = (meta: FoodPhotoMetadata) => {
    setFormPhotos(prev => [meta, ...prev.filter(p => p.id !== meta.id)]);
    setShowReusePhotoPicker(false);
  };

  const handleToggleFormCategory = (cat: FoodCategoryKey) => {
    const exists = formCategories.includes(cat);
    if (exists) {
      if (activeCategorySub === cat) {
        setFormCategories(prev => prev.filter(c => c !== cat));
        const nextSel = { ...formSelections };
        delete nextSel[cat];
        setFormSelections(nextSel);
        const nextCus = { ...formCustomFoods };
        delete nextCus[cat];
        setFormCustomFoods(nextCus);
        setActiveCategorySub(null);
      } else {
        setActiveCategorySub(cat);
      }
    } else {
      setFormCategories(prev => [...prev, cat]);
      setActiveCategorySub(cat);
    }
  };

  const handleToggleSpecificFood = (cat: FoodCategoryKey, foodKey: string) => {
    const cur = formSelections[cat] || [];
    const nextList = cur.includes(foodKey) ? cur.filter(k => k !== foodKey) : [...cur, foodKey];
    const nextSel = { ...formSelections };
    if (nextList.length > 0) nextSel[cat] = nextList;
    else delete nextSel[cat];
    setFormSelections(nextSel);
  };

  const handleAddCustomFood = () => {
    if (!activeCategorySub) return;
    const trimmed = customFoodInput.trim();
    if (!trimmed) return;
    const cur = formCustomFoods[activeCategorySub] || [];
    if (!cur.some(x => x.toLowerCase() === trimmed.toLowerCase())) {
      setFormCustomFoods(prev => ({
        ...prev,
        [activeCategorySub]: [...cur, trimmed],
      }));
    }
    setCustomFoodInput('');
  };

  const handleSaveForm = (applyImmediately = false) => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError(t.mlib_err_name_required);
      return;
    }

    const blockType =
      formMealType === 'other'
        ? 'Custom'
        : formMealType.charAt(0).toUpperCase() + formMealType.slice(1);

    const saved = saveLibraryMeal({
      id: editingItem?.id,
      name: trimmedName,
      description: formDesc.trim() || undefined,
      blockType,
      mealType: formMealType,
      foodCategories: formCategories,
      foodSelections: formSelections,
      customFoods: formCustomFoods,
      foodQuantities: Object.keys(formQuantities).length > 0 ? formQuantities : undefined,
      soupPortion: formCategories.includes('soups') ? formSoupPortion : undefined,
      foodPhoto: formPhotos[0],
      foodPhotos: formPhotos.length > 0 ? formPhotos : undefined,
      imageRef: formPhotos[0]
        ? {
            kind: 'uploaded_photo',
            photoId: formPhotos[0].id,
            photoMeta: { ...formPhotos[0] },
          }
        : undefined,
    });

    setIsFormOpen(false);
    setEditingItem(null);
    setRefreshTick(v => v + 1);

    if (applyImmediately) {
      onSelectMeal(saved, { startTime: insertStartTime, endTime: insertEndTime });
    }
  };

  const handleDeleteMeal = async (id: string) => {
    await deleteLibraryMeal(id);
    setRefreshTick(v => v + 1);
  };

  const formatMealIngredients = (meal: PersonalMealLibraryItem): string => {
    const parts: string[] = [];
    if (meal.description && meal.description.toLowerCase() !== meal.name.toLowerCase()) {
      parts.push(meal.description);
    }
    if (meal.foodSelections) {
      for (const [cat, keys] of Object.entries(meal.foodSelections)) {
        for (const k of keys || []) {
          const lbl = translateBuiltInFoodItem(k, t, cat as FoodCategoryKey);
          if (lbl && !parts.some(p => p.toLowerCase().includes(lbl.toLowerCase()))) {
            parts.push(lbl);
          }
        }
      }
    }
    if (meal.customFoods) {
      for (const list of Object.values(meal.customFoods)) {
        for (const c of list || []) {
          if (c && !parts.some(p => p.toLowerCase().includes(c.toLowerCase()))) {
            parts.push(c);
          }
        }
      }
    }
    if (parts.length > 0) return parts.join(' · ');
    if (meal.foodCategories.length > 0) {
      return meal.foodCategories
        .map(c => (t[`sdb_cat_${c}` as keyof typeof t] as string) || c)
        .join(', ');
    }
    return '';
  };

  const modalTitle =
    mode === 'apply_to_block'
      ? t.mlib_pick_for_block_title
      : mode === 'add_alternative'
      ? t.mlib_pick_for_alt_title
      : t.mlib_modal_title;

  const primaryActionLabel =
    mode === 'apply_to_block'
      ? t.mlib_btn_select_meal
      : mode === 'add_alternative'
      ? t.mlib_btn_select_alt
      : t.mlib_btn_use_in_day;

  return (
    <div
      className="mlib-backdrop"
      id="personal-meal-library-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mlib-modal-heading"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mlib-dialog">
        <header className="mlib-header">
          <div className="mlib-header-copy">
            <h2 id="mlib-modal-heading" className="mlib-title">
              {isFormOpen
                ? editingItem
                  ? t.mlib_form_edit_title
                  : t.mlib_form_create_title
                : modalTitle}
            </h2>
            {!isFormOpen && <p className="mlib-subtitle">{t.mlib_modal_sub}</p>}
          </div>
          <button
            type="button"
            id="btn-mlib-close"
            className="mlib-close-btn"
            onClick={onClose}
            aria-label={t.commit_cancel}
          >
            ✕
          </button>
        </header>

        <div className="mlib-body">
          {isFormOpen ? (
            /* ── CREATE / EDIT LIBRARY MEAL FORM ── */
            <div className="mlib-form" id="mlib-meal-form">
              <div className="mlib-field">
                <label className="mlib-label" htmlFor="input-mlib-name">
                  {t.mlib_field_name}
                </label>
                <input
                  id="input-mlib-name"
                  type="text"
                  className="mlib-input"
                  value={formName}
                  onChange={e => {
                    setFormName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder={t.mlib_field_name_placeholder}
                  maxLength={90}
                  autoFocus
                />
              </div>

              <div className="mlib-field">
                <label className="mlib-label" htmlFor="input-mlib-desc">
                  {t.mlib_field_desc}{' '}
                  <span className="mlib-optional">({t.sdb_optional})</span>
                </label>
                <input
                  id="input-mlib-desc"
                  type="text"
                  className="mlib-input"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder={t.mlib_field_desc_placeholder}
                  maxLength={140}
                />
              </div>

              {/* Meal Type */}
              <div className="mlib-field">
                <span className="mlib-label">{t.sdb_block_type}</span>
                <div className="mlib-chip-row">
                  {MEAL_TYPE_KEYS.map(mt => {
                    const label =
                      (t[`sdb_meal_type_${mt}` as keyof typeof t] as string) ||
                      (t[`sdb_type_${mt}` as keyof typeof t] as string) ||
                      mt;
                    return (
                      <button
                        key={mt}
                        type="button"
                        id={`btn-mlib-type-${mt}`}
                        className={`mlib-chip ${formMealType === mt ? 'mlib-chip--active' : ''}`}
                        onClick={() => setFormMealType(mt)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Photo Attachment + Zero-Duplication Reuse Picker */}
              <div className="mlib-field">
                <span className="mlib-label">
                  📷 {t.sdb_food_photos}{' '}
                  <span className="mlib-optional">({t.sdb_optional})</span>
                </span>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                />
                <input
                  ref={fileInputRef}
                  id="input-mlib-photo-file"
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                />

                {formPhotos.length > 0 && (
                  <div className="mlib-photo-preview-strip">
                    {formPhotos.map((p, idx) => {
                      const src = photoUrls[p.id] || getPhotoDataUrlSync(p.id);
                      return (
                        <div key={p.id} className="mlib-photo-thumb-card">
                          {src ? (
                            <img src={src} alt={formName || 'Meal photo'} className="mlib-photo-thumb-img" />
                          ) : (
                            <div className="mlib-photo-thumb-fallback">📷</div>
                          )}
                          <button
                            type="button"
                            id={`btn-mlib-remove-photo-${idx}`}
                            className="mlib-photo-remove-btn"
                            onClick={() =>
                              setFormPhotos(prev => prev.filter((_, i) => i !== idx))
                            }
                            aria-label={t.sdb_remove_photo}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mlib-photo-actions">
                  <button
                    type="button"
                    id="btn-mlib-take-photo"
                    className="mlib-photo-btn"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    📷 {t.sdb_take_photo}
                  </button>
                  <button
                    type="button"
                    id="btn-mlib-gallery-photo"
                    className="mlib-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    🖼️ {t.sdb_choose_gallery}
                  </button>
                  <button
                    type="button"
                    id="btn-mlib-reuse-photo"
                    className={`mlib-photo-btn ${showReusePhotoPicker ? 'mlib-photo-btn--active' : ''}`}
                    onClick={() => setShowReusePhotoPicker(prev => !prev)}
                  >
                    ♻️ {t.mlib_btn_reuse_photo}
                  </button>
                </div>

                {showReusePhotoPicker && (
                  <div className="mlib-reuse-picker" id="mlib-reuse-photo-picker">
                    <span className="mlib-reuse-heading">{t.mlib_reuse_photo_heading}</span>
                    {reusablePhotos.length === 0 ? (
                      <p className="mlib-reuse-empty">{t.mlib_reuse_photo_empty}</p>
                    ) : (
                      <div className="mlib-reuse-grid">
                        {reusablePhotos.map(p => {
                          const src = photoUrls[p.id] || getPhotoDataUrlSync(p.id);
                          const isSelected = formPhotos.some(fp => fp.id === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              id={`btn-mlib-pick-existing-photo-${p.id}`}
                              className={`mlib-reuse-thumb-btn ${isSelected ? 'mlib-reuse-thumb-btn--selected' : ''}`}
                              onClick={() => handleReuseExistingPhoto(p)}
                            >
                              {src ? (
                                <img src={src} alt="" className="mlib-reuse-thumb-img" />
                              ) : (
                                <span className="mlib-photo-thumb-fallback">📷</span>
                              )}
                              {isSelected && <span className="mlib-reuse-check">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Food Categories & Specific Foods */}
              <div className="mlib-field">
                <span className="mlib-label">{t.sdb_food_categories_label}</span>
                <div className="mlib-chip-row">
                  {FOOD_CATEGORY_KEYS.map(cat => {
                    const isSelected = formCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        id={`btn-mlib-cat-${cat}`}
                        className={`mlib-chip ${isSelected ? 'mlib-chip--active' : ''}`}
                        onClick={() => handleToggleFormCategory(cat)}
                      >
                        <span>{FOOD_CATEGORY_ICONS[cat]}</span>
                        <span>{t[`sdb_cat_${cat}` as keyof typeof t] as string}</span>
                      </button>
                    );
                  })}
                </div>

                {formCategories.includes('soups') && (
                  <div className="mlib-sub-box">
                    <span className="mlib-sub-label">🥣 {t.sdb_soup_portion_label}</span>
                    <div className="mlib-chip-row">
                      {SOUP_PORTION_KEYS.map(pk => (
                        <button
                          key={pk}
                          type="button"
                          className={`mlib-chip ${formSoupPortion === pk ? 'mlib-chip--active' : ''}`}
                          onClick={() =>
                            setFormSoupPortion(prev => (prev === pk ? undefined : pk))
                          }
                        >
                          {t[`sdb_soup_portion_${pk}` as keyof typeof t] as string}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeCategorySub && formCategories.includes(activeCategorySub) && (
                  <div className="mlib-sub-box">
                    <span className="mlib-sub-label">
                      {FOOD_CATEGORY_ICONS[activeCategorySub]}{' '}
                      {t[`sdb_cat_${activeCategorySub}` as keyof typeof t] as string}
                    </span>
                    <div className="mlib-chip-row">
                      {getFoodOptionsForCategory(activeCategorySub).map(opt => {
                        const isPicked = (formSelections[activeCategorySub] || []).includes(
                          opt.key
                        );
                        const lbl =
                          (t[opt.i18nKey as keyof typeof t] as string) || opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            id={`btn-mlib-food-${opt.key}`}
                            className={`mlib-chip mlib-chip--sm ${isPicked ? 'mlib-chip--active' : ''}`}
                            onClick={() =>
                              handleToggleSpecificFood(activeCategorySub, opt.key)
                            }
                          >
                            {isPicked ? '✓ ' : ''}
                            {lbl}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mlib-custom-food-row">
                      <input
                        type="text"
                        className="mlib-input mlib-input--sm"
                        value={customFoodInput}
                        onChange={e => setCustomFoodInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomFood();
                          }
                        }}
                        placeholder={t.sdb_custom_food_placeholder}
                        maxLength={50}
                      />
                      <button
                        type="button"
                        className="mlib-photo-btn"
                        onClick={handleAddCustomFood}
                      >
                        {t.sdb_add_custom_food_btn}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <p className="mlib-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="mlib-form-footer">
                <button
                  type="button"
                  id="btn-mlib-form-cancel"
                  className="mlib-btn-secondary"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingItem(null);
                  }}
                >
                  {t.commit_cancel}
                </button>
                <button
                  type="button"
                  id="btn-mlib-form-save"
                  className="mlib-btn-primary"
                  onClick={() => handleSaveForm(false)}
                >
                  ✓ {t.commit_save}
                </button>
                {(mode === 'apply_to_block' || mode === 'add_alternative') && !editingItem && (
                  <button
                    type="button"
                    id="btn-mlib-form-save-and-use"
                    className="mlib-btn-primary"
                    onClick={() => handleSaveForm(true)}
                  >
                    ✓ {primaryActionLabel}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── BROWSE / SELECT SAVED MEALS VIEW ── */
            <>
              <div className="mlib-toolbar">
                <input
                  id="input-mlib-search"
                  type="search"
                  className="mlib-input mlib-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.mlib_search_placeholder}
                />
                <button
                  type="button"
                  id="btn-mlib-new-meal"
                  className="mlib-btn-new"
                  onClick={openCreateForm}
                >
                  <span>+</span>
                  <span>{t.mlib_btn_new_meal}</span>
                </button>
              </div>

              <div className="mlib-filter-bar" role="tablist">
                <button
                  type="button"
                  className={`mlib-chip ${selectedMealTypeFilter === 'all' ? 'mlib-chip--active' : ''}`}
                  onClick={() => setSelectedMealTypeFilter('all')}
                >
                  {t.mlib_filter_all}
                </button>
                {(['breakfast', 'lunch', 'dinner', 'snack'] as MealTypeKey[]).map(mt => {
                  const lbl =
                    (t[`sdb_meal_type_${mt}` as keyof typeof t] as string) ||
                    (t[`sdb_type_${mt}` as keyof typeof t] as string) ||
                    mt;
                  return (
                    <button
                      key={mt}
                      type="button"
                      className={`mlib-chip ${selectedMealTypeFilter === mt ? 'mlib-chip--active' : ''}`}
                      onClick={() => setSelectedMealTypeFilter(mt)}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>

              {mode === 'browse' && meals.length > 0 && (
                <div className="mlib-time-slot-bar" id="mlib-insert-time-bar">
                  <span className="mlib-time-slot-label">{t.sdb_start_time}:</span>
                  <div className="mlib-time-slot-selects">
                    <select
                      id="select-mlib-insert-start"
                      className="mlib-time-select"
                      value={insertStartTime}
                      onChange={e => {
                        const s = e.target.value;
                        setInsertStartTime(s);
                        setInsertEndTime(calculateEndTimeFromStart(s, 30));
                      }}
                    >
                      {getTimeSlotOptions(insertStartTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="mlib-time-sep">→</span>
                    <select
                      id="select-mlib-insert-end"
                      className="mlib-time-select"
                      value={insertEndTime}
                      onChange={e => setInsertEndTime(e.target.value)}
                    >
                      {getTimeSlotOptions(insertEndTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {meals.length === 0 ? (
                <div className="mlib-empty" id="mlib-empty-state">
                  <div className="mlib-empty-icon" aria-hidden="true">
                    🍽️
                  </div>
                  <h3 className="mlib-empty-title">{t.mlib_empty_title}</h3>
                  <p className="mlib-empty-sub">{t.mlib_empty_sub}</p>
                  <button
                    type="button"
                    id="btn-mlib-empty-create"
                    className="mlib-btn-primary"
                    onClick={openCreateForm}
                  >
                    + {t.mlib_btn_new_meal}
                  </button>
                </div>
              ) : (
                <div className="mlib-list" id="mlib-meals-list">
                  {meals.map(meal => {
                    const photos = getLibraryMealPhotos(meal);
                    const imgSrc =
                      (photos[0] && (photoUrls[photos[0].id] || getPhotoDataUrlSync(photos[0].id))) ||
                      resolveMealStockPhoto(meal);
                    const mealTypeLabel = meal.mealType
                      ? (t[`sdb_meal_type_${meal.mealType}` as keyof typeof t] as string) ||
                        meal.mealType
                      : meal.blockType || '';
                    const ingredientsLine = formatMealIngredients(meal);

                    return (
                      <article
                        key={meal.id}
                        id={`mlib-card-${meal.id}`}
                        className="mlib-meal-card"
                      >
                        <div className="mlib-meal-card-main">
                          <img
                            src={imgSrc}
                            alt={meal.name}
                            className="mlib-meal-card-img"
                            onError={e => {
                              if (!e.currentTarget.dataset.fallbackApplied) {
                                e.currentTarget.dataset.fallbackApplied = '1';
                                e.currentTarget.src = '/images/meals/lunch.jpg';
                              }
                            }}
                          />
                          <div className="mlib-meal-card-info">
                            <div className="mlib-meal-card-badges">
                              {mealTypeLabel && (
                                <span className="mlib-meal-type-pill">{mealTypeLabel}</span>
                              )}
                              {meal.useCount > 0 && (
                                <span className="mlib-meal-used-pill">
                                  {t.mlib_used_count.replace('{count}', String(meal.useCount))}
                                </span>
                              )}
                            </div>
                            <h4 className="mlib-meal-card-title">{meal.name}</h4>
                            {ingredientsLine && (
                              <p className="mlib-meal-card-desc">{ingredientsLine}</p>
                            )}
                          </div>
                        </div>

                        <div className="mlib-meal-card-actions">
                          <button
                            type="button"
                            id={`btn-mlib-select-${meal.id}`}
                            className="mlib-btn-primary mlib-btn-primary--sm"
                            onClick={() =>
                              onSelectMeal(meal, {
                                startTime: insertStartTime,
                                endTime: insertEndTime,
                              })
                            }
                          >
                            ✓ {primaryActionLabel}
                          </button>
                          <div className="mlib-meal-card-icon-btns">
                            <button
                              type="button"
                              id={`btn-mlib-edit-${meal.id}`}
                              className="mlib-icon-btn"
                              onClick={() => openEditForm(meal)}
                              aria-label={`${t.commit_edit}: ${meal.name}`}
                              title={t.commit_edit}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              id={`btn-mlib-delete-${meal.id}`}
                              className="mlib-icon-btn mlib-icon-btn--danger"
                              onClick={() => handleDeleteMeal(meal.id)}
                              aria-label={`${t.commit_delete}: ${meal.name}`}
                              title={t.commit_delete}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
