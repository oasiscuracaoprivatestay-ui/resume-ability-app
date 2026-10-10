import React, { useState, useEffect, useCallback, useId } from 'react';
import { useTranslation } from '../i18n';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_INTENSITIES,
  type ActivityCategory,
  type ActivityIntensity,
  type ActivityRecord,
  createActivity,
  updateActivity,
  formatCurrentLocalTime,
} from '../activities';
import { getLocalDateKey } from '../utils/dietStorage';
import { getActiveChallenge } from '../challenges/challengeStorage';
import { playFeedback } from '../utils/feedback';
import { AppIcon, type AppIconName } from './icons/AppIcon';
import './ActivityModal.css';

export interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (activity: ActivityRecord) => void;
  activityToEdit?: ActivityRecord | null;
  defaultDateKey?: string;
}

const CATEGORY_APP_ICONS: Record<ActivityCategory, AppIconName> = {
  walking: 'walking',
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  strength_training: 'dumbbell',
  mobility_yoga: 'yoga',
  sports: 'trophy',
  other_movement: 'sparkles',
};

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  activityToEdit,
  defaultDateKey,
}) => {
  const { t } = useTranslation();
  const titleId = useId();

  // Form State
  const [category, setCategory] = useState<ActivityCategory>('walking');
  const [durationMinutes, setDurationMinutes] = useState<string>('30');
  const [customName, setCustomName] = useState<string>('');
  const [intensity, setIntensity] = useState<ActivityIntensity | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [dateKey, setDateKey] = useState<string>(() => defaultDateKey || getLocalDateKey());
  const [time, setTime] = useState<string>(() => formatCurrentLocalTime());
  const [linkChallenge, setLinkChallenge] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active challenge check
  const activeChallenge = getActiveChallenge();

  // Sync form state when modal opens or editing record changes
  useEffect(() => {
    if (!isOpen) return;

    if (activityToEdit) {
      setCategory(activityToEdit.category);
      setDurationMinutes(String(activityToEdit.durationMinutes));
      setCustomName(activityToEdit.customName || '');
      setIntensity(activityToEdit.intensity || '');
      setNotes(activityToEdit.notes || '');
      setDateKey(activityToEdit.dateKey);
      setTime(activityToEdit.time);
      setLinkChallenge(Boolean(activityToEdit.associatedChallengeId));
    } else {
      // New activity defaults
      setCategory('walking');
      setDurationMinutes('30');
      setCustomName('');
      setIntensity('');
      setNotes('');
      setDateKey(defaultDateKey || getLocalDateKey());
      setTime(formatCurrentLocalTime());
      // Challenge linking MUST default to OFF
      setLinkChallenge(false);
    }
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [isOpen, activityToEdit, defaultDateKey]);

  // Focus restoration & body scroll lock
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('sda-modal-open');
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.classList.remove('sda-modal-open');
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCategorySelect = (cat: ActivityCategory) => {
    setCategory(cat);
    setErrorMessage(null);
  };

  const handleIntensityToggle = (val: ActivityIntensity) => {
    setIntensity((prev) => (prev === val ? '' : val));
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage(null);

      // Validate duration
      const parsedDuration = parseInt(durationMinutes, 10);
      if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > 720) {
        setErrorMessage(t.act_field_duration + ': 1–720');
        return;
      }

      // Validate custom name length
      if (customName.trim().length > 50) {
        setErrorMessage(t.act_field_custom_name + ': max 50 chars');
        return;
      }

      // Validate notes length
      if (notes.trim().length > 300) {
        setErrorMessage(t.act_field_notes + ': max 300 chars');
        return;
      }

      setIsSubmitting(true);

      // Determine challenge ID
      let associatedChallengeId: string | null | undefined;
      if (linkChallenge) {
        if (activeChallenge && activeChallenge.status === 'active') {
          associatedChallengeId = activeChallenge.id;
        } else if (activityToEdit?.associatedChallengeId) {
          // Preserve existing historical association
          associatedChallengeId = activityToEdit.associatedChallengeId;
        } else {
          associatedChallengeId = undefined;
        }
      } else {
        // Explicitly unlinked
        associatedChallengeId = activityToEdit?.associatedChallengeId ? null : undefined;
      }

      try {
        if (activityToEdit) {
          // Update existing
          const result = updateActivity(activityToEdit.id, {
            category,
            durationMinutes: parsedDuration,
            customName: customName.trim() ? customName.trim() : null,
            intensity: intensity || null,
            notes: notes.trim() ? notes.trim() : null,
            dateKey,
            time,
            associatedChallengeId,
          });

          if (!result.success || !result.data) {
            setErrorMessage(result.error || 'Failed to update activity.');
            setIsSubmitting(false);
            return;
          }

          playFeedback('neutral');
          onSaved(result.data);
          onClose();
        } else {
          // Create new
          const result = createActivity({
            category,
            durationMinutes: parsedDuration,
            customName: customName.trim() ? customName.trim() : undefined,
            intensity: intensity || undefined,
            notes: notes.trim() ? notes.trim() : undefined,
            dateKey,
            time,
            associatedChallengeId: associatedChallengeId || undefined,
          });

          if (!result.success || !result.data) {
            setErrorMessage(result.error || 'Failed to record activity.');
            setIsSubmitting(false);
            return;
          }

          playFeedback('neutral');
          onSaved(result.data);
          onClose();
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
        setIsSubmitting(false);
      }
    },
    [
      activityToEdit,
      category,
      durationMinutes,
      customName,
      intensity,
      notes,
      dateKey,
      time,
      linkChallenge,
      activeChallenge,
      onSaved,
      onClose,
      t,
    ]
  );

  if (!isOpen) return null;

  const isEditing = Boolean(activityToEdit);

  return (
    <div
      className="activity-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="activity-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="activity-modal-header">
          <h2 id={titleId} className="activity-modal-title">
            {isEditing ? t.act_modal_title_edit : t.act_modal_title_new}
          </h2>
          <button
            type="button"
            className="activity-modal-close-btn"
            onClick={onClose}
            aria-label={t.act_btn_cancel}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="activity-modal-form" noValidate>
          {/* Category Picker */}
          <div className="activity-form-group">
            <label className="activity-form-label">{t.act_field_category}</label>
            <div className="activity-category-grid" role="radiogroup" aria-label={t.act_field_category}>
              {ACTIVITY_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                const catLabelKey = `act_cat_${cat}` as keyof typeof t;
                const label = (t[catLabelKey] as string) || cat;

                return (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    id={`btn-cat-${cat}`}
                    className={`activity-category-card ${isSelected ? 'activity-category-card--active' : ''}`}
                    onClick={() => handleCategorySelect(cat)}
                  >
                    <span className="activity-category-icon" aria-hidden="true">
                      <AppIcon name={CATEGORY_APP_ICONS[cat]} size={22} />
                    </span>
                    <span className="activity-category-name">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration & Custom Name Row */}
          <div className="activity-form-row">
            <div className="activity-form-group activity-form-group--half">
              <label htmlFor="input-activity-duration" className="activity-form-label">
                {t.act_field_duration} *
              </label>
              <input
                id="input-activity-duration"
                type="number"
                min="1"
                max="720"
                step="1"
                required
                className="activity-input"
                placeholder={t.act_field_duration_placeholder}
                value={durationMinutes}
                onChange={(e) => {
                  setDurationMinutes(e.target.value);
                  setErrorMessage(null);
                }}
              />
            </div>

            <div className="activity-form-group activity-form-group--half">
              <label htmlFor="input-activity-name" className="activity-form-label">
                {t.act_field_custom_name}
              </label>
              <input
                id="input-activity-name"
                type="text"
                maxLength={50}
                className="activity-input"
                placeholder={t.act_field_custom_name_placeholder}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="activity-form-row">
            <div className="activity-form-group activity-form-group--half">
              <label htmlFor="input-activity-date" className="activity-form-label">
                {t.act_field_date} *
              </label>
              <input
                id="input-activity-date"
                type="date"
                required
                className="activity-input"
                value={dateKey}
                onChange={(e) => {
                  setDateKey(e.target.value);
                  setErrorMessage(null);
                }}
              />
            </div>

            <div className="activity-form-group activity-form-group--half">
              <label htmlFor="input-activity-time" className="activity-form-label">
                {t.act_field_time} *
              </label>
              <input
                id="input-activity-time"
                type="time"
                required
                className="activity-input"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setErrorMessage(null);
                }}
              />
            </div>
          </div>

          {/* Intensity Segmented Controls */}
          <div className="activity-form-group">
            <label className="activity-form-label">{t.act_field_intensity}</label>
            <div className="activity-intensity-group" role="group">
              {ACTIVITY_INTENSITIES.map((lvl) => {
                const isSelected = intensity === lvl;
                const labelKey = `act_int_${lvl}` as keyof typeof t;
                const label = (t[labelKey] as string) || lvl;

                return (
                  <button
                    key={lvl}
                    type="button"
                    id={`btn-intensity-${lvl}`}
                    className={`activity-intensity-btn ${isSelected ? 'activity-intensity-btn--active' : ''}`}
                    onClick={() => handleIntensityToggle(lvl)}
                    aria-pressed={isSelected}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Notes */}
          <div className="activity-form-group">
            <label htmlFor="textarea-activity-notes" className="activity-form-label">
              {t.act_field_notes}
            </label>
            <textarea
              id="textarea-activity-notes"
              rows={2}
              maxLength={300}
              className="activity-textarea"
              placeholder={t.act_field_notes_placeholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="activity-char-count">{notes.length}/300</span>
          </div>

          {/* Optional Challenge Linking */}
          <div className="activity-form-group activity-challenge-linking-card">
            {activeChallenge && activeChallenge.status === 'active' ? (
              <label className="activity-challenge-checkbox-label" htmlFor="toggle-link-challenge">
                <input
                  id="toggle-link-challenge"
                  type="checkbox"
                  className="activity-checkbox"
                  checked={linkChallenge}
                  onChange={(e) => setLinkChallenge(e.target.checked)}
                />
                <div className="activity-challenge-label-text">
                  <span className="activity-challenge-title">{t.act_link_challenge}</span>
                  <span className="activity-challenge-sub">
                    {t.act_link_challenge_active.replace('{name}', `${activeChallenge.abilityId} (${activeChallenge.durationDays}d)`)}
                  </span>
                </div>
              </label>
            ) : isEditing && activityToEdit?.associatedChallengeId ? (
              <label className="activity-challenge-checkbox-label" htmlFor="toggle-link-challenge">
                <input
                  id="toggle-link-challenge"
                  type="checkbox"
                  className="activity-checkbox"
                  checked={linkChallenge}
                  onChange={(e) => setLinkChallenge(e.target.checked)}
                />
                <div className="activity-challenge-label-text">
                  <span className="activity-challenge-title">{t.act_link_challenge}</span>
                  <span className="activity-challenge-sub">{t.act_linked_historical_challenge}</span>
                </div>
              </label>
            ) : (
              <div className="activity-no-challenge-notice">
                <span className="activity-no-challenge-icon">⚡</span>
                <span className="activity-no-challenge-text">{t.act_no_active_challenge}</span>
              </div>
            )}
          </div>

          {/* Error Message Notice */}
          {errorMessage && (
            <div id="activity-modal-error" className="activity-form-error" role="alert">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Modal Actions */}
          <div className="activity-modal-actions">
            <button
              id="btn-activity-cancel"
              type="button"
              className="activity-btn activity-btn--cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t.act_btn_cancel}
            </button>
            <button
              id="btn-activity-save"
              type="submit"
              className="activity-btn activity-btn--save"
              disabled={isSubmitting}
            >
              {isSubmitting ? '...' : t.act_btn_save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
