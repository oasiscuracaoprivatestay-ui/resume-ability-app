import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { useTranslation } from '../../i18n';
import type { PracticeLoopBookId } from '../../challenges/practiceLoopEngine';
import type { NinetyDayMilestoneDay } from '../../challenges/ninetyDayJourneyStorage';
import {
  ACHIEVEMENT_REWARDS_UPDATED_EVENT,
  MAX_ACHIEVEMENT_NOTE_LENGTH,
  getAchievementNote,
  saveAchievementNote,
  type AchievementKind,
} from '../../utils/achievementRewardsStorage';
import { useReducedMotion } from '../animations/useReducedMotion';
import { ShareAchievementModal } from './ShareAchievementModal';
import './MotivationalRewardCard.css';

export interface MotivationalRewardCardProps {
  id?: string;
  achievementId: string;
  kind: AchievementKind;
  bookId: PracticeLoopBookId;
  dateKey: string;
  milestoneDay?: NinetyDayMilestoneDay;
  challengeDurationDays?: number;
  compact?: boolean;
  nextStepAction?: {
    id?: string;
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function resolveAchievementMotivationCopy(
  t: ReturnType<typeof useTranslation>['t'],
  params: {
    kind: AchievementKind;
    bookId: PracticeLoopBookId;
    milestoneDay?: NinetyDayMilestoneDay;
    challengeDurationDays?: number;
  }
): {
  eyebrow: string;
  typeLabel: string;
  title: string;
  message: string;
  icon: AppIconName;
} {
  const isBook2 = params.bookId === 'book2_loss_maintenance';
  const eyebrow = isBook2 ? t.rw_card_eyebrow_b2 : t.rw_card_eyebrow_b1;

  if (params.kind === 'resume') {
    return {
      eyebrow: t.rw_card_eyebrow_b1,
      typeLabel: t.rw_type_resume,
      title: t.rw_title_resume,
      message: t.rw_msg_resume_b1,
      icon: 'rotate-ccw',
    };
  }

  if (params.kind === 'repledge') {
    return {
      eyebrow,
      typeLabel: t.rw_type_repledge,
      title: isBook2 ? t.rw_title_repledge_b2 : t.rw_title_repledge_b1,
      message: isBook2 ? t.rw_msg_repledge_b2 : t.rw_msg_repledge_b1,
      icon: 'shield',
    };
  }

  if (params.kind === 'milestone_90d') {
    const dayStr = String(params.milestoneDay ?? 7);
    return {
      eyebrow,
      typeLabel: t.rw_type_milestone,
      title: t.rw_title_milestone.replace('{day}', dayStr),
      message: (isBook2 ? t.rw_msg_milestone_b2 : t.rw_msg_milestone_b1).replace('{day}', dayStr),
      icon: 'award',
    };
  }

  const daysStr = String(params.challengeDurationDays ?? 7);
  return {
    eyebrow,
    typeLabel: t.rw_type_challenge,
    title: t.rw_title_challenge.replace('{days}', daysStr),
    message: (isBook2 ? t.rw_msg_challenge_b2 : t.rw_msg_challenge_b1).replace('{days}', daysStr),
    icon: 'trophy',
  };
}

/**
 * Reusable Scenic Motivational Reward Card (Phase 5C.2 — Sections 3, 4, 6 & 7).
 *
 * Shown ONLY after a confirmed successful action (Resume saved, Daily Re-Pledge saved,
 * or 90-Day Milestone review explicitly completed) or when revisiting a verified
 * achievement from Achievement History.
 *
 * Purely coupled to `achievementId` for optional private notes — never creates
 * duplicate achievement records and never modifies XP/scoring.
 */
export const MotivationalRewardCard: React.FC<MotivationalRewardCardProps> = ({
  id,
  achievementId,
  kind,
  bookId,
  dateKey,
  milestoneDay,
  challengeDurationDays,
  compact = false,
  nextStepAction,
  onDismiss,
  dismissLabel,
}) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  const [savedNoteText, setSavedNoteText] = useState<string>(() => {
    return getAchievementNote(achievementId)?.noteText ?? '';
  });
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSavedSr, setNoteSavedSr] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const syncNoteFromStore = useCallback(() => {
    const current = getAchievementNote(achievementId)?.noteText ?? '';
    setSavedNoteText(current);
  }, [achievementId]);

  useEffect(() => {
    syncNoteFromStore();
    setIsEditingNote(false);
    setNoteError(null);
    setNoteSavedSr(null);
  }, [achievementId, syncNoteFromStore]);

  useEffect(() => {
    window.addEventListener(ACHIEVEMENT_REWARDS_UPDATED_EVENT, syncNoteFromStore);
    return () => window.removeEventListener(ACHIEVEMENT_REWARDS_UPDATED_EVENT, syncNoteFromStore);
  }, [syncNoteFromStore]);

  const copy = useMemo(
    () =>
      resolveAchievementMotivationCopy(t, {
        kind,
        bookId,
        milestoneDay,
        challengeDurationDays,
      }),
    [t, kind, bookId, milestoneDay, challengeDurationDays]
  );

  const handleStartEditNote = () => {
    setNoteError(null);
    setNoteSavedSr(null);
    setNoteDraft(savedNoteText);
    setIsEditingNote(true);
  };

  const handleCancelNote = () => {
    setNoteError(null);
    setNoteDraft(savedNoteText);
    setIsEditingNote(false);
  };

  const handleSaveNote = () => {
    setNoteError(null);
    const res = saveAchievementNote(achievementId, noteDraft);
    if (!res.saved) {
      setNoteError(t.rw_note_save_error);
      return;
    }
    const nextText = res.note?.noteText ?? '';
    setSavedNoteText(nextText);
    setIsEditingNote(false);
    setNoteSavedSr(t.rw_note_saved_sr);
  };

  const baseDomId = id || `reward-card-${achievementId}`;

  return (
    <>
      <section
        id={baseDomId}
        className={`sda-reward-card sda-reward-card--${kind}${
          compact ? ' sda-reward-card--compact' : ''
        }`}
        data-achievement-id={achievementId}
        data-achievement-kind={kind}
        data-book-context={bookId}
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        aria-label={copy.title}
      >
        {/* Cinematic Mountain / Sunrise Scenic Backdrop */}
        <div className="sda-reward-scenic-backdrop">
          <div className="sda-reward-scenic-img" aria-hidden="true" />
          <div className="sda-reward-scenic-scrim" aria-hidden="true" />

          <div className="sda-reward-top-bar">
            <div className="sda-reward-emblem-group">
              <span className="sda-reward-emblem" aria-hidden="true">
                <AppIcon name={copy.icon} size={17} />
              </span>
              <span className="sda-reward-eyebrow">{copy.eyebrow}</span>
            </div>

            <span className="sda-reward-date-pill">
              {milestoneDay
                ? `${t.rw_hist_day_badge.replace('{day}', String(milestoneDay))} · ${dateKey}`
                : dateKey}
            </span>
          </div>

          <div className="sda-reward-copy">
            <h4 className="sda-reward-title" id={`${baseDomId}-title`}>
              {copy.title}
            </h4>
            <p className="sda-reward-message" id={`${baseDomId}-message`}>
              {copy.message}
            </p>
          </div>
        </div>

        {/* Private Note + Share / Next Step / Continue Controls */}
        <div className="sda-reward-body">
          <div className="sda-reward-note-box" id={`${baseDomId}-note-box`}>
            <div className="sda-reward-note-header">
              <div className="sda-reward-note-title-group">
                <span className="sda-reward-note-label">{t.rw_note_label}</span>
                <span className="sda-reward-private-pill">
                  <AppIcon name="lock" size={11} />
                  <span>{t.rw_note_private_badge}</span>
                </span>
              </div>

              {!isEditingNote && (
                <button
                  type="button"
                  id={`${baseDomId}-btn-note-toggle`}
                  className="sda-reward-note-trigger-btn"
                  onClick={handleStartEditNote}
                >
                  <AppIcon name="pencil" size={12} />
                  <span>{savedNoteText ? t.rw_btn_edit_note : t.rw_btn_add_note}</span>
                </button>
              )}
            </div>

            {isEditingNote ? (
              <div className="sda-reward-note-editor">
                <textarea
                  id={`${baseDomId}-note-textarea`}
                  className="sda-reward-note-textarea"
                  rows={2}
                  maxLength={MAX_ACHIEVEMENT_NOTE_LENGTH}
                  aria-label={t.rw_note_label}
                  placeholder={t.rw_note_placeholder}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <div className="sda-reward-note-editor-foot">
                  <span className="sda-reward-note-count">
                    {noteDraft.length}/{MAX_ACHIEVEMENT_NOTE_LENGTH}
                  </span>
                  <div className="sda-reward-note-btns">
                    {noteDraft.length > 0 && (
                      <button
                        type="button"
                        id={`${baseDomId}-btn-note-clear`}
                        className="sda-reward-note-btn-secondary"
                        onClick={() => setNoteDraft('')}
                      >
                        {t.rw_btn_clear_note}
                      </button>
                    )}
                    <button
                      type="button"
                      id={`${baseDomId}-btn-note-cancel`}
                      className="sda-reward-note-btn-secondary"
                      onClick={handleCancelNote}
                    >
                      {t.rw_btn_cancel_note}
                    </button>
                    <button
                      type="button"
                      id={`${baseDomId}-btn-note-save`}
                      className="sda-reward-note-btn-save"
                      onClick={handleSaveNote}
                    >
                      {t.rw_btn_save_note}
                    </button>
                  </div>
                </div>
                {noteError && (
                  <p className="sda-reward-note-error" role="alert">
                    {noteError}
                  </p>
                )}
              </div>
            ) : savedNoteText ? (
              <p className="sda-reward-note-saved-text" id={`${baseDomId}-note-text`}>
                {savedNoteText}
              </p>
            ) : (
              <p className="sda-reward-note-empty" id={`${baseDomId}-note-empty`}>
                {t.rw_note_empty_hint}
              </p>
            )}

            {noteSavedSr && (
              <span className="sr-only" role="status" aria-live="polite">
                {noteSavedSr}
              </span>
            )}
          </div>

          <div className="sda-reward-toolbar">
            <div className="sda-reward-toolbar-left">
              <button
                type="button"
                id={`${baseDomId}-btn-share`}
                className="sda-reward-btn-share"
                onClick={() => setIsShareOpen(true)}
              >
                <AppIcon name="external-link" size={14} />
                <span>{t.rw_btn_share}</span>
              </button>
            </div>

            <div className="sda-reward-toolbar-right">
              {nextStepAction && (
                <button
                  type="button"
                  id={nextStepAction.id || `${baseDomId}-btn-next-step`}
                  className="sda-reward-btn-next"
                  onClick={nextStepAction.onClick}
                >
                  <span>{nextStepAction.label}</span>
                  <AppIcon name="chevron-right" size={14} />
                </button>
              )}

              {onDismiss && (
                <button
                  type="button"
                  id={`${baseDomId}-btn-dismiss`}
                  className="sda-reward-btn-dismiss"
                  onClick={onDismiss}
                >
                  {dismissLabel || t.rw_btn_continue}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <ShareAchievementModal
        isOpen={isShareOpen}
        kind={kind}
        onClose={() => setIsShareOpen(false)}
      />
    </>
  );
};
