import React, { useState, useCallback, useMemo } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Screen } from '../types';
import { useTranslation } from '../i18n';
import { playFeedback } from '../utils/feedback';
import { loadPledge, recordNonNegotiableReview } from '../utils/pledgeStorage';
import { recordScoreEvent } from '../utils/scoringEngine';
import { getLocalDateKey } from '../utils/dietStorage';
import CheckableCommitmentItem from '../components/CheckableCommitmentItem';
import HoldCommitButton from '../components/HoldCommitButton';
import {
  loadSlipperyZones,
  addSlipperyZone,
  updateSlipperyZone,
  deleteSlipperyZone,
  recordSlipperyZonesReview,
  formatLastReviewed,
  PersonalSlipperyZone,
  SlipperyZonesData,
} from '../utils/slipperyZonesStorage';
import './MySlipperyZonesScreen.css';

interface MySlipperyZonesScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const MySlipperyZonesScreen: React.FC<MySlipperyZonesScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const [data, setData] = useState<SlipperyZonesData>(() => loadSlipperyZones());
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingZone, setEditingZone] = useState<PersonalSlipperyZone | null>(null);
  const [zoneTitleInput, setZoneTitleInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [zoneToDelete, setZoneToDelete] = useState<PersonalSlipperyZone | null>(null);

  // Review celebration & completion state
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewCompleted, setReviewCompleted] = useState(false);

  // Load user's Why reason and Non-Negotiables directly from pledge storage
  const pledge = useMemo(() => loadPledge(), []);
  const firstReason = useMemo(() => {
    return pledge.reasons.find((r) => r.trim().length > 0) ?? null;
  }, [pledge.reasons]);

  const nonNegotiables = pledge.nonNegotiables;

  // Session-based review checkmarks state (not permanent "completed forever")
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheckItem = useCallback((idx: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, []);

  // Gating condition: All displayed non-negotiables must be checked before final review
  const checkedCount = useMemo(() => {
    return nonNegotiables.filter((_, idx) => !!checkedItems[idx]).length;
  }, [nonNegotiables, checkedItems]);

  const allChecked = useMemo(() => {
    if (nonNegotiables.length === 0) return true;
    return nonNegotiables.every((_, idx) => !!checkedItems[idx]);
  }, [nonNegotiables, checkedItems]);

  // Complete Review Confirmation
  const completeReview = useCallback(() => {
    playFeedback('win');

    // Record review metadata
    const result = recordSlipperyZonesReview();
    setData(result.updatedData);

    // Record Non-Negotiables review in pledge storage
    recordNonNegotiableReview();

    // Deterministic scoring for Non-Negotiables review (+15 max 1/day)
    recordScoreEvent({
      activityType: 'NON_NEGOTIABLES_REVIEW',
      sourceId: `nn_review_${getLocalDateKey()}`,
    });

    const msg = result.scoreAwarded ? t.sz_points_awarded : t.sz_points_already_awarded;
    setReviewMessage(msg);
    setReviewCompleted(true);
  }, [t]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingZone(null);
    setZoneTitleInput('');
    setInputError('');
  };

  const handleOpenEditModal = (zone: PersonalSlipperyZone) => {
    setModalMode('edit');
    setEditingZone(zone);
    setZoneTitleInput(zone.title);
    setInputError('');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setEditingZone(null);
    setZoneTitleInput('');
    setInputError('');
  };

  const handleSaveZone = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = zoneTitleInput.trim();
    if (!trimmed) {
      setInputError(t.sz_input_placeholder || 'Please enter a description');
      return;
    }

    if (modalMode === 'add') {
      addSlipperyZone(trimmed);
    } else if (modalMode === 'edit' && editingZone) {
      updateSlipperyZone(editingZone.id, trimmed);
    }

    setData(loadSlipperyZones());
    handleCloseModal();
  };

  const handleDeleteConfirm = () => {
    if (zoneToDelete) {
      deleteSlipperyZone(zoneToDelete.id);
      setData(loadSlipperyZones());
      setZoneToDelete(null);
    }
  };

  return (
    <div className="screen my-slippery-zones-screen" id="my-slippery-zones-screen">
      <ScreenHeader
        onBack={() => onNavigate('my-commitments')}
        onHome={() => onNavigate('home')}
        onNavigate={onNavigate}
      />

      <div className="sz-screen-content">
        <div className="sz-screen-header">
          <h1 className="sz-screen-title">{t.sz_screen_title}</h1>
          <p className="sz-screen-sub">{t.sz_screen_subtitle}</p>
        </div>

        {/* 1. Review Introduction / Awareness Shield Banner */}
        <div className="sz-awareness-card" id="sz-awareness-card">
          <div className="sz-awareness-header">
            <span className="sz-awareness-icon" aria-hidden="true">
              🛡️
            </span>
            <p className="sz-awareness-text">{t.sz_awareness_banner}</p>
          </div>
          <div className="sz-stats-row">
            <div className="sz-stat-badge" id="sz-stat-last-reviewed">
              <span className="sz-stat-dot" aria-hidden="true" />
              <span>{formatLastReviewed(data.lastReviewedAt, t)}</span>
            </div>
            <div className="sz-stat-badge" id="sz-stat-review-count">
              <span>{t.sz_reviews_count.replace('{count}', String(data.reviewCount || 0))}</span>
            </div>
          </div>
        </div>

        {/* 2. WHY / COMMITMENT CONTEXT */}
        <div className="sz-why-card" id="sz-why-card">
          <div className="sz-why-header">
            <span className="sz-why-label">{t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}</span>
            <button
              id="btn-sz-manage-why"
              type="button"
              className="sz-why-manage-btn"
              onClick={() => onNavigate('commitment')}
              aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
            >
              {t.commit_why_link || 'Manage'} ›
            </button>
          </div>
          <p className={`sz-why-text ${firstReason ? '' : 'sz-why-text--empty'}`}>
            {firstReason || t.commit_why_empty || 'No Why specified yet.'}
          </p>
        </div>

        {/* 3. NON-NEGOTIABLES REVIEW SECTION (INDIVIDUALLY CHECKABLE) */}
        <div className="sz-nn-review-section" id="sz-nn-review-section">
          <div className="sz-nn-header">
            <div className="sz-nn-header-text">
              <h2 className="sz-nn-title">{t.review_nn_section_title || 'NON-NEGOTIABLES REVIEW'}</h2>
              <p className="sz-nn-subtitle">
                {t.review_nn_section_sub || 'Acknowledge each rule before confirming'}
              </p>
            </div>
            {nonNegotiables.length > 0 && (
              <span className="sz-nn-progress-badge" id="sz-nn-progress-badge">
                {t.nn_review_progress_status
                  ? t.nn_review_progress_status
                      .replace('{checked}', String(checkedCount))
                      .replace('{total}', String(nonNegotiables.length))
                  : `${checkedCount} of ${nonNegotiables.length} reviewed`}
              </span>
            )}
          </div>

          {nonNegotiables.length === 0 ? (
            <div className="sz-nn-empty" id="sz-nn-empty">
              <p className="sz-nn-empty-text">
                {t.pledge_review_empty || 'No Non-Negotiables set yet.'}
              </p>
              <button
                type="button"
                className="btn-sz-add-nn"
                id="btn-sz-add-nn"
                onClick={() => onNavigate('commitment')}
              >
                + {t.commit_nn_add || 'Add Non-Negotiables'}
              </button>
            </div>
          ) : (
            <div
              className="sz-nn-list"
              id="sz-nn-list"
              role="group"
              aria-label={t.review_nn_section_title || 'Non-Negotiables'}
            >
              {nonNegotiables.map((nn, idx) => (
                <CheckableCommitmentItem
                  key={idx}
                  id={`nn-review-item-${idx}`}
                  index={idx}
                  text={nn}
                  checked={!!checkedItems[idx]}
                  onToggle={() => toggleCheckItem(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 4. SLIPPERY ZONES SECTION */}
        <div className="sz-list-header">
          <h2 className="sz-list-title">{t.my_commitments_card_sz_title}</h2>
          <button
            type="button"
            className="btn-add-sz"
            id="btn-add-slippery-zone"
            onClick={handleOpenAddModal}
          >
            {t.sz_add_zone_btn}
          </button>
        </div>

        {/* Existing Slippery Zone List */}
        <div className="sz-zones-list" id="sz-zones-list">
          {data.zones.length === 0 ? (
            <div className="sz-empty-state" id="sz-empty-state">
              <span className="sz-empty-icon" aria-hidden="true">
                📝
              </span>
              <h3 className="sz-empty-title">{t.sz_empty_title}</h3>
              <p className="sz-empty-desc">{t.sz_empty_desc}</p>
              <button
                type="button"
                className="btn-empty-add-sz"
                id="btn-empty-add-slippery-zone"
                onClick={handleOpenAddModal}
              >
                {t.sz_add_zone_btn}
              </button>
            </div>
          ) : (
            data.zones.map((zone, index) => (
              <div key={zone.id} className="sz-zone-card" id={`sz-zone-card-${zone.id}`}>
                <div className="sz-zone-num" aria-hidden="true">
                  {index + 1}
                </div>
                <div className="sz-zone-body">
                  <p className="sz-zone-title">{zone.title}</p>
                </div>
                <div className="sz-zone-actions">
                  <button
                    type="button"
                    className="sz-action-btn sz-action-edit"
                    id={`btn-edit-sz-${zone.id}`}
                    onClick={() => handleOpenEditModal(zone)}
                    aria-label={`${t.sz_edit_btn}: ${zone.title}`}
                    title={t.sz_edit_btn}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="sz-action-btn sz-action-delete"
                    id={`btn-delete-sz-${zone.id}`}
                    onClick={() => setZoneToDelete(zone)}
                    aria-label={`${t.sz_delete_btn}: ${zone.title}`}
                    title={t.sz_delete_btn}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 5. FINAL HOLD ACTION SECTION (STRICTLY BELOW SLIPPERY ZONES) */}
        <div className="sz-review-action-section" id="sz-review-action-section">
          {reviewCompleted ? (
            <div
              className="sz-celebration-banner"
              id="sz-celebration-banner"
              role="status"
              aria-live="polite"
            >
              <div className="sz-celebration-badge">
                ✓ {t.sz_review_confirmed || 'Review confirmed ✓'}
              </div>
              {reviewMessage && <p className="sz-celebration-message">{reviewMessage}</p>}
              <button
                type="button"
                id="btn-sz-back-to-menu"
                className="sz-btn-back-menu"
                onClick={() => onNavigate('home')}
              >
                <span className="sz-btn-back-menu-icon" aria-hidden="true">
                  🏠
                </span>
                <span>{t.sz_back_to_menu || 'Back to Main Menu'}</span>
              </button>
            </div>
          ) : (
            <HoldCommitButton
              id="btn-sz-hold-review"
              variant="review"
              label={`→ ${t.sz_hold_to_confirm_review || 'HOLD TO CONFIRM REVIEW'}`}
              disabled={!allChecked}
              disabledReason={
                !allChecked
                  ? `${t.nn_review_check_all_first || 'Review each Non-Negotiable first'} (${checkedCount}/${nonNegotiables.length})`
                  : undefined
              }
              onComplete={completeReview}
            />
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="sz-modal-overlay" role="dialog" aria-modal="true">
          <div className="sz-modal-content">
            <h3 className="sz-modal-title">
              {modalMode === 'add' ? t.sz_add_modal_title : t.sz_edit_modal_title}
            </h3>
            <form onSubmit={handleSaveZone} className="sz-modal-form">
              <label htmlFor="sz-zone-input" className="sz-modal-label">
                {t.my_commitments_card_sz_title}
              </label>
              <textarea
                id="sz-zone-input"
                className="sz-modal-textarea"
                rows={3}
                placeholder={t.sz_input_placeholder}
                value={zoneTitleInput}
                onChange={(e) => {
                  setZoneTitleInput(e.target.value);
                  if (inputError) setInputError('');
                }}
                autoFocus
              />
              {inputError && <p className="sz-input-error">{inputError}</p>}
              <div className="sz-modal-buttons">
                <button
                  type="button"
                  className="btn-sz-modal-cancel"
                  onClick={handleCloseModal}
                >
                  {t.sz_cancel_btn}
                </button>
                <button type="submit" className="btn-sz-modal-save">
                  {t.sz_save_btn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {zoneToDelete && (
        <div className="sz-modal-overlay" role="dialog" aria-modal="true">
          <div className="sz-modal-content sz-modal-delete">
            <h3 className="sz-modal-title">{t.sz_delete_btn}</h3>
            <p className="sz-delete-warning">{t.sz_delete_confirm}</p>
            <p className="sz-delete-item-title">"{zoneToDelete.title}"</p>
            <div className="sz-modal-buttons">
              <button
                type="button"
                className="btn-sz-modal-cancel"
                onClick={() => setZoneToDelete(null)}
              >
                {t.sz_cancel_btn}
              </button>
              <button
                type="button"
                className="btn-sz-modal-delete"
                onClick={handleDeleteConfirm}
              >
                {t.sz_delete_btn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySlipperyZonesScreen;
