/**
 * Super Diet-Ability — Premium My Progress & Victories (Phase 4)
 *
 * Implements:
 * 1. Behavioral Consistency Engine (Check-In & Challenge practice metrics, resume rate)
 * 2. Non-Scale Victories (NSVs) and Weekly Reflections
 * 3. Waist Circumference (primary physical metric with cm/in support)
 * 4. Local-First Progress Photos (100% private in IndexedDB)
 * 5. Optional Secondary Metrics (Weight kg/lbs and Glucose/CGM readings with medical disclaimers)
 * 6. Suggested Gentle Tracking Rhythm Guide
 *
 * Safe & Accessible: WCAG AA contrast, touch targets >= 44px, full EN/ES/NL i18n.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import { AppIcon } from '../components/icons/AppIcon';
import {
  loadProgressVictoriesStore,
  addVictory,
  deleteVictory,
  addWaistRecord,
  deleteWaistRecord,
  addProgressPhoto,
  deleteProgressPhoto,
  addWeightRecord,
  deleteWeightRecord,
  addGlucoseRecord,
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
import { calculateChallengePracticeStats, CHALLENGE_UPDATED_EVENT } from '../challenges';
import { getTodayScore, SCORE_UPDATED_EVENT } from '../utils/scoringEngine';
import { getDailyActivitySummary, ACTIVITIES_UPDATED_EVENT } from '../activities';
import { getLocalDateKey } from '../utils/dietStorage';
import { STATS_RESET_EVENT } from '../utils/resetStats';
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

export function ProgressVictoriesScreen({ onNavigate, onBack }: ProgressVictoriesScreenProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Store data states
  const [victories, setVictories] = useState<VictoryRecord[]>([]);
  const [waistRecords, setWaistRecords] = useState<WaistRecord[]>([]);
  const [photos, setPhotos] = useState<ProgressPhotoRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [glucoseRecords, setGlucoseRecords] = useState<GlucoseRecord[]>([]);
  const [reflections, setReflections] = useState<WeeklyReflectionRecord[]>([]);
  const [waistUnit, setWaistUnit] = useState<'cm' | 'in'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  // Photo URLs cache map for fast rendering
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  // Behavioral Stats Snapshot
  const [daysChecked, setDaysChecked] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [resumeRate, setResumeRate] = useState<number | null>(null);
  const [todayScore, setTodayScore] = useState<number>(0);
  const [movementMinutes, setMovementMinutes] = useState<number>(0);

  // Refresh all data
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

    // Async load photos into data URLs
    store.photos.forEach((p) => {
      const syncUrl = getPhotoDataUrlSync(p.photoId);
      if (syncUrl) {
        setPhotoUrls((prev) => ({ ...prev, [p.photoId]: syncUrl }));
      } else {
        getFoodPhoto(p.photoId).then((res) => {
          if (res?.dataUrl) {
            setPhotoUrls((prev) => ({ ...prev, [p.photoId]: res.dataUrl }));
          }
        }).catch(() => {
          // ignore
        });
      }
    });

    // Read behavioral metrics
    try {
      const ch = readActiveChallenge();
      if (ch) {
        setDaysChecked(calculateChallengePracticeStats(ch).daysCheckedIn);
        setDurationDays(ch.durationDays);
        setResumeRate(ch.relevantEventCounts?.resumeRate ?? null);
      } else {
        setDaysChecked(null);
        setDurationDays(null);
        setResumeRate(null);
      }
    } catch {
      // ignore
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
  }, []);

  useEffect(() => {
    refreshAll();
    const events = [
      PROGRESS_VICTORIES_UPDATED_EVENT,
      CHALLENGE_UPDATED_EVENT,
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
  // Victory form
  const [vTitle, setVTitle] = useState('');
  const [vCategory, setVCategory] = useState<VictoryCategory>('clothing_fit');
  const [vDesc, setVDesc] = useState('');
  const [vDate, setVDate] = useState(() => getLocalDateKey());
  const [vError, setVError] = useState('');

  // Waist form
  const [waistVal, setWaistVal] = useState('');
  const [waistDate, setWaistDate] = useState(() => getLocalDateKey());
  const [waistNotes, setWaistNotes] = useState('');
  const [waistError, setWaistError] = useState('');

  // Photo form
  const [photoTag, setPhotoTag] = useState<'day_1' | 'day_30' | 'day_60' | 'day_90' | 'other'>('day_1');
  const [photoDate, setPhotoDate] = useState(() => getLocalDateKey());
  const [photoNotes, setPhotoNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Weight form
  const [wtVal, setWtVal] = useState('');
  const [wtDate, setWtDate] = useState(() => getLocalDateKey());
  const [wtNotes, setWtNotes] = useState('');
  const [wtError, setWtError] = useState('');

  // Glucose form
  const [glcVal, setGlcVal] = useState('');
  const [glcType, setGlcType] = useState<GlucoseRecord['readingType']>('fasting');
  const [glcDate, setGlcDate] = useState(() => getLocalDateKey());
  const [glcNotes, setGlcNotes] = useState('');
  const [glcError, setGlcError] = useState('');

  // Reflection form
  const [refText, setRefText] = useState('');
  const [refVictory, setRefVictory] = useState('');
  const [refFocus, setRefFocus] = useState('');
  const [refDate, setRefDate] = useState(() => getLocalDateKey());
  const [refError, setRefError] = useState('');

  // ── Modal Handlers ──
  const openModal = (type: ModalType) => {
    setActiveModal(type);
    setVError('');
    setWaistError('');
    setPhotoError('');
    setWtError('');
    setGlcError('');
    setRefError('');

    // Pre-fill dates to today
    const today = getLocalDateKey();
    setVDate(today);
    setWaistDate(today);
    setPhotoDate(today);
    setWtDate(today);
    setGlcDate(today);
    setRefDate(today);

    // Reset values
    setVTitle('');
    setVDesc('');
    setWaistVal('');
    setWaistNotes('');
    setWtVal('');
    setWtNotes('');
    setGlcVal('');
    setGlcNotes('');
    setRefText('');
    setRefVictory('');
    setRefFocus('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const closeModal = () => {
    setActiveModal(null);
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  // Submit Victory
  const handleSubmitVictory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vTitle.trim()) {
      setVError(t.pv_field_title + ' is required');
      return;
    }
    const res = addVictory({
      dateKey: vDate,
      category: vCategory,
      title: vTitle.trim(),
      description: vDesc.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setVError('Failed to save victory');
    }
  };

  // Submit Waist
  const handleSubmitWaist = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(waistVal);
    const check = validateWaist(num, waistUnit);
    if (!check.valid) {
      setWaistError(check.error || 'Invalid measurement');
      return;
    }
    const res = addWaistRecord({
      dateKey: waistDate,
      value: num,
      unit: waistUnit,
      notes: waistNotes.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setWaistError('Failed to save waist measurement');
    }
  };

  // Handle Photo selection
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      setPhotoError('Please select a valid image file (JPG, PNG, WebP, etc.).');
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
    try {
      const objUrl = URL.createObjectURL(file);
      setPhotoPreview(objUrl);
    } catch {
      // fallback
    }
  };

  // Submit Photo
  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setPhotoError('Please select a photo file');
      return;
    }
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
        setPhotoError('Failed to record photo metadata');
      }
    } catch (err: any) {
      setPhotoError(err?.message || 'Error processing photo');
    }
  };

  // Submit Weight
  const handleSubmitWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(wtVal);
    const check = validateWeight(num, weightUnit);
    if (!check.valid) {
      setWtError(check.error || 'Invalid weight value');
      return;
    }
    const res = addWeightRecord({
      dateKey: wtDate,
      value: num,
      unit: weightUnit,
      notes: wtNotes.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setWtError('Failed to save weight record');
    }
  };

  // Submit Glucose
  const handleSubmitGlucose = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(glcVal);
    const check = validateGlucose(num);
    if (!check.valid) {
      setGlcError(check.error || 'Invalid glucose reading');
      return;
    }
    const res = addGlucoseRecord({
      dateKey: glcDate,
      readingType: glcType,
      valueMgDl: num,
      notes: glcNotes.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setGlcError('Failed to save glucose reading');
    }
  };

  // Submit Reflection
  const handleSubmitReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refText.trim() && !refVictory.trim()) {
      setRefError('Please fill in your reflection or win');
      return;
    }
    const res = saveWeeklyReflection({
      weekStartDateKey: refDate,
      reflectionText: refText.trim(),
      biggestVictory: refVictory.trim(),
      nextWeekFocus: refFocus.trim() || undefined,
    });
    if (res) {
      refreshAll();
      closeModal();
    } else {
      setRefError('Failed to save weekly reflection');
    }
  };

  // Deletions with confirm
  const handleDeleteVictory = (id: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteVictory(id);
      refreshAll();
    }
  };

  const handleDeleteWaist = (id: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteWaistRecord(id);
      refreshAll();
    }
  };

  const handleDeletePhoto = async (id: string, photoId: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteProgressPhoto(id);
      await deleteFoodPhoto(photoId);
      refreshAll();
    }
  };

  const handleDeleteWeight = (id: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteWeightRecord(id);
      refreshAll();
    }
  };

  const handleDeleteGlucose = (id: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteGlucoseRecord(id);
      refreshAll();
    }
  };

  const handleDeleteReflection = (id: string) => {
    if (window.confirm(t.pv_delete_confirm)) {
      deleteWeeklyReflection(id);
      refreshAll();
    }
  };

  // Category label helper
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

  // Latest waist calculation
  const latestWaist = waistRecords[0] ?? null;
  const prevWaist = waistRecords[1] ?? null;
  const waistDelta = useMemo(() => {
    if (!latestWaist || !prevWaist) return null;
    const diffCm = latestWaist.valueCm - prevWaist.valueCm;
    const displayDiff = waistUnit === 'in' ? cmToInches(diffCm) : Math.round(diffCm * 10) / 10;
    return displayDiff;
  }, [latestWaist, prevWaist, waistUnit]);

  // Latest weight calculation
  const latestWeight = weightRecords[0] ?? null;

  return (
    <div className="pv-screen" id="progress-victories-screen">
      {/* ── Screen Header ── */}
      <header className="pv-header">
        <button
          type="button"
          id="btn-progress-back"
          className="pv-back-btn"
          onClick={() => (onBack ? onBack() : onNavigate('home'))}
        >
          <AppIcon name="chevron-left" size={18} />
          <span>{t.common_back || 'Back'}</span>
        </button>
        <div className="pv-title-wrap">
          <h1 className="pv-title" id="pv-title">
            {t.pv_screen_title}
          </h1>
          <p className="pv-subtitle">{t.pv_screen_subtitle}</p>
        </div>

        {/* ── Tabs Navigation ── */}
        <nav className="pv-tabs" aria-label="Progress navigation tabs" id="pv-tabs-nav">
          <button
            type="button"
            id="tab-pv-overview"
            className={`pv-tab-btn${activeTab === 'overview' ? ' pv-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <AppIcon name="sparkles" size={16} />
            <span>{t.pv_tab_overview}</span>
          </button>
          <button
            type="button"
            id="tab-pv-victories"
            className={`pv-tab-btn${activeTab === 'victories' ? ' pv-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('victories')}
          >
            <AppIcon name="award" size={16} />
            <span>{t.pv_tab_victories}</span>
          </button>
          <button
            type="button"
            id="tab-pv-body"
            className={`pv-tab-btn${activeTab === 'body' ? ' pv-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            <AppIcon name="camera" size={16} />
            <span>{t.pv_tab_body}</span>
          </button>
          <button
            type="button"
            id="tab-pv-observations"
            className={`pv-tab-btn${activeTab === 'observations' ? ' pv-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('observations')}
          >
            <AppIcon name="activity" size={16} />
            <span>{t.pv_tab_observations}</span>
          </button>
        </nav>
      </header>

      {/* ── Main Content Area ── */}
      <main className="pv-content">
        {/* ── TAB: OVERVIEW ── */}
        {(activeTab === 'overview' || activeTab === 'victories') && (
          <section className="pv-card pv-card--accent" id="sec-behavioral-progress">
            <header className="pv-card-header">
              <div className="pv-card-title-group">
                <span className="pv-card-icon" aria-hidden="true">
                  <AppIcon name="check-circle" size={18} />
                </span>
                <div>
                  <h2 className="pv-card-title">{t.pv_sec_behavioral}</h2>
                  <p className="pv-card-subtitle">{t.pv_sec_behavioral_sub}</p>
                </div>
              </div>
            </header>

            <div className="pv-behavioral-grid">
              <div className="pv-metric-tile" id="pv-metric-days">
                <span className="pv-metric-tile-top">
                  <span>{t.pv_days_checked}</span>
                  <AppIcon name="calendar" size={15} />
                </span>
                <span className="pv-metric-tile-val">
                  {daysChecked === null ? '—' : daysChecked}
                </span>
                {durationDays !== null && (
                  <span className="pv-metric-tile-sub">
                    {t.home_hero_of_total?.replace('{total}', String(durationDays)) || `of ${durationDays}`}
                  </span>
                )}
              </div>

              <div className="pv-metric-tile" id="pv-metric-resume">
                <span className="pv-metric-tile-top">
                  <span>{t.pv_resume_rate}</span>
                  <AppIcon name="rotate-ccw" size={15} />
                </span>
                <span className="pv-metric-tile-val">
                  {resumeRate === null ? '—' : `${resumeRate}%`}
                </span>
                <span className="pv-metric-tile-sub">
                  {resumeRate === null && daysChecked !== null
                    ? t.home_progress_resume_none
                    : t.challenge_resumed_count || 'Resumed slips'}
                </span>
              </div>

              <div className="pv-metric-tile" id="pv-metric-score">
                <span className="pv-metric-tile-top">
                  <span>{t.pv_today_score}</span>
                  <AppIcon name="sparkles" size={15} />
                </span>
                <span className="pv-metric-tile-val">{todayScore}</span>
                <span className="pv-metric-tile-sub">
                  {t.home_progress_today_score}
                </span>
              </div>

              <div className="pv-metric-tile" id="pv-metric-movement">
                <span className="pv-metric-tile-top">
                  <span>{t.pv_movement_min}</span>
                  <AppIcon name="footprints" size={15} />
                </span>
                <span className="pv-metric-tile-val">{movementMinutes}m</span>
                <span className="pv-metric-tile-sub">
                  {t.home_progress_minutes.replace('{minutes}', String(movementMinutes))}
                </span>
              </div>
            </div>

            <div className="pv-philosophy-box" id="pv-philosophy-box">
              <span className="pv-philosophy-icon" aria-hidden="true">
                <AppIcon name="heart" size={18} />
              </span>
              <span>{t.pv_philosophy_quote}</span>
            </div>
          </section>
        )}

        {/* ── TAB: VICTORIES & REFLECTIONS ── */}
        {(activeTab === 'overview' || activeTab === 'victories') && (
          <>
            {/* Non-Scale Victories */}
            <section className="pv-card" id="sec-non-scale-victories">
              <header className="pv-card-header">
                <div className="pv-card-title-group">
                  <span className="pv-card-icon" aria-hidden="true">
                    <AppIcon name="award" size={18} />
                  </span>
                  <div>
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
                  <AppIcon name="check" size={16} />
                  <span>{t.pv_btn_add_victory}</span>
                </button>
              </header>

              {victories.length === 0 ? (
                <div className="pv-empty-state" id="pv-victories-empty">
                  <span className="pv-empty-icon" aria-hidden="true">✨</span>
                  <h3 className="pv-empty-title">{t.pv_empty_victories_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_victories_text}</p>
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
                          id={`btn-del-victory-${v.id}`}
                          className="pv-icon-btn"
                          aria-label={`Delete victory ${v.title}`}
                          onClick={() => handleDeleteVictory(v.id)}
                        >
                          <AppIcon name="trash-2" size={16} />
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
                  <div>
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
                  <span>{t.pv_btn_add_reflection}</span>
                </button>
              </header>

              {reflections.length === 0 ? (
                <div className="pv-empty-state" id="pv-reflections-empty">
                  <span className="pv-empty-icon" aria-hidden="true">📝</span>
                  <h3 className="pv-empty-title">{t.pv_empty_reflections_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_reflections_text}</p>
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
                        <h4 className="pv-item-title">🏆 {r.biggestVictory}</h4>
                        {r.reflectionText && (
                          <p className="pv-item-desc">💭 {r.reflectionText}</p>
                        )}
                        {r.nextWeekFocus && (
                          <p className="pv-item-desc" style={{ color: '#5eead4' }}>
                            🎯 {t.pv_field_next_focus}: {r.nextWeekFocus}
                          </p>
                        )}
                      </div>
                      <div className="pv-item-actions">
                        <button
                          type="button"
                          id={`btn-del-reflection-${r.id}`}
                          className="pv-icon-btn"
                          aria-label={`Delete reflection for ${r.weekStartDateKey}`}
                          onClick={() => handleDeleteReflection(r.id)}
                        >
                          <AppIcon name="trash-2" size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* ── TAB: BODY & WAIST ── */}
        {(activeTab === 'overview' || activeTab === 'body') && (
          <>
            {/* Waist Circumference Tracking */}
            <section className="pv-card" id="sec-waist-tracking">
              <header className="pv-card-header">
                <div className="pv-card-title-group">
                  <span className="pv-card-icon" aria-hidden="true">
                    <AppIcon name="activity" size={18} />
                  </span>
                  <div>
                    <h2 className="pv-card-title">{t.pv_sec_waist}</h2>
                    <p className="pv-card-subtitle">{t.pv_sec_waist_sub}</p>
                  </div>
                </div>
                <div className="pv-card-header-actions">
                  <div className="pv-unit-toggle" role="group" aria-label="Waist unit selector">
                    <button
                      type="button"
                      id="btn-unit-cm"
                      className={`pv-unit-btn${waistUnit === 'cm' ? ' pv-unit-btn--active' : ''}`}
                      onClick={() => handleToggleWaistUnit('cm')}
                    >
                      cm
                    </button>
                    <button
                      type="button"
                      id="btn-unit-in"
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
                    <span>{t.pv_btn_add_waist}</span>
                  </button>
                </div>
              </header>

              {latestWaist ? (
                <div className="pv-measurement-box" id="pv-waist-latest">
                  <span className="pv-measurement-val">
                    {waistUnit === 'in' ? cmToInches(latestWaist.valueCm) : latestWaist.valueCm}
                  </span>
                  <span className="pv-measurement-unit">{waistUnit}</span>
                  {waistDelta !== null && (
                    <span
                      style={{
                        marginLeft: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: waistDelta <= 0 ? '#5eead4' : '#fbbf24',
                      }}
                    >
                      {waistDelta <= 0 ? `▼ ${Math.abs(waistDelta)} ${waistUnit}` : `▲ +${waistDelta} ${waistUnit}`}
                    </span>
                  )}
                </div>
              ) : null}

              {waistRecords.length === 0 ? (
                <div className="pv-empty-state" id="pv-waist-empty">
                  <span className="pv-empty-icon" aria-hidden="true">📏</span>
                  <h3 className="pv-empty-title">{t.pv_empty_waist_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_waist_text}</p>
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
                            id={`btn-del-waist-${w.id}`}
                            className="pv-icon-btn"
                            aria-label={`Delete waist record ${displayVal} ${waistUnit}`}
                            onClick={() => handleDeleteWaist(w.id)}
                          >
                            <AppIcon name="trash-2" size={16} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="pv-rhythm-hint">
                <AppIcon name="clock" size={16} />
                <span>{t.pv_waist_rhythm_hint}</span>
              </div>
            </section>

            {/* Visual Progress Photographs */}
            <section className="pv-card" id="sec-progress-photos">
              <header className="pv-card-header">
                <div className="pv-card-title-group">
                  <span className="pv-card-icon" aria-hidden="true">
                    <AppIcon name="camera" size={18} />
                  </span>
                  <div>
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
                  <span>{t.pv_btn_add_photo}</span>
                </button>
              </header>

              <div className="pv-privacy-banner" id="pv-photos-privacy-banner">
                <AppIcon name="shield" size={18} />
                <span>{t.pv_photo_privacy_guarantee}</span>
              </div>

              {photos.length === 0 ? (
                <div className="pv-empty-state" id="pv-photos-empty">
                  <span className="pv-empty-icon" aria-hidden="true">📷</span>
                  <h3 className="pv-empty-title">{t.pv_empty_photos_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_photos_text}</p>
                </div>
              ) : (
                <div className="pv-photo-grid" id="pv-photos-grid">
                  {photos.map((p) => {
                    const dataUrl = photoUrls[p.photoId];
                    return (
                      <div key={p.id} className="pv-photo-card" id={`pv-photo-card-${p.id}`}>
                        {dataUrl ? (
                          <img
                            src={dataUrl}
                            alt={`Progress photo ${p.milestoneTag || 'milestone'}`}
                            className="pv-photo-img"
                          />
                        ) : (
                          <div
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#64748b',
                            }}
                          >
                            <AppIcon name="camera" size={24} />
                          </div>
                        )}
                        <span className="pv-photo-tag" id={`pv-photo-tag-${p.id}`}>
                          {getMilestoneTagLabel(p.milestoneTag)}
                        </span>
                        <span className="pv-photo-date">{p.dateKey}</span>
                        <button
                          type="button"
                          id={`btn-del-photo-${p.id}`}
                          className="pv-photo-delete-btn"
                          aria-label={`Delete progress photo ${p.dateKey}`}
                          onClick={() => handleDeletePhoto(p.id, p.photoId)}
                        >
                          <AppIcon name="trash-2" size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ── TAB: OPTIONAL OBSERVATIONS & METRICS ── */}
        {(activeTab === 'overview' || activeTab === 'observations') && (
          <>
            {/* Optional Weight Records */}
            <section className="pv-card" id="sec-weight-records">
              <header className="pv-card-header">
                <div className="pv-card-title-group">
                  <span className="pv-card-icon" aria-hidden="true">
                    <AppIcon name="scale" size={18} />
                  </span>
                  <div>
                    <h2 className="pv-card-title">{t.pv_sec_weight}</h2>
                    <p className="pv-card-subtitle">{t.pv_sec_weight_sub}</p>
                  </div>
                </div>
                <div className="pv-card-header-actions">
                  <div className="pv-unit-toggle" role="group" aria-label="Weight unit selector">
                    <button
                      type="button"
                      id="btn-wt-unit-kg"
                      className={`pv-unit-btn${weightUnit === 'kg' ? ' pv-unit-btn--active' : ''}`}
                      onClick={() => handleToggleWeightUnit('kg')}
                    >
                      kg
                    </button>
                    <button
                      type="button"
                      id="btn-wt-unit-lbs"
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
                    <span>{t.pv_btn_add_weight}</span>
                  </button>
                </div>
              </header>

              <div className="pv-disclaimer" id="pv-weight-disclaimer">
                <AppIcon name="alert-triangle" size={18} />
                <span>{t.pv_weight_disclaimer}</span>
              </div>

              {latestWeight ? (
                <div className="pv-measurement-box" id="pv-weight-latest">
                  <span className="pv-measurement-val">
                    {weightUnit === 'lbs' ? kgToLbs(latestWeight.valueKg) : latestWeight.valueKg}
                  </span>
                  <span className="pv-measurement-unit">{weightUnit}</span>
                </div>
              ) : null}

              {weightRecords.length === 0 ? (
                <div className="pv-empty-state" id="pv-weight-empty">
                  <span className="pv-empty-icon" aria-hidden="true">⚖️</span>
                  <h3 className="pv-empty-title">{t.pv_empty_weight_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_weight_text}</p>
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
                            id={`btn-del-weight-${w.id}`}
                            className="pv-icon-btn"
                            aria-label={`Delete weight record ${displayVal} ${weightUnit}`}
                            onClick={() => handleDeleteWeight(w.id)}
                          >
                            <AppIcon name="trash-2" size={16} />
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
                  <div>
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
                  <span>{t.pv_btn_add_glucose}</span>
                </button>
              </header>

              <div className="pv-disclaimer" id="pv-glucose-disclaimer">
                <AppIcon name="alert-triangle" size={18} />
                <span>{t.pv_glucose_disclaimer}</span>
              </div>

              {glucoseRecords.length === 0 ? (
                <div className="pv-empty-state" id="pv-glucose-empty">
                  <span className="pv-empty-icon" aria-hidden="true">🩸</span>
                  <h3 className="pv-empty-title">{t.pv_empty_glucose_title}</h3>
                  <p className="pv-empty-text">{t.pv_empty_glucose_text}</p>
                </div>
              ) : (
                <ul className="pv-list" id="pv-glucose-list">
                  {glucoseRecords.map((g) => (
                    <li key={g.id} className="pv-item" id={`pv-glucose-item-${g.id}`}>
                      <div className="pv-item-main">
                        <div className="pv-item-header">
                          <span className="pv-category-pill pv-category-pill--energy">
                            {g.valueMgDl} mg/dL ({getGlucoseTypeLabel(g.readingType)})
                          </span>
                          <span className="pv-item-date">{g.dateKey}</span>
                        </div>
                        {g.notes && <p className="pv-item-desc">{g.notes}</p>}
                      </div>
                      <div className="pv-item-actions">
                        <button
                          type="button"
                          id={`btn-del-glucose-${g.id}`}
                          className="pv-icon-btn"
                          aria-label={`Delete glucose record ${g.valueMgDl} mg/dL`}
                          onClick={() => handleDeleteGlucose(g.id)}
                        >
                          <AppIcon name="trash-2" size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {/* ── Suggested Tracking Rhythm Guide ── */}
        <section className="pv-card" id="pv-rhythm-guide">
          <header className="pv-card-header">
            <div className="pv-card-title-group">
              <span className="pv-card-icon" aria-hidden="true">
                <AppIcon name="clock" size={18} />
              </span>
              <div>
                <h2 className="pv-card-title">{t.pv_sec_rhythm_guide}</h2>
              </div>
            </div>
          </header>
          <ul className="pv-list" style={{ gap: '8px' }}>
            <li className="pv-item" style={{ padding: '10px 14px' }}>
              <span style={{ color: '#5eead4', fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: '0.84rem' }}>{t.pv_rhythm_daily}</span>
            </li>
            <li className="pv-item" style={{ padding: '10px 14px' }}>
              <span style={{ color: '#5eead4', fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: '0.84rem' }}>{t.pv_rhythm_weekly}</span>
            </li>
            <li className="pv-item" style={{ padding: '10px 14px' }}>
              <span style={{ color: '#5eead4', fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: '0.84rem' }}>{t.pv_rhythm_biweekly}</span>
            </li>
            <li className="pv-item" style={{ padding: '10px 14px' }}>
              <span style={{ color: '#5eead4', fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: '0.84rem' }}>{t.pv_rhythm_milestone}</span>
            </li>
          </ul>
        </section>
      </main>

      {/* ── MODALS ── */}

      {/* 1. Add Victory Modal */}
      {activeModal === 'victory' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-victory-title"
          id="pv-modal-victory"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-victory-title">
                {t.pv_modal_add_victory_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitVictory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-victory-title">
                  {t.pv_field_title}
                </label>
                <input
                  id="inp-victory-title"
                  type="text"
                  className="pv-input"
                  placeholder="e.g. Belt down one notch, no 3pm energy slump..."
                  value={vTitle}
                  onChange={(e) => setVTitle(e.target.value)}
                  autoFocus
                />
              </div>

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

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-victory-desc">
                  {t.pv_field_desc}
                </label>
                <textarea
                  id="inp-victory-desc"
                  className="pv-textarea"
                  placeholder="Additional context or notes..."
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

      {/* 2. Add Waist Modal */}
      {activeModal === 'waist' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-waist-title"
          id="pv-modal-waist"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-waist-title">
                {t.pv_modal_add_waist_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitWaist} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-waist-val">
                  {t.pv_field_value} ({waistUnit})
                </label>
                <input
                  id="inp-waist-val"
                  type="number"
                  step="0.1"
                  className="pv-input"
                  placeholder={waistUnit === 'in' ? 'e.g. 33.5' : 'e.g. 85.0'}
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

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-waist-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-waist-notes"
                  type="text"
                  className="pv-input"
                  placeholder="e.g. Morning, fasted, relaxed posture..."
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

      {/* 3. Add Photo Modal */}
      {activeModal === 'photo' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-photo-title"
          id="pv-modal-photo"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-photo-title">
                {t.pv_sec_photos}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitPhoto} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="pv-photo-file-input">
                  Select Image File
                </label>
                <input
                  id="pv-photo-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="pv-input"
                  onChange={handlePhotoFileChange}
                />
              </div>

              {photoPreview && (
                <div style={{ maxHeight: '180px', overflow: 'hidden', borderRadius: '12px' }}>
                  <img
                    src={photoPreview}
                    alt="Selected preview"
                    style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                  />
                </div>
              )}

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-photo-tag">
                  Milestone Tag
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

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-photo-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-photo-notes"
                  type="text"
                  className="pv-input"
                  placeholder="Optional notes or milestone thoughts..."
                  value={photoNotes}
                  onChange={(e) => setPhotoNotes(e.target.value)}
                />
              </div>

              {photoError && <p className="pv-error-text">{photoError}</p>}

              <div className="pv-modal-actions">
                <button type="button" className="pv-btn-cancel" onClick={closeModal}>
                  {t.pv_btn_cancel}
                </button>
                <button type="submit" id="btn-save-photo" className="pv-btn-submit">
                  {t.pv_btn_save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Weight Modal */}
      {activeModal === 'weight' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-weight-title"
          id="pv-modal-weight"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-weight-title">
                {t.pv_modal_add_weight_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitWeight} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-weight-val">
                  {t.pv_field_value} ({weightUnit})
                </label>
                <input
                  id="inp-weight-val"
                  type="number"
                  step="0.1"
                  className="pv-input"
                  placeholder={weightUnit === 'lbs' ? 'e.g. 175.4' : 'e.g. 79.5'}
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

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-weight-notes">
                  {t.pv_field_notes}
                </label>
                <input
                  id="inp-weight-notes"
                  type="text"
                  className="pv-input"
                  placeholder="Optional context..."
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

      {/* 5. Add Glucose Modal */}
      {activeModal === 'glucose' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-glucose-title"
          id="pv-modal-glucose"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-glucose-title">
                {t.pv_modal_add_glucose_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitGlucose} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-glc-val">
                  {t.pv_field_value} (mg/dL)
                </label>
                <input
                  id="inp-glc-val"
                  type="number"
                  step="1"
                  className="pv-input"
                  placeholder="e.g. 95"
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
                  placeholder="Meal notes, observation..."
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

      {/* 6. Add Reflection Modal */}
      {activeModal === 'reflection' && (
        <div
          className="pv-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reflection-title"
          id="pv-modal-reflection"
        >
          <div className="pv-modal-card">
            <div className="pv-modal-header">
              <h3 className="pv-modal-title" id="modal-reflection-title">
                {t.pv_modal_add_reflection_title}
              </h3>
              <button
                type="button"
                className="pv-modal-close-btn"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitReflection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-victory">
                  {t.pv_field_biggest_victory}
                </label>
                <input
                  id="inp-ref-victory"
                  type="text"
                  className="pv-input"
                  placeholder="One win I am proud of..."
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
                  placeholder="Thoughts on consistency, appetite, energy..."
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
                  placeholder="e.g. Pause before snacking, 10-minute walk after lunch..."
                  value={refFocus}
                  onChange={(e) => setRefFocus(e.target.value)}
                />
              </div>

              <div className="pv-form-group">
                <label className="pv-label" htmlFor="inp-ref-date">
                  Week Start Date
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
    </div>
  );
}

export default ProgressVictoriesScreen;
