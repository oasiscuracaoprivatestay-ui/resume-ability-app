import React, { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '../icons/AppIcon';
import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import {
  getSelectedPracticeLoopBook,
  PRACTICE_LOOP_UPDATED_EVENT,
} from '../../challenges/book2PracticeStorage';
import {
  ACHIEVEMENT_SOURCE_EVENTS,
  MAX_ACHIEVEMENT_NOTE_LENGTH,
  getVerifiedAchievements,
  saveAchievementNote,
  type VerifiedAchievementItem,
} from '../../utils/achievementRewardsStorage';
import { STATS_RESET_EVENT } from '../../utils/resetStats';
import {
  MotivationalRewardCard,
  resolveAchievementMotivationCopy,
} from './MotivationalRewardCard';
import { ShareAchievementModal } from './ShareAchievementModal';
import './MotivationalRewardCard.css';

export interface AchievementHistorySectionProps {
  onNavigate: (screen: Screen) => void;
}

/**
 * Verified Achievement History Section inside Progress & Victories (Phase 5C.2 — Section 5).
 *
 * Reads verified Resume events, Daily Re-Pledges, completed 90-Day Milestone reviews,
 * and confirmed Challenge Completions directly from canonical local stores.
 * Never fabricates historical records and preserves full history across Book 1 <-> Book 2 switches.
 */
export const AchievementHistorySection: React.FC<AchievementHistorySectionProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [items, setItems] = useState<VerifiedAchievementItem[]>(() =>
    getVerifiedAchievements('desc')
  );
  const [fallbackBookId, setFallbackBookId] = useState(() => getSelectedPracticeLoopBook());

  // Inline personal note editing per achievement row
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  // Modals for Share Preview & Scenic Reward Card Viewer
  const [shareItem, setShareItem] = useState<VerifiedAchievementItem | null>(null);
  const [viewerItem, setViewerItem] = useState<VerifiedAchievementItem | null>(null);

  const refreshAchievements = useCallback(() => {
    setItems(getVerifiedAchievements(sortOrder));
    setFallbackBookId(getSelectedPracticeLoopBook());
  }, [sortOrder]);

  useEffect(() => {
    refreshAchievements();
  }, [refreshAchievements]);

  useEffect(() => {
    const events = [
      ...ACHIEVEMENT_SOURCE_EVENTS,
      PRACTICE_LOOP_UPDATED_EVENT,
      STATS_RESET_EVENT,
      'storage',
    ];
    events.forEach((ev) => window.addEventListener(ev, refreshAchievements));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, refreshAchievements));
    };
  }, [refreshAchievements]);

  const handleToggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  const handleStartEdit = (item: VerifiedAchievementItem) => {
    setNoteError(null);
    setEditingId(item.id);
    setNoteDraft(item.note?.noteText ?? '');
  };

  const handleCancelEdit = () => {
    setNoteError(null);
    setEditingId(null);
    setNoteDraft('');
  };

  const handleSaveNote = (achievementId: string) => {
    setNoteError(null);
    const res = saveAchievementNote(achievementId, noteDraft);
    if (!res.saved) {
      setNoteError(t.rw_note_save_error);
      return;
    }
    setEditingId(null);
    setNoteDraft('');
    refreshAchievements();
  };

  return (
    <>
      <section className="pv-card pv-card--accent sda-ach-history-card" id="sec-achievement-history">
        <header className="pv-card-header pv-card-header--inline">
          <div className="pv-card-title-group">
            <span className="pv-card-icon" aria-hidden="true">
              <AppIcon name="trophy" size={18} />
            </span>
            <div className="pv-card-title-copy">
              <h2 className="pv-card-title">{t.rw_hist_title}</h2>
              <p className="pv-card-subtitle">{t.rw_hist_sub}</p>
            </div>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              id="btn-ach-sort-order"
              className="sda-ach-sort-btn"
              onClick={handleToggleSort}
              data-sort-order={sortOrder}
            >
              <AppIcon name="clock" size={14} />
              <span>{sortOrder === 'desc' ? t.rw_hist_sort_newest : t.rw_hist_sort_oldest}</span>
            </button>
          )}
        </header>

        {items.length === 0 ? (
          <div className="pv-empty-compact" id="ach-history-empty">
            <span className="pv-empty-badge" aria-hidden="true">
              <AppIcon name="award" size={18} />
            </span>
            <div className="pv-empty-copy">
              <h3 className="pv-empty-title">{t.rw_hist_empty_title}</h3>
              <p className="pv-empty-text">{t.rw_hist_empty_text}</p>
            </div>
          </div>
        ) : (
          <ul className="sda-ach-list" id="ach-history-list">
            {items.map((item) => {
              const effectiveBook = item.bookContext ?? fallbackBookId;
              const copy = resolveAchievementMotivationCopy(t, {
                kind: item.kind,
                bookId: effectiveBook,
                milestoneDay: item.milestoneDay,
                challengeDurationDays: item.challengeDurationDays,
              });
              const isEditingThis = editingId === item.id;

              return (
                <li
                  key={item.id}
                  id={`ach-item-${item.id}`}
                  className={`sda-ach-item sda-ach-item--${item.kind}`}
                  data-achievement-id={item.id}
                  data-achievement-kind={item.kind}
                >
                  <div className="sda-ach-item-top">
                    <div className="sda-ach-item-lead">
                      <span className="sda-ach-emblem" aria-hidden="true">
                        <AppIcon name={copy.icon} size={17} />
                      </span>
                      <div className="sda-ach-meta">
                        <div className="sda-ach-pills-row">
                          <span className="sda-ach-type-pill">{copy.typeLabel}</span>
                          {item.milestoneDay && (
                            <span className="sda-ach-day-pill">
                              {t.rw_hist_day_badge.replace('{day}', String(item.milestoneDay))}
                            </span>
                          )}
                          {item.challengeDurationDays && (
                            <span className="sda-ach-day-pill">
                              {t.rw_hist_duration_badge.replace(
                                '{days}',
                                String(item.challengeDurationDays)
                              )}
                            </span>
                          )}
                        </div>
                        <h3 className="sda-ach-item-title">{copy.title}</h3>
                        <p className="sda-ach-item-msg">{copy.message}</p>
                      </div>
                    </div>

                    <span className="sda-ach-date">{item.dateKey}</span>
                  </div>

                  {/* Personal Achievement Note (Editable in-place, never duplicated) */}
                  <div className="sda-reward-note-box" id={`ach-note-box-${item.id}`}>
                    <div className="sda-reward-note-header">
                      <div className="sda-reward-note-title-group">
                        <span className="sda-reward-note-label">{t.rw_note_label}</span>
                        <span className="sda-reward-private-pill">
                          <AppIcon name="lock" size={11} />
                          <span>{t.rw_note_private_badge}</span>
                        </span>
                      </div>
                      {!isEditingThis && (
                        <button
                          type="button"
                          id={`btn-ach-edit-note-${item.id}`}
                          className="sda-reward-note-trigger-btn"
                          onClick={() => handleStartEdit(item)}
                        >
                          <AppIcon name="pencil" size={12} />
                          <span>{item.note ? t.rw_btn_edit_note : t.rw_btn_add_note}</span>
                        </button>
                      )}
                    </div>

                    {isEditingThis ? (
                      <div className="sda-reward-note-editor">
                        <textarea
                          id={`textarea-ach-note-${item.id}`}
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
                                id={`btn-ach-clear-note-${item.id}`}
                                className="sda-reward-note-btn-secondary"
                                onClick={() => setNoteDraft('')}
                              >
                                {t.rw_btn_clear_note}
                              </button>
                            )}
                            <button
                              type="button"
                              id={`btn-ach-cancel-note-${item.id}`}
                              className="sda-reward-note-btn-secondary"
                              onClick={handleCancelEdit}
                            >
                              {t.rw_btn_cancel_note}
                            </button>
                            <button
                              type="button"
                              id={`btn-ach-save-note-${item.id}`}
                              className="sda-reward-note-btn-save"
                              onClick={() => handleSaveNote(item.id)}
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
                    ) : item.note ? (
                      <p className="sda-reward-note-saved-text" id={`ach-note-text-${item.id}`}>
                        {item.note.noteText}
                      </p>
                    ) : (
                      <p className="sda-reward-note-empty">{t.rw_note_empty_hint}</p>
                    )}
                  </div>

                  <div className="sda-ach-actions-row">
                    <button
                      type="button"
                      id={`btn-ach-view-card-${item.id}`}
                      className="sda-ach-btn"
                      onClick={() => setViewerItem(item)}
                    >
                      <AppIcon name="sparkles" size={13} />
                      <span>{t.rw_btn_view_card}</span>
                    </button>
                    <button
                      type="button"
                      id={`btn-ach-share-${item.id}`}
                      className="sda-ach-btn sda-ach-btn--share"
                      onClick={() => setShareItem(item)}
                    >
                      <AppIcon name="external-link" size={13} />
                      <span>{t.rw_btn_share}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Scenic Reward Card Viewer Modal */}
      {viewerItem && (
        <div
          className="sda-share-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewerItem(null);
          }}
        >
          <div
            id="modal-reward-card-viewer"
            className="sda-reward-viewer-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t.rw_btn_view_card}
          >
            <MotivationalRewardCard
              id="reward-card-history-viewer"
              achievementId={viewerItem.id}
              kind={viewerItem.kind}
              bookId={viewerItem.bookContext ?? fallbackBookId}
              dateKey={viewerItem.dateKey}
              milestoneDay={viewerItem.milestoneDay}
              challengeDurationDays={viewerItem.challengeDurationDays}
              nextStepAction={{
                id: 'btn-viewer-open-challenges',
                label: t.anim_repledge_return_loop_btn,
                onClick: () => {
                  setViewerItem(null);
                  onNavigate('challenges');
                },
              }}
              onDismiss={() => setViewerItem(null)}
            />
          </div>
        </div>
      )}

      {/* Privacy-Safe Share Modal */}
      <ShareAchievementModal
        isOpen={Boolean(shareItem)}
        kind={shareItem?.kind ?? 'repledge'}
        onClose={() => setShareItem(null)}
      />
    </>
  );
};
