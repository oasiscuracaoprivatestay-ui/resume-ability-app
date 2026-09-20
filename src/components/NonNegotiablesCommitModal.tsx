import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { saveCommitEvent } from '../utils/inControlStorage';
import { generateId } from '../utils';
import { recordScoreEvent } from '../utils/scoringEngine';
import CheckableCommitmentItem from './CheckableCommitmentItem';
import HoldCommitButton from './HoldCommitButton';
import './NonNegotiablesCommitModal.css';

interface NonNegotiablesCommitModalProps {
  isOpen: boolean;
  nonNegotiables: string[];
  onClose: () => void;
  onCommitSuccess: () => void;
  onNavigateHome: () => void;
}

type ModalStep = 'hold' | 'success';

export default function NonNegotiablesCommitModal({
  isOpen,
  nonNegotiables,
  onClose,
  onCommitSuccess,
  onNavigateHome,
}: NonNegotiablesCommitModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>('hold');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  // Reset state whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setStep('hold');
      setCheckedItems({});
    }
  }, [isOpen]);

  // Handle ESC key to close (only if not in success state)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'success') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  const toggleCheckItem = useCallback((idx: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }, []);

  const checkedCount = useMemo(() => {
    return nonNegotiables.filter((_, idx) => !!checkedItems[idx]).length;
  }, [nonNegotiables, checkedItems]);

  const allChecked = useMemo(() => {
    if (nonNegotiables.length === 0) return true;
    return nonNegotiables.every((_, idx) => !!checkedItems[idx]);
  }, [nonNegotiables, checkedItems]);

  // Complete commitment action
  const completeCommit = useCallback(() => {
    // Persist single CommitEvent with source 'non-negotiables'
    const id = generateId();
    saveCommitEvent({
      id,
      timestamp: Date.now(),
      source: 'non-negotiables',
    });

    recordScoreEvent({
      activityType: 'COMMITMENT_COMPLETE',
      sourceId: `commitment_${id}`,
    });

    onCommitSuccess();

    // Transition to success confirmation
    setStep('success');
  }, [onCommitSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="nn-commit-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nn-commit-modal-title"
    >
      <div className="nn-commit-backdrop" onClick={step === 'success' ? undefined : onClose} />

      <div className="nn-commit-dialog">
        {/* Close Button */}
        {step !== 'success' && (
          <button
            type="button"
            className="nn-commit-close-btn"
            onClick={onClose}
            aria-label={t.sz_cancel_btn || 'Close'}
          >
            ✕
          </button>
        )}

        {step === 'hold' ? (
          <div className="nn-commit-main">
            {/* Header / Context */}
            <div className="nn-commit-header">
              <span className="section-label">{t.commit_badge}</span>
              <h2 id="nn-commit-modal-title" className="nn-commit-title">
                {t.commit_title}
              </h2>
              <p className="nn-commit-subtitle">
                {t.commit_subtitle}
              </p>
            </div>

            {/* User's Non-Negotiables List (Individually Checkable) */}
            <div className="nn-commit-list-section">
              <div className="nn-commit-list-header-row">
                <span className="nn-commit-list-label">{t.commit_nn_section}</span>
                {nonNegotiables.length > 0 && (
                  <span className="nn-commit-count-badge">
                    {checkedCount} / {nonNegotiables.length}
                  </span>
                )}
              </div>
              <div
                className="nn-commit-list"
                role="group"
                aria-label={t.commit_nn_section}
              >
                {nonNegotiables.map((nn, idx) => (
                  <CheckableCommitmentItem
                    key={idx}
                    id={`modal-nn-check-${idx}`}
                    index={idx}
                    text={nn}
                    checked={!!checkedItems[idx]}
                    onToggle={() => toggleCheckItem(idx)}
                  />
                ))}
              </div>
            </div>

            {/* Standardized Hold to Commit Ritual */}
            <div className="nn-commit-hold-container">
              <HoldCommitButton
                id="btn-nn-hold-commit"
                variant="commit"
                label={`→ ${t.commit_hold_btn || 'HOLD TO COMMIT'}`}
                disabled={!allChecked}
                disabledReason={
                  !allChecked
                    ? `${t.nn_review_check_all_first || 'Review each Non-Negotiable first'} (${checkedCount}/${nonNegotiables.length})`
                    : undefined
                }
                onComplete={completeCommit}
              />

              {/* Cancel / Return Action (Sergio Feedback) */}
              <div className="nn-commit-cancel-wrap">
                <button
                  id="btn-nn-cancel"
                  type="button"
                  className="nn-commit-cancel-btn"
                  onClick={onClose}
                  aria-label={t.commit_btn_cancel || 'Cancel / Return to Main Menu'}
                >
                  ✕ {t.commit_btn_cancel || 'Cancel / Return to Main Menu'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="nn-commit-success" aria-live="polite">
            <div className="nn-commit-success-icon-wrap">
              <span className="nn-commit-success-icon" aria-hidden="true">✓</span>
            </div>

            <h2 id="nn-commit-modal-title" className="nn-commit-success-title">
              {t.nn_commit_success_title}
            </h2>
            <p className="nn-commit-success-sub">
              {t.nn_commit_success_sub}
            </p>

            <div className="nn-commit-success-actions">
              <button
                id="btn-nn-commit-continue"
                className="nn-commit-btn-continue"
                onClick={onClose}
              >
                {t.nn_commit_btn_continue}
              </button>
              <button
                id="btn-nn-commit-home"
                className="nn-commit-btn-home"
                onClick={onNavigateHome}
              >
                {t.nn_commit_btn_return_home}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
