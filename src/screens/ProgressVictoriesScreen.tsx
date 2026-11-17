/**
 * Super Diet-Ability — Premium My Progress & Victories (Phase 5.1 Redesign)
 *
 * Design System: Midnight Intelligence × Premium Wellness
 * - Obsidian #071512 · Deep Emerald #102620 · Elevated #12342C · Mint Accent #2DD4B3
 * - Plus Jakarta Sans typography, 2×2 mobile / 4-column desktop navigation grid
 *
 * Preserves 100% of existing functionality, storage keys, IndexedDB photo architecture,
 * unit conversions, validation rules, and behavioral/challenge calculation formulas:
 * 1. Behavioral Consistency Engine (Days Checked In, Resume Rate, Today's Score, Movement Today)
 * 2. Non-Scale Victories (NSVs) & Weekly Reflections (create, edit, delete)
 * 3. Waist Circumference (cm/in toggle, delta, create, edit, delete) & Local-First Progress Photos
 *    with compact expandable privacy disclosure + lightbox preview
 * 4. Optional Metrics: Weight (kg/lbs) & Glucose/CGM observations with educational disclaimers
 * 5. Consolidated expandable Gentle Tracking Rhythm Guide
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';
import GlobalScoreBadge from '../components/GlobalScoreBadge';
import {
  loadProgressVictoriesStore,
  addVictory,
  updateVictory,
  deleteVictory,
  addWaistRecord,
  updateWaistRecord,
  deleteWaistRecord,
  addProgressPhoto,
  deleteProgressPhoto,
  addWeightRecord,
  updateWeightRecord,
  deleteWeightRecord,
  addGlucoseRecord,
  updateGlucoseRecord,
  deleteGlucoseRecord,
  saveWeeklyReflection,
  deleteWeeklyReflection,
  setPreferredUnits,
  cmToInches,
  kgToLbs,
  validateWaist,
  validateWeight,
  validateGlucose,
  PROGRESS_VICTORIES_UPDATED_EVENT,
  type VictoryCategory,
  type VictoryRecord,
  type WaistRecord,
  type ProgressPhotoRecord,
  type WeightRecord,
  type GlucoseRecord,
  type WeeklyReflectionRecord,
} from '../utils/progressVictoriesStorage';
import {
  saveFoodPhoto,
  deleteFoodPhoto,
  getPhotoDataUrlSync,
  getFoodPhoto,
  isValidImageFile,
} from '../utils/photoStorage';
import { readActiveChallenge } from '../components/premium/readActiveChallenge';
import {
  calculateChallengePracticeStats,
  CHALLENGE_UPDATED_EVENT,
  NINETY_DAY_JOURNEY_UPDATED_EVENT,
} from '../challenges';
import { getTodayScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { getDailyActivitySummary, ACTIVITIES_UPDATED_EVENT } from '../activities';
import { getLocalDateKey } from '../utils/dietStorage';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import {
  ACHIEVEMENT_REWARDS_UPDATED_EVENT,
  getVerifiedAchievements,
} from '../utils/achievementRewardsStorage';
import { AchievementHistorySection } from '../components/rewards';
import './ProgressVictoriesScreen.css';

interface ProgressVictoriesScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

type TabType = 'overview' | 'victories' | 'body' | 'observations';

type ModalType =
  | null
  | 'victory'
  | 'waist'
  | 'photo'
  | 'weight'
  | 'glucose'
  | 'reflection';

interface PendingDelete {
  kind: 'victory' | 'reflection' | 'waist' | 'photo' | 'weight' | 'glucose';
  id: string;
  photoId?: string;
}

function stripLeadingPlus(label: string): string {
  return (label || '').replace(/^\+\s*/, '').trim();
}

export function ProgressVictoriesScreen({ onNavigate, onBack }: ProgressVictoriesScreenProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const initial = sessionStorage.getItem('pv_initial_tab');
      if (initial) {
        sessionStorage.removeItem('pv_initial_tab');
        if (initial === 'overview' || initial === 'victories' || initial === 'body' || initial === 'observations') {
          return initial;
        }
      }
    } catch {
      // ignore storage errors
    }
    return 'overview';
  });
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [previewPhotoItem, setPreviewPhotoItem] = useState<ProgressPhotoRecord | null>(null);

  // Collapsible disclosures (compact by default)
  const [isRhythmOpen, setIsRhythmOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // Store data states
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [victories, setVictories] = useState<VictoryRecord[]>([]);
  const [waistRecords, setWaistRecords] = useState<WaistRecord[]>([]);
  const [photos, setPhotos] = useState<ProgressPhotoRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [glucoseRecords, setGlucoseRecords] = useState<GlucoseRecord[]>([]);
  const [reflections, setReflections] = useState<WeeklyReflectionRecord[]>([]);
  const [waistUnit, setWaistUnit] = useState<'cm' | 'in'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Photo URLs cache map & hydration status
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loadingPhotoIds, setLoadingPhotoIds] = useState<Record<string, boolean>>({});

  // Behavioral Stats Snapshot (real active challenge duration, missing vs 0 distinguished)
  const [daysChecked, setDaysChecked] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [resumeRate, setResumeRate] = useState<number | null>(null);
  const [eligibleSlips, setEligibleSlips] = useState<number>(0);
  const [resumedSlips, setResumedSlips] = useState<number>(0);
  const [todayScore, setTodayScore] = useState<number>(0);
  const [movementMinutes, setMovementMinutes] = useState<number>(0);
  const [verifiedAchCount, setVerifiedAchCount] = useState<number>(0);

  // Refresh all data from authoritative local stores
  const refreshAll = useCallback(() => {
    const store = loadProgressVictoriesStore();
    setVictories([...store.victories].sort((a, b) => b.createdAt - a.createdAt));
    setWaistRecords([...store.waistRecords].sort((a, b) => b.createdAt - a.createdAt));
    setPhotos([...store.photos].sort((a, b) => b.createdAt - a.createdAt));
    setWeightRecords([...store.weightRecords].sort((a, b) => b.createdAt - a.createdAt));
    setGlucoseRecords([...store.glucoseRecords].sort((a, b) => b.createdAt - a.createdAt));
    setReflections([...store.weeklyReflections].sort((a, b) => b.createdAt - a.createdAt));
    setWaistUnit(store.preferredUnits.waist || 'cm');
    setWeightUnit(store.preferredUnits.weight || 'kg');

    // Hydrate IndexedDB photos locally
    store.photos.forEach((p) => {
      const syncUrl = getPhotoDataUrlSync(p.photoId);
      if (syncUrl) {
        setPhotoUrls((prev) => ({ ...prev, [p.photoId]: syncUrl }));
      } else {
        setLoadingPhotoIds((prev) => ({ ...prev, [p.photoId]: true }));
        getFoodPhoto(p.photoId)
          .then((res) => {
            if (res?.dataUrl) {
              setPhotoUrls((prev) => ({ ...prev, [p.photoId]: res.dataUrl }));
            }
          })
          .catch(() => {
            // ignore corrupted photo entry safely
          })
          .finally(() => {
            setLoadingPhotoIds((prev) => {
              const next = { ...prev };
              delete next[p.photoId];
              return next;
            });
          });
      }
    });

    // Behavioral metrics from active challenge (exact formula preserved)
    try {
      const ch = readActiveChallenge();
      if (ch) {
        setDaysChecked(calculateChallengePracticeStats(ch).daysCheckedIn);
        setDurationDays(ch.durationDays);
        setResumeRate(ch.relevantEventCounts?.resumeRate ?? null);
        setEligibleSlips(ch.relevantEventCounts?.eligibleSlips ?? 0);
        setResumedSlips(ch.relevantEventCounts?.resumedSlips ?? 0);
      } else {
        setDaysChecked(null);
        setDurationDays(null);
        setResumeRate(null);
        setEligibleSlips(0);
        setResumedSlips(0);
      }
    } catch {
      setDaysChecked(null);
      setDurationDays(null);
      setResumeRate(null);
      setEligibleSlips(0);
      setResumedSlips(0);
    }

    try {
      setTodayScore(getTodayScore());
    } catch {
      setTodayScore(0);
    }

    try {
      const dailySummary = getDailyActivitySummary(getLocalDateKey());
      setMovementMinutes(dailySummary.totalDurationMinutes);
    } catch {
      setMovementMinutes(0);
    }

    try {
      setVerifiedAchCount(getVerifiedAchievements().length);
    } catch {
      setVerifiedAchCount(0);
    }

    setIsStoreLoaded(true);
  }, []);

  useEffect(() => {
    refreshAll();
    const events = [
      PROGRESS_VICTORIES_UPDATED_EVENT,
      CHALLENGE_UPDATED_EVENT,
      NINETY_DAY_JOURNEY_UPDATED_EVENT,
      ACHIEVEMENT_REWARDS_UPDATED_EVENT,
      SCORE_UPDATED_EVENT,
      ACTIVITIES_UPDATED_EVENT,
      STATS_RESET_EVENT,
    ];
    events.forEach((e) => window.addEventListener(e, refreshAll));
    return () => events.forEach((e) => window.removeEventListener(e, refreshAll));
  }, [refreshAll]);

  // Unit toggles
  const handleToggleWaistUnit = (unit: 'cm' | 'in') => {
    setWaistUnit(unit);
    setPreferredUnits({ waist: unit });
  };

  const handleToggleWeightUnit = (unit: 'kg' | 'lbs') => {
    setWeightUnit(unit);
    setPreferredUnits({ weight: unit });
  };

  // ── Form States for Modals ──
  const [vTitle, setVTitle] = useState('');
  const [vCategory, setVCategory] = useState<VictoryCategory>('clothing_fit');
  const [vDesc, setVDesc] = useState('');
  const [vDate, setVDate] = useState(() => getLocalDateKey());
  const [vError, setVError] = useState('');

  const [waistVal, setWaistVal] = useState('');
  const [waistDate, setWaistDate] = useState(() => getLocalDateKey());
  const [waistNotes, setWaistNotes] = useState('');
  const [waistError, setWaistError] = useState('');

  const [photoTag, setPhotoTag] = useState<'day_1' | 'day_30' | 'day_60' | 'day_90' | 'other'>('day_1');
  const [photoDate, setPhotoDate] = useState(() => getLocalDateKey());
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wtVal, setWtVal] = useState('');
  const [wtDate, setWtDate] = useState(() => getLocalDateKey());
  const [wtNotes, setWtNotes] = useState('');
  const [wtError, setWtError] = useState('');

  const [glcVal, setGlcVal] = useState('');
  const [glcType, setGlcType] = useState<GlucoseRecord['readingType']>('fasting');
  const [glcDate, setGlcDate] = useState(() => getLocalDateKey());
  const [glcNotes, setGlcNotes] = useState('');
  const [glcError, setGlcError] = useState('');

  const [refText, setRefText] = useState('');
  const [refVictory, setRefVictory] = useState('');
  const [refFocus, setRefFocus] = useState('');
  const [refDate, setRefDate] = useState(() => getLocalDateKey());
  const [refError, setRefError] = useState('');

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setEditingRecordId(null);
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoFile(null);
    setIsSavingPhoto(false);
  }, [photoPreview]);

  // Escape key closes any open modal
  useEffect(() => {
    if (!activeModal && !pendingDelete && !previewPhotoItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewPhotoItem) setPreviewPhotoItem(null);
        else if (pendingDelete) setPendingDelete(null);
        else closeModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, pendingDelete, previewPhotoItem, closeModal]);

  // Open Modal (Create)
  const openModal = (type: ModalType) => {
    setEditingRecordId(null);
    setActiveModal(type);
    setVError('');
    setWaistError('');
    setPhotoError('');
    setWtError('');
    setGlcError('');
    setRefError('');

    const today = getLocalDateKey();
    setVDate(today);
    setWaistDate(today);
    setPhotoDate(today);
    setWtDate(today);
    setGlcDate(today);
    setRefDate(today);

    setVTitle('');
    setVCategory('clothing_fit');
    setVDesc('');
    setWaistVal('');
    setWaistNotes('');
    setPhotoTag('day_1');
    setPhotoNotes('');
    setWtVal('');
    setWtNotes('');
    setGlcVal('');
    setGlcType('fasting');
    setGlcNotes('');
    setRefText('');
    setRefVictory('');
    setRefFocus('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Open Modal (Edit existing records)
  const handleOpenEditVictory = (v: VictoryRecord) => {
    setEditingRecordId(v.id);
    setVTitle(v.title);
    setVCategory(v.category);
    setVDate(v.dateKey);
    setVDesc(v.description || '');
    setVError('');
    setActiveModal('victory');
  };

  const handleOpenEditReflection = (r: WeeklyReflectionRecord) => {
    setEditingRecordId(r.id);
    setRefVictory(r.biggestVictory || '');
    setRefText(r.reflectionText || '');
    setRefFocus(r.nextWeekFocus || '');
    setRefDate(r.weekStartDateKey);
    setRefError('');
    setActiveModal('reflection');
  };

  const handleOpenEditWaist = (w: WaistRecord) => {
    setEditingRecordId(w.id);
    const displayVal = waistUnit === 'in' ? cmToInches(w.valueCm) : w.valueCm;
    setWaistVal(String(displayVal));
    setWaistDate(w.dateKey);
    setWaistNotes(w.notes || '');
    setWaistError('');
    setActiveModal('waist');
  };

  const handleOpenEditWeight = (w: WeightRecord) => {
    setEditingRecordId(w.id);
    const displayVal = weightUnit === 'lbs' ? kgToLbs(w.valueKg) : w.valueKg;
    setWtVal(String(displayVal));
    setWtDate(w.dateKey);
    setWtNotes(w.notes || '');
    setWtError('');
    setActiveModal('weight');
  };

  const handleOpenEditGlucose = (g: GlucoseRecord) => {
    setEditingRecordId(g.id);
    setGlcVal(String(g.valueMgDl));
    setGlcType(g.readingType);
    setGlcDate(g.dateKey);
    setGlcNotes(g.notes || '');
    setGlcError('');
    setActiveModal('glucose');
  };

  // Submit Victory (Add or Update)
  const handleSubmitVictory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vTitle.trim()) {
      setVError(t.pv_err_required_title);
      return;
    }
    const res = editingRecordId
      ? updateVictory(editingRecordId, {
          dateKey: vDate,
          category: vCategory,
          title: vTitle.trim(),
          description: vDesc.trim() || undefined,
        })
      : addVictory({
          dateKey: vDate,
          category: vCategory,
          title: vTitle.trim(),
          description: vDesc.trim() || undefined,
        });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setVError(t.pv_err_required_title);
    }
  };

  // Submit Waist (Add or Update)
  const handleSubmitWaist = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(waistVal);
    const check = validateWaist(num, waistUnit);
    if (!check.valid) {
      const range = waistUnit === 'in' ? '14–98 in' : '35–250 cm';
      setWaistError(t.pv_err_invalid_waist.replace('{range}', range));
      return;
    }
    const res = editingRecordId
      ? updateWaistRecord(editingRecordId, {
          dateKey: waistDate,
          value: num,
          unit: waistUnit,
          notes: waistNotes.trim(),
        })
      : addWaistRecord({
          dateKey: waistDate,
          value: num,
          unit: waistUnit,
          notes: waistNotes.trim() || undefined,
        });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      const range = waistUnit === 'in' ? '14–98 in' : '35–250 cm';
      setWaistError(t.pv_err_invalid_waist.replace('{range}', range));
    }
  };

  // Photo file selection (100% local IndexedDB)
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      setPhotoError(t.pv_err_invalid_image);
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
    try {
      const objUrl = URL.createObjectURL(file);
      setPhotoPreview(objUrl);
    } catch {
      // ignore preview fallback
    }
  };

  // Submit Photo
  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setPhotoError(t.pv_err_select_photo);
      return;
    }
    setIsSavingPhoto(true);
    try {
      const meta = await saveFoodPhoto(photoFile);
      const res = addProgressPhoto({
        photoId: meta.id,
        dateKey: photoDate,
        milestoneTag: photoTag,
        notes: photoNotes.trim() || undefined,
      });
      if (res) {
        refreshAll();
        closeModal();
      } else {
        setPhotoError(t.pv_err_select_photo);
        setIsSavingPhoto(false);
      }
    } catch {
      setPhotoError(t.pv_err_invalid_image);
      setIsSavingPhoto(false);
    }
  };

  // Submit Weight (Add or Update)
  const handleSubmitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(wtVal);
    const check = validateWeight(num, weightUnit);
    if (!check.valid) {
      const range = weightUnit === 'lbs' ? '55–770 lbs' : '25–350 kg';
      setWtError(t.pv_err_invalid_weight.replace('{range}', range));
      return;
    }
    const res = editingRecordId
      ? updateWeightRecord(editingRecordId, {
          dateKey: wtDate,
          value: num,
          unit: weightUnit,
          notes: wtNotes.trim(),
        })
      : addWeightRecord({
          dateKey: wtDate,
          value: num,
          unit: weightUnit,
          notes: wtNotes.trim() || undefined,
        });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      const range = weightUnit === 'lbs' ? '55–770 lbs' : '25–350 kg';
      setWtError(t.pv_err_invalid_weight.replace('{range}', range));
    }
  };

  // Submit Glucose (Add or Update)
  const handleSubmitGlucose = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(glcVal);
    const check = validateGlucose(num);
    if (!check.valid) {
      setGlcError(t.pv_err_invalid_glucose);
      return;
    }
    const res = editingRecordId
      ? updateGlucoseRecord(editingRecordId, {
          dateKey: glcDate,
          readingType: glcType,
          valueMgDl: num,
          notes: glcNotes.trim(),
        })
      : addGlucoseRecord({
          dateKey: glcDate,
          readingType: glcType,
          valueMgDl: num,
          notes: glcNotes.trim() || undefined,
        });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setGlcError(t.pv_err_invalid_glucose);
    }
  };

  // Submit Reflection (Add or Update)
  const handleSubmitReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refText.trim() && !refVictory.trim()) {
      setRefError(t.pv_err_required_reflection);
      return;
    }
    const res = saveWeeklyReflection({
      id: editingRecordId || undefined,
      weekStartDateKey: refDate,
      reflectionText: refText.trim(),
      biggestVictory: refVictory.trim(),
      nextWeekFocus: refFocus.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setRefError(t.pv_err_required_reflection);
    }
  };

  // Execute confirmed deletion
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id, photoId } = pendingDelete;
    setPendingDelete(null);

    if (kind === 'victory') {
      deleteVictory(id);
    } else if (kind === 'reflection') {
      deleteWeeklyReflection(id);
    } else if (kind === 'waist') {
      deleteWaistRecord(id);
    } else if (kind === 'photo') {
      deleteProgressPhoto(id);
      if (photoId) {
        await deleteFoodPhoto(photoId);
      }
    } else if (kind === 'weight') {
      deleteWeightRecord(id);
    } else if (kind === 'glucose') {
      deleteGlucoseRecord(id);
    }
    refreshAll();
  };

  // Localized helpers
  const getCategoryLabel = (cat: VictoryCategory): string => {
    switch (cat) {
      case 'clothing_fit':
        return t.pv_cat_clothing_fit;
      case 'energy':
        return t.pv_cat_energy;
      case 'sleep':
        return t.pv_cat_sleep;
      case 'appetite':
        return t.pv_cat_appetite;
      case 'fitness':
        return t.pv_cat_fitness;
      case 'mindset':
        return t.pv_cat_mindset;
      case 'other':
      default:
        return t.pv_cat_other;
    }
  };

  const getGlucoseTypeLabel = (type: GlucoseRecord['readingType']): string => {
    switch (type) {
      case 'fasting':
        return t.pv_glc_type_fasting;
      case 'cgm_avg':
        return t.pv_glc_type_cgm_avg;
      case 'post_meal':
        return t.pv_glc_type_post_meal;
      case 'custom':
      default:
        return t.pv_glc_type_custom;
    }
  };

  const getMilestoneTagLabel = (tag?: string): string => {
    switch (tag) {
      case 'day_1':
        return t.pv_photo_tag_day_1;
      case 'day_30':
        return t.pv_photo_tag_day_30;
      case 'day_60':
        return t.pv_photo_tag_day_60;
      case 'day_90':
        return t.pv_photo_tag_day_90;
      default:
        return t.pv_photo_tag_other;
    }
  };

  // Latest physical values & delta
  const latestWaist = waistRecords[0] ?? null;
  const prevWaist = waistRecords[1] ?? null;
  const waistDelta = useMemo(() => {
    if (!latestWaist || !prevWaist) return null;
    const diffCm = latestWaist.valueCm - prevWaist.valueCm;
    return waistUnit === 'in' ? cmToInches(diffCm) : Math.round(diffCm * 10) / 10;
  }, [latestWaist, prevWaist, waistUnit]);

  const latestWeight = weightRecords[0] ?? null;

  const navItems: {
    id: string;
    tab: TabType;
    icon: AppIconName;
    label: string;
    count?: number;
  }[] = [
    {
      id: 'tab-pv-overview',
      tab: 'overview',
      icon: 'bar-chart',
      label: t.pv_tab_overview,
    },
    {
      id: 'tab-pv-victories',
      tab: 'victories',
      icon: 'award',
      label: t.pv_tab_victories,
      count: victories.length + reflections.length + verifiedAchCount,
    },
    {
      id: 'tab-pv-body',
      tab: 'body',
      icon: 'camera',
      label: t.pv_tab_body,
      count: waistRecords.length + photos.length,
    },
    {
      id: 'tab-pv-observations',
      tab: 'observations',
      icon: 'activity',
      label: t.pv_tab_observations,
      count: weightRecords.length + glucoseRecords.length,
    },
  ];

  // Overview snapshot summaries
  const victoriesSnapshotText = t.pv_overview_victories_summary
    .replace('{victories}', String(victories.length))
    .replace('{reflections}', String(reflections.length));

  const bodySnapshotText =
    latestWaist || photos.length > 0
      ? t.pv_overview_body_summary
          .replace(
            '{waist}',
            latestWaist
              ? `${waistUnit === 'in' ? cmToInches(latestWaist.valueCm) : latestWaist.valueCm} ${waistUnit}`
              : '—'
          )
          .replace('{photos}', String(photos.length))
      : t.pv_overview_body_summary_empty;

  const optionalSnapshotText = t.pv_overview_optional_summary
    .replace('{weight}', String(weightRecords.length))
    .replace('{glucose}', String(glucoseRecords.length));

  return (
    <div className="pv-screen" id="progress-victories-screen">
      {/* ── Sticky Two-Tier Utility Topbar (Back + Score Badge) ── */}
      <div className="pv-topbar">
        <div className="pv-topbar-inner">
          <button
            type="button"
            id="btn-progress-back"
            className="pv-back-pill"
            onClick={() => (onBack ? onBack() : onNavigate('home'))}
          >
            <AppIcon name="arrow-left" size={16} />
            <span>{t.common_back || 'Back'}</span>
          </button>
          <div className="pv-topbar-score">
            <GlobalScoreBadge mode="header" onNavigate={onNavigate} />
          </div>
        </div>
      </div>

      {/* ── Inner Responsive Shell ── */}
      <div className="pv-shell">
        {/* ── Hero Title & 2×2 Mobile / 4-Column Desktop Section Grid ── */}
        <header className="pv-hero-header">
          <div className="pv-hero-copy">
            <span className="pv-eyebrow">{t.pv_header_eyebrow}</span>
            <h1 className="pv-title" id="pv-title">
              {t.pv_screen_title}
            </h1>
            <p className="pv-subtitle">{t.pv_screen_subtitle}</p>
          </div>

          <nav
            className="pv-nav-grid"
            role="tablist"
            aria-label={t.pv_tabs_aria}
            id="pv-tabs-nav"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={item.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`pv-nav-card${isActive ? ' pv-nav-card--active' : ''}`}
                  onClick={() => setActiveTab(item.tab)}
                >
                  <span className="pv-nav-card-top">
                    <span className="pv-nav-card-icon" aria-hidden="true">
                      <AppIcon name={item.icon} size={17} />
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="pv-nav-card-badge">{item.count}</span>
                    )}
                  </span>
                  <span className="pv-nav-card-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* ── Main Content Area ── */}
        <main className="pv-content" aria-busy={!isStoreLoaded}>
          {/* ════════════════════════════════════════════════════════════════
              SECTION 1: OVERVIEW (Behavioral Progress + Snapshot + Rhythm Guide)
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="pv-overview-layout">
              {/* Primary Behavioral Progress Card */}
              <section className="pv-card pv-card--accent" id="sec-behavioral-progress">
                <header className="pv-card-header pv-card-header--inline">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="check-circle" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_behavioral}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_behavioral_sub}</p>
                    </div>
                  </div>

                  {durationDays !== null ? (
                    <button
                      type="button"
                      id="btn-pv-active-challenge-pill"
                      className="pv-challenge-pill pv-challenge-pill--active"
                      onClick={() => onNavigate('challenges')}
                    >
                      <AppIcon name="trophy" size={13} />
                      <span>
                        {durationDays === 1
                          ? t.pv_challenge_active_pill_1d
                          : t.pv_challenge_active_pill.replace('{days}', String(durationDays))}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="btn-pv-start-challenge"
                      className="pv-challenge-pill pv-challenge-pill--empty"
                      onClick={() => onNavigate('challenges')}
                    >
                      <AppIcon name="zap" size={13} />
                      <span>{t.pv_start_challenge_cta}</span>
                    </button>
                  )}
                </header>

                {/* Compact 2-Column Mobile / 4-Column Desktop Behavioral Metric Cards */}
                <div className="pv-behavioral-grid">
                  {/* 1. Days Checked In (Real active challenge duration; null vs 0 distinct) */}
                  <div className="pv-metric-tile" id="pv-metric-days">
                    <span className="pv-metric-tile-top">
                      <span className="pv-metric-tile-label">{t.pv_days_checked}</span>
                      <span className="pv-metric-tile-icon" aria-hidden="true">
                        <AppIcon name="calendar" size={15} />
                      </span>
                    </span>
                    <span className="pv-metric-tile-val">
                      {daysChecked === null
                        ? '—'
                        : durationDays !== null
                        ? `${daysChecked}/${durationDays}`
                        : String(daysChecked)}
                    </span>
                    <span className="pv-metric-tile-sub">
                      {daysChecked === null
                        ? t.pv_no_active_challenge
                        : durationDays === 1
                        ? t.pv_of_duration_1d
                        : durationDays !== null
                        ? t.pv_of_duration_days.replace('{total}', String(durationDays))
                        : ''}
                    </span>
                  </div>

                  {/* 2. Resume Rate (null = no slips/no challenge vs 0% = actual unresumed slip) */}
                  <div className="pv-metric-tile" id="pv-metric-resume">
                    <span className="pv-metric-tile-top">
                      <span className="pv-metric-tile-label">{t.pv_resume_rate}</span>
                      <span className="pv-metric-tile-icon" aria-hidden="true">
                        <AppIcon name="rotate-ccw" size={15} />
                      </span>
                    </span>
                    <span className="pv-metric-tile-val">
                      {resumeRate === null ? '—' : `${resumeRate}%`}
                    </span>
                    <span className="pv-metric-tile-sub">
                      {daysChecked === null
                        ? t.pv_resume_sub_no_challenge
                        : resumeRate === null
                        ? t.home_progress_resume_none
                        : t.pv_resume_sub_active
                            .replace('{resumed}', String(resumedSlips))
                            .replace('{total}', String(eligibleSlips))}
                    </span>
                  </div>

                  {/* 3. Today's Score */}
                  <div className="pv-metric-tile" id="pv-metric-score">
                    <span className="pv-metric-tile-top">
                      <span className="pv-metric-tile-label">{t.pv_today_score}</span>
                      <span className="pv-metric-tile-icon pv-metric-tile-icon--gold" aria-hidden="true">
                        <AppIcon name="zap" size={15} />
                      </span>
                    </span>
                    <span className="pv-metric-tile-val">{todayScore}</span>
                    <span className="pv-metric-tile-sub">{t.pv_score_sub}</span>
                  </div>

                  {/* 4. Movement Today */}
                  <div className="pv-metric-tile" id="pv-metric-movement">
                    <span className="pv-metric-tile-top">
                      <span className="pv-metric-tile-label">{t.pv_movement_min}</span>
                      <span className="pv-metric-tile-icon" aria-hidden="true">
                        <AppIcon name="footprints" size={15} />
                      </span>
                    </span>
                    <span className="pv-metric-tile-val">{movementMinutes}m</span>
                    <span className="pv-metric-tile-sub">
                      {movementMinutes > 0
                        ? t.home_progress_minutes.replace('{minutes}', String(movementMinutes))
                        : t.pv_movement_sub}
                    </span>
                  </div>
                </div>

                <div className="pv-philosophy-box" id="pv-philosophy-box">
                  <span className="pv-philosophy-icon" aria-hidden="true">
                    <AppIcon name="heart" size={16} />
                  </span>
                  <span>{t.pv_philosophy_quote}</span>
                </div>
              </section>

              {/* Secondary Column on Desktop: Progress Snapshot + Consolidated Expandable Tracking Guide */}
              <div className="pv-overview-side">
                {/* Compact Quick-Jump Progress Snapshot */}
                <section className="pv-card" id="pv-overview-snapshot">
                  <header className="pv-card-header pv-card-header--compact">
                    <div className="pv-card-title-group">
                      <span className="pv-card-icon" aria-hidden="true">
                        <AppIcon name="layers" size={17} />
                      </span>
                      <h2 className="pv-card-title">{t.pv_overview_snapshot_title}</h2>
                    </div>
                  </header>

                  <div className="pv-snapshot-list">
                    <button
                      type="button"
                      id="btn-snapshot-achievements"
                      className="pv-snapshot-row"
                      onClick={() => setActiveTab('victories')}
                    >
                      <span className="pv-snapshot-icon" aria-hidden="true">
                        <AppIcon name="trophy" size={17} />
                      </span>
                      <span className="pv-snapshot-copy">
                        <span className="pv-snapshot-title">{t.rw_hist_title}</span>
                        <span className="pv-snapshot-sub">
                          {t.rw_hist_snapshot_count.replace('{count}', String(verifiedAchCount))}
                        </span>
                      </span>
                      <span className="pv-snapshot-cta">
                        <span>{t.pv_btn_open_section}</span>
                        <AppIcon name="chevron-right" size={15} />
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-snapshot-victories"
                      className="pv-snapshot-row"
                      onClick={() => setActiveTab('victories')}
                    >
                      <span className="pv-snapshot-icon" aria-hidden="true">
                        <AppIcon name="award" size={17} />
                      </span>
                      <span className="pv-snapshot-copy">
                        <span className="pv-snapshot-title">{t.pv_tab_victories}</span>
                        <span className="pv-snapshot-sub">{victoriesSnapshotText}</span>
                      </span>
                      <span className="pv-snapshot-cta">
                        <span>{t.pv_btn_open_section}</span>
                        <AppIcon name="chevron-right" size={15} />
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-snapshot-body"
                      className="pv-snapshot-row"
                      onClick={() => setActiveTab('body')}
                    >
                      <span className="pv-snapshot-icon" aria-hidden="true">
                        <AppIcon name="camera" size={17} />
                      </span>
                      <span className="pv-snapshot-copy">
                        <span className="pv-snapshot-title">{t.pv_tab_body}</span>
                        <span className="pv-snapshot-sub">{bodySnapshotText}</span>
                      </span>
                      <span className="pv-snapshot-cta">
                        <span>{t.pv_btn_open_section}</span>
                        <AppIcon name="chevron-right" size={15} />
                      </span>
                    </button>

                    <button
                      type="button"
                      id="btn-snapshot-observations"
                      className="pv-snapshot-row"
                      onClick={() => setActiveTab('observations')}
                    >
                      <span className="pv-snapshot-icon" aria-hidden="true">
                        <AppIcon name="activity" size={17} />
                      </span>
                      <span className="pv-snapshot-copy">
                        <span className="pv-snapshot-title">{t.pv_tab_observations}</span>
                        <span className="pv-snapshot-sub">{optionalSnapshotText}</span>
                      </span>
                      <span className="pv-snapshot-cta">
                        <span>{t.pv_btn_open_section}</span>
                        <AppIcon name="chevron-right" size={15} />
                      </span>
                    </button>
                  </div>
                </section>

                {/* Consolidated Expandable Tracking Guide (Single instance, collapsed by default) */}
                <section className="pv-card pv-accordion-card" id="pv-rhythm-guide">
                  <button
                    type="button"
                    id="btn-toggle-rhythm-guide"
                    className="pv-accordion-trigger"
                    aria-expanded={isRhythmOpen}
                    aria-controls="pv-rhythm-guide-panel"
                    onClick={() => setIsRhythmOpen((prev) => !prev)}
                  >
                    <span className="pv-card-title-group">
                      <span className="pv-card-icon" aria-hidden="true">
                        <AppIcon name="clock" size={17} />
                      </span>
                      <span className="pv-card-title-copy">
                        <span className="pv-card-title">{t.pv_sec_rhythm_guide}</span>
                        <span className="pv-card-subtitle">{t.pv_rhythm_guide_sub}</span>
                      </span>
                    </span>
                    <span
                      className={`pv-chevron-pill${isRhythmOpen ? ' pv-chevron-pill--open' : ''}`}
                      aria-hidden="true"
                    >
                      <AppIcon name="chevron-down" size={16} />
                    </span>
                  </button>

                  <div
                    id="pv-rhythm-guide-panel"
                    className={`pv-accordion-panel${isRhythmOpen ? ' pv-accordion-panel--open' : ''}`}
                  >
                    <div className="pv-accordion-inner">
                      <ul className="pv-rhythm-list">
                        <li className="pv-rhythm-row">
                          <span className="pv-rhythm-dot" aria-hidden="true">
                            <AppIcon name="check-circle" size={15} />
                          </span>
                          <span>{t.pv_rhythm_daily}</span>
                        </li>
                        <li className="pv-rhythm-row">
                          <span className="pv-rhythm-dot" aria-hidden="true">
                            <AppIcon name="award" size={15} />
                          </span>
                          <span>{t.pv_rhythm_weekly}</span>
                        </li>
                        <li className="pv-rhythm-row">
                          <span className="pv-rhythm-dot" aria-hidden="true">
                            <AppIcon name="activity" size={15} />
                          </span>
                          <span>{t.pv_rhythm_biweekly}</span>
                        </li>
                        <li className="pv-rhythm-row">
                          <span className="pv-rhythm-dot" aria-hidden="true">
                            <AppIcon name="camera" size={15} />
                          </span>
                          <span>{t.pv_rhythm_milestone}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2: VICTORIES, ACHIEVEMENT HISTORY & REFLECTIONS
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'victories' && (
            <div>
              <AchievementHistorySection onNavigate={onNavigate} />
              <div className="pv-two-col-grid">
              {/* Non-Scale Victories */}
              <section className="pv-card" id="sec-non-scale-victories">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="award" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_victories}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_victories_sub}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-add-victory"
                    className="pv-btn-add"
                    onClick={() => openModal('victory')}
                  >
                    <AppIcon name="plus" size={16} />
                    <span>{stripLeadingPlus(t.pv_btn_add_victory)}</span>
                  </button>
                </header>

                {victories.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-victories-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="sparkles" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_victories_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_victories_text}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="pv-list" id="pv-victories-list">
                    {victories.map((v) => (
                      <li key={v.id} className="pv-item" id={`pv-victory-item-${v.id}`}>
                        <div className="pv-item-main">
                          <div className="pv-item-header">
                            <span
                              className={`pv-category-pill pv-category-pill--${v.category}`}
                              id={`pv-cat-pill-${v.category}`}
                            >
                              {getCategoryLabel(v.category)}
                            </span>
                            <span className="pv-item-date">{v.dateKey}</span>
                          </div>
                          <h4 className="pv-item-title">{v.title}</h4>
                          {v.description && <p className="pv-item-desc">{v.description}</p>}
                        </div>
                        <div className="pv-item-actions">
                          <button
                            type="button"
                            id={`btn-edit-victory-${v.id}`}
                            className="pv-icon-btn"
                            aria-label={`${t.pv_btn_edit}: ${v.title}`}
                            onClick={() => handleOpenEditVictory(v)}
                          >
                            <AppIcon name="pencil" size={15} />
                          </button>
                          <button
                            type="button"
                            id={`btn-del-victory-${v.id}`}
                            className="pv-icon-btn pv-icon-btn--danger"
                            aria-label={`${t.pv_btn_delete}: ${v.title}`}
                            onClick={() => setPendingDelete({ kind: 'victory', id: v.id })}
                          >
                            <AppIcon name="trash-2" size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Weekly Reflections */}
              <section className="pv-card" id="sec-weekly-reflections">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="clipboard-list" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_reflections}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_reflections_sub}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-add-reflection"
                    className="pv-btn-add"
                    onClick={() => openModal('reflection')}
                  >
                    <AppIcon name="plus" size={16} />
                    <span>{stripLeadingPlus(t.pv_btn_add_reflection)}</span>
                  </button>
                </header>

                {reflections.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-reflections-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="clipboard-list" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_reflections_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_reflections_text}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="pv-list" id="pv-reflections-list">
                    {reflections.map((r) => (
                      <li key={r.id} className="pv-item" id={`pv-reflection-item-${r.id}`}>
                        <div className="pv-item-main">
                          <div className="pv-item-header">
                            <span className="pv-category-pill pv-category-pill--mindset">
                              {t.pv_sec_reflections}
                            </span>
                            <span className="pv-item-date">{r.weekStartDateKey}</span>
                          </div>
                          {r.biggestVictory && (
                            <h4 className="pv-item-title pv-item-title--icon">
                              <AppIcon name="trophy" size={14} />
                              <span>{r.biggestVictory}</span>
                            </h4>
                          )}
                          {r.reflectionText && <p className="pv-item-desc">{r.reflectionText}</p>}
                          {r.nextWeekFocus && (
                            <p className="pv-item-focus">
                              <AppIcon name="target" size={13} />
                              <span>
                                {t.pv_field_next_focus}: {r.nextWeekFocus}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="pv-item-actions">
                          <button
                            type="button"
                            id={`btn-edit-reflection-${r.id}`}
                            className="pv-icon-btn"
                            aria-label={`${t.pv_btn_edit}: ${r.weekStartDateKey}`}
                            onClick={() => handleOpenEditReflection(r)}
                          >
                            <AppIcon name="pencil" size={15} />
                          </button>
                          <button
                            type="button"
                            id={`btn-del-reflection-${r.id}`}
                            className="pv-icon-btn pv-icon-btn--danger"
                            aria-label={`${t.pv_btn_delete}: ${r.weekStartDateKey}`}
                            onClick={() => setPendingDelete({ kind: 'reflection', id: r.id })}
                          >
                            <AppIcon name="trash-2" size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SECTION 3: BODY & PHOTOS (Waist + Private Local Photos)
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'body' && (
            <div className="pv-two-col-grid">
              {/* Waist Circumference */}
              <section className="pv-card" id="sec-waist-tracking">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="activity" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_waist}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_waist_sub}</p>
                    </div>
                  </div>
                  <div className="pv-card-header-actions">
                    <div className="pv-unit-toggle" role="group" aria-label={t.pv_sec_waist}>
                      <button
                        type="button"
                        id="btn-unit-cm"
                        aria-pressed={waistUnit === 'cm'}
                        className={`pv-unit-btn${waistUnit === 'cm' ? ' pv-unit-btn--active' : ''}`}
                        onClick={() => handleToggleWaistUnit('cm')}
                      >
                        cm
                      </button>
                      <button
                        type="button"
                        id="btn-unit-in"
                        aria-pressed={waistUnit === 'in'}
                        className={`pv-unit-btn${waistUnit === 'in' ? ' pv-unit-btn--active' : ''}`}
                        onClick={() => handleToggleWaistUnit('in')}
                      >
                        in
                      </button>
                    </div>
                    <button
                      type="button"
                      id="btn-add-waist"
                      className="pv-btn-add"
                      onClick={() => openModal('waist')}
                    >
                      <AppIcon name="plus" size={16} />
                      <span>{stripLeadingPlus(t.pv_btn_add_waist)}</span>
                    </button>
                  </div>
                </header>

                {latestWaist && (
                  <div className="pv-measurement-banner" id="pv-waist-latest">
                    <span className="pv-measurement-eyebrow">{t.pv_latest_label}</span>
                    <div className="pv-measurement-main">
                      <span className="pv-measurement-val">
                        {waistUnit === 'in' ? cmToInches(latestWaist.valueCm) : latestWaist.valueCm}
                      </span>
                      <span className="pv-measurement-unit">{waistUnit}</span>
                      {waistDelta !== null && (
                        <span
                          className={`pv-delta-chip${
                            waistDelta <= 0 ? ' pv-delta-chip--down' : ' pv-delta-chip--up'
                          }`}
                        >
                          {waistDelta <= 0
                            ? `▼ ${Math.abs(waistDelta)} ${waistUnit}`
                            : `▲ +${waistDelta} ${waistUnit}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {waistRecords.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-waist-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="activity" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_waist_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_waist_text}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="pv-list" id="pv-waist-list">
                    {waistRecords.map((w) => {
                      const displayVal = waistUnit === 'in' ? cmToInches(w.valueCm) : w.valueCm;
                      return (
                        <li key={w.id} className="pv-item" id={`pv-waist-item-${w.id}`}>
                          <div className="pv-item-main">
                            <div className="pv-item-header">
                              <span className="pv-category-pill pv-category-pill--clothing_fit">
                                {displayVal} {waistUnit}
                              </span>
                              <span className="pv-item-date">{w.dateKey}</span>
                            </div>
                            {w.notes && <p className="pv-item-desc">{w.notes}</p>}
                          </div>
                          <div className="pv-item-actions">
                            <button
                              type="button"
                              id={`btn-edit-waist-${w.id}`}
                              className="pv-icon-btn"
                              aria-label={`${t.pv_btn_edit}: ${displayVal} ${waistUnit}`}
                              onClick={() => handleOpenEditWaist(w)}
                            >
                              <AppIcon name="pencil" size={15} />
                            </button>
                            <button
                              type="button"
                              id={`btn-del-waist-${w.id}`}
                              className="pv-icon-btn pv-icon-btn--danger"
                              aria-label={`${t.pv_btn_delete}: ${displayVal} ${waistUnit}`}
                              onClick={() => setPendingDelete({ kind: 'waist', id: w.id })}
                            >
                              <AppIcon name="trash-2" size={15} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Progress Photos (100% Local IndexedDB + Compact Expandable Privacy Disclosure) */}
              <section className="pv-card" id="sec-progress-photos">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="camera" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_photos}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_photos_sub}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-add-photo"
                    className="pv-btn-add"
                    onClick={() => openModal('photo')}
                  >
                    <AppIcon name="camera" size={16} />
                    <span>{stripLeadingPlus(t.pv_btn_add_photo)}</span>
                  </button>
                </header>

                {/* Compact Expandable Privacy & Data-Loss Disclosure */}
                <div className="pv-privacy-disclosure" id="pv-photos-privacy-banner">
                  <button
                    type="button"
                    id="btn-toggle-photo-privacy"
                    className="pv-privacy-toggle"
                    aria-expanded={isPrivacyOpen}
                    aria-controls="pv-photos-privacy-body"
                    onClick={() => setIsPrivacyOpen((prev) => !prev)}
                  >
                    <span className="pv-privacy-toggle-left">
                      <span className="pv-privacy-shield" aria-hidden="true">
                        <AppIcon name="shield" size={15} />
                      </span>
                      <span className="pv-privacy-summary">{t.pv_privacy_summary_badge}</span>
                    </span>
                    <span className="pv-privacy-toggle-right">
                      <span className="pv-privacy-link">{t.pv_privacy_toggle_details}</span>
                      <span
                        className={`pv-privacy-chevron${isPrivacyOpen ? ' pv-privacy-chevron--open' : ''}`}
                        aria-hidden="true"
                      >
                        <AppIcon name="chevron-down" size={15} />
                      </span>
                    </span>
                  </button>

                  <div
                    id="pv-photos-privacy-body"
                    className={`pv-accordion-panel${isPrivacyOpen ? ' pv-accordion-panel--open' : ''}`}
                  >
                    <div className="pv-accordion-inner">
                      <p className="pv-privacy-body-text">{t.pv_photo_privacy_guarantee}</p>
                    </div>
                  </div>
                </div>

                {photos.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-photos-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="camera" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_photos_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_photos_text}</p>
                    </div>
                  </div>
                ) : (
                  <div className="pv-photo-grid" id="pv-photos-grid">
                    {photos.map((p) => {
                      const dataUrl = photoUrls[p.photoId];
                      const isHydrating = Boolean(loadingPhotoIds[p.photoId]);
                      return (
                        <div key={p.id} className="pv-photo-card" id={`pv-photo-card-${p.id}`}>
                          <button
                            type="button"
                            id={`btn-preview-photo-${p.id}`}
                            className="pv-photo-preview-trigger"
                            onClick={() => setPreviewPhotoItem(p)}
                            aria-label={`${getMilestoneTagLabel(p.milestoneTag)} — ${p.dateKey}`}
                          >
                            {dataUrl ? (
                              <img
                                src={dataUrl}
                                alt={`${getMilestoneTagLabel(p.milestoneTag)} (${p.dateKey})`}
                                className="pv-photo-img"
                              />
                            ) : (
                              <div className="pv-photo-placeholder" aria-busy={isHydrating}>
                                <AppIcon name="camera" size={22} />
                              </div>
                            )}
                            <span className="pv-photo-tag" id={`pv-photo-tag-${p.id}`}>
                              {getMilestoneTagLabel(p.milestoneTag)}
                            </span>
                            <span className="pv-photo-meta">
                              <span className="pv-photo-date">{p.dateKey}</span>
                              {p.notes && <span className="pv-photo-note">{p.notes}</span>}
                            </span>
                          </button>
                          <button
                            type="button"
                            id={`btn-del-photo-${p.id}`}
                            className="pv-photo-delete-btn"
                            aria-label={`${t.pv_btn_delete}: ${p.dateKey}`}
                            onClick={() =>
                              setPendingDelete({ kind: 'photo', id: p.id, photoId: p.photoId })
                            }
                          >
                            <AppIcon name="trash-2" size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SECTION 4: OPTIONAL METRICS (Weight & Glucose/CGM)
             ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'observations' && (
            <div className="pv-two-col-grid">
              {/* Optional Weight Records */}
              <section className="pv-card" id="sec-weight-records">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="scale" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_weight}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_weight_sub}</p>
                    </div>
                  </div>
                  <div className="pv-card-header-actions">
                    <div className="pv-unit-toggle" role="group" aria-label={t.pv_sec_weight}>
                      <button
                        type="button"
                        id="btn-wt-unit-kg"
                        aria-pressed={weightUnit === 'kg'}
                        className={`pv-unit-btn${weightUnit === 'kg' ? ' pv-unit-btn--active' : ''}`}
                        onClick={() => handleToggleWeightUnit('kg')}
                      >
                        kg
                      </button>
                      <button
                        type="button"
                        id="btn-wt-unit-lbs"
                        aria-pressed={weightUnit === 'lbs'}
                        className={`pv-unit-btn${weightUnit === 'lbs' ? ' pv-unit-btn--active' : ''}`}
                        onClick={() => handleToggleWeightUnit('lbs')}
                      >
                        lbs
                      </button>
                    </div>
                    <button
                      type="button"
                      id="btn-add-weight"
                      className="pv-btn-add"
                      onClick={() => openModal('weight')}
                    >
                      <AppIcon name="plus" size={16} />
                      <span>{stripLeadingPlus(t.pv_btn_add_weight)}</span>
                    </button>
                  </div>
                </header>

                <div className="pv-disclaimer" id="pv-weight-disclaimer">
                  <span className="pv-disclaimer-icon" aria-hidden="true">
                    <AppIcon name="alert-triangle" size={16} />
                  </span>
                  <span>{t.pv_weight_disclaimer}</span>
                </div>

                {latestWeight && (
                  <div className="pv-measurement-banner" id="pv-weight-latest">
                    <span className="pv-measurement-eyebrow">{t.pv_latest_label}</span>
                    <div className="pv-measurement-main">
                      <span className="pv-measurement-val">
                        {weightUnit === 'lbs'
                          ? kgToLbs(latestWeight.valueKg)
                          : latestWeight.valueKg}
                      </span>
                      <span className="pv-measurement-unit">{weightUnit}</span>
                    </div>
                  </div>
                )}

                {weightRecords.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-weight-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="scale" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_weight_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_weight_text}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="pv-list" id="pv-weight-list">
                    {weightRecords.map((w) => {
                      const displayVal = weightUnit === 'lbs' ? kgToLbs(w.valueKg) : w.valueKg;
                      return (
                        <li key={w.id} className="pv-item" id={`pv-weight-item-${w.id}`}>
                          <div className="pv-item-main">
                            <div className="pv-item-header">
                              <span className="pv-category-pill pv-category-pill--other">
                                {displayVal} {weightUnit}
                              </span>
                              <span className="pv-item-date">{w.dateKey}</span>
                            </div>
                            {w.notes && <p className="pv-item-desc">{w.notes}</p>}
                          </div>
                          <div className="pv-item-actions">
                            <button
                              type="button"
                              id={`btn-edit-weight-${w.id}`}
                              className="pv-icon-btn"
                              aria-label={`${t.pv_btn_edit}: ${displayVal} ${weightUnit}`}
                              onClick={() => handleOpenEditWeight(w)}
                            >
                              <AppIcon name="pencil" size={15} />
                            </button>
                            <button
                              type="button"
                              id={`btn-del-weight-${w.id}`}
                              className="pv-icon-btn pv-icon-btn--danger"
                              aria-label={`${t.pv_btn_delete}: ${displayVal} ${weightUnit}`}
                              onClick={() => setPendingDelete({ kind: 'weight', id: w.id })}
                            >
                              <AppIcon name="trash-2" size={15} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Optional Glucose & CGM Observations */}
              <section className="pv-card" id="sec-glucose-observations">
                <header className="pv-card-header">
                  <div className="pv-card-title-group">
                    <span className="pv-card-icon" aria-hidden="true">
                      <AppIcon name="activity" size={18} />
                    </span>
                    <div className="pv-card-title-copy">
                      <h2 className="pv-card-title">{t.pv_sec_glucose}</h2>
                      <p className="pv-card-subtitle">{t.pv_sec_glucose_sub}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="btn-add-glucose"
                    className="pv-btn-add"
                    onClick={() => openModal('glucose')}
                  >
                    <AppIcon name="plus" size={16} />
                    <span>{stripLeadingPlus(t.pv_btn_add_glucose)}</span>
                  </button>
                </header>

                <div className="pv-disclaimer" id="pv-glucose-disclaimer">
                  <span className="pv-disclaimer-icon" aria-hidden="true">
                    <AppIcon name="alert-triangle" size={16} />
                  </span>
                  <span>{t.pv_glucose_disclaimer}</span>
                </div>

                {glucoseRecords.length === 0 ? (
                  <div className="pv-empty-compact" id="pv-glucose-empty">
                    <span className="pv-empty-badge" aria-hidden="true">
                      <AppIcon name="droplet" size={18} />
                    </span>
                    <div className="pv-empty-copy">
                      <h3 className="pv-empty-title">{t.pv_empty_glucose_title}</h3>
                      <p className="pv-empty-text">{t.pv_empty_glucose_text}</p>
                    </div>
                  </div>
                ) : (
                  <ul className="pv-list" id="pv-glucose-list">
                    {glucoseRecords.map((g) => (
                      <li key={g.id} className="pv-item" id={`pv-glucose-item-${g.id}`}>
                        <div className="pv-item-main">
                          <div className="pv-item-header">
                            <span className="pv-category-pill pv-category-pill--energy">
                              {g.valueMgDl} mg/dL · {getGlucoseTypeLabel(g.readingType)}
                            </span>
                            <span className="pv-item-date">{g.dateKey}</span>
                          </div>
                          {g.notes && <p className="pv-item-desc">{g.notes}</p>}
                        </div>
                        <div className="pv-item-actions">
                          <button
                            type="button"
                            id={`btn-edit-glucose-${g.id}`}
                            className="pv-icon-btn"
                            aria-label={`${t.pv_btn_edit}: ${g.valueMgDl} mg/dL`}
                            onClick={() => handleOpenEditGlucose(g)}
                          >
                            <AppIcon name="pencil" size={15} />
                          </button>
                          <button
                            type="button"
                            id={`btn-del-glucose-${g.id}`}
                            className="pv-icon-btn pv-icon-btn--danger"
                            aria-label={`${t.pv_btn_delete}: ${g.valueMgDl} mg/dL`}
                            onClick={() => setPendingDelete({ kind: 'glucose', id: g.id })}
                          >
                            <AppIcon name="trash-2" size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS (Create / Edit Forms, Photo Lightbox, Delete Confirmation)
         ══════════════════════════════════════════════════════════════════════ */}

      {/* 1. Victory Modal */}
      {activeModal === 'victory' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-victory-title"
          id="pv-modal-victory"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-victory-title">
                {editingRecordId ? t.pv_modal_edit_victory_title : t.pv_modal_add_victory_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitVictory} className="pv-modal-form">
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-victory-title">
                  {t.pv_field_title}
                </label>
                <input
                  id="inp-victory-title"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_victory_title}
                  value={vTitle}
                  onChange={(e) => setVTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="pv-form-row">
                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-victory-category">
                    {t.pv_field_category}
                  </label>
                  <select
                    id="inp-victory-category"
                    className="pv-select"
                    value={vCategory}
                    onChange={(e) => setVCategory(e.target.value as VictoryCategory)}
                  >
                    <option value="clothing_fit">{t.pv_cat_clothing_fit}</option>
                    <option value="energy">{t.pv_cat_energy}</option>
                    <option value="sleep">{t.pv_cat_sleep}</option>
                    <option value="appetite">{t.pv_cat_appetite}</option>
                    <option value="fitness">{t.pv_cat_fitness}</option>
                    <option value="mindset">{t.pv_cat_mindset}</option>
                    <option value="other">{t.pv_cat_other}</option>
                  </select>
                </div>

                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-victory-date">
                    {t.pv_field_date}
                  </label>
                  <input
                    id="inp-victory-date"
                    type="date"
                    className="pv-input"
                    value={vDate}
                    onChange={(e) => setVDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-victory-desc">
                  {t.pv_field_desc}
                </label>
                <textarea
                  id="inp-victory-desc"
                  className="pv-textarea"
                  placeholder={t.pv_ph_victory_desc}
                  value={vDesc}
                  onChange={(e) => setVDesc(e.target.value)}
                />
              </div>

              {vError && <p className="pv-error-text">{vError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-victory" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Waist Modal */}
      {activeModal === 'waist' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-waist-title"
          id="pv-modal-waist"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-waist-title">
                {editingRecordId ? t.pv_modal_edit_waist_title : t.pv_modal_add_waist_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitWaist} className="pv-modal-form">
              <div className="pv-form-row">
                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-waist-val">
                    {t.pv_field_value} ({waistUnit})
                  </label>
                  <input
                    id="inp-waist-val"
                    type="number"
                    step="0.1"
                    className="pv-input"
                    placeholder={waistUnit === 'in' ? '33.5' : '85.0'}
                    value={waistVal}
                    onChange={(e) => setWaistVal(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-waist-date">
                    {t.pv_field_date}
                  </label>
                  <input
                    id="inp-waist-date"
                    type="date"
                    className="pv-input"
                    value={waistDate}
                    onChange={(e) => setWaistDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-waist-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-waist-notes"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_waist_notes}
                  value={waistNotes}
                  onChange={(e) => setWaistNotes(e.target.value)}
                />
              </div>

              {waistError && <p className="pv-error-text">{waistError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-waist" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Progress Photo Modal */}
      {activeModal === 'photo' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-photo-title"
          id="pv-modal-photo"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-photo-title">
                {t.pv_modal_add_photo_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitPhoto} className="pv-modal-form">
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="pv-photo-file-input">
                  {t.pv_field_select_image}
                </label>
                <input
                  id="pv-photo-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="pv-file-hidden"
                  onChange={handlePhotoFileChange}
                />
                <button
                  type="button"
                  id="btn-trigger-photo-file"
                  className="pv-file-picker-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AppIcon name="camera" size={17} />
                  <span>{photoFile ? photoFile.name : t.pv_btn_choose_photo}</span>
                </button>
              </div>

              {photoPreview && (
                <div className="pv-modal-photo-preview">
                  <img src={photoPreview} alt="" className="pv-modal-photo-preview-img" />
                </div>
              )}

              <div className="pv-form-row">
                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-photo-tag">
                    {t.pv_field_milestone_tag}
                  </label>
                  <select
                    id="inp-photo-tag"
                    className="pv-select"
                    value={photoTag}
                    onChange={(e) => setPhotoTag(e.target.value as any)}
                  >
                    <option value="day_1">{t.pv_photo_tag_day_1}</option>
                    <option value="day_30">{t.pv_photo_tag_day_30}</option>
                    <option value="day_60">{t.pv_photo_tag_day_60}</option>
                    <option value="day_90">{t.pv_photo_tag_day_90}</option>
                    <option value="other">{t.pv_photo_tag_other}</option>
                  </select>
                </div>

                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-photo-date">
                    {t.pv_field_date}
                  </label>
                  <input
                    id="inp-photo-date"
                    type="date"
                    className="pv-input"
                    value={photoDate}
                    onChange={(e) => setPhotoDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-photo-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-photo-notes"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_photo_notes}
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                />
              </div>

              <div className="pv-modal-privacy-note">
                <AppIcon name="shield" size={14} />
                <span>{t.pv_privacy_summary_badge}</span>
              </div>

              {photoError && <p className="pv-error-text">{photoError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button
                  type="submit"
                  id="btn-save-photo"
                  className="pv-btn-submit"
                  disabled={isSavingPhoto}
                >
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Weight Modal */}
      {activeModal === 'weight' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-weight-title"
          id="pv-modal-weight"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-weight-title">
                {editingRecordId ? t.pv_modal_edit_weight_title : t.pv_modal_add_weight_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitWeight} className="pv-modal-form">
              <div className="pv-form-row">
                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-weight-val">
                    {t.pv_field_value} ({weightUnit})
                  </label>
                  <input
                    id="inp-weight-val"
                    type="number"
                    step="0.1"
                    className="pv-input"
                    placeholder={weightUnit === 'lbs' ? '175.4' : '79.5'}
                    value={wtVal}
                    onChange={(e) => setWtVal(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-weight-date">
                    {t.pv_field_date}
                  </label>
                  <input
                    id="inp-weight-date"
                    type="date"
                    className="pv-input"
                    value={wtDate}
                    onChange={(e) => setWtDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-weight-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-weight-notes"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_weight_notes}
                  value={wtNotes}
                  onChange={(e) => setWtNotes(e.target.value)}
                />
              </div>

              {wtError && <p className="pv-error-text">{wtError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-weight" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Glucose Modal */}
      {activeModal === 'glucose' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-glucose-title"
          id="pv-modal-glucose"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-glucose-title">
                {editingRecordId ? t.pv_modal_edit_glucose_title : t.pv_modal_add_glucose_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitGlucose} className="pv-modal-form">
              <div className="pv-form-row">
                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-glc-val">
                    {t.pv_field_value} (mg/dL)
                  </label>
                  <input
                    id="inp-glc-val"
                    type="number"
                    step="1"
                    className="pv-input"
                    placeholder="95"
                    value={glcVal}
                    onChange={(e) => setGlcVal(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="pv-form-group">
                  <label className="pv-label" htmlFor="inp-glc-type">
                    {t.pv_field_glucose_type}
                  </label>
                  <select
                    id="inp-glc-type"
                    className="pv-select"
                    value={glcType}
                    onChange={(e) => setGlcType(e.target.value as any)}
                  >
                    <option value="fasting">{t.pv_glc_type_fasting}</option>
                    <option value="cgm_avg">{t.pv_glc_type_cgm_avg}</option>
                    <option value="post_meal">{t.pv_glc_type_post_meal}</option>
                    <option value="custom">{t.pv_glc_type_custom}</option>
                  </select>
                </div>
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-glc-date">
                  {t.pv_field_date}
                </label>
                <input
                  id="inp-glc-date"
                  type="date"
                  className="pv-input"
                  value={glcDate}
                  onChange={(e) => setGlcDate(e.target.value)}
                />
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-glc-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-glc-notes"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_glucose_notes}
                  value={glcNotes}
                  onChange={(e) => setGlcNotes(e.target.value)}
                />
              </div>

              {glcError && <p className="pv-error-text">{glcError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-glucose" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Weekly Reflection Modal */}
      {activeModal === 'reflection' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reflection-title"
          id="pv-modal-reflection"
          onClick={closeModal}
        >
          <div className="pv-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-reflection-title">
                {editingRecordId
                  ? t.pv_modal_edit_reflection_title
                  : t.pv_modal_add_reflection_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitReflection} className="pv-modal-form">
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-victory">
                  {t.pv_field_biggest_victory}
                </label>
                <input
                  id="inp-ref-victory"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_ref_victory}
                  value={refVictory}
                  onChange={(e) => setRefVictory(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-text">
                  {t.pv_field_reflection}
                </label>
                <textarea
                  id="inp-ref-text"
                  className="pv-textarea"
                  placeholder={t.pv_ph_ref_text}
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                />
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-focus">
                  {t.pv_field_next_focus}
                </label>
                <input
                  id="inp-ref-focus"
                  type="text"
                  className="pv-input"
                  placeholder={t.pv_ph_ref_focus}
                  value={refFocus}
                  onChange={(e) => setRefFocus(e.target.value)}
                />
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-date">
                  {t.pv_field_week_start}
                </label>
                <input
                  id="inp-ref-date"
                  type="date"
                  className="pv-input"
                  value={refDate}
                  onChange={(e) => setRefDate(e.target.value)}
                />
              </div>

              {refError && <p className="pv-error-text">{refError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-reflection" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Progress Photo Lightbox Preview Modal */}
      {previewPhotoItem && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.pv_sec_photos}
          id="pv-photo-lightbox"
          onClick={() => setPreviewPhotoItem(null)}
        >
          <div
            className="pv-modal-card pv-modal-card--lightbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pv-modal-header">
              <div>
                <h3 className="pv-modal-title">
                  {getMilestoneTagLabel(previewPhotoItem.milestoneTag)}
                </h3>
                <span className="pv-item-date">{previewPhotoItem.dateKey}</span>
              </div>
              <button
                type="button"
                id="btn-close-photo-lightbox"
                className="pv-modal-close-btn"
                onClick={() => setPreviewPhotoItem(null)}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>

            <div className="pv-lightbox-img-wrap">
              {photoUrls[previewPhotoItem.photoId] ? (
                <img
                  src={photoUrls[previewPhotoItem.photoId]}
                  alt={`${getMilestoneTagLabel(previewPhotoItem.milestoneTag)} (${previewPhotoItem.dateKey})`}
                  className="pv-lightbox-img"
                />
              ) : (
                <div className="pv-photo-placeholder">
                  <AppIcon name="camera" size={28} />
                </div>
              )}
            </div>

            {previewPhotoItem.notes && (
              <p className="pv-lightbox-notes">{previewPhotoItem.notes}</p>
            )}
          </div>
        </div>
      )}

      {/* 8. Accessible Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-confirm-delete-title"
          id="pv-modal-confirm-delete"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="pv-modal-card pv-modal-card--confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-confirm-delete-title">
                {t.pv_modal_confirm_delete_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={() => setPendingDelete(null)}
                aria-label={t.pv_close_modal_aria}
              >
                <AppIcon name="x" size={18} />
              </button>
            </div>
            <p className="pv-confirm-text">{t.pv_delete_confirm}</p>
            <div className="pv-modal-actions">
              <button
                type="button"
                id="btn-cancel-delete"
                className="pv-btn-cancel"
                onClick={() => setPendingDelete(null)}
              >
                {t.pv_btn_cancel}
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                className="pv-btn-danger"
                onClick={handleConfirmDelete}
              >
                {t.pv_btn_delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressVictoriesScreen;
