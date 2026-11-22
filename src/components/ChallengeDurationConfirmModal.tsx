/**
 * Super Diet-Ability — Challenge Duration Selection & Confirmation Modal (Phase 5C)
 *
 * Ensures that whenever a user initiates starting a new Challenge, they explicitly
 * select and verify their intended duration (1, 3, 7, 30, or 90 Days) before any
 * Challenge instance is created or persisted.
 *
 * Strict Safety Guarantees:
 * - Opening the modal NEVER starts or mutates a Challenge.
 * - Canceling / closing / pressing Escape causes zero state or storage changes.
 * - Preselects the caller's current/preferred duration while requiring explicit confirmation.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n';
import {
  RESUME_ABILITY_CHALLENGE_DEFINITION,
  addDaysToDateKey,
  type ChallengeDurationDays,
} from '../challenges';
import { getLocalDateKey } from '../utils/dietStorage';
import { AppIcon } from './icons/AppIcon';
import './ChallengeDurationConfirmModal.css';

export interface ChallengeDurationConfirmModalProps {
  isOpen: boolean;
  initialDuration: ChallengeDurationDays;
  abilityName?: string;
  onConfirm: (confirmedDuration: ChallengeDurationDays) => void;
  onCancel: () => void;
}

const SUPPORTED_DURATIONS: readonly ChallengeDurationDays[] =
  RESUME_ABILITY_CHALLENGE_DEFINITION.supportedDurations;

export const ChallengeDurationConfirmModal: React.FC<ChallengeDurationConfirmModalProps> = ({
  isOpen,
  initialDuration,
  abilityName = RESUME_ABILITY_CHALLENGE_DEFINITION.canonicalName,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [draftDuration, setDraftDuration] = useState<ChallengeDurationDays>(initialDuration);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Sync draft duration when modal opens with a new preselected duration
  useEffect(() => {
    if (isOpen) {
      const safeInitial = SUPPORTED_DURATIONS.includes(initialDuration) ? initialDuration : 7;
      setDraftDuration(safeInitial);
    }
  }, [isOpen, initialDuration]);

  // Body scroll lock, Escape dismissal, and focus restoration
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('sda-modal-open');

    const raf = requestAnimationFrame(() => {
      confirmBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('sda-modal-open');
      const target = returnFocusRef.current;
      if (target && document.contains(target)) {
        try {
          target.focus();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, onCancel]);

  const getOptionLabel = (d: ChallengeDurationDays): string => {
    switch (d) {
      case 1:
        return t.ch_dur_opt_1;
      case 3:
        return t.ch_dur_opt_3;
      case 7:
        return t.ch_dur_opt_7;
      case 30:
        return t.ch_dur_opt_30;
      case 90:
        return t.ch_dur_opt_90;
    }
  };

  const getOptionDesc = (d: ChallengeDurationDays): string => {
    switch (d) {
      case 1:
        return t.ch_dur_desc_1;
      case 3:
        return t.ch_dur_desc_3;
      case 7:
        return t.ch_dur_desc_7;
      case 30:
        return t.ch_dur_desc_30;
      case 90:
        return t.ch_dur_desc_90;
    }
  };

  const dateWindow = useMemo(() => {
    const start = getLocalDateKey();
    const end = addDaysToDateKey(start, draftDuration - 1);
    return `${start} → ${end}`;
  }, [draftDuration]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ch-dur-backdrop"
      id="challenge-duration-confirm-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        id="challenge-duration-confirm-modal"
        className="ch-dur-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-duration-modal-title"
        aria-describedby="challenge-duration-modal-subtitle"
      >
        <div className="ch-dur-header">
          <div className="ch-dur-header-left">
            <span className="ch-dur-eyebrow">
              <AppIcon name="trophy" size={13} />
              <span>{abilityName}</span>
            </span>
            <h2 id="challenge-duration-modal-title" className="ch-dur-title">
              {t.ch_dur_modal_title}
            </h2>
            <p id="challenge-duration-modal-subtitle" className="ch-dur-subtitle">
              {t.ch_dur_modal_sub}
            </p>
          </div>

          <button
            type="button"
            id="btn-close-duration-modal"
            className="ch-dur-close-btn"
            onClick={onCancel}
            aria-label={t.ch_dur_cancel_btn}
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <div
          className="ch-dur-options-grid"
          role="group"
          aria-labelledby="challenge-duration-modal-subtitle"
        >
          {SUPPORTED_DURATIONS.map((d) => {
            const isSelected = draftDuration === d;
            const isFlagship = d === 90;
            return (
              <button
                key={d}
                type="button"
                id={`btn-modal-duration-${d}`}
                data-duration-days={d}
                className={`ch-dur-option-card${isSelected ? ' ch-dur-option-card--selected' : ''}${
                  isFlagship ? ' ch-dur-option-card--flagship' : ''
                }`}
                aria-pressed={isSelected}
                onClick={() => setDraftDuration(d)}
              >
                <div className="ch-dur-option-main">
                  <span className="ch-dur-option-label">{getOptionLabel(d)}</span>
                  <span className="ch-dur-option-desc">{getOptionDesc(d)}</span>
                </div>
                <span
                  className={`ch-dur-option-radio${
                    isSelected ? ' ch-dur-option-radio--checked' : ''
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <AppIcon name="check" size={13} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explicit Selected Duration Verification Strip */}
        <div className="ch-dur-summary-card" id="duration-confirm-selected-summary">
          <div className="ch-dur-summary-row">
            <span className="ch-dur-summary-key">{t.ch_dur_selected_label}</span>
            <strong className="ch-dur-summary-val" id="duration-confirm-selected-val">
              {getOptionLabel(draftDuration)}
            </strong>
          </div>
          <div className="ch-dur-summary-row">
            <span className="ch-dur-summary-key">{t.ch_dur_window_label}</span>
            <span className="ch-dur-summary-dates" id="duration-confirm-window-val">
              {dateWindow}
            </span>
          </div>
        </div>

        <div className="ch-dur-actions">
          <button
            ref={confirmBtnRef}
            type="button"
            id="btn-confirm-start-challenge"
            className="ch-dur-btn-confirm"
            onClick={() => onConfirm(draftDuration)}
          >
            <AppIcon name="zap" size={16} />
            <span>{t.ch_dur_confirm_btn}</span>
          </button>

          <button
            type="button"
            id="btn-cancel-duration-modal"
            className="ch-dur-btn-cancel"
            onClick={onCancel}
          >
            {t.ch_dur_cancel_btn}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChallengeDurationConfirmModal;
