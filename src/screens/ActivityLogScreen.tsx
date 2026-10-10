import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import {
  listActivities,
  deleteActivity,
  getDailyActivitySummary,
  ACTIVITIES_UPDATED_EVENT,
  type ActivityRecord,
  type ActivityCategory,
} from '../activities';
import { getLocalDateKey } from '../utils/dietStorage';
import { ActivityModal } from '../components/ActivityModal';
import { playFeedback } from '../utils/feedback';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import './ActivityLogScreen.css';

interface ActivityLogScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
}

const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  walking: '🚶',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  strength_training: '🏋️',
  mobility_yoga: '🧘',
  sports: '🎾',
  other_movement: '✨',
};

export const ActivityLogScreen: React.FC<ActivityLogScreenProps> = ({ onNavigate, onBack }) => {
  const { t } = useTranslation();

  // Activities collection state
  const [activities, setActivities] = useState<ActivityRecord[]>(() => listActivities());
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activityToEdit, setActivityToEdit] = useState<ActivityRecord | null>(null);

  // Delete confirmation modal state
  const [activityToDelete, setActivityToDelete] = useState<ActivityRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Temporary feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayKey = getLocalDateKey();

  // Check for deep-link / shortcut intent to open modal directly (e.g. from Home, Dashboard, or Challenges)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const intent = window.sessionStorage.getItem('activity_log_open_modal');
        if (intent === 'true') {
          window.sessionStorage.removeItem('activity_log_open_modal');
          setActivityToEdit(null);
          setIsModalOpen(true);
        }
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  // Listen for storage events and stats reset across components
  useEffect(() => {
    const handleUpdate = () => {
      setActivities(listActivities());
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
    window.addEventListener(STATS_RESET_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(ACTIVITIES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(STATS_RESET_EVENT, handleUpdate);
    };
  }, []);

  // Today's summary metrics
  const todaySummary = useMemo(() => {
    return getDailyActivitySummary(todayKey);
  }, [activities, todayKey, refreshKey]);

  // Group activities chronologically by dateKey (newest first)
  const groupedActivities = useMemo(() => {
    const groups: { dateKey: string; items: ActivityRecord[]; totalMinutes: number }[] = [];
    const dateMap = new Map<string, ActivityRecord[]>();

    for (const act of activities) {
      if (!dateMap.has(act.dateKey)) {
        dateMap.set(act.dateKey, []);
      }
      dateMap.get(act.dateKey)!.push(act);
    }

    // Sort dates descending
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const items = dateMap.get(date)!;
      const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
      groups.push({ dateKey: date, items, totalMinutes });
    }

    return groups;
  }, [activities]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  const handleOpenAdd = () => {
    setActivityToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (act: ActivityRecord) => {
    setActivityToEdit(act);
    setIsModalOpen(true);
  };

  const handleSaved = (_savedRecord: ActivityRecord) => {
    setActivities(listActivities());
    showToast(t.act_feedback_saved);
  };

  const handleRequestDelete = (act: ActivityRecord) => {
    setDeleteError(null);
    setActivityToDelete(act);
  };

  // ESC key handler and scroll lock for delete confirmation modal
  useEffect(() => {
    if (!activityToDelete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActivityToDelete(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activityToDelete]);

  const handleConfirmDelete = () => {
    if (!activityToDelete) return;

    const result = deleteActivity(activityToDelete.id);
    if (!result.success) {
      setDeleteError(result.error || 'Failed to delete activity.');
      return;
    }

    playFeedback('neutral');
    setActivities(listActivities());
    setActivityToDelete(null);
    showToast(t.act_feedback_deleted);
  };

  const formatDateHeading = (dateKey: string): string => {
    if (dateKey === todayKey) {
      return t.act_date_today;
    }

    // Calculate yesterday
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const yStr = now.getFullYear();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const dStr = String(now.getDate()).padStart(2, '0');
    const yesterdayKey = `${yStr}-${mStr}-${dStr}`;

    if (dateKey === yesterdayKey) {
      return t.act_date_yesterday;
    }

    // Explicit date
    return dateKey;
  };

  return (
    <div className="screen activity-log-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        title={t.act_screen_title}
        subtitle={t.act_screen_subtitle}
        eyebrow="MOVEMENT & ACTIVITY"
        onBack={onBack}
        showScoreBadge
        onNavigate={onNavigate}
      />

      <div className="activity-log-content">
        <div className="activity-screen-hero" style={{ display: 'none' }}>
          <h1 className="activity-screen-title">{t.act_screen_title}</h1>
          <p className="activity-screen-subtitle">{t.act_screen_subtitle}</p>
        </div>
        {/* Today's Movement Summary Widget */}
        <section id="card-today-activity-summary" className="activity-today-summary-card">
          <div className="activity-today-summary-header">
            <span className="activity-today-summary-title">{t.act_today_summary_title}</span>
            <span className="activity-today-summary-date">{todayKey}</span>
          </div>

          <div className="activity-today-summary-body">
            {todaySummary.count > 0 ? (
              <div className="activity-today-stats-row">
                <div className="activity-today-stat-pill">
                  <span className="activity-today-stat-value">{todaySummary.count}</span>
                  <span className="activity-today-stat-label">
                    {t.act_today_summary_count.replace('{count}', String(todaySummary.count))}
                  </span>
                </div>
                <div className="activity-today-stat-pill activity-today-stat-pill--time">
                  <span className="activity-today-stat-value">{todaySummary.totalDurationMinutes}</span>
                  <span className="activity-today-stat-label">
                    {t.act_today_summary_minutes.replace('{minutes}', String(todaySummary.totalDurationMinutes))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="activity-today-no-data">{t.act_today_no_movement}</p>
            )}

            <button
              id="btn-add-activity"
              type="button"
              className="activity-btn-record-cta"
              onClick={handleOpenAdd}
            >
              {t.act_btn_add}
            </button>
          </div>
        </section>

        {/* History Grouped List */}
        <section className="activity-history-section" aria-label={t.act_screen_title}>
          {groupedActivities.length === 0 ? (
            <div className="activity-empty-state">
              <span className="activity-empty-icon" aria-hidden="true">🏃</span>
              <h3 className="activity-empty-title">{t.act_empty_state_title}</h3>
              <p className="activity-empty-desc">{t.act_empty_state_desc}</p>
              <button
                id="btn-empty-record-activity"
                type="button"
                className="activity-empty-btn"
                onClick={handleOpenAdd}
              >
                {t.act_btn_record}
              </button>
            </div>
          ) : (
            groupedActivities.map((group) => (
              <div key={group.dateKey} className="activity-date-group">
                <div className="activity-date-group-header">
                  <h3 className="activity-date-heading">{formatDateHeading(group.dateKey)}</h3>
                  <span className="activity-date-total-pill">{group.totalMinutes} min</span>
                </div>

                <div className="activity-cards-list" role="list">
                  {group.items.map((act) => {
                    const catKey = `act_cat_${act.category}` as keyof typeof t;
                    const catLabel = (t[catKey] as string) || act.category;

                    return (
                      <article
                        key={act.id}
                        id={`card-activity-${act.id}`}
                        className="activity-item-card"
                        role="listitem"
                      >
                        <div className="activity-item-top">
                          <div className="activity-item-main">
                            <span className="activity-item-icon" aria-hidden="true">
                              {CATEGORY_ICONS[act.category]}
                            </span>
                            <div className="activity-item-titles">
                              <h4 className="activity-item-category">{catLabel}</h4>
                              {act.customName && (
                                <p className="activity-item-custom-name">{act.customName}</p>
                              )}
                            </div>
                          </div>

                          <div className="activity-item-meta">
                            <span className="activity-item-duration">{act.durationMinutes} min</span>
                            <span className="activity-item-time">{act.time}</span>
                          </div>
                        </div>

                        {/* Optional badges row */}
                        {(act.intensity || act.associatedChallengeId) && (
                          <div className="activity-item-badges">
                            {act.intensity && (
                              <span className={`activity-intensity-badge activity-intensity-badge--${act.intensity}`}>
                                {t[`act_int_${act.intensity}` as keyof typeof t] as string || act.intensity}
                              </span>
                            )}
                            {act.associatedChallengeId && (
                              <span className="activity-challenge-badge">
                                ⚡ {t.act_link_challenge}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Optional notes */}
                        {act.notes && (
                          <p className="activity-item-notes">{act.notes}</p>
                        )}

                        {/* Card actions */}
                        <div className="activity-item-actions">
                          <button
                            id={`btn-edit-activity-${act.id}`}
                            type="button"
                            className="activity-card-action-btn activity-card-action-btn--edit"
                            onClick={() => handleOpenEdit(act)}
                            aria-label={`${t.act_btn_edit} ${catLabel}`}
                          >
                            ✎ {t.act_btn_edit}
                          </button>
                          <button
                            id={`btn-delete-activity-${act.id}`}
                            type="button"
                            className="activity-card-action-btn activity-card-action-btn--delete"
                            onClick={() => handleRequestDelete(act)}
                            aria-label={`${t.act_btn_delete} ${catLabel}`}
                          >
                            ✕ {t.act_btn_delete}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Activity Log/Edit Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        activityToEdit={activityToEdit}
      />

      {/* Delete Confirmation Modal */}
      {activityToDelete && (
        <div
          className="activity-delete-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivityToDelete(null);
          }}
        >
          <div
            className="activity-delete-modal-box"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <h3 id="delete-confirm-title" className="activity-delete-modal-title">
              {t.act_delete_confirm_title}
            </h3>
            <p className="activity-delete-modal-desc">{t.act_delete_confirm_desc}</p>

            {deleteError && (
              <div className="activity-delete-error" role="alert">
                ⚠️ {deleteError}
              </div>
            )}

            <div className="activity-delete-actions">
              <button
                id="btn-cancel-delete"
                type="button"
                className="activity-delete-btn activity-delete-btn--keep"
                onClick={() => setActivityToDelete(null)}
                autoFocus
              >
                {t.act_delete_btn_keep}
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                className="activity-delete-btn activity-delete-btn--delete"
                onClick={handleConfirmDelete}
              >
                {t.act_delete_btn_delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating feedback toast */}
      {toastMessage && (
        <div className="activity-toast-notice" role="status" aria-live="polite">
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
};
