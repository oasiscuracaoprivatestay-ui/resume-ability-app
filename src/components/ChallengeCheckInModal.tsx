/**
 * SDA Ability Challenges System — Challenge Check-In Modal (Phase 41E)
 *
 * Provides in-challenge daily reporting, practice tracking, and non-shaming recovery actions:
 * 1. Canonical status selection (On Structure, Near Slip, Slip).
 * 2. Stable event deduplication shared between Challenge association and Centralized Scoring.
 * 3. Immediate connection to Why, Non-Negotiables, and Structured Diet.
 * 4. Standardized Hold to Re-commit interaction for slip recovery without modifying Diet verification.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import type { ChallengeInstance } from '../challenges/types';
import { recordChallengeCheckIn } from '../challenges/challengeEngine';
import type { CheckInStatus } from '../utils/checkInStorage';
import { getLocalDateKey } from '../utils/dietStorage';
import { loadPledge } from '../utils/pledgeStorage';
import { saveRecommitEvent } from '../utils/recommitStorage';
import { recordScoreEvent } from '../utils/scoringEngine';
import { generateId } from '../utils';
import { playFeedback } from '../utils/feedback';
import { HoldCommitButton } from './HoldCommitButton';
import './ChallengeCheckInModal.css';

interface ChallengeCheckInModalProps {
  isOpen: boolean;
  challenge: ChallengeInstance;
  onClose: () => void;
  onNavigate: (screen: any) => void;
  onCheckInCompleted?: () => void;
  onRecommitCompleted?: () => void;
}

export const ChallengeCheckInModal: React.FC<ChallengeCheckInModalProps> = ({
  isOpen,
  challenge,
  onClose,
  onNavigate,
  onCheckInCompleted,
  onRecommitCompleted,
}) => {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<CheckInStatus | null>(null);
  const [step, setStep] = useState<'select' | 'confirmed'>('select');
  const [hasRecommitted, setHasRecommitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Pending action ID tracking for idempotent retries across rapid taps or reloads
  const pendingActionIdRef = useRef<string | null>(null);

  // Load user's saved Why reason and non-negotiables
  const pledge = useMemo(() => loadPledge(), [isOpen]);
  const firstReason = pledge.reasons && pledge.reasons.length > 0 ? pledge.reasons[0] : null;

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedStatus(null);
      setStep('select');
      setHasRecommitted(false);
      setIsSubmitting(false);
      setSubmissionError(null);

      // Check if there was an interrupted attempt in sessionStorage
      try {
        if (typeof sessionStorage !== 'undefined') {
          const raw = sessionStorage.getItem('sda_pending_challenge_action');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (
              parsed.challengeId === challenge.id &&
              parsed.dateKey === getLocalDateKey() &&
              parsed.actionId
            ) {
              pendingActionIdRef.current = parsed.actionId;
            }
          }
        }
      } catch {}
    } else {
      pendingActionIdRef.current = null;
    }
  }, [isOpen, challenge.id]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentDay = challenge.currentDay;
  const totalDays = challenge.durationDays;

  const handleSubmitStatus = () => {
    if (!selectedStatus || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    const dateKey = getLocalDateKey();
    if (!pendingActionIdRef.current) {
      pendingActionIdRef.current = `ch_ci_${challenge.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(
            'sda_pending_challenge_action',
            JSON.stringify({
              actionId: pendingActionIdRef.current,
              challengeId: challenge.id,
              dateKey,
            })
          );
        }
      } catch {}
    }

    try {
      const res = recordChallengeCheckIn({
        challengeId: challenge.id,
        status: selectedStatus,
        actionId: pendingActionIdRef.current,
        actionTaken: selectedStatus === 'slip' ? 'recommit' : 'continue',
        dateKey,
      });

      if (!res || res.status === 'storage_failed') {
        setSubmissionError(
          t.challenge_checkin_error_storage ||
            'Storage error: check-in could not be saved. Please try again.'
        );
        return;
      }

      if (res.status === 'challenge_not_active') {
        setSubmissionError(
          t.challenge_checkin_error_inactive ||
            'This challenge has ended or is no longer active.'
        );
        pendingActionIdRef.current = null;
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('sda_pending_challenge_action');
          }
        } catch {}
        return;
      }

      // Success (saved or duplicate reconcile)
      pendingActionIdRef.current = null;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('sda_pending_challenge_action');
        }
      } catch {}

      if (selectedStatus === 'on-structure') {
        playFeedback('win');
      } else if (selectedStatus === 'near-slip') {
        playFeedback('recovery');
      }

      setStep('confirmed');
      if (onCheckInCompleted) {
        onCheckInCompleted();
      }
    } catch {
      setSubmissionError(
        t.challenge_checkin_error_storage ||
          'Storage error: check-in could not be saved. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHoldRecommitComplete = () => {
    const recommitId = generateId();
    saveRecommitEvent({
      id: recommitId,
      timestamp: Date.now(),
    });
    recordScoreEvent({
      activityType: 'RECOMMIT',
      sourceId: `recommit_${recommitId}`,
      metadata: { challengeId: challenge.id },
    });
    playFeedback('commit');
    setHasRecommitted(true);
    if (onRecommitCompleted) {
      setTimeout(() => {
        onRecommitCompleted();
      }, 500);
    }
  };

  const handleContinueChallenge = () => {
    onClose();
  };

  return (
    <div
      className="challenge-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="challenge-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-checkin-title"
      >
        <button
          id="btn-close-challenge-checkin"
          type="button"
          className="challenge-modal-close"
          onClick={onClose}
          aria-label={t.recommit_btn_cancel || 'Close'}
        >
          ✕
        </button>

        {step === 'select' ? (
          /* ── STEP 1: REPORT STATUS ── */
          <div className="challenge-checkin-step-content">
            <div className="challenge-modal-header">
              <span className="challenge-modal-badge">
                {t.challenge_checkin_day_badge
                  ?.replace('{current}', String(currentDay))
                  ?.replace('{total}', String(totalDays)) || `Day ${currentDay} of ${totalDays}`}
              </span>
              <h2 id="challenge-checkin-title" className="challenge-modal-title">
                {t.challenge_checkin_modal_title || 'Challenge Check-In'}
              </h2>
              <p className="challenge-modal-sub">
                {t.challenge_checkin_prompt || 'Report your current structure status'}
              </p>
            </div>

            <div className="challenge-status-options-grid">
              {/* Option 1: On Structure */}
              <button
                type="button"
                id="btn-status-on-structure"
                className={`challenge-status-btn ${selectedStatus === 'on-structure' ? 'challenge-status-btn--selected' : ''}`}
                onClick={() => setSelectedStatus('on-structure')}
              >
                <div className="status-btn-icon-wrap status-btn-icon-wrap--on-structure">
                  <span>✓</span>
                </div>
                <div className="status-btn-text">
                  <span className="status-btn-title">
                    {t.challenge_checkin_status_on_structure || 'On Structure'}
                  </span>
                  <span className="status-btn-desc">
                    {t.challenge_checkin_status_on_structure_sub || 'Following my structure plan as intended.'}
                  </span>
                </div>
              </button>

              {/* Option 2: Near Slip */}
              <button
                type="button"
                id="btn-status-near-slip"
                className={`challenge-status-btn ${selectedStatus === 'near-slip' ? 'challenge-status-btn--selected' : ''}`}
                onClick={() => setSelectedStatus('near-slip')}
              >
                <div className="status-btn-icon-wrap status-btn-icon-wrap--near-slip">
                  <span>⚡</span>
                </div>
                <div className="status-btn-text">
                  <span className="status-btn-title">
                    {t.challenge_checkin_status_near_slip || 'Near Slip'}
                  </span>
                  <span className="status-btn-desc">
                    {t.challenge_checkin_status_near_slip_sub || 'Encountered temptation, but caught it early.'}
                  </span>
                </div>
              </button>

              {/* Option 3: Slip */}
              <button
                type="button"
                id="btn-status-slip"
                className={`challenge-status-btn ${selectedStatus === 'slip' ? 'challenge-status-btn--selected' : ''}`}
                onClick={() => setSelectedStatus('slip')}
              >
                <div className="status-btn-icon-wrap status-btn-icon-wrap--slip">
                  <span>↻</span>
                </div>
                <div className="status-btn-text">
                  <span className="status-btn-title">
                    {t.challenge_checkin_status_slip || 'True Slip'}
                  </span>
                  <span className="status-btn-desc">
                    {t.challenge_checkin_status_slip_sub || 'Off-structure eating occurred — ready to practice recovery.'}
                  </span>
                </div>
              </button>
            </div>

            {/* Optional Diet reporting gateway */}
            <div className="challenge-diet-gateway">
              <button
                type="button"
                id="btn-checkin-open-diet"
                className="challenge-diet-link"
                onClick={() => {
                  onClose();
                  onNavigate('structured-diet');
                }}
              >
                {t.challenge_checkin_diet_link || 'Need to verify specific meal blocks? Log in Structured Diet →'}
              </button>
            </div>

            <div className="challenge-modal-actions">
              {submissionError && (
                <div className="challenge-checkin-error-banner" role="alert">
                  <span>{submissionError}</span>
                </div>
              )}
              <button
                type="button"
                id="btn-submit-challenge-checkin"
                className="challenge-primary-submit-btn"
                disabled={!selectedStatus || isSubmitting}
                onClick={handleSubmitStatus}
              >
                <span>{t.challenge_checkin_btn_submit || 'Submit Check-In'}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STEP 2: CONFIRMED FEEDBACK & ACTIONS ── */
          <div className="challenge-checkin-step-content challenge-checkin-feedback">
            {selectedStatus === 'on-structure' && (
              <div className="feedback-section feedback-section--win">
                <div className="feedback-icon-hero">🏆</div>
                <h3 className="feedback-title">
                  {t.challenge_checkin_win_title || 'Structure Maintained!'}
                </h3>
                <p className="feedback-desc">
                  {t.challenge_checkin_win_desc ||
                    'Consistency is your superpower. Every on-structure check-in builds lasting momentum.'}
                </p>

                {firstReason && (
                  <div className="feedback-why-card">
                    <span className="feedback-why-tag">{t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}</span>
                    <p className="feedback-why-text">"{firstReason}"</p>
                  </div>
                )}

                <div className="feedback-actions-stack">
                  <button
                    type="button"
                    id="btn-ci-continue-challenge"
                    className="challenge-primary-submit-btn"
                    onClick={handleContinueChallenge}
                  >
                    <span>{t.challenge_checkin_btn_continue || 'Continue Challenge'}</span>
                    <span>→</span>
                  </button>
                  <button
                    type="button"
                    id="btn-ci-review-nn"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('commitment');
                    }}
                  >
                    {t.challenge_checkin_action_nn || 'Review Non-Negotiables'}
                  </button>
                  <button
                    type="button"
                    id="btn-ci-diet-diet"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('structured-diet');
                    }}
                  >
                    {t.challenge_checkin_action_diet || 'Return to Structured Diet'}
                  </button>
                </div>
              </div>
            )}

            {selectedStatus === 'near-slip' && (
              <div className="feedback-section feedback-section--near">
                <div className="feedback-icon-hero">⚡</div>
                <h3 className="feedback-title">
                  {t.challenge_checkin_near_title || 'Urge Handled!'}
                </h3>
                <p className="feedback-desc">
                  {t.challenge_checkin_near_desc ||
                    'Awareness is a win. Catching urges before they become slips strengthens your Resume-Ability.'}
                </p>

                {firstReason && (
                  <div className="feedback-why-card">
                    <span className="feedback-why-tag">{t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}</span>
                    <p className="feedback-why-text">"{firstReason}"</p>
                  </div>
                )}

                <div className="feedback-actions-stack">
                  <button
                    type="button"
                    id="btn-ci-continue-challenge"
                    className="challenge-primary-submit-btn"
                    onClick={handleContinueChallenge}
                  >
                    <span>{t.challenge_checkin_btn_continue || 'Continue Challenge'}</span>
                    <span>→</span>
                  </button>
                  <button
                    type="button"
                    id="btn-ci-timer"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('context');
                    }}
                  >
                    ⏱ {t.challenge_checkin_action_timer || '15-Min Urge Delay (Timer)'}
                  </button>
                  <button
                    type="button"
                    id="btn-ci-review-why"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('commitment');
                    }}
                  >
                    {t.challenge_checkin_action_why || 'Review My Why'}
                  </button>
                </div>
              </div>
            )}

            {selectedStatus === 'slip' && (
              <div className="feedback-section feedback-section--slip">
                <div className="feedback-icon-hero">🔄</div>
                <h3 className="feedback-title">
                  {t.challenge_checkin_slip_title || 'Opportunity to Practice'}
                </h3>
                <p className="feedback-desc">
                  {t.challenge_checkin_slip_desc ||
                    'Slips never fail or reset your Challenge. Slips are opportunities to practice recovery.'}
                </p>

                {/* Hold to Re-Commit ritual */}
                <div className="challenge-recommit-ritual-wrap">
                  {!hasRecommitted ? (
                    <>
                      <p className="challenge-recommit-hint">
                        {t.challenge_checkin_recommit_hint || 'Hold to re-commit and refocus on your structured plan.'}
                      </p>
                      <HoldCommitButton
                        id="btn-challenge-recommit-hold"
                        variant="recommit"
                        label={`→ ${t.recommit_hold_btn || 'HOLD TO RE-COMMIT'}`}
                        onComplete={handleHoldRecommitComplete}
                      />
                    </>
                  ) : (
                    <div className="challenge-recommitted-badge">
                      <span className="recommitted-check">✓</span>
                      <span>{t.challenge_checkin_recommitted_success || 'Re-commitment registered! You are back on track.'}</span>
                    </div>
                  )}
                </div>

                <div className="feedback-actions-stack">
                  <button
                    type="button"
                    id="btn-ci-continue-challenge"
                    className="challenge-primary-submit-btn"
                    onClick={handleContinueChallenge}
                  >
                    <span>{t.challenge_checkin_btn_continue || 'Continue Challenge'}</span>
                    <span>→</span>
                  </button>
                  <button
                    type="button"
                    id="btn-ci-log-diet-slip"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('structured-diet');
                    }}
                  >
                    {t.challenge_checkin_diet_link || 'Log in Structured Diet →'}
                  </button>
                  <button
                    type="button"
                    id="btn-ci-emergency-timer"
                    className="challenge-secondary-action-btn"
                    onClick={() => {
                      onClose();
                      onNavigate('context');
                    }}
                  >
                    ⏱ {t.ci_action_timer || 'Recovery Timer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
