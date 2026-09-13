import { useState, useEffect, useMemo, useRef } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import { playFeedback } from '../utils/feedback';
import { getLocalDateKey } from '../utils/dietStorage';
import {
  ReviewQuestionId,
  DailyReviewAnswer,
  DailyReviewRecord,
  getDailyReview,
  saveDailyReview,
  resolveProfileForDate,
  isDateEligibleForReview,
  getRecentReviewDates,
} from '../utils/dailyReviewStorage';
import { recordScoreEvent } from '../utils/scoringEngine';
import './DailyReviewScreen.css';

interface DailyReviewScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  initialDateKey?: string;
}

export default function DailyReviewScreen({
  onNavigate,
  onBack,
  initialDateKey,
}: DailyReviewScreenProps) {
  const { t } = useTranslation();
  const todayKey = useMemo(() => getLocalDateKey(), []);

  const getStr = (key: string, fallback = ''): string => {
    const val = (t as unknown as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : fallback || key;
  };

  // Selected date state (defaults intelligently to today)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => initialDateKey || todayKey);

  // Profile associated with selected date
  const associatedProfile = useMemo(() => {
    return resolveProfileForDate(selectedDateKey);
  }, [selectedDateKey]);

  // Is date eligible?
  const isEligible = useMemo(() => {
    return isDateEligibleForReview(selectedDateKey);
  }, [selectedDateKey]);

  // Review record in state
  const [review, setReview] = useState<DailyReviewRecord | null>(() => {
    return getDailyReview(selectedDateKey, associatedProfile.profileId);
  });

  // Is in summary view (if review exists and is completed and not currently editing)
  const [isEditing, setIsEditing] = useState<boolean>(() => {
    const existing = getDailyReview(selectedDateKey, associatedProfile.profileId);
    return !existing || !existing.completed;
  });

  // Track expanded note textareas
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Autosave feedback toast
  const [autosaveNotice, setAutosaveNotice] = useState<boolean>(false);
  const autosaveTimerRef = useRef<number | null>(null);

  // When selectedDateKey changes, load or reset review
  useEffect(() => {
    const loaded = getDailyReview(selectedDateKey, associatedProfile.profileId);
    setReview(loaded);
    setIsEditing(!loaded || !loaded.completed);
    setExpandedNotes({});
  }, [selectedDateKey, associatedProfile.profileId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Recent 7 dates for quick selector
  const recentDates = useMemo(() => {
    return getRecentReviewDates(7);
  }, [selectedDateKey, review?.completed]);

  // Handle answering a single-choice question
  const handleAnswerOption = (questionId: ReviewQuestionId, value: string) => {
    const currentAnswer = review?.answers[questionId];
    const nextAnswer: DailyReviewAnswer = {
      questionId,
      value,
      note: currentAnswer?.note,
      selectedOptions: currentAnswer?.selectedOptions,
    };

    const nextAnswers = {
      ...(review?.answers || {}),
      [questionId]: nextAnswer,
    };

    const saved = saveDailyReview({
      dateKey: selectedDateKey,
      profileId: associatedProfile.profileId,
      profileName: associatedProfile.profileName,
      answers: nextAnswers,
      completed: review?.completed || false,
    });

    setReview(saved);
    playFeedback('neutral');
    triggerAutosaveIndicator();
  };

  // Handle multi-select trigger chips (Q8)
  const handleToggleTrigger = (triggerKey: string) => {
    const currentAnswer = review?.answers['q8_triggers'];
    let nextTriggers: string[] = currentAnswer?.selectedOptions ? [...currentAnswer.selectedOptions] : [];

    if (triggerKey === 'none') {
      nextTriggers = nextTriggers.includes('none') ? [] : ['none'];
    } else {
      nextTriggers = nextTriggers.filter(k => k !== 'none');
      if (nextTriggers.includes(triggerKey)) {
        nextTriggers = nextTriggers.filter(k => k !== triggerKey);
      } else {
        nextTriggers.push(triggerKey);
      }
    }

    const nextAnswer: DailyReviewAnswer = {
      questionId: 'q8_triggers',
      value: nextTriggers.join(','),
      selectedOptions: nextTriggers,
      note: currentAnswer?.note,
    };

    const nextAnswers = {
      ...(review?.answers || {}),
      q8_triggers: nextAnswer,
    };

    const saved = saveDailyReview({
      dateKey: selectedDateKey,
      profileId: associatedProfile.profileId,
      profileName: associatedProfile.profileName,
      answers: nextAnswers,
      completed: review?.completed || false,
    });

    setReview(saved);
    playFeedback('neutral');
    triggerAutosaveIndicator();
  };

  // Handle updating an optional note
  const handleUpdateNote = (questionId: ReviewQuestionId, noteText: string) => {
    const currentAnswer = review?.answers[questionId];
    const nextAnswer: DailyReviewAnswer = {
      questionId,
      value: currentAnswer?.value || '',
      selectedOptions: currentAnswer?.selectedOptions,
      note: noteText,
    };

    const nextAnswers = {
      ...(review?.answers || {}),
      [questionId]: nextAnswer,
    };

    const saved = saveDailyReview({
      dateKey: selectedDateKey,
      profileId: associatedProfile.profileId,
      profileName: associatedProfile.profileName,
      answers: nextAnswers,
      completed: review?.completed || false,
    });

    setReview(saved);
    triggerAutosaveIndicator();
  };

  const triggerAutosaveIndicator = () => {
    setAutosaveNotice(true);
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      setAutosaveNotice(false);
    }, 1800);
  };

  // Save & Finish
  const handleSaveAndFinish = () => {
    const saved = saveDailyReview({
      dateKey: selectedDateKey,
      profileId: associatedProfile.profileId,
      profileName: associatedProfile.profileName,
      answers: review?.answers || {},
      completed: true,
    });
    setReview(saved);
    recordScoreEvent({
      activityType: 'DAILY_REVIEW_COMPLETE',
      dateKey: selectedDateKey,
      sourceId: `daily_review_${selectedDateKey}`,
      profileId: associatedProfile.profileId,
      profileName: associatedProfile.profileName,
    });
    setIsEditing(false);
    playFeedback('win');
  };

  const handleHeaderBack = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('structured-diet');
    }
  };

  // Format date display (e.g. "Monday, September 13, 2026")
  const formattedDateTitle = useMemo(() => {
    try {
      const [year, month, day] = selectedDateKey.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return selectedDateKey;
    }
  }, [selectedDateKey]);

  return (
    <div className="screen dr-screen">
      <div className="dr-inner">
        <ScreenHeader
          onBack={handleHeaderBack}
          onHome={() => onNavigate('home')}
        />

        <div className="dr-content">
          {/* Header block */}
          <div className="dr-heading-block">
            <span className="section-label">SUPER DIET-ABILITY</span>
            <h1 className="dr-heading">{t.dr_screen_title}</h1>
            <p className="dr-sub">{t.dr_screen_subtitle}</p>
          </div>

          {/* Date Selector Row */}
          <div className="dr-date-selector-card" id="dr-date-selector-card">
            <div className="dr-date-selector-top">
              <span className="dr-date-label">📅 {t.dr_date_label}</span>
              <div className="dr-custom-date-wrap">
                <input
                  id="dr-date-picker"
                  type="date"
                  className="dr-date-input"
                  value={selectedDateKey}
                  onChange={e => {
                    if (e.target.value) {
                      setSelectedDateKey(e.target.value);
                    }
                  }}
                  title={t.dr_select_date_picker}
                  aria-label={t.dr_select_date_picker}
                />
              </div>
            </div>

            {/* Quick 7-day pill carousel */}
            <div className="dr-recent-pills" role="tablist" aria-label="Recent Dates">
              {recentDates.map(item => {
                const isSelected = item.dateKey === selectedDateKey;
                const d = new Date(item.dateKey + 'T00:00:00');
                const dayLetter = d.toLocaleDateString(undefined, { weekday: 'narrow' });
                const dayNumber = d.getDate();

                return (
                  <button
                    key={item.dateKey}
                    id={`btn-dr-date-${item.dateKey}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    className={`dr-date-pill ${isSelected ? 'dr-date-pill--selected' : ''} ${item.isToday ? 'dr-date-pill--today' : ''}`}
                    onClick={() => setSelectedDateKey(item.dateKey)}
                  >
                    <span className="dr-pill-day">{item.isToday ? 'Today' : dayLetter}</span>
                    <span className="dr-pill-num">{dayNumber}</span>
                    {item.hasReview && <span className="dr-pill-badge" title="Completed">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Associated Goal Profile Card */}
          <div className="dr-profile-banner" id="dr-profile-banner">
            <div className="dr-profile-info">
              <span className="dr-profile-icon">🎯</span>
              <div className="dr-profile-text">
                <span className="dr-profile-label">{t.dr_associated_goal}</span>
                <span className="dr-profile-name">{associatedProfile.profileName}</span>
              </div>
            </div>
            <div className="dr-date-badge-right">
              <span className="dr-date-badge-text">{formattedDateTitle}</span>
            </div>
          </div>

          {/* If date has no diet schedule configured */}
          {!isEligible ? (
            <div className="dr-warning-card" id="dr-no-diet-warning">
              <div className="dr-warning-icon">ℹ️</div>
              <h3 className="dr-warning-title">{t.dr_no_diet_warning_title}</h3>
              <p className="dr-warning-desc">{t.dr_no_diet_warning_desc}</p>
              <button
                id="btn-dr-back-today"
                type="button"
                className="dr-btn dr-btn--secondary"
                onClick={() => setSelectedDateKey(todayKey)}
              >
                ← Return to Today
              </button>
            </div>
          ) : !isEditing && review?.completed ? (
            /* ── Summary Card View ── */
            <div className="dr-summary-card" id="dr-summary-card">
              <div className="dr-summary-header">
                <div className="dr-summary-badge-wrap">
                  <span className="dr-summary-icon">✨</span>
                  <span className="dr-summary-badge">{t.dr_summary_completed_badge}</span>
                </div>
                <span className="dr-summary-date">{formattedDateTitle}</span>
              </div>

              <h2 className="dr-summary-title">{t.dr_summary_title}</h2>
              <p className="dr-summary-sub">{t.dr_summary_subtitle}</p>

              <div className="dr-summary-grid">
                {/* Q10 Dominant Pattern */}
                <div className="dr-summary-tile">
                  <span className="dr-tile-label">Pattern Dominance</span>
                  <span className="dr-tile-value">
                    {review.answers.q10_dominant_pattern?.value
                      ? getStr(`dr_q10_opt_${review.answers.q10_dominant_pattern.value}`, review.answers.q10_dominant_pattern.value)
                      : 'Not reported'}
                  </span>
                </div>

                {/* Q9 Goal Alignment */}
                <div className="dr-summary-tile">
                  <span className="dr-tile-label">Goal Alignment</span>
                  <span className="dr-tile-value">
                    {review.answers.q9_supported_goal?.value
                      ? getStr(`dr_q9_opt_${review.answers.q9_supported_goal.value}`, review.answers.q9_supported_goal.value)
                      : 'Not reported'}
                  </span>
                </div>

                {/* Q1 Planned Opportunities */}
                <div className="dr-summary-tile">
                  <span className="dr-tile-label">Planned Opportunities</span>
                  <span className="dr-tile-value">
                    {review.answers.q1_planned_eating?.value
                      ? getStr(`dr_q1_opt_${review.answers.q1_planned_eating.value}`, review.answers.q1_planned_eating.value)
                      : 'Not reported'}
                  </span>
                </div>

                {/* Q6 Eating Boundary */}
                <div className="dr-summary-tile">
                  <span className="dr-tile-label">Eating Boundary</span>
                  <span className="dr-tile-value">
                    {review.answers.q6_stopped_at_boundary?.value
                      ? getStr(`dr_q6_opt_${review.answers.q6_stopped_at_boundary.value}`, review.answers.q6_stopped_at_boundary.value)
                      : 'Not reported'}
                  </span>
                </div>
              </div>

              {/* Triggers Tag Section if any */}
              {review.answers.q8_triggers?.selectedOptions && review.answers.q8_triggers.selectedOptions.length > 0 && (
                <div className="dr-summary-triggers-wrap">
                  <span className="dr-summary-triggers-label">Triggers Identified:</span>
                  <div className="dr-summary-trigger-tags">
                    {review.answers.q8_triggers.selectedOptions.map(k => (
                      <span key={k} className="dr-trigger-tag">
                        {getStr(`dr_trigger_${k}`, k)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="dr-summary-actions">
                <button
                  id="btn-dr-edit-review"
                  type="button"
                  className="dr-btn dr-btn--secondary"
                  onClick={() => setIsEditing(true)}
                >
                  ✎ {t.dr_edit_review_btn}
                </button>
                <button
                  id="btn-dr-done"
                  type="button"
                  className="dr-btn dr-btn--primary"
                  onClick={handleHeaderBack}
                >
                  ✓ {t.dr_done_back_btn}
                </button>
              </div>
            </div>
          ) : (
            /* ── Review Form (10 Questions) ── */
            <div className="dr-form" id="dr-review-form">
              {autosaveNotice && (
                <div className="dr-autosave-toast" role="status">
                  ✓ {t.dr_autosaved}
                </div>
              )}

              {/* Q1: Planned Eating */}
              <div className="dr-question-card" id="dr-q1-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">1</span>
                  <h3 className="dr-q-text">{t.dr_q1_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['all', 'most', 'partly', 'none'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q1-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q1_planned_eating?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q1_planned_eating', opt)}
                    >
                      {getStr(`dr_q1_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q1_planned_eating"
                  note={review?.answers.q1_planned_eating?.note}
                  isExpanded={Boolean(expandedNotes.q1_planned_eating || review?.answers.q1_planned_eating?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q1_planned_eating: !prev.q1_planned_eating }))}
                  onSave={val => handleUpdateNote('q1_planned_eating', val)}
                  t={t}
                />
              </div>

              {/* Q2: Distinguish Structure */}
              <div className="dr-question-card" id="dr-q2-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">2</span>
                  <h3 className="dr-q-text">{t.dr_q2_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['yes', 'partly', 'no'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q2-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q2_distinguish_structure?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q2_distinguish_structure', opt)}
                    >
                      {getStr(`dr_q2_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q2_distinguish_structure"
                  note={review?.answers.q2_distinguish_structure?.note}
                  isExpanded={Boolean(expandedNotes.q2_distinguish_structure || review?.answers.q2_distinguish_structure?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q2_distinguish_structure: !prev.q2_distinguish_structure }))}
                  onSave={val => handleUpdateNote('q2_distinguish_structure', val)}
                  t={t}
                />
              </div>

              {/* Q3: Flexible Planned vs Reactive */}
              <div className="dr-question-card" id="dr-q3-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">3</span>
                  <h3 className="dr-q-text">{t.dr_q3_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['planned', 'mostly', 'reactive', 'no_flexible'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q3-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q3_flexible_planned_reactive?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q3_flexible_planned_reactive', opt)}
                    >
                      {getStr(`dr_q3_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q3_flexible_planned_reactive"
                  note={review?.answers.q3_flexible_planned_reactive?.note}
                  isExpanded={Boolean(expandedNotes.q3_flexible_planned_reactive || review?.answers.q3_flexible_planned_reactive?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q3_flexible_planned_reactive: !prev.q3_flexible_planned_reactive }))}
                  onSave={val => handleUpdateNote('q3_flexible_planned_reactive', val)}
                  t={t}
                />
              </div>

              {/* Q4: Preserve Non-Eating Periods */}
              <div className="dr-question-card" id="dr-q4-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">4</span>
                  <h3 className="dr-q-text">{t.dr_q4_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['yes', 'minor', 'frequent'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q4-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q4_preserve_non_eating?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q4_preserve_non_eating', opt)}
                    >
                      {getStr(`dr_q4_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q4_preserve_non_eating"
                  note={review?.answers.q4_preserve_non_eating?.note}
                  isExpanded={Boolean(expandedNotes.q4_preserve_non_eating || review?.answers.q4_preserve_non_eating?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q4_preserve_non_eating: !prev.q4_preserve_non_eating }))}
                  onSave={val => handleUpdateNote('q4_preserve_non_eating', val)}
                  t={t}
                />
              </div>

              {/* Q5: Flexibility Replaced or Added */}
              <div className="dr-question-card" id="dr-q5-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">5</span>
                  <h3 className="dr-q-text">{t.dr_q5_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['replaced', 'added', 'both', 'none'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q5-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q5_flexibility_replaced_added?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q5_flexibility_replaced_added', opt)}
                    >
                      {getStr(`dr_q5_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q5_flexibility_replaced_added"
                  note={review?.answers.q5_flexibility_replaced_added?.note}
                  isExpanded={Boolean(expandedNotes.q5_flexibility_replaced_added || review?.answers.q5_flexibility_replaced_added?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q5_flexibility_replaced_added: !prev.q5_flexibility_replaced_added }))}
                  onSave={val => handleUpdateNote('q5_flexibility_replaced_added', val)}
                  t={t}
                />
              </div>

              {/* Q6: Stopped at Boundary */}
              <div className="dr-question-card" id="dr-q6-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">6</span>
                  <h3 className="dr-q-text">{t.dr_q6_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['yes', 'delayed', 'no'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q6-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q6_stopped_at_boundary?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q6_stopped_at_boundary', opt)}
                    >
                      {getStr(`dr_q6_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q6_stopped_at_boundary"
                  note={review?.answers.q6_stopped_at_boundary?.note}
                  isExpanded={Boolean(expandedNotes.q6_stopped_at_boundary || review?.answers.q6_stopped_at_boundary?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q6_stopped_at_boundary: !prev.q6_stopped_at_boundary }))}
                  onSave={val => handleUpdateNote('q6_stopped_at_boundary', val)}
                  t={t}
                />
              </div>

              {/* Q7: Slip Recognition & Resume Speed */}
              <div className="dr-question-card" id="dr-q7-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">7</span>
                  <h3 className="dr-q-text">{t.dr_q7_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['immediate', 'next_block', 'next_day', 'no_slip'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q7-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q7_slip_recognition_resumed?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q7_slip_recognition_resumed', opt)}
                    >
                      {getStr(`dr_q7_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q7_slip_recognition_resumed"
                  note={review?.answers.q7_slip_recognition_resumed?.note}
                  isExpanded={Boolean(expandedNotes.q7_slip_recognition_resumed || review?.answers.q7_slip_recognition_resumed?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q7_slip_recognition_resumed: !prev.q7_slip_recognition_resumed }))}
                  onSave={val => handleUpdateNote('q7_slip_recognition_resumed', val)}
                  t={t}
                />
              </div>

              {/* Q8: Triggers Multi-Select */}
              <div className="dr-question-card" id="dr-q8-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">8</span>
                  <h3 className="dr-q-text">{t.dr_q8_text}</h3>
                </div>
                <div className="dr-chips-group">
                  {(['stress', 'social', 'visual', 'boredom', 'hunger', 'fatigue', 'celebration', 'none'] as const).map(triggerKey => {
                    const isSelected = review?.answers.q8_triggers?.selectedOptions?.includes(triggerKey);
                    return (
                      <button
                        key={triggerKey}
                        id={`btn-trigger-${triggerKey}`}
                        type="button"
                        className={`dr-chip-btn ${isSelected ? 'dr-chip-btn--active' : ''}`}
                        onClick={() => handleToggleTrigger(triggerKey)}
                      >
                        {isSelected ? '✓ ' : ''}{getStr(`dr_trigger_${triggerKey}`)}
                      </button>
                    );
                  })}
                </div>
                <NoteSection
                  questionId="q8_triggers"
                  note={review?.answers.q8_triggers?.note}
                  isExpanded={Boolean(expandedNotes.q8_triggers || review?.answers.q8_triggers?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q8_triggers: !prev.q8_triggers }))}
                  onSave={val => handleUpdateNote('q8_triggers', val)}
                  t={t}
                />
              </div>

              {/* Q9: Choices Supported Goal */}
              <div className="dr-question-card" id="dr-q9-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">9</span>
                  <h3 className="dr-q-text">{t.dr_q9_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['yes', 'partly', 'no'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q9-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q9_supported_goal?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q9_supported_goal', opt)}
                    >
                      {getStr(`dr_q9_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q9_supported_goal"
                  note={review?.answers.q9_supported_goal?.note}
                  isExpanded={Boolean(expandedNotes.q9_supported_goal || review?.answers.q9_supported_goal?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q9_supported_goal: !prev.q9_supported_goal }))}
                  onSave={val => handleUpdateNote('q9_supported_goal', val)}
                  t={t}
                />
              </div>

              {/* Q10: Dominant Pattern */}
              <div className="dr-question-card" id="dr-q10-card">
                <div className="dr-q-header">
                  <span className="dr-q-num">10</span>
                  <h3 className="dr-q-text">{t.dr_q10_text}</h3>
                </div>
                <div className="dr-options-group">
                  {(['dominant', 'recovering', 'at_risk', 'lost'] as const).map(opt => (
                    <button
                      key={opt}
                      id={`btn-q10-${opt}`}
                      type="button"
                      className={`dr-option-btn ${review?.answers.q10_dominant_pattern?.value === opt ? 'dr-option-btn--active' : ''}`}
                      onClick={() => handleAnswerOption('q10_dominant_pattern', opt)}
                    >
                      {getStr(`dr_q10_opt_${opt}`)}
                    </button>
                  ))}
                </div>
                <NoteSection
                  questionId="q10_dominant_pattern"
                  note={review?.answers.q10_dominant_pattern?.note}
                  isExpanded={Boolean(expandedNotes.q10_dominant_pattern || review?.answers.q10_dominant_pattern?.note)}
                  onToggle={() => setExpandedNotes(prev => ({ ...prev, q10_dominant_pattern: !prev.q10_dominant_pattern }))}
                  onSave={val => handleUpdateNote('q10_dominant_pattern', val)}
                  t={t}
                />
              </div>

              {/* Save & Finish Button */}
              <div className="dr-submit-row">
                <button
                  id="btn-dr-save-finish"
                  type="button"
                  className="dr-btn dr-btn--primary dr-btn--full"
                  onClick={handleSaveAndFinish}
                >
                  ✨ {t.dr_save_finish_btn}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Collapsible Note Section Helper ───────────────────────────────────────────

interface NoteSectionProps {
  questionId: string;
  note?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onSave: (val: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

function NoteSection({
  questionId,
  note = '',
  isExpanded,
  onToggle,
  onSave,
  t,
}: NoteSectionProps) {
  const [text, setText] = useState(note);

  useEffect(() => {
    setText(note);
  }, [note]);

  return (
    <div className="dr-note-wrap">
      {!isExpanded ? (
        <button
          id={`btn-add-note-${questionId}`}
          type="button"
          className="dr-note-toggle-btn"
          onClick={onToggle}
        >
          {t.dr_add_note_btn}
        </button>
      ) : (
        <div className="dr-note-input-wrap">
          <label htmlFor={`note-input-${questionId}`} className="dr-note-label">
            {t.dr_optional_note_label}:
          </label>
          <textarea
            id={`note-input-${questionId}`}
            className="dr-note-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => onSave(text.trim())}
            placeholder={t.dr_optional_note_placeholder}
            rows={2}
            maxLength={300}
          />
        </div>
      )}
    </div>
  );
}
