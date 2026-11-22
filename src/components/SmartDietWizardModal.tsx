/**
 * Super Diet-Ability — Phase 3: Smart Structured Diet Wizard Modal
 *
 * 5-Step Guided Experience inside the Main SDA App (`StructuredDietScreen`):
 * 1. Food Preferences (proteins, carbs, veg/fruits, beverages, avoidances, restrictions, custom notes)
 * 2. Daily Routine (wake/sleep, work/study hours, meal count, non-overlapping preferred slots, weekend rhythm)
 * 3. Food Access (cook at home, meal prep, bring to work, cafeteria, restaurant/takeaway, limited cooking)
 * 4. Generate My Structure (curated + Personal Meal Library proposals with realistic photography, backup options & suitability)
 * 5. Review & Save (per-meal Accept / Modify / Reject / Swap / Save to Library + non-destructive Safe Save destination)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n';
import {
  DAY_KEYS,
  calculateEndTimeFromStart,
  dateKeyToDayKey,
  getBlockPhotos,
  getBlockPrimaryDescription,
  getLocalDateKey,
  sanitiseBlock,
  setBlockApprovalStatus,
  swapBlockWithAlternative,
  type DayKey,
  type MealApprovalStatus,
  type MealTypeKey,
} from '../utils/dietStorage';
import {
  FOOD_CATEGORY_KEYS,
  FOOD_CATEGORY_ICONS,
  formatTime,
  getTimeSlotOptions,
  type FoodCategoryKey,
} from '../data/dietData';
import {
  getFoodOptionsForCategory,
  type CustomFoodsMap,
  type FoodSelectionsMap,
} from '../data/foodOptions';
import {
  getFoodPhoto,
  getPhotoDataUrlSync,
  isValidImageFile,
  saveFoodPhoto,
  type FoodPhotoMetadata,
} from '../utils/photoStorage';
import {
  applyLibraryMealToBlock,
  buildAlternativeFromLibraryMeal,
  createLibraryMealFromBlock,
  listReusableUploadedPhotos,
  recordLibraryMealUsed,
  type PersonalMealLibraryItem,
} from '../utils/mealLibraryStorage';
import {
  MEAL_STOCK_PHOTO_URLS,
  resolveBuiltInMealText,
  resolveMealStockPhoto,
  translateBuiltInFoodItem,
} from '../utils/mealStockPhotos';
import {
  WIZARD_ACCESS_OPTIONS,
  applyWizardPlanSafely,
  computeDefaultSlotsForRoutine,
  generatePersonalizedWizardPlan,
  isOvernightWakeSleep,
  loadSmartWizardProfile,
  saveSmartWizardProfile,
  summarizeWizardApprovals,
  validateRoutineSlots,
  type SmartWizardProfile,
  type WizardAccessOption,
  type WizardBeverageChoice,
  type WizardCarbChoice,
  type WizardMealLocation,
  type WizardProposedBlock,
  type WizardProteinChoice,
  type WizardRestrictionChoice,
  type WizardSaveDestination,
  type WizardSafeSaveResult,
  type WizardSchedulePattern,
  type WizardVegFruitMode,
  type WizardWeekendMode,
} from '../utils/smartDietWizardEngine';
import { PersonalMealLibraryModal } from './PersonalMealLibraryModal';
import './SmartDietWizardModal.css';

export interface SmartDietWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanSaved: (result: WizardSafeSaveResult, toastMessage: string) => void;
}

const PROTEIN_OPTIONS: Array<{
  key: WizardProteinChoice;
  labelKey: string;
  thumb: string;
}> = [
  { key: 'chicken', labelKey: 'wiz_prot_chicken', thumb: MEAL_STOCK_PHOTO_URLS.chicken_rice_broccoli },
  { key: 'fish', labelKey: 'wiz_prot_fish', thumb: MEAL_STOCK_PHOTO_URLS.salmon_dinner },
  { key: 'beef', labelKey: 'wiz_prot_beef', thumb: MEAL_STOCK_PHOTO_URLS.beef_sweet_potato },
  { key: 'turkey', labelKey: 'wiz_prot_turkey', thumb: MEAL_STOCK_PHOTO_URLS.quinoa_salad_bowl },
  { key: 'eggs', labelKey: 'wiz_prot_eggs', thumb: MEAL_STOCK_PHOTO_URLS.veggie_omelette },
  { key: 'greek_yogurt', labelKey: 'wiz_prot_yogurt', thumb: MEAL_STOCK_PHOTO_URLS.greek_yogurt_bowl },
  { key: 'plant_based', labelKey: 'wiz_prot_plant', thumb: MEAL_STOCK_PHOTO_URLS.plant_protein_bowl },
];

const CARB_OPTIONS: Array<{
  key: WizardCarbChoice;
  labelKey: string;
  icon: string;
}> = [
  { key: 'rice', labelKey: 'wiz_carb_rice', icon: '🍚' },
  { key: 'potato', labelKey: 'wiz_carb_potato', icon: '🥔' },
  { key: 'quinoa', labelKey: 'wiz_carb_quinoa', icon: '🌾' },
  { key: 'whole_grain', labelKey: 'wiz_carb_whole_grain', icon: '🥖' },
  { key: 'oats', labelKey: 'wiz_carb_oats', icon: '🥣' },
  { key: 'minimal_carbs', labelKey: 'wiz_carb_minimal', icon: '🥬' },
];

const PRODUCE_FAVORITES: Array<{ key: string; labelKey: string }> = [
  { key: 'spinach', labelKey: 'sdb_food_opt_spinach' },
  { key: 'broccoli', labelKey: 'sdb_food_opt_broccoli' },
  { key: 'lettuce_salad_greens', labelKey: 'sdb_food_opt_lettuce_salad_greens' },
  { key: 'avocado', labelKey: 'sdb_food_opt_avocado' },
  { key: 'berries', labelKey: 'sdb_food_opt_berries' },
  { key: 'apple', labelKey: 'sdb_food_opt_apple' },
  { key: 'banana', labelKey: 'sdb_food_opt_banana' },
];

const BEVERAGE_OPTIONS: Array<{
  key: WizardBeverageChoice;
  labelKey: string;
  icon: string;
}> = [
  { key: 'water', labelKey: 'wiz_bev_water', icon: '💧' },
  { key: 'tea', labelKey: 'wiz_bev_tea', icon: '🍵' },
  { key: 'coffee', labelKey: 'wiz_bev_coffee', icon: '☕' },
  { key: 'smoothies', labelKey: 'wiz_bev_smoothies', icon: '🥤' },
  { key: 'avoid_sugary_drinks', labelKey: 'wiz_bev_avoid_sugary', icon: '🚫' },
];

const RESTRICTION_OPTIONS: Array<{
  key: WizardRestrictionChoice;
  labelKey: string;
}> = [
  { key: 'none', labelKey: 'wiz_rest_none' },
  { key: 'dairy_free', labelKey: 'wiz_rest_dairy' },
  { key: 'gluten_free', labelKey: 'wiz_rest_gluten' },
  { key: 'nut_free', labelKey: 'wiz_rest_nuts' },
  { key: 'vegetarian', labelKey: 'wiz_rest_vegetarian' },
  { key: 'pescatarian', labelKey: 'wiz_rest_pescatarian' },
  { key: 'other', labelKey: 'wiz_rest_other' },
];

const ACCESS_CARD_META: Record<
  WizardAccessOption,
  { titleKey: string; descKey: string; suitKey: string; icon: string; thumb: string }
> = {
  cook_at_home: {
    titleKey: 'wiz_acc_cook_home',
    descKey: 'wiz_acc_cook_home_desc',
    suitKey: 'wiz_suit_cook_home',
    icon: '🏠',
    thumb: MEAL_STOCK_PHOTO_URLS.salmon_dinner,
  },
  meal_prep: {
    titleKey: 'wiz_acc_meal_prep',
    descKey: 'wiz_acc_meal_prep_desc',
    suitKey: 'wiz_suit_meal_prep',
    icon: '🥡',
    thumb: MEAL_STOCK_PHOTO_URLS.chicken_rice_broccoli,
  },
  bring_to_work: {
    titleKey: 'wiz_acc_bring_work',
    descKey: 'wiz_acc_bring_work_desc',
    suitKey: 'wiz_suit_bring_work',
    icon: '💼',
    thumb: MEAL_STOCK_PHOTO_URLS.quinoa_salad_bowl,
  },
  workplace_cafeteria: {
    titleKey: 'wiz_acc_cafeteria',
    descKey: 'wiz_acc_cafeteria_desc',
    suitKey: 'wiz_suit_cafeteria',
    icon: '🍽️',
    thumb: MEAL_STOCK_PHOTO_URLS.veggie_omelette,
  },
  restaurant_takeaway: {
    titleKey: 'wiz_acc_restaurant',
    descKey: 'wiz_acc_restaurant_desc',
    suitKey: 'wiz_suit_restaurant',
    icon: '🏪',
    thumb: MEAL_STOCK_PHOTO_URLS.tuna_wrap,
  },
  limited_cooking: {
    titleKey: 'wiz_acc_limited',
    descKey: 'wiz_acc_limited_desc',
    suitKey: 'wiz_suit_limited',
    icon: '⚡',
    thumb: MEAL_STOCK_PHOTO_URLS.protein_smoothie,
  },
};

function getMealTypeIcon(typeStr?: string): string {
  const k = (typeStr || '').toLowerCase();
  if (k === 'breakfast') return '🌅';
  if (k === 'lunch') return '☀️';
  if (k === 'dinner') return '🌙';
  if (k === 'snack') return '🍎';
  if (k === 'kitchen_closed' || k === 'micro_fasting') return '⏳';
  return '🍽️';
}

export const SmartDietWizardModal: React.FC<SmartDietWizardModalProps> = ({
  isOpen,
  onClose,
  onPlanSaved,
}) => {
  const { t, lang } = useTranslation();
  const [profile, setProfile] = useState<SmartWizardProfile>(() => loadSmartWizardProfile());
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [highestVisitedStep, setHighestVisitedStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [variantSeed, setVariantSeed] = useState(0);
  const [proposedWeekdayBlocks, setProposedWeekdayBlocks] = useState<WizardProposedBlock[]>([]);
  const [proposedWeekendBlocks, setProposedWeekendBlocks] = useState<WizardProposedBlock[]>([]);
  const [step4Tab, setStep4Tab] = useState<'daily' | 'weekend' | 'overview'>('daily');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Step 5 Safe Save states
  const [saveDestination, setSaveDestination] = useState<WizardSaveDestination>('new_profile');
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedWeekdays, setSelectedWeekdays] = useState<DayKey[]>([
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);
  const [alsoApplyToToday, setAlsoApplyToToday] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [wizardToast, setWizardToast] = useState('');

  // Inline Meal Editor inside Step 5 ("Modify")
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editMealName, setEditMealName] = useState('');
  const [editOriginalResolvedName, setEditOriginalResolvedName] = useState('');
  const [editStartTime, setEditStartTime] = useState('08:00');
  const [editEndTime, setEditEndTime] = useState('08:30');
  const [editMealType, setEditMealType] = useState<MealTypeKey>('breakfast');
  const [editCategories, setEditCategories] = useState<FoodCategoryKey[]>([]);
  const [editSelections, setEditSelections] = useState<FoodSelectionsMap>({});
  const [editCustomFoods, setEditCustomFoods] = useState<CustomFoodsMap>({});
  const [editCustomFoodInput, setEditCustomFoodInput] = useState('');
  const [editActiveCat, setEditActiveCat] = useState<FoodCategoryKey | null>(null);
  const [editPhotos, setEditPhotos] = useState<FoodPhotoMetadata[]>([]);
  const [showEditReusePhotos, setShowEditReusePhotos] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Personal Meal Library Picker inside Wizard
  const [libraryPickerTarget, setLibraryPickerTarget] = useState<{
    blockId: string;
    mode: 'apply_to_block' | 'add_alternative';
  } | null>(null);

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  // Re-hydrate saved wizard profile on open
  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadSmartWizardProfile();
    setProfile(loaded);
    setStep(1);
    setHighestVisitedStep(1);
    setVariantSeed(0);
    setSaveDestination('new_profile');
    setNewProfileName(t.wiz_dest_profile_name_default);
    setSaveError('');
    setWizardToast('');
    setEditingMealId(null);
  }, [isOpen, t.wiz_dest_profile_name_default]);

  // Persist profile edits automatically
  const updateProfile = (updater: (prev: SmartWizardProfile) => SmartWizardProfile) => {
    setProfile(prev => {
      const next = updater(prev);
      saveSmartWizardProfile(next);
      return next;
    });
  };

  // Load any referenced IndexedDB photos asynchronously
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const allPhotos: FoodPhotoMetadata[] = [];
    for (const b of [...proposedWeekdayBlocks, ...proposedWeekendBlocks]) {
      allPhotos.push(...getBlockPhotos(b));
      for (const alt of b.alternatives || []) {
        allPhotos.push(...getBlockPhotos(alt));
      }
    }
    for (const ep of editPhotos) {
      allPhotos.push(ep);
    }
    for (const rp of listReusableUploadedPhotos()) {
      allPhotos.push(rp);
    }

    for (const p of allPhotos) {
      if (!p?.id || photoUrls[p.id]) continue;
      const sync = getPhotoDataUrlSync(p.id);
      if (sync) {
        setPhotoUrls(prev => ({ ...prev, [p.id]: sync }));
      } else {
        getFoodPhoto(p.id)
          .then(rec => {
            if (active && rec?.dataUrl) {
              setPhotoUrls(prev => ({ ...prev, [p.id]: rec.dataUrl }));
            }
          })
          .catch(() => {});
      }
    }
    return () => {
      active = false;
    };
  }, [isOpen, proposedWeekdayBlocks, proposedWeekendBlocks, editPhotos, photoUrls]);

  const showTransientToast = (msg: string) => {
    setWizardToast(msg);
    setTimeout(() => {
      setWizardToast(cur => (cur === msg ? '' : cur));
    }, 3200);
  };

  const routineValidation = useMemo(
    () => validateRoutineSlots(profile.routine.slots, profile.routine.wakeTime),
    [profile.routine.slots, profile.routine.wakeTime]
  );

  const triggerGeneratePlan = (seed = 0, sourceProfile = profile) => {
    const generated = generatePersonalizedWizardPlan(sourceProfile, { variantSeed: seed });
    setProposedWeekdayBlocks(generated.weekdayBlocks);
    setProposedWeekendBlocks(generated.weekendBlocks);
    setStep4Tab('daily');
  };

  const goToStep = (target: 1 | 2 | 3 | 4 | 5) => {
    if (target >= 4 && proposedWeekdayBlocks.length === 0) {
      triggerGeneratePlan(variantSeed, profile);
    }
    setStep(target);
    setHighestVisitedStep(prev => (target > prev ? target : prev));
    updateProfile(p => ({ ...p, lastStep: target }));
    setSaveError('');
    setTimeout(() => {
      bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 20);
  };

  const handleBack = () => {
    if (editingMealId) {
      setEditingMealId(null);
      return;
    }
    if (step === 1) {
      onClose();
      return;
    }
    goToStep((step - 1) as 1 | 2 | 3 | 4);
  };

  // ── Step 1 Handlers ──
  const toggleProtein = (key: WizardProteinChoice) => {
    updateProfile(prev => {
      const has = prev.preferences.proteins.includes(key);
      const nextList = has
        ? prev.preferences.proteins.filter(x => x !== key)
        : [...prev.preferences.proteins, key];
      return {
        ...prev,
        preferences: { ...prev.preferences, proteins: nextList },
      };
    });
  };

  const toggleCarb = (key: WizardCarbChoice) => {
    updateProfile(prev => {
      const has = prev.preferences.carbs.includes(key);
      const nextList = has
        ? prev.preferences.carbs.filter(x => x !== key)
        : [...prev.preferences.carbs, key];
      return {
        ...prev,
        preferences: { ...prev.preferences, carbs: nextList },
      };
    });
  };

  const toggleProduce = (key: string) => {
    updateProfile(prev => {
      const has = prev.preferences.favoriteProduce.includes(key);
      const nextList = has
        ? prev.preferences.favoriteProduce.filter(x => x !== key)
        : [...prev.preferences.favoriteProduce, key];
      return {
        ...prev,
        preferences: { ...prev.preferences, favoriteProduce: nextList },
      };
    });
  };

  const toggleBeverage = (key: WizardBeverageChoice) => {
    updateProfile(prev => {
      const has = prev.preferences.beverages.includes(key);
      const nextList = has
        ? prev.preferences.beverages.filter(x => x !== key)
        : [...prev.preferences.beverages, key];
      return {
        ...prev,
        preferences: { ...prev.preferences, beverages: nextList },
      };
    });
  };

  const toggleRestriction = (key: WizardRestrictionChoice) => {
    updateProfile(prev => {
      if (key === 'none') {
        return {
          ...prev,
          preferences: { ...prev.preferences, restrictions: ['none'] },
        };
      }
      const withoutNone = prev.preferences.restrictions.filter(r => r !== 'none');
      const has = withoutNone.includes(key);
      const nextList = has ? withoutNone.filter(r => r !== key) : [...withoutNone, key];
      return {
        ...prev,
        preferences: {
          ...prev.preferences,
          restrictions: nextList.length > 0 ? nextList : ['none'],
        },
      };
    });
  };

  // ── Step 2 Handlers ──
  const handleMealCountChange = (count: 2 | 3 | 4 | 5) => {
    updateProfile(prev => ({
      ...prev,
      routine: {
        ...prev.routine,
        mealCount: count,
        slots: computeDefaultSlotsForRoutine(
          prev.routine.wakeTime,
          prev.routine.sleepTime,
          count,
          prev.routine.middayLocation
        ),
      },
    }));
  };

  const handleAutoSpaceSlots = () => {
    updateProfile(prev => ({
      ...prev,
      routine: {
        ...prev.routine,
        slots: computeDefaultSlotsForRoutine(
          prev.routine.wakeTime,
          prev.routine.sleepTime,
          prev.routine.mealCount,
          prev.routine.middayLocation
        ),
      },
    }));
  };

  const handleUpdateSlot = (
    idx: number,
    patch: Partial<SmartWizardProfile['routine']['slots'][number]>
  ) => {
    updateProfile(prev => {
      const nextSlots = prev.routine.slots.map((s, i) => {
        if (i !== idx) return s;
        const updated = { ...s, ...patch };
        if (patch.startTime && !patch.endTime) {
          updated.endTime = calculateEndTimeFromStart(patch.startTime, 30);
        }
        return updated;
      });
      return {
        ...prev,
        routine: { ...prev.routine, slots: nextSlots },
      };
    });
  };

  // ── Step 3 Handlers ──
  const toggleAccessOption = (opt: WizardAccessOption) => {
    updateProfile(prev => {
      const has = prev.foodAccess.includes(opt);
      const nextAccess = has
        ? prev.foodAccess.filter(x => x !== opt)
        : [...prev.foodAccess, opt];
      return {
        ...prev,
        foodAccess: nextAccess.length > 0 ? nextAccess : ['cook_at_home'],
      };
    });
  };

  // ── Step 4 & 5 Proposal Review Handlers ──
  const handleRegenerate = () => {
    const nextSeed = variantSeed + 1;
    setVariantSeed(nextSeed);
    triggerGeneratePlan(nextSeed, profile);
  };

  // Synchronizes Step 5 review edits (Accept / Modify / Reject / Swap / From Library)
  // across both weekday and weekend proposed slots while preserving shifted weekend times.
  const applyReviewUpdate = (
    mapper: (b: WizardProposedBlock, idx: number) => WizardProposedBlock
  ) => {
    setProposedWeekdayBlocks(prevWeekday => {
      const nextWeekday = prevWeekday.map((b, idx) => mapper(b, idx));
      setProposedWeekendBlocks(prevWeekend => {
        if (prevWeekend.length === 0) return prevWeekend;
        return prevWeekend.map((wb, idx) => {
          const updatedWd = nextWeekday[idx];
          const prevWd = prevWeekday[idx];
          if (!updatedWd || !prevWd || updatedWd === prevWd) return wb;
          return {
            ...updatedWd,
            id: wb.id,
            startTime:
              profile.routine.weekendMode === 'later_shifted'
                ? wb.startTime
                : updatedWd.startTime,
            endTime:
              profile.routine.weekendMode === 'later_shifted'
                ? wb.endTime
                : updatedWd.endTime,
          };
        });
      });
      return nextWeekday;
    });
  };

  const handleSetMealApproval = (blockId: string, status: MealApprovalStatus) => {
    applyReviewUpdate(b =>
      b.id === blockId
        ? {
            ...setBlockApprovalStatus(b, status),
            accessSuitability: b.accessSuitability,
            backupAccessSuitability: b.backupAccessSuitability,
          }
        : b
    );
    setSaveError('');
  };

  const handleAcceptAllPending = () => {
    applyReviewUpdate(b =>
      !b.approvalStatus || b.approvalStatus === 'pending'
        ? {
            ...setBlockApprovalStatus(b, 'accepted'),
            accessSuitability: b.accessSuitability,
            backupAccessSuitability: b.backupAccessSuitability,
          }
        : b
    );
  };

  const handleSwapProposedBackup = (blockId: string) => {
    applyReviewUpdate(b => {
      if (b.id !== blockId || !b.alternatives || b.alternatives.length === 0) return b;
      const swapped = swapBlockWithAlternative(b, b.alternatives[0].id, {
        keepPreviousAsAlternative: true,
        nextApprovalStatus: 'modified',
      });
      return {
        ...swapped,
        accessSuitability: b.backupAccessSuitability || b.accessSuitability,
        backupAccessSuitability: b.accessSuitability,
      };
    });
  };

  const handleSaveProposedToLibrary = (block: WizardProposedBlock) => {
    const displayTitle = getBlockPrimaryDescription(block, t as unknown as Record<string, any>);
    createLibraryMealFromBlock(block, {
      name: displayTitle,
      t: t as unknown as Record<string, any>,
    });
    showTransientToast(t.mlib_saved_toast);
  };

  // Inline Meal Modification Modal inside Wizard Step 5
  const openInlineMealEditor = (block: WizardProposedBlock) => {
    const resolvedTitle =
      getBlockPrimaryDescription(block, t as unknown as Record<string, any>) || '';
    setEditingMealId(block.id);
    setEditMealName(resolvedTitle);
    setEditOriginalResolvedName(resolvedTitle.trim());
    setEditStartTime(block.startTime);
    setEditEndTime(block.endTime);
    setEditMealType((block.mealType || 'lunch') as MealTypeKey);
    setEditCategories(block.foodCategories ? [...block.foodCategories] : []);
    setEditSelections(
      block.foodSelections ? JSON.parse(JSON.stringify(block.foodSelections)) : {}
    );
    setEditCustomFoods(
      block.customFoods ? JSON.parse(JSON.stringify(block.customFoods)) : {}
    );
    setEditCustomFoodInput('');
    setEditActiveCat(block.foodCategories?.[0] || 'protein');
    setEditPhotos(getBlockPhotos(block));
    setShowEditReusePhotos(false);
  };

  const handleSaveInlineMealEdit = () => {
    if (!editingMealId) return;
    applyReviewUpdate(b => {
      if (b.id !== editingMealId) return b;
      const trimmedName = editMealName.trim();
      const rawPrevKey = (b.customText || '').trim();
      const isPrevBuiltInKey =
        !b.libraryMealId &&
        (rawPrevKey.startsWith('wiz_') ||
          rawPrevKey.startsWith('sdb_') ||
          rawPrevKey.startsWith('pl_'));
      const nextCustomText =
        isPrevBuiltInKey && trimmedName === editOriginalResolvedName
          ? rawPrevKey
          : trimmedName || b.customText;

      const updatedBase = sanitiseBlock({
        ...b,
        startTime: editStartTime,
        endTime: editEndTime,
        type: editMealType,
        mealType: editMealType,
        customText: nextCustomText,
        foodCategories: [...editCategories],
        foodSelections: Object.keys(editSelections).length > 0 ? editSelections : undefined,
        customFoods: Object.keys(editCustomFoods).length > 0 ? editCustomFoods : undefined,
        foodPhotos: editPhotos.length > 0 ? [...editPhotos] : undefined,
        foodPhoto: editPhotos[0] ? { ...editPhotos[0] } : undefined,
        imageRef: editPhotos[0]
          ? { kind: 'uploaded_photo', photoId: editPhotos[0].id, photoMeta: { ...editPhotos[0] } }
          : b.imageRef,
        approvalStatus: 'modified',
      });
      return {
        ...updatedBase,
        accessSuitability: b.accessSuitability,
        backupAccessSuitability: b.backupAccessSuitability,
      };
    });
    setEditingMealId(null);
  };

  const handleLibraryMealChosen = (meal: PersonalMealLibraryItem) => {
    if (!libraryPickerTarget) return;
    recordLibraryMealUsed(meal.id);

    if (libraryPickerTarget.mode === 'apply_to_block') {
      applyReviewUpdate(b => {
        if (b.id !== libraryPickerTarget.blockId) return b;
        const applied = applyLibraryMealToBlock(meal, {
          id: b.id,
          startTime: b.startTime,
          endTime: b.endTime,
          type: b.type,
          mealType: b.mealType,
          approvalStatus: 'modified',
          alternatives: b.alternatives,
        });
        return {
          ...applied,
          accessSuitability: b.accessSuitability,
          backupAccessSuitability: b.backupAccessSuitability,
        };
      });
      showTransientToast(t.mlib_applied_toast);
    } else {
      applyReviewUpdate(b => {
        if (b.id !== libraryPickerTarget.blockId) return b;
        const alt = buildAlternativeFromLibraryMeal(meal, {
          type: b.type,
          mealType: b.mealType,
        });
        return {
          ...b,
          alternatives: [alt, ...(b.alternatives || [])],
        };
      });
      showTransientToast(t.mlib_alt_added_toast);
    }

    setLibraryPickerTarget(null);
  };

  // ── Step 5 Final Safe Save ──
  const approvalSummary = useMemo(
    () => summarizeWizardApprovals(proposedWeekdayBlocks),
    [proposedWeekdayBlocks]
  );

  const handleConfirmSaveStructure = () => {
    setSaveError('');
    try {
      const result = applyWizardPlanSafely({
        destination: saveDestination,
        weekdayBlocks: proposedWeekdayBlocks,
        weekendBlocks: proposedWeekendBlocks,
        weekendMode: profile.routine.weekendMode,
        profileName: newProfileName,
        profileDescription: t.wiz_subtitle,
        selectedWeekdays,
        alsoApplyToToday,
        todayDateKey: getLocalDateKey(),
      });

      const toast =
        result.destination === 'new_profile'
          ? t.wiz_saved_toast_profile
          : result.destination === 'today_only'
          ? t.wiz_saved_toast_today
          : t.wiz_saved_toast_weekdays;

      onPlanSaved(result, toast);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg === 'WIZARD_ERR_ALL_REJECTED') setSaveError(t.wiz_err_all_rejected);
      else if (msg === 'WIZARD_ERR_NO_WEEKDAYS') setSaveError(t.wiz_err_no_weekdays);
      else if (msg === 'WIZARD_ERR_PROFILE_NAME') setSaveError(t.wiz_err_profile_name);
      else setSaveError(t.wiz_err_all_rejected);
    }
  };

  if (!isOpen) return null;

  const renderProposedMealCard = (block: WizardProposedBlock, isReviewStep: boolean) => {
    const isRejected = block.approvalStatus === 'rejected';
    const isFasting = block.type === 'kitchen_closed' || block.type === 'micro_fasting';
    const mealTypeLabel =
      (t[`sdb_meal_type_${block.mealType}` as keyof typeof t] as string) ||
      (t[`sdb_type_${block.type}` as keyof typeof t] as string) ||
      block.type;
    const timeRange = `${formatTime(block.startTime, lang)}–${formatTime(block.endTime, lang)}`;

    const photos = getBlockPhotos(block);
    const mainPhotoSrc =
      (photos[0] && (photoUrls[photos[0].id] || getPhotoDataUrlSync(photos[0].id))) ||
      resolveMealStockPhoto(block);

    const mainTitle = getBlockPrimaryDescription(block, t as unknown as Record<string, any>);
    const mainIngredients = (() => {
      const rawKey = (block.customText || '').trim();
      if (
        !block.libraryMealId &&
        block.approvalStatus !== 'modified' &&
        (rawKey.startsWith('wiz_meal_') || rawKey.startsWith('sdb_builtin_ex_'))
      ) {
        const descKey = `${rawKey}_desc` as keyof typeof t;
        if (typeof t[descKey] === 'string' && t[descKey]) {
          return t[descKey] as string;
        }
      }
      const parts: string[] = [];
      if (block.foodSelections) {
        for (const [cat, keys] of Object.entries(block.foodSelections)) {
          for (const fk of keys || []) {
            const lbl = translateBuiltInFoodItem(fk, t as unknown as Record<string, any>, cat as FoodCategoryKey);
            if (lbl && !parts.includes(lbl)) parts.push(lbl);
          }
        }
      }
      if (block.customFoods) {
        for (const list of Object.values(block.customFoods)) {
          for (const cf of list || []) {
            if (cf && !parts.includes(cf)) parts.push(cf);
          }
        }
      }
      if (parts.length > 0) return parts.slice(0, 5).join(', ');
      if (Array.isArray(block.items) && block.items.length > 0 && !isFasting) {
        return block.items
          .map(it => translateBuiltInFoodItem(it, t as unknown as Record<string, any>))
          .join(', ');
      }
      return '';
    })();

    const alt = block.alternatives?.[0] || null;
    const altPhotos = getBlockPhotos(alt);
    const altPhotoSrc = alt
      ? (altPhotos[0] && (photoUrls[altPhotos[0].id] || getPhotoDataUrlSync(altPhotos[0].id))) ||
        resolveMealStockPhoto(alt)
      : '';
    const altTitle = alt
      ? resolveBuiltInMealText(alt.name, t as unknown as Record<string, any>, {
          isUserCustomMeal: Boolean(alt.libraryMealId),
        })
      : '';
    const altDesc = alt
      ? resolveBuiltInMealText(alt.customText, t as unknown as Record<string, any>, {
          isUserCustomMeal: Boolean(alt.libraryMealId),
        })
      : '';

    const suitMeta = ACCESS_CARD_META[block.accessSuitability || 'cook_at_home'];
    const suitLabel = (t[suitMeta.suitKey as keyof typeof t] as string) || '';
    const backupSuitMeta = block.backupAccessSuitability
      ? ACCESS_CARD_META[block.backupAccessSuitability]
      : null;
    const backupSuitLabel = backupSuitMeta
      ? (t[backupSuitMeta.suitKey as keyof typeof t] as string) || ''
      : '';

    return (
      <article
        key={block.id}
        id={`wiz-card-${block.id}`}
        className={`wiz-meal-card ${isRejected ? 'wiz-meal-card--rejected' : ''}`}
        data-approval-status={block.approvalStatus || 'pending'}
      >
        {/* Header Bar */}
        <div className="wiz-meal-card-head">
          <div className="wiz-meal-card-head-left">
            <span className="wiz-meal-icon" aria-hidden="true">
              {getMealTypeIcon(block.mealType || block.type)}
            </span>
            <span className="wiz-meal-type-name">{mealTypeLabel}</span>
            {block.approvalStatus === 'accepted' && (
              <span className="wiz-status-badge wiz-status-badge--accepted">
                ✓ {t.sdb_vc_approval_accepted}
              </span>
            )}
            {block.approvalStatus === 'modified' && (
              <span className="wiz-status-badge wiz-status-badge--modified">
                ✎ {t.sdb_vc_approval_modified}
              </span>
            )}
            {isRejected && (
              <span className="wiz-status-badge wiz-status-badge--rejected">
                {t.sdb_vc_approval_rejected}
              </span>
            )}
          </div>
          <span className="wiz-meal-time-pill">{timeRange}</span>
        </div>

        {/* Main Meal Row */}
        <div className="wiz-meal-main-row">
          <img
            src={mainPhotoSrc}
            alt={mainTitle}
            className="wiz-meal-photo"
            onError={e => {
              if (!e.currentTarget.dataset.fb) {
                e.currentTarget.dataset.fb = '1';
                e.currentTarget.src = MEAL_STOCK_PHOTO_URLS.breakfast_bowl;
              }
            }}
          />

          <div className="wiz-meal-copy">
            <div className="wiz-meal-pills-row">
              <span className="wiz-role-pill">
                {isFasting ? t.sdb_vc_structure_window_badge : t.sdb_vc_main_meal_badge}
              </span>
              {!isFasting && suitLabel && (
                <span className="wiz-suitability-pill">
                  <span aria-hidden="true">{suitMeta.icon}</span> {suitLabel}
                </span>
              )}
              {block.libraryMealId && (
                <span className="wiz-lib-pill">★ {t.sdb_vc_saved_library_badge}</span>
              )}
            </div>
            <h4 className="wiz-meal-title">{mainTitle}</h4>
            {mainIngredients && mainIngredients.toLowerCase() !== mainTitle.toLowerCase() && (
              <p className="wiz-meal-ingredients">{mainIngredients}</p>
            )}
          </div>

          {isReviewStep && (
            <div className="wiz-approval-rail" role="group" aria-label={mealTypeLabel}>
              <button
                type="button"
                id={`btn-wiz-approve-accept-${block.id}`}
                className={`wiz-approve-btn wiz-approve-btn--accept ${
                  block.approvalStatus === 'accepted' ? 'is-active' : ''
                }`}
                onClick={() => handleSetMealApproval(block.id, 'accepted')}
                title={t.sdb_vc_btn_accept}
                aria-label={`${t.sdb_vc_btn_accept}: ${mainTitle}`}
              >
                <span>✓</span>
                <span className="wiz-approve-btn-lbl">{t.sdb_vc_btn_accept}</span>
              </button>
              <button
                type="button"
                id={`btn-wiz-approve-modify-${block.id}`}
                className={`wiz-approve-btn wiz-approve-btn--modify ${
                  block.approvalStatus === 'modified' ? 'is-active' : ''
                }`}
                onClick={() => openInlineMealEditor(block)}
                title={t.sdb_vc_btn_modify}
                aria-label={`${t.sdb_vc_btn_modify}: ${mainTitle}`}
              >
                <span>✎</span>
                <span className="wiz-approve-btn-lbl">{t.sdb_vc_btn_modify}</span>
              </button>
              <button
                type="button"
                id={`btn-wiz-approve-reject-${block.id}`}
                className={`wiz-approve-btn wiz-approve-btn--reject ${
                  isRejected ? 'is-active' : ''
                }`}
                onClick={() =>
                  handleSetMealApproval(block.id, isRejected ? 'accepted' : 'rejected')
                }
                title={isRejected ? t.sdb_vc_btn_restore : t.sdb_vc_btn_reject}
                aria-label={`${isRejected ? t.sdb_vc_btn_restore : t.sdb_vc_btn_reject}: ${mainTitle}`}
              >
                <span>✕</span>
                <span className="wiz-approve-btn-lbl">{t.sdb_vc_btn_reject}</span>
              </button>
            </div>
          )}
        </div>

        {/* Calm Non-Punitive Excluded Notice */}
        {isRejected && (
          <div className="wiz-rejected-notice" id={`wiz-rejected-notice-${block.id}`}>
            <span>{t.sdb_vc_rejected_hint}</span>
            <button
              type="button"
              id={`btn-wiz-restore-${block.id}`}
              className="wiz-restore-btn"
              onClick={() => handleSetMealApproval(block.id, 'accepted')}
            >
              ✓ {t.sdb_vc_btn_restore}
            </button>
          </div>
        )}

        {/* Practical Backup Option Row */}
        {alt && !isFasting && (
          <div className="wiz-backup-row">
            <div className="wiz-backup-left">
              <img
                src={altPhotoSrc}
                alt={altTitle}
                className="wiz-backup-photo"
                onError={e => {
                  if (!e.currentTarget.dataset.fb) {
                    e.currentTarget.dataset.fb = '1';
                    e.currentTarget.src = MEAL_STOCK_PHOTO_URLS.chicken_rice_broccoli;
                  }
                }}
              />
              <div className="wiz-backup-copy">
                <div className="wiz-meal-pills-row">
                  <span className="wiz-backup-pill">{t.wiz_backup_badge}</span>
                  {backupSuitLabel && backupSuitMeta && (
                    <span className="wiz-suitability-pill wiz-suitability-pill--subtle">
                      <span aria-hidden="true">{backupSuitMeta.icon}</span> {backupSuitLabel}
                    </span>
                  )}
                </div>
                <strong className="wiz-backup-title">{altTitle}</strong>
                {altDesc && altDesc.toLowerCase() !== altTitle.toLowerCase() && (
                  <span className="wiz-backup-desc">{altDesc}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              id={`btn-wiz-use-backup-${block.id}`}
              className="wiz-use-backup-btn"
              onClick={() => handleSwapProposedBackup(block.id)}
            >
              ⇄ {t.wiz_btn_use_backup}
            </button>
          </div>
        )}

        {/* Review Step Contextual Library & Customize Toolbar */}
        {isReviewStep && !isRejected && !isFasting && (
          <div className="wiz-card-tools">
            <button
              type="button"
              id={`btn-wiz-save-lib-${block.id}`}
              className="wiz-tool-chip"
              onClick={() => handleSaveProposedToLibrary(block)}
            >
              ★ {t.sdb_vc_btn_save_library}
            </button>
            <button
              type="button"
              id={`btn-wiz-from-lib-${block.id}`}
              className="wiz-tool-chip"
              onClick={() =>
                setLibraryPickerTarget({ blockId: block.id, mode: 'apply_to_block' })
              }
            >
              📖 {t.sdb_vc_btn_replace_library}
            </button>
            <button
              type="button"
              id={`btn-wiz-add-alt-lib-${block.id}`}
              className="wiz-tool-chip"
              onClick={() =>
                setLibraryPickerTarget({ blockId: block.id, mode: 'add_alternative' })
              }
            >
              + {t.sdb_vc_btn_add_alt}
            </button>
          </div>
        )}
      </article>
    );
  };

  const stepLabels: Array<{ num: 1 | 2 | 3 | 4 | 5; label: string }> = [
    { num: 1, label: t.wiz_step_1 },
    { num: 2, label: t.wiz_step_2 },
    { num: 3, label: t.wiz_step_3 },
    { num: 4, label: t.wiz_step_4 },
    { num: 5, label: t.wiz_step_5 },
  ];

  const todayDayKey = dateKeyToDayKey(getLocalDateKey());

  const modalNode = (
    <div
      className="wiz-backdrop"
      id="smart-diet-wizard-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wiz-main-heading"
    >
      <div className="wiz-shell">
        {/* ── Top Header & 5-Step Progress Stepper ── */}
        <header className="wiz-topbar">
          <div className="wiz-topbar-row">
            <button
              type="button"
              id="btn-wiz-back"
              className="wiz-icon-nav-btn"
              onClick={handleBack}
              aria-label={t.wiz_btn_back}
              title={t.wiz_btn_back}
            >
              ←
            </button>

            <div className="wiz-brand-center">
              <span className="wiz-infinity-mark" aria-hidden="true">
                ∞
              </span>
              <div className="wiz-brand-titles">
                <h2 className="wiz-main-title" id="wiz-main-heading">
                  {t.wiz_title}
                </h2>
                <p className="wiz-main-sub">{t.wiz_subtitle}</p>
              </div>
            </div>

            <button
              type="button"
              id="btn-wiz-close"
              className="wiz-icon-nav-btn"
              onClick={onClose}
              aria-label={t.wiz_btn_dismiss}
              title={t.wiz_btn_dismiss}
            >
              ✕
            </button>
          </div>

          <nav className="wiz-stepper" aria-label={t.wiz_title}>
            {stepLabels.map(s => {
              const isCurrent = step === s.num;
              const isCompleted = s.num < step || s.num <= highestVisitedStep;
              const canJump = s.num <= highestVisitedStep || (s.num <= 3 && routineValidation.valid);
              return (
                <button
                  key={s.num}
                  type="button"
                  id={`btn-wiz-step-${s.num}`}
                  className={`wiz-step-node ${isCurrent ? 'is-current' : ''} ${
                    s.num < step ? 'is-done' : ''
                  }`}
                  disabled={!canJump && !isCurrent && !isCompleted}
                  onClick={() => goToStep(s.num)}
                >
                  <span className="wiz-step-circle">
                    {s.num < step ? '✓' : s.num}
                  </span>
                  <span className="wiz-step-label">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {wizardToast && (
          <div className="wiz-toast" role="status">
            ✓ {wizardToast}
          </div>
        )}

        {/* ── Wizard Scrollable Step Content ── */}
        <div className="wiz-body" ref={bodyScrollRef}>
          {editingMealId ? (
            /* ── INLINE PROPOSED MEAL EDITOR (Modify Ingredients, Timing, Photo) ── */
            <div className="wiz-step-panel" id="wiz-inline-meal-editor">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge">✎</span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_edit_meal_heading}</h3>
                  <p className="wiz-section-sub">{t.sdb_vc_pending_banner_sub}</p>
                </div>
              </div>

              <div className="wiz-card-group">
                <div className="wiz-field">
                  <label className="wiz-label" htmlFor="input-wiz-edit-meal-name">
                    {t.mlib_field_name}
                  </label>
                  <input
                    id="input-wiz-edit-meal-name"
                    type="text"
                    className="wiz-input"
                    value={editMealName}
                    onChange={e => setEditMealName(e.target.value)}
                    maxLength={90}
                  />
                </div>

                <div className="wiz-time-pair-grid">
                  <div className="wiz-field">
                    <label className="wiz-label" htmlFor="select-wiz-edit-start">
                      {t.sdb_start_time}
                    </label>
                    <select
                      id="select-wiz-edit-start"
                      className="wiz-select"
                      value={editStartTime}
                      onChange={e => {
                        const v = e.target.value;
                        setEditStartTime(v);
                        setEditEndTime(calculateEndTimeFromStart(v, 30));
                      }}
                    >
                      {getTimeSlotOptions(editStartTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="wiz-field">
                    <label className="wiz-label" htmlFor="select-wiz-edit-end">
                      {t.sdb_end_time}
                    </label>
                    <select
                      id="select-wiz-edit-end"
                      className="wiz-select"
                      value={editEndTime}
                      onChange={e => setEditEndTime(e.target.value)}
                    >
                      {getTimeSlotOptions(editEndTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wiz-field">
                  <span className="wiz-label">{t.sdb_food_categories_label}</span>
                  <div className="wiz-chip-wrap">
                    {FOOD_CATEGORY_KEYS.map(cat => {
                      const active = editCategories.includes(cat);
                      const lbl = (t[`sdb_cat_${cat}` as keyof typeof t] as string) || cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`wiz-pill-chip ${active ? 'is-selected' : ''}`}
                          onClick={() => {
                            if (active && editActiveCat === cat) {
                              setEditCategories(prev => prev.filter(c => c !== cat));
                              setEditActiveCat(null);
                            } else if (active) {
                              setEditActiveCat(cat);
                            } else {
                              setEditCategories(prev => [...prev, cat]);
                              setEditActiveCat(cat);
                            }
                          }}
                        >
                          <span>{FOOD_CATEGORY_ICONS[cat]}</span>
                          <span>{lbl}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editActiveCat && (
                  <div className="wiz-subpanel">
                    <span className="wiz-label">
                      {FOOD_CATEGORY_ICONS[editActiveCat]}{' '}
                      {(t[`sdb_cat_${editActiveCat}` as keyof typeof t] as string) || editActiveCat}
                    </span>
                    <div className="wiz-chip-wrap">
                      {getFoodOptionsForCategory(editActiveCat).map(opt => {
                        const sel = (editSelections[editActiveCat] || []).includes(opt.key);
                        const lbl = (t[opt.i18nKey as keyof typeof t] as string) || opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            className={`wiz-pill-chip wiz-pill-chip--sm ${sel ? 'is-selected' : ''}`}
                            onClick={() => {
                              setEditSelections(prev => {
                                const cur = prev[editActiveCat] || [];
                                const nextList = sel
                                  ? cur.filter(k => k !== opt.key)
                                  : [...cur, opt.key];
                                const next = { ...prev, [editActiveCat]: nextList };
                                if (nextList.length === 0) delete next[editActiveCat];
                                return next;
                              });
                            }}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </div>

                    <div className="wiz-inline-add-row">
                      <input
                        type="text"
                        className="wiz-input"
                        value={editCustomFoodInput}
                        onChange={e => setEditCustomFoodInput(e.target.value)}
                        placeholder={t.sdb_custom_food_placeholder}
                        maxLength={50}
                      />
                      <button
                        type="button"
                        className="wiz-secondary-btn"
                        onClick={() => {
                          const v = editCustomFoodInput.trim();
                          if (!v) return;
                          setEditCustomFoods(prev => ({
                            ...prev,
                            [editActiveCat]: [...(prev[editActiveCat] || []), v],
                          }));
                          setEditCustomFoodInput('');
                        }}
                      >
                        + {t.sdb_add_custom_food_btn}
                      </button>
                    </div>
                  </div>
                )}

                {/* Photo upload or zero-duplication reuse */}
                <div className="wiz-field">
                  <span className="wiz-label">📷 {t.sdb_food_photos}</span>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f || !isValidImageFile(f)) return;
                      const meta = await saveFoodPhoto(f);
                      const sync = getPhotoDataUrlSync(meta.id);
                      if (sync) setPhotoUrls(prev => ({ ...prev, [meta.id]: sync }));
                      setEditPhotos([meta]);
                    }}
                  />
                  <div className="wiz-chip-wrap">
                    <button
                      type="button"
                      className="wiz-secondary-btn"
                      onClick={() => editFileInputRef.current?.click()}
                    >
                      🖼️ {t.sdb_choose_gallery}
                    </button>
                    <button
                      type="button"
                      className="wiz-secondary-btn"
                      onClick={() => setShowEditReusePhotos(p => !p)}
                    >
                      ♻️ {t.mlib_btn_reuse_photo}
                    </button>
                    <button
                      type="button"
                      className="wiz-secondary-btn"
                      onClick={() => {
                        const targetId = editingMealId;
                        setEditingMealId(null);
                        setLibraryPickerTarget({ blockId: targetId, mode: 'apply_to_block' });
                      }}
                    >
                      📖 {t.wiz_btn_pick_from_library}
                    </button>
                  </div>

                  {showEditReusePhotos && (
                    <div className="wiz-reuse-grid">
                      {listReusableUploadedPhotos().map(p => {
                        const src = photoUrls[p.id] || getPhotoDataUrlSync(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="wiz-reuse-tile"
                            onClick={() => {
                              setEditPhotos([p]);
                              setShowEditReusePhotos(false);
                            }}
                          >
                            {src ? <img src={src} alt="" /> : <span>📷</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-save-inline-edit"
                  className="wiz-primary-cta"
                  onClick={handleSaveInlineMealEdit}
                >
                  <span className="wiz-cta-check">✓</span>
                  <span>{t.commit_save}</span>
                </button>
                <button
                  type="button"
                  className="wiz-secondary-btn"
                  onClick={() => setEditingMealId(null)}
                >
                  {t.commit_cancel}
                </button>
              </div>
            </div>
          ) : step === 1 ? (
            /* ── STEP 1: FOOD PREFERENCES ── */
            <div className="wiz-step-panel" id="wiz-step-1-preferences">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge" aria-hidden="true">
                  🍴
                </span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_s1_title}</h3>
                  <p className="wiz-section-sub">{t.wiz_s1_sub}</p>
                </div>
              </div>

              {/* Preferred Proteins */}
              <section className="wiz-card-group">
                <div className="wiz-group-head">
                  <span className="wiz-group-title">🥩 {t.wiz_s1_proteins_label}</span>
                  <span className="wiz-group-hint">{t.wiz_s1_select_multi}</span>
                </div>
                <div className="wiz-visual-tile-grid">
                  {PROTEIN_OPTIONS.map(opt => {
                    const selected = profile.preferences.proteins.includes(opt.key);
                    const lbl = t[opt.labelKey as keyof typeof t] as string;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        id={`btn-wiz-prot-${opt.key}`}
                        aria-pressed={selected}
                        className={`wiz-photo-tile ${selected ? 'is-selected' : ''}`}
                        onClick={() => toggleProtein(opt.key)}
                      >
                        <span className="wiz-tile-check" aria-hidden="true">
                          {selected ? '✓' : ''}
                        </span>
                        <img src={opt.thumb} alt={lbl} className="wiz-photo-tile-img" />
                        <span className="wiz-photo-tile-label">{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Preferred Carbs */}
              <section className="wiz-card-group">
                <div className="wiz-group-head">
                  <span className="wiz-group-title">🌾 {t.wiz_s1_carbs_label}</span>
                  <span className="wiz-group-hint">{t.wiz_s1_select_multi}</span>
                </div>
                <div className="wiz-carb-grid">
                  {CARB_OPTIONS.map(opt => {
                    const selected = profile.preferences.carbs.includes(opt.key);
                    const lbl = t[opt.labelKey as keyof typeof t] as string;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        id={`btn-wiz-carb-${opt.key}`}
                        aria-pressed={selected}
                        className={`wiz-icon-tile ${selected ? 'is-selected' : ''}`}
                        onClick={() => toggleCarb(opt.key)}
                      >
                        <span className="wiz-tile-check" aria-hidden="true">
                          {selected ? '✓' : ''}
                        </span>
                        <span className="wiz-icon-tile-emoji" aria-hidden="true">
                          {opt.icon}
                        </span>
                        <span className="wiz-icon-tile-label">{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Vegetables & Fruits */}
              <section className="wiz-card-group">
                <label className="wiz-group-title" htmlFor="select-wiz-veg-mode">
                  🥦 {t.wiz_s1_veg_label}
                </label>
                <select
                  id="select-wiz-veg-mode"
                  className="wiz-select"
                  value={profile.preferences.vegFruitMode}
                  onChange={e =>
                    updateProfile(p => ({
                      ...p,
                      preferences: {
                        ...p.preferences,
                        vegFruitMode: e.target.value as WizardVegFruitMode,
                      },
                    }))
                  }
                >
                  <option value="variety">✓ {t.wiz_veg_variety}</option>
                  <option value="greens_focused">{t.wiz_veg_greens}</option>
                  <option value="simple_favorites">{t.wiz_veg_simple}</option>
                </select>

                <span className="wiz-sublabel">{t.wiz_s1_fav_produce_label}</span>
                <div className="wiz-chip-wrap">
                  {PRODUCE_FAVORITES.map(item => {
                    const sel = profile.preferences.favoriteProduce.includes(item.key);
                    const lbl = t[item.labelKey as keyof typeof t] as string;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        id={`btn-wiz-prod-${item.key}`}
                        aria-pressed={sel}
                        className={`wiz-pill-chip ${sel ? 'is-selected' : ''}`}
                        onClick={() => toggleProduce(item.key)}
                      >
                        {sel && <span aria-hidden="true">✓</span>}
                        <span>{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Beverages */}
              <section className="wiz-card-group">
                <div className="wiz-group-head">
                  <span className="wiz-group-title">☕ {t.wiz_s1_beverages_label}</span>
                  <span className="wiz-group-hint">{t.wiz_s1_select_multi}</span>
                </div>
                <div className="wiz-carb-grid">
                  {BEVERAGE_OPTIONS.map(opt => {
                    const sel = profile.preferences.beverages.includes(opt.key);
                    const lbl = t[opt.labelKey as keyof typeof t] as string;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        id={`btn-wiz-bev-${opt.key}`}
                        aria-pressed={sel}
                        className={`wiz-icon-tile ${sel ? 'is-selected' : ''}`}
                        onClick={() => toggleBeverage(opt.key)}
                      >
                        <span className="wiz-tile-check" aria-hidden="true">
                          {sel ? '✓' : ''}
                        </span>
                        <span className="wiz-icon-tile-emoji" aria-hidden="true">
                          {opt.icon}
                        </span>
                        <span className="wiz-icon-tile-label">{lbl}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Dietary Restrictions & Allergies */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">🚫 {t.wiz_s1_restrictions_label}</span>
                <div className="wiz-chip-wrap">
                  {RESTRICTION_OPTIONS.map(opt => {
                    const sel = profile.preferences.restrictions.includes(opt.key);
                    const lbl = t[opt.labelKey as keyof typeof t] as string;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        id={`btn-wiz-rest-${opt.key}`}
                        aria-pressed={sel}
                        className={`wiz-pill-chip ${sel ? 'is-selected' : ''}`}
                        onClick={() => toggleRestriction(opt.key)}
                      >
                        <span>{sel ? '☑' : '☐'}</span>
                        <span>{lbl}</span>
                      </button>
                    );
                  })}
                </div>

                {profile.preferences.restrictions.includes('other') && (
                  <input
                    id="input-wiz-rest-other"
                    type="text"
                    className="wiz-input"
                    value={profile.preferences.customRestrictionNote}
                    onChange={e =>
                      updateProfile(p => ({
                        ...p,
                        preferences: {
                          ...p.preferences,
                          customRestrictionNote: e.target.value,
                        },
                      }))
                    }
                    placeholder={t.wiz_s1_rest_other_ph}
                    maxLength={100}
                  />
                )}
              </section>

              {/* Optional Foods to Avoid & Custom Preferences */}
              <section className="wiz-card-group">
                <div className="wiz-field">
                  <label className="wiz-label" htmlFor="input-wiz-avoid">
                    {t.wiz_s1_avoid_label}
                  </label>
                  <input
                    id="input-wiz-avoid"
                    type="text"
                    className="wiz-input"
                    value={profile.preferences.foodsToAvoid}
                    onChange={e =>
                      updateProfile(p => ({
                        ...p,
                        preferences: { ...p.preferences, foodsToAvoid: e.target.value },
                      }))
                    }
                    placeholder={t.wiz_s1_avoid_ph}
                    maxLength={120}
                  />
                </div>

                <div className="wiz-field">
                  <label className="wiz-label" htmlFor="input-wiz-custom-prefs">
                    {t.wiz_s1_custom_label}
                  </label>
                  <input
                    id="input-wiz-custom-prefs"
                    type="text"
                    className="wiz-input"
                    value={profile.preferences.customPreferencesNote}
                    onChange={e =>
                      updateProfile(p => ({
                        ...p,
                        preferences: {
                          ...p.preferences,
                          customPreferencesNote: e.target.value,
                        },
                      }))
                    }
                    placeholder={t.wiz_s1_custom_ph}
                    maxLength={140}
                  />
                </div>
              </section>

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-next-to-2"
                  className="wiz-primary-cta"
                  onClick={() => goToStep(2)}
                >
                  <span>{t.wiz_btn_next_routine}</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  type="button"
                  id="btn-wiz-skip-optional"
                  className="wiz-secondary-btn wiz-secondary-btn--full"
                  onClick={() => goToStep(2)}
                >
                  {t.wiz_btn_skip_optional} →
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            /* ── STEP 2: DAILY ROUTINE ── */
            <div className="wiz-step-panel" id="wiz-step-2-routine">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge" aria-hidden="true">
                  📅
                </span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_s2_title}</h3>
                  <p className="wiz-section-sub">{t.wiz_s2_sub}</p>
                </div>
              </div>

              {/* Wake & Sleep */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">🌙 {t.wiz_s2_sleep_wake_label}</span>
                <div className="wiz-time-pair-grid">
                  <div className="wiz-field">
                    <label className="wiz-label" htmlFor="select-wiz-wake-time">
                      {t.wiz_s2_wake_label}
                    </label>
                    <select
                      id="select-wiz-wake-time"
                      className="wiz-select"
                      value={profile.routine.wakeTime}
                      onChange={e => {
                        const nextWake = e.target.value;
                        updateProfile(p => ({
                          ...p,
                          routine: {
                            ...p.routine,
                            wakeTime: nextWake,
                            slots: computeDefaultSlotsForRoutine(
                              nextWake,
                              p.routine.sleepTime,
                              p.routine.mealCount,
                              p.routine.middayLocation
                            ),
                          },
                        }));
                      }}
                    >
                      {getTimeSlotOptions(profile.routine.wakeTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="wiz-field">
                    <label className="wiz-label" htmlFor="select-wiz-sleep-time">
                      {t.wiz_s2_sleep_label}
                    </label>
                    <select
                      id="select-wiz-sleep-time"
                      className="wiz-select"
                      value={profile.routine.sleepTime}
                      onChange={e => {
                        const nextSleep = e.target.value;
                        updateProfile(p => ({
                          ...p,
                          routine: {
                            ...p.routine,
                            sleepTime: nextSleep,
                            slots: computeDefaultSlotsForRoutine(
                              p.routine.wakeTime,
                              nextSleep,
                              p.routine.mealCount,
                              p.routine.middayLocation
                            ),
                          },
                        }));
                      }}
                    >
                      {getTimeSlotOptions(profile.routine.sleepTime, lang).map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isOvernightWakeSleep(profile.routine.wakeTime, profile.routine.sleepTime) && (
                  <p className="wiz-overnight-note" id="wiz-overnight-schedule-note">
                    🌙 {t.wiz_s2_overnight_hint}
                  </p>
                )}
              </section>

              {/* Work or Study Hours */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">💼 {t.wiz_s2_work_label}</span>
                <div className="wiz-choice-stack">
                  {(
                    [
                      { key: 'regular_work', label: t.wiz_s2_sched_regular, icon: '💼' },
                      { key: 'variable_shift', label: t.wiz_s2_sched_varies, icon: '🔄' },
                      { key: 'flexible_home', label: t.wiz_s2_sched_flexible, icon: '🏠' },
                    ] as Array<{ key: WizardSchedulePattern; label: string; icon: string }>
                  ).map(opt => {
                    const active = profile.routine.schedulePattern === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        id={`btn-wiz-sched-${opt.key}`}
                        aria-pressed={active}
                        className={`wiz-radio-row ${active ? 'is-selected' : ''}`}
                        onClick={() =>
                          updateProfile(p => ({
                            ...p,
                            routine: { ...p.routine, schedulePattern: opt.key },
                          }))
                        }
                      >
                        <span>
                          {opt.icon} {opt.label}
                        </span>
                        <span className="wiz-radio-indicator">{active ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>

                {profile.routine.schedulePattern !== 'flexible_home' && (
                  <div className="wiz-time-pair-grid">
                    <div className="wiz-field">
                      <label className="wiz-label" htmlFor="select-wiz-work-start">
                        {t.wiz_s2_work_start}
                      </label>
                      <select
                        id="select-wiz-work-start"
                        className="wiz-select"
                        value={profile.routine.workStart}
                        onChange={e =>
                          updateProfile(p => ({
                            ...p,
                            routine: { ...p.routine, workStart: e.target.value },
                          }))
                        }
                      >
                        {getTimeSlotOptions(profile.routine.workStart, lang).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="wiz-field">
                      <label className="wiz-label" htmlFor="select-wiz-work-end">
                        {t.wiz_s2_work_end}
                      </label>
                      <select
                        id="select-wiz-work-end"
                        className="wiz-select"
                        value={profile.routine.workEnd}
                        onChange={e =>
                          updateProfile(p => ({
                            ...p,
                            routine: { ...p.routine, workEnd: e.target.value },
                          }))
                        }
                      >
                        {getTimeSlotOptions(profile.routine.workEnd, lang).map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Usual Midday Location */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">📍 {t.wiz_s2_location_label}</span>
                <div className="wiz-three-col-grid">
                  {(
                    [
                      { key: 'home', label: t.wiz_loc_home, icon: '🏠' },
                      { key: 'work', label: t.wiz_loc_work, icon: '💼' },
                      { key: 'on_the_go', label: t.wiz_loc_on_the_go, icon: '🚶' },
                    ] as Array<{ key: WizardMealLocation; label: string; icon: string }>
                  ).map(loc => {
                    const active = profile.routine.middayLocation === loc.key;
                    return (
                      <button
                        key={loc.key}
                        type="button"
                        id={`btn-wiz-loc-${loc.key}`}
                        aria-pressed={active}
                        className={`wiz-icon-tile ${active ? 'is-selected' : ''}`}
                        onClick={() =>
                          updateProfile(p => ({
                            ...p,
                            routine: {
                              ...p.routine,
                              middayLocation: loc.key,
                              slots: p.routine.slots.map(s =>
                                s.mealType === 'breakfast' || s.mealType === 'dinner'
                                  ? s
                                  : { ...s, location: loc.key }
                              ),
                            },
                          }))
                        }
                      >
                        <span className="wiz-tile-check">{active ? '✓' : ''}</span>
                        <span className="wiz-icon-tile-emoji">{loc.icon}</span>
                        <span className="wiz-icon-tile-label">{loc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Meal Count & Preferred Meal Windows */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">🍽️ {t.wiz_s2_meal_count_label}</span>
                <div className="wiz-count-grid">
                  {([2, 3, 4, 5] as const).map(cnt => {
                    const active = profile.routine.mealCount === cnt;
                    return (
                      <button
                        key={cnt}
                        type="button"
                        id={`btn-wiz-meal-count-${cnt}`}
                        aria-pressed={active}
                        className={`wiz-pill-chip wiz-pill-chip--center ${
                          active ? 'is-selected' : ''
                        }`}
                        onClick={() => handleMealCountChange(cnt)}
                      >
                        {t.wiz_meals_count_fmt.replace('{count}', String(cnt))}
                      </button>
                    );
                  })}
                </div>

                <div className="wiz-slots-head">
                  <span className="wiz-sublabel">{t.wiz_s2_slots_label}</span>
                  <button
                    type="button"
                    id="btn-wiz-autospace"
                    className="wiz-link-btn"
                    onClick={handleAutoSpaceSlots}
                  >
                    ⚡ {t.wiz_btn_autospace}
                  </button>
                </div>

                <div className="wiz-slots-list">
                  {profile.routine.slots.map((slot, idx) => {
                    const isOverlapping =
                      routineValidation.overlappingIndices?.includes(idx) ||
                      routineValidation.invalidIndex === idx;
                    return (
                      <div
                        key={slot.id}
                        className={`wiz-slot-row ${isOverlapping ? 'has-error' : ''}`}
                      >
                        <select
                          id={`select-wiz-slot-type-${idx}`}
                          className="wiz-select wiz-select--compact"
                          value={slot.mealType}
                          onChange={e =>
                            handleUpdateSlot(idx, { mealType: e.target.value as MealTypeKey })
                          }
                          aria-label={`${t.sdb_block_type} ${idx + 1}`}
                        >
                          {(['breakfast', 'lunch', 'snack', 'dinner'] as MealTypeKey[]).map(mt => (
                            <option key={mt} value={mt}>
                              {getMealTypeIcon(mt)}{' '}
                              {(t[`sdb_meal_type_${mt}` as keyof typeof t] as string) || mt}
                            </option>
                          ))}
                        </select>

                        <div className="wiz-slot-times">
                          <select
                            id={`select-wiz-slot-start-${idx}`}
                            className="wiz-select wiz-select--compact"
                            value={slot.startTime}
                            onChange={e => handleUpdateSlot(idx, { startTime: e.target.value })}
                            aria-label={`${t.sdb_start_time} ${idx + 1}`}
                          >
                            {getTimeSlotOptions(slot.startTime, lang).map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <span className="wiz-slot-arrow">–</span>
                          <select
                            id={`select-wiz-slot-end-${idx}`}
                            className="wiz-select wiz-select--compact"
                            value={slot.endTime}
                            onChange={e => handleUpdateSlot(idx, { endTime: e.target.value })}
                            aria-label={`${t.sdb_end_time} ${idx + 1}`}
                          >
                            {getTimeSlotOptions(slot.endTime, lang).map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!routineValidation.valid && (
                  <div className="wiz-error-banner" id="wiz-routine-overlap-alert" role="alert">
                    ⚠{' '}
                    {routineValidation.invalidIndex !== null
                      ? t.wiz_err_invalid_slot
                      : t.wiz_err_overlap}
                  </div>
                )}
              </section>

              {/* Weekday vs. Weekend & Overnight Fasting */}
              <section className="wiz-card-group">
                <span className="wiz-group-title">🗓️ {t.wiz_s2_weekend_label}</span>
                <div className="wiz-choice-stack">
                  {(
                    [
                      { key: 'same_as_weekdays', label: t.wiz_wknd_same },
                      { key: 'later_shifted', label: t.wiz_wknd_later },
                      { key: 'flexible_unstructured', label: t.wiz_wknd_flexible },
                    ] as Array<{ key: WizardWeekendMode; label: string }>
                  ).map(wk => {
                    const active = profile.routine.weekendMode === wk.key;
                    return (
                      <button
                        key={wk.key}
                        type="button"
                        id={`btn-wiz-wknd-${wk.key}`}
                        aria-pressed={active}
                        className={`wiz-radio-row ${active ? 'is-selected' : ''}`}
                        onClick={() =>
                          updateProfile(p => ({
                            ...p,
                            routine: { ...p.routine, weekendMode: wk.key },
                          }))
                        }
                      >
                        <span>{wk.label}</span>
                        <span className="wiz-radio-indicator">{active ? '✓' : ''}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="wiz-checkbox-row" htmlFor="toggle-wiz-overnight-fasting">
                  <input
                    id="toggle-wiz-overnight-fasting"
                    type="checkbox"
                    checked={profile.routine.includeOvernightFastingWindow}
                    onChange={e =>
                      updateProfile(p => ({
                        ...p,
                        routine: {
                          ...p.routine,
                          includeOvernightFastingWindow: e.target.checked,
                        },
                      }))
                    }
                  />
                  <div>
                    <strong>{t.wiz_s2_fasting_toggle}</strong>
                    <span>{t.wiz_s2_fasting_desc}</span>
                  </div>
                </label>
              </section>

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-next-to-3"
                  className="wiz-primary-cta"
                  disabled={!routineValidation.valid}
                  onClick={() => goToStep(3)}
                >
                  <span>{t.wiz_btn_next_access}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          ) : step === 3 ? (
            /* ── STEP 3: FOOD ACCESS ── */
            <div className="wiz-step-panel" id="wiz-step-3-access">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge" aria-hidden="true">
                  🥗
                </span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_s3_title}</h3>
                  <p className="wiz-section-sub">{t.wiz_s3_sub}</p>
                </div>
              </div>

              <div className="wiz-access-cards-list">
                {WIZARD_ACCESS_OPTIONS.map(accKey => {
                  const meta = ACCESS_CARD_META[accKey];
                  const selected = profile.foodAccess.includes(accKey);
                  const title = t[meta.titleKey as keyof typeof t] as string;
                  const desc = t[meta.descKey as keyof typeof t] as string;
                  return (
                    <button
                      key={accKey}
                      type="button"
                      id={`btn-wiz-access-${accKey}`}
                      aria-pressed={selected}
                      className={`wiz-access-card ${selected ? 'is-selected' : ''}`}
                      onClick={() => toggleAccessOption(accKey)}
                    >
                      <img src={meta.thumb} alt={title} className="wiz-access-card-img" />
                      <div className="wiz-access-card-copy">
                        <strong className="wiz-access-card-title">
                          {meta.icon} {title}
                        </strong>
                        <span className="wiz-access-card-desc">{desc}</span>
                      </div>
                      <span className="wiz-access-check" aria-hidden="true">
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-next-to-4"
                  className="wiz-primary-cta"
                  onClick={() => {
                    triggerGeneratePlan(0, profile);
                    setVariantSeed(0);
                    goToStep(4);
                  }}
                >
                  <span>{t.wiz_btn_next_generate}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          ) : step === 4 ? (
            /* ── STEP 4: GENERATE MY STRUCTURE ── */
            <div className="wiz-step-panel" id="wiz-step-4-generate">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge" aria-hidden="true">
                  ✨
                </span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_s4_title}</h3>
                  <p className="wiz-section-sub">{t.wiz_s4_sub}</p>
                </div>
              </div>

              {/* Readable Summary Card with Full Wrapping & Accessible Expandable Details */}
              <div className="wiz-summary-card" id="wiz-summary-strip">
                <div className="wiz-summary-strip">
                  <div className="wiz-summary-cell">
                    <span className="wiz-summary-eyebrow">🍴 {t.wiz_sum_meals}</span>
                    <strong className="wiz-summary-val">
                      {t.wiz_meals_count_fmt.replace('{count}', String(profile.routine.mealCount))}
                    </strong>
                  </div>
                  <div className="wiz-summary-cell">
                    <span className="wiz-summary-eyebrow">💼 {t.wiz_sum_hours}</span>
                    <strong className="wiz-summary-val">
                      {profile.routine.schedulePattern === 'flexible_home'
                        ? t.wiz_loc_home
                        : `${formatTime(profile.routine.workStart, lang)}–${formatTime(
                            profile.routine.workEnd,
                            lang
                          )}`}
                    </strong>
                  </div>
                  <div className="wiz-summary-cell">
                    <span className="wiz-summary-eyebrow">🏠 {t.wiz_sum_access}</span>
                    <strong className="wiz-summary-val">
                      {profile.foodAccess
                        .map(a => t[ACCESS_CARD_META[a].titleKey as keyof typeof t] as string)
                        .join(' · ')}
                    </strong>
                  </div>
                  <div className="wiz-summary-cell">
                    <span className="wiz-summary-eyebrow">🌿 {t.wiz_sum_prefs}</span>
                    <strong className="wiz-summary-val">
                      {profile.preferences.proteins
                        .map(p => {
                          const found = PROTEIN_OPTIONS.find(o => o.key === p);
                          return found ? (t[found.labelKey as keyof typeof t] as string) : p;
                        })
                        .join(', ') || t.wiz_veg_variety}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-wiz-summary-toggle"
                  className="wiz-summary-expand-btn"
                  aria-expanded={summaryExpanded}
                  aria-controls="wiz-summary-extra-details"
                  onClick={() => setSummaryExpanded(prev => !prev)}
                >
                  <span>{summaryExpanded ? t.wiz_sum_less_btn : t.wiz_sum_more_btn}</span>
                  <span aria-hidden="true">{summaryExpanded ? '▴' : '▾'}</span>
                </button>

                {summaryExpanded && (
                  <div className="wiz-summary-extra" id="wiz-summary-extra-details">
                    <div className="wiz-summary-extra-row">
                      <span>🌾 {t.wiz_s1_carbs_label}:</span>
                      <strong>
                        {profile.preferences.carbs
                          .map(c => {
                            const found = CARB_OPTIONS.find(o => o.key === c);
                            return found ? (t[found.labelKey as keyof typeof t] as string) : c;
                          })
                          .join(', ') || '—'}
                      </strong>
                    </div>
                    <div className="wiz-summary-extra-row">
                      <span>🚫 {t.wiz_ov_restrictions}:</span>
                      <strong>
                        {profile.preferences.restrictions
                          .map(r => {
                            const opt = RESTRICTION_OPTIONS.find(o => o.key === r);
                            return opt ? (t[opt.labelKey as keyof typeof t] as string) : r;
                          })
                          .join(', ')}
                      </strong>
                    </div>
                    <div className="wiz-summary-extra-row">
                      <span>🗓️ {t.wiz_ov_weekend_rhythm}:</span>
                      <strong>
                        {profile.routine.weekendMode === 'later_shifted'
                          ? t.wiz_wknd_later
                          : profile.routine.weekendMode === 'flexible_unstructured'
                          ? t.wiz_wknd_flexible
                          : t.wiz_wknd_same}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Segmented Tabs: My Daily Plan | Weekend Rhythm | Overview */}
              <div className="wiz-segmented-tabs" role="tablist">
                <button
                  type="button"
                  id="btn-wiz-tab-daily"
                  role="tab"
                  aria-selected={step4Tab === 'daily'}
                  className={`wiz-seg-tab ${step4Tab === 'daily' ? 'is-active' : ''}`}
                  onClick={() => setStep4Tab('daily')}
                >
                  {t.wiz_tab_daily_plan}
                </button>
                {profile.routine.weekendMode !== 'same_as_weekdays' && (
                  <button
                    type="button"
                    id="btn-wiz-tab-weekend"
                    role="tab"
                    aria-selected={step4Tab === 'weekend'}
                    className={`wiz-seg-tab ${step4Tab === 'weekend' ? 'is-active' : ''}`}
                    onClick={() => setStep4Tab('weekend')}
                  >
                    {t.wiz_tab_weekend_plan}
                  </button>
                )}
                <button
                  type="button"
                  id="btn-wiz-tab-overview"
                  role="tab"
                  aria-selected={step4Tab === 'overview'}
                  className={`wiz-seg-tab ${step4Tab === 'overview' ? 'is-active' : ''}`}
                  onClick={() => setStep4Tab('overview')}
                >
                  {t.wiz_tab_overview}
                </button>
              </div>

              {step4Tab === 'overview' ? (
                <div className="wiz-card-group" id="wiz-overview-panel">
                  <div className="wiz-overview-row">
                    <span>{t.wiz_ov_wake_sleep}</span>
                    <strong>
                      {formatTime(profile.routine.wakeTime, lang)} –{' '}
                      {formatTime(profile.routine.sleepTime, lang)}
                    </strong>
                  </div>
                  <div className="wiz-overview-row">
                    <span>{t.wiz_ov_work_window}</span>
                    <strong>
                      {profile.routine.schedulePattern === 'flexible_home'
                        ? t.wiz_s2_sched_flexible
                        : `${formatTime(profile.routine.workStart, lang)} – ${formatTime(
                            profile.routine.workEnd,
                            lang
                          )}`}
                    </strong>
                  </div>
                  <div className="wiz-overview-row">
                    <span>{t.wiz_ov_restrictions}</span>
                    <strong>
                      {profile.preferences.restrictions
                        .map(r => {
                          const opt = RESTRICTION_OPTIONS.find(o => o.key === r);
                          return opt ? (t[opt.labelKey as keyof typeof t] as string) : r;
                        })
                        .join(', ')}
                    </strong>
                  </div>
                  <div className="wiz-overview-row">
                    <span>{t.wiz_ov_weekend_rhythm}</span>
                    <strong>
                      {profile.routine.weekendMode === 'later_shifted'
                        ? t.wiz_wknd_later
                        : profile.routine.weekendMode === 'flexible_unstructured'
                        ? t.wiz_wknd_flexible
                        : t.wiz_wknd_same}
                    </strong>
                  </div>
                  <p className="wiz-disclaimer-note">{t.wiz_ov_disclaimer}</p>
                </div>
              ) : step4Tab === 'weekend' &&
                profile.routine.weekendMode === 'flexible_unstructured' ? (
                <div className="wiz-card-group">
                  <strong className="wiz-group-title">🌱 {t.sdb_mode_unstructured}</strong>
                  <p className="wiz-section-sub">{t.sdb_unstructured_guidance_text}</p>
                </div>
              ) : (
                <div className="wiz-proposed-list">
                  {(step4Tab === 'weekend' ? proposedWeekendBlocks : proposedWeekdayBlocks).map(
                    blk => renderProposedMealCard(blk, false)
                  )}
                </div>
              )}

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-next-to-5"
                  className="wiz-primary-cta"
                  onClick={() => goToStep(5)}
                >
                  <span className="wiz-cta-check">✓</span>
                  <span>{t.wiz_btn_next_review}</span>
                </button>

                <div className="wiz-secondary-row">
                  <button
                    type="button"
                    id="btn-wiz-edit-answers"
                    className="wiz-secondary-btn"
                    onClick={() => goToStep(1)}
                  >
                    ✎ {t.wiz_btn_edit_answers}
                  </button>
                  <button
                    type="button"
                    id="btn-wiz-regenerate"
                    className="wiz-secondary-btn"
                    onClick={handleRegenerate}
                  >
                    ↻ {t.wiz_btn_regenerate}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── STEP 5: INDIVIDUAL MEAL REVIEW & SAFE SAVING ── */
            <div className="wiz-step-panel" id="wiz-step-5-review">
              <div className="wiz-section-hero">
                <span className="wiz-section-badge" aria-hidden="true">
                  📋
                </span>
                <div>
                  <h3 className="wiz-section-title">{t.wiz_s5_title}</h3>
                  <p className="wiz-section-sub">{t.wiz_s5_sub}</p>
                </div>
              </div>

              {/* Live Individual Meal Review Summary Bar */}
              <div className="wiz-review-summary-card" id="wiz-review-summary-bar">
                <div className="wiz-review-stats-row">
                  <span className="wiz-stat-pill wiz-stat-pill--accepted">
                    ✓ {t.wiz_stat_accepted}: <strong>{approvalSummary.acceptedCount}</strong>
                  </span>
                  <span className="wiz-stat-pill wiz-stat-pill--modified">
                    ✎ {t.wiz_stat_modified}: <strong>{approvalSummary.modifiedCount}</strong>
                  </span>
                  <span className="wiz-stat-pill wiz-stat-pill--rejected">
                    ✕ {t.wiz_stat_rejected}: <strong>{approvalSummary.rejectedCount}</strong>
                  </span>
                  <span className="wiz-stat-pill wiz-stat-pill--pending">
                    • {t.wiz_stat_pending}: <strong>{approvalSummary.pendingCount}</strong>
                  </span>
                </div>

                {approvalSummary.pendingCount > 0 && (
                  <button
                    type="button"
                    id="btn-wiz-accept-all-pending"
                    className="wiz-approve-all-btn"
                    onClick={handleAcceptAllPending}
                  >
                    ✓ {t.wiz_btn_accept_all_pending} ({approvalSummary.pendingCount})
                  </button>
                )}
              </div>

              {/* Interactive Proposed Meal Cards */}
              <div className="wiz-proposed-list">
                {proposedWeekdayBlocks.map(blk => renderProposedMealCard(blk, true))}
              </div>

              {/* Non-Destructive Safe Saving Destination Card */}
              <section className="wiz-card-group wiz-save-dest-card" id="wiz-safe-save-section">
                <div className="wiz-save-dest-head">
                  <h4 className="wiz-group-title">🛡️ {t.wiz_save_dest_heading}</h4>
                  <p className="wiz-section-sub">{t.wiz_save_dest_sub}</p>
                </div>

                <div className="wiz-choice-stack">
                  {/* Option 1: New Custom Structure Goal Profile (Safe Default) */}
                  <button
                    type="button"
                    id="radio-wiz-dest-new_profile"
                    aria-pressed={saveDestination === 'new_profile'}
                    className={`wiz-dest-option ${
                      saveDestination === 'new_profile' ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSaveDestination('new_profile');
                      setSaveError('');
                    }}
                  >
                    <div className="wiz-dest-option-copy">
                      <strong>{t.wiz_dest_new_profile}</strong>
                      <span>{t.wiz_dest_new_profile_desc}</span>
                    </div>
                    <span className="wiz-radio-indicator">
                      {saveDestination === 'new_profile' ? '✓' : ''}
                    </span>
                  </button>

                  {saveDestination === 'new_profile' && (
                    <div className="wiz-dest-subbox">
                      <label className="wiz-label" htmlFor="input-wiz-profile-name">
                        {t.wiz_dest_profile_name_label}
                      </label>
                      <input
                        id="input-wiz-profile-name"
                        type="text"
                        className="wiz-input"
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        maxLength={60}
                      />
                    </div>
                  )}

                  {/* Option 2: Apply to Today Only */}
                  <button
                    type="button"
                    id="radio-wiz-dest-today_only"
                    aria-pressed={saveDestination === 'today_only'}
                    className={`wiz-dest-option ${
                      saveDestination === 'today_only' ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSaveDestination('today_only');
                      setSaveError('');
                    }}
                  >
                    <div className="wiz-dest-option-copy">
                      <strong>{t.wiz_dest_today_only}</strong>
                      <span>{t.wiz_dest_today_only_desc}</span>
                    </div>
                    <span className="wiz-radio-indicator">
                      {saveDestination === 'today_only' ? '✓' : ''}
                    </span>
                  </button>

                  {/* Option 3: Apply to Selected Weekdays */}
                  <button
                    type="button"
                    id="radio-wiz-dest-selected_weekdays"
                    aria-pressed={saveDestination === 'selected_weekdays'}
                    className={`wiz-dest-option ${
                      saveDestination === 'selected_weekdays' ? 'is-selected' : ''
                    }`}
                    onClick={() => {
                      setSaveDestination('selected_weekdays');
                      setSaveError('');
                    }}
                  >
                    <div className="wiz-dest-option-copy">
                      <strong>{t.wiz_dest_weekdays}</strong>
                      <span>{t.wiz_dest_weekdays_desc}</span>
                    </div>
                    <span className="wiz-radio-indicator">
                      {saveDestination === 'selected_weekdays' ? '✓' : ''}
                    </span>
                  </button>

                  {saveDestination === 'selected_weekdays' && (
                    <div className="wiz-dest-subbox">
                      <div className="wiz-weekday-chips">
                        {DAY_KEYS.map(dk => {
                          const sel = selectedWeekdays.includes(dk);
                          const dayLabel =
                            (t[`sdb_day_short_${dk}` as keyof typeof t] as string) ||
                            (t[`sdb_day_${dk}` as keyof typeof t] as string) ||
                            dk.toUpperCase();
                          return (
                            <button
                              key={dk}
                              type="button"
                              id={`btn-wiz-day-${dk}`}
                              aria-pressed={sel}
                              className={`wiz-pill-chip wiz-pill-chip--sm ${
                                sel ? 'is-selected' : ''
                              }`}
                              onClick={() =>
                                setSelectedWeekdays(prev =>
                                  sel ? prev.filter(x => x !== dk) : [...prev, dk]
                                )
                              }
                            >
                              {dayLabel}
                            </button>
                          );
                        })}
                      </div>

                      {selectedWeekdays.includes(todayDayKey) && (
                        <label className="wiz-checkbox-row" htmlFor="toggle-wiz-also-today">
                          <input
                            id="toggle-wiz-also-today"
                            type="checkbox"
                            checked={alsoApplyToToday}
                            onChange={e => setAlsoApplyToToday(e.target.checked)}
                          />
                          <div>
                            <strong>{t.wiz_dest_also_today}</strong>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {saveError && (
                  <div className="wiz-error-banner" id="wiz-save-error-banner" role="alert">
                    ⚠ {saveError}
                  </div>
                )}
              </section>

              <div className="wiz-footer-actions">
                <button
                  type="button"
                  id="btn-wiz-confirm-save"
                  className="wiz-primary-cta"
                  onClick={handleConfirmSaveStructure}
                >
                  <span className="wiz-cta-check">✓</span>
                  <span>{t.wiz_btn_confirm_save}</span>
                </button>

                <div className="wiz-secondary-row">
                  <button
                    type="button"
                    id="btn-wiz-step5-regenerate"
                    className="wiz-secondary-btn"
                    onClick={handleRegenerate}
                  >
                    ↻ {t.wiz_btn_regenerate}
                  </button>
                  <button
                    type="button"
                    id="btn-wiz-dismiss"
                    className="wiz-secondary-btn"
                    onClick={onClose}
                  >
                    ✕ {t.wiz_btn_dismiss}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Personal Meal Library Picker when Replacing or Adding an Alternative inside Wizard */}
      {libraryPickerTarget && (
        <PersonalMealLibraryModal
          isOpen={true}
          mode={libraryPickerTarget.mode}
          targetBlock={
            proposedWeekdayBlocks.find(b => b.id === libraryPickerTarget.blockId) || null
          }
          onClose={() => setLibraryPickerTarget(null)}
          onSelectMeal={meal => handleLibraryMealChosen(meal)}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};

export default SmartDietWizardModal;
