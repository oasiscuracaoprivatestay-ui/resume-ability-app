import React, { useState, useEffect, useRef, useCallback } from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Screen } from '../types';
import { useTranslation } from '../i18n';
import { playFeedback } from '../utils/feedback';
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

const HOLD_MS = 2500;
const RING_R = 46;
const RING_CX = 60;
const RING_CY = 60;
const RING_CIRC = 2 * Math.PI * RING_R;

export const MySlipperyZonesScreen: React.FC<MySlipperyZonesScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const [data, setData] = useState<SlipperyZonesData>(() => loadSlipperyZones());
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingZone, setEditingZone] = useState<PersonalSlipperyZone | null>(null);
  const [zoneTitleInput, setZoneTitleInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [zoneToDelete, setZoneToDelete] = useState<PersonalSlipperyZone | null>(null);

  // Press-and-hold review state
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef(false);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync data on mount
  useEffect(() => {
    setData(loadSlipperyZones());
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (messageTimeoutRef.current !== null) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  // ── Cancel Hold ──────────────────────────────────────────
  const cancelHold = useCallback(() => {
    if (holdCompletedRef.current) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(0);
  }, []);

  // ── Complete Review Confirmation ──────────────────────────
  const completeReview = useCallback(() => {
    if (holdCompletedRef.current) return;
    holdCompletedRef.current = true;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
    setProgress(1);

    playFeedback('commit');

    const result = recordSlipperyZonesReview();
    setData(result.updatedData);

    const msg = result.scoreAwarded ? t.sz_points_awarded : t.sz_points_already_awarded;
    setReviewMessage(msg);
    setShowCelebration(true);

    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
      setShowCelebration(false);
      holdCompletedRef.current = false;
      setProgress(0);
    }, 4000);
  }, [t]);

  // ── Start Hold Loop ───────────────────────────────────────
  const startHold = useCallback(() => {
    if (holding || holdCompletedRef.current) return;
    setHolding(true);
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (startRef.current === null) return;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / HOLD_MS, 1);
      setProgress(p);

      if (p >= 1) {
        completeReview();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [holding, completeReview]);

  // Pointer event handlers for hold button
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startHold();
  };

  const handlePointerUp = () => cancelHold();
  const handlePointerLeave = () => cancelHold();

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat && !holding && !holdCompletedRef.current) {
        startHold();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      cancelHold();
    }
  };

  // ── Zone CRUD handlers ────────────────────────────────────
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

  const strokeDashoffset = RING_CIRC * (1 - progress);

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

        {/* Awareness Shield Banner */}
        <div className="sz-awareness-card" id="sz-awareness-card">
          <div className="sz-awareness-header">
            <span className="sz-awareness-icon" aria-hidden="true">🛡️</span>
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

        {/* Celebration / Feedback State */}
        {showCelebration && (
          <div className="sz-celebration-banner" role="status" aria-live="polite">
            <div className="sz-celebration-badge">✓ {t.sz_review_success}</div>
            <p className="sz-celebration-message">{reviewMessage}</p>
          </div>
        )}

        {/* Hold to Confirm Review Section */}
        <div className="sz-review-action-section">
          <div className={`sz-ring-wrap${holding ? ' sz-ring-wrap--holding' : ''}`}>
            <svg className="sz-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <linearGradient id="sz-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <circle
                className="sz-ring-track"
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                strokeWidth="5"
              />
              {(holding || progress > 0) && (
                <circle
                  className="sz-ring-arc"
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke="url(#sz-ring-grad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                />
              )}
            </svg>

            <button
              id="btn-sz-hold-review"
              className={`sz-hold-btn${holding ? ' sz-hold-btn--active' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              aria-label={holding ? t.sz_holding_review : t.sz_hold_to_review}
              type="button"
            >
              <span className="sz-hold-btn-icon" aria-hidden="true">
                {holding ? '⚡' : '⚠️'}
              </span>
              <span className="sz-hold-btn-text">
                {holding ? t.sz_holding_review : t.sz_hold_to_review}
              </span>
            </button>
          </div>
        </div>

        {/* Zone List Header & Add Button */}
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

        {/* Zone Cards List */}
        <div className="sz-zones-list" id="sz-zones-list">
          {data.zones.length === 0 ? (
            <div className="sz-empty-state" id="sz-empty-state">
              <span className="sz-empty-icon" aria-hidden="true">📝</span>
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
              <div
                key={zone.id}
                className="sz-zone-card"
                id={`sz-zone-card-${zone.id}`}
              >
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
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div
          className="sz-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div className="sz-modal-card" role="document">
            <h3 className="sz-modal-title">
              {modalMode === 'add' ? t.sz_add_modal_title : t.sz_edit_modal_title}
            </h3>
            <form onSubmit={handleSaveZone}>
              <div className="sz-input-group">
                <textarea
                  id="input-sz-title"
                  className="sz-textarea"
                  rows={3}
                  value={zoneTitleInput}
                  onChange={(e) => {
                    setZoneTitleInput(e.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder={t.sz_input_placeholder}
                  autoFocus
                />
                {inputError && <p className="sz-error-msg">{inputError}</p>}
              </div>
              <div className="sz-modal-actions">
                <button
                  type="button"
                  id="btn-sz-cancel"
                  className="sz-btn sz-btn-cancel"
                  onClick={handleCloseModal}
                >
                  {t.sz_cancel_btn}
                </button>
                <button
                  type="submit"
                  id="btn-sz-save"
                  className="sz-btn sz-btn-save"
                >
                  {t.sz_save_btn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {zoneToDelete && (
        <div
          className="sz-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setZoneToDelete(null);
          }}
        >
          <div className="sz-modal-card sz-delete-modal-card" role="document">
            <h3 className="sz-modal-title">{t.sz_delete_btn}</h3>
            <p className="sz-delete-confirm-text">{t.sz_delete_confirm}</p>
            <p className="sz-delete-zone-preview">"{zoneToDelete.title}"</p>
            <div className="sz-modal-actions">
              <button
                type="button"
                id="btn-sz-delete-cancel"
                className="sz-btn sz-btn-cancel"
                onClick={() => setZoneToDelete(null)}
              >
                {t.sz_cancel_btn}
              </button>
              <button
                type="button"
                id="btn-sz-delete-confirm"
                className="sz-btn sz-btn-danger"
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
