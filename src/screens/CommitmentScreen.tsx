import { useState, useCallback, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon } from '../components/icons/AppIcon';
import TermHelp from '../components/TermHelp';
import {
  loadPledge,
  savePledge,
  MAX_NON_NEGOTIABLES,
} from '../utils/pledgeStorage';
import type { PledgeData } from '../utils/pledgeStorage';
import ResetStatsModal from '../components/ResetStatsModal';
import NonNegotiablesCommitModal from '../components/NonNegotiablesCommitModal';
import { hasCommittedNonNegotiables } from '../utils/inControlStorage';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import './CommitmentScreen.css';

interface CommitmentScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

export default function CommitmentScreen({ onNavigate, onBack }: CommitmentScreenProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<PledgeData>(() => loadPledge());
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [hasCommittedNN, setHasCommittedNN] = useState(() => hasCommittedNonNegotiables());

  // Direct access focus from Main Menu / More Sheet (e.g. Non-Negotiables button)
  useEffect(() => {
    try {
      const focus = sessionStorage.getItem('commitment_focus');
      if (focus === 'nn') {
        sessionStorage.removeItem('commitment_focus');
        setTimeout(() => {
          const el = document.getElementById('section-non-negotiables');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      } else if (focus === 'why') {
        sessionStorage.removeItem('commitment_focus');
        setTimeout(() => {
          const el = document.getElementById('section-why');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
      }
    } catch {
      // ignore
    }
  }, []);

  // Listen to stats reset event to update commitment button label
  useEffect(() => {
    const handleStatsReset = () => {
      setHasCommittedNN(hasCommittedNonNegotiables());
    };
    window.addEventListener(STATS_RESET_EVENT, handleStatsReset);
    return () => window.removeEventListener(STATS_RESET_EVENT, handleStatsReset);
  }, []);

  // ── Reason edit state ──────────────────────────────────────────────────────
  const [editReasonIdx, setEditReasonIdx] = useState<number | null>(null);
  const [editReasonText, setEditReasonText] = useState('');
  const [addingReason, setAddingReason] = useState(false);
  const [newReasonText, setNewReasonText] = useState('');

  // ── Non-Negotiable edit state ──────────────────────────────────────────────
  const [editNNIdx, setEditNNIdx] = useState<number | null>(null);
  const [editNNText, setEditNNText] = useState('');
  const [addingNN, setAddingNN] = useState(false);
  const [newNNText, setNewNNText] = useState('');

  // ── Helper: update state + persist ────────────────────────────────────────
  const update = useCallback((updater: (d: PledgeData) => PledgeData) => {
    setData(prev => {
      const next = updater({ ...prev });
      savePledge(next);
      return next;
    });
  }, []);

  // ── Reason actions ─────────────────────────────────────────────────────────
  const startEditReason = (idx: number) => {
    setEditReasonIdx(idx);
    setEditReasonText(data.reasons[idx]);
    setAddingReason(false);
    setNewReasonText('');
  };

  const saveReason = (idx: number) => {
    const text = editReasonText.trim();
    if (!text) { setEditReasonIdx(null); return; }
    update(d => {
      const reasons = [...d.reasons];
      reasons[idx] = text;
      return { ...d, reasons };
    });
    setEditReasonIdx(null);
  };

  const deleteReason = (idx: number) => {
    if (editReasonIdx === idx) setEditReasonIdx(null);
    update(d => ({ ...d, reasons: d.reasons.filter((_, i) => i !== idx) }));
  };

  const commitAddReason = () => {
    const text = newReasonText.trim();
    if (text) {
      update(d => ({ ...d, reasons: [...d.reasons, text] }));
    }
    setNewReasonText('');
    setAddingReason(false);
  };

  const cancelAddReason = () => {
    setNewReasonText('');
    setAddingReason(false);
  };

  // ── Non-Negotiable actions ─────────────────────────────────────────────────
  const nnAtLimit = data.nonNegotiables.length >= MAX_NON_NEGOTIABLES;

  const startEditNN = (idx: number) => {
    setEditNNIdx(idx);
    setEditNNText(data.nonNegotiables[idx]);
    setAddingNN(false);
    setNewNNText('');
  };

  const saveNN = (idx: number) => {
    const text = editNNText.trim();
    if (!text) { setEditNNIdx(null); return; }
    update(d => {
      const nonNegotiables = [...d.nonNegotiables];
      nonNegotiables[idx] = text;
      return { ...d, nonNegotiables };
    });
    setEditNNIdx(null);
  };

  const deleteNN = (idx: number) => {
    if (editNNIdx === idx) setEditNNIdx(null);
    update(d => ({ ...d, nonNegotiables: d.nonNegotiables.filter((_, i) => i !== idx) }));
  };

  const commitAddNN = () => {
    const text = newNNText.trim();
    if (text && !nnAtLimit) {
      update(d => ({ ...d, nonNegotiables: [...d.nonNegotiables, text] }));
    }
    setNewNNText('');
    setAddingNN(false);
  };

  const cancelAddNN = () => {
    setNewNNText('');
    setAddingNN(false);
  };

  const handleBack = () => {
    if (showResetModal) {
      setShowResetModal(false);
      return;
    }
    if (showCommitModal) {
      setShowCommitModal(false);
      return;
    }
    if (onBack) {
      onBack();
    } else {
      onNavigate('home');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="screen commit-screen" id="commitment-screen">
      <PremiumScreenHeader
        title={t.commit_heading}
        eyebrow={t.commit_label}
        onBack={handleBack}
        backId="btn-header-back"
        backAriaLabel={t.global_back || 'Go back'}
        backText={t.global_back || 'Back'}
        showScoreBadge={true}
        onNavigate={onNavigate}
        rightAction={
          <button
            id="btn-header-home"
            type="button"
            className="sda-premium-header__home-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_return_to_main || 'Go home'}
          >
            <AppIcon name="home" size={18} />
          </button>
        }
      />

      <div className="commit-inner">
        <div className="commit-content">
          {/* ════ 1. WHY I'M DOING THIS ════ */}
          <section className="commit-section" aria-label={t.commit_why_section} id="section-why">
            <h2 className="commit-section-title">{t.commit_why_section}</h2>

            <div className="commit-list">
              {data.reasons.map((reason, idx) => (
                <div key={idx} className="commit-item">
                  {editReasonIdx === idx ? (
                    <div className="commit-item-edit">
                      <input
                        id={`reason-edit-${idx}`}
                        className="commit-input"
                        value={editReasonText}
                        onChange={e => setEditReasonText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveReason(idx);
                          if (e.key === 'Escape') setEditReasonIdx(null);
                        }}
                        autoFocus
                        maxLength={120}
                        aria-label="Edit reason"
                      />
                      <div className="commit-item-actions">
                        <button
                          type="button"
                          className="commit-btn commit-btn--save"
                          onClick={() => saveReason(idx)}
                        >
                          {t.commit_save}
                        </button>
                        <button
                          type="button"
                          className="commit-btn commit-btn--cancel"
                          onClick={() => setEditReasonIdx(null)}
                        >
                          {t.commit_cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="commit-item-row">
                      <span className="commit-reason-dot" aria-hidden="true" />
                      <span className="commit-item-text">{reason}</span>
                      <div className="commit-item-controls">
                        <button
                          type="button"
                          className="commit-icon-btn"
                          onClick={() => startEditReason(idx)}
                          aria-label={`${t.commit_edit}: ${reason}`}
                          title={t.commit_edit}
                        >
                          <AppIcon name="pencil" size={15} />
                        </button>
                        <button
                          type="button"
                          className="commit-icon-btn commit-icon-btn--delete"
                          onClick={() => deleteReason(idx)}
                          aria-label={`${t.commit_delete}: ${reason}`}
                          title={t.commit_delete}
                        >
                          <AppIcon name="trash-2" size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add reason */}
              {addingReason ? (
                <div className="commit-item-add">
                  <input
                    id="reason-new-input"
                    className="commit-input"
                    placeholder={t.commit_why_placeholder}
                    value={newReasonText}
                    onChange={e => setNewReasonText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitAddReason();
                      if (e.key === 'Escape') cancelAddReason();
                    }}
                    autoFocus
                    maxLength={120}
                    aria-label="New reason"
                  />
                  <div className="commit-item-actions">
                    <button type="button" className="commit-btn commit-btn--save" onClick={commitAddReason}>
                      {t.commit_save}
                    </button>
                    <button type="button" className="commit-btn commit-btn--cancel" onClick={cancelAddReason}>
                      {t.commit_cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-add-reason"
                  type="button"
                  className="commit-add-btn"
                  onClick={() => { setAddingReason(true); setEditReasonIdx(null); }}
                >
                  {t.commit_why_add}
                </button>
              )}
            </div>
          </section>

          {/* ════ 2. MY NON-NEGOTIABLES ════ */}
          <section className="commit-section" aria-label={t.commit_nn_section} id="section-non-negotiables">
            <div className="commit-section-header">
              <div className="commit-title-row">
                <h2 className="commit-section-title">{t.commit_nn_section}</h2>
                <TermHelp termKey="nn" btnId="btn-help-commit-nn" />
              </div>
              <span className="commit-nn-count">
                {data.nonNegotiables.length} / {MAX_NON_NEGOTIABLES}
              </span>
            </div>
            <p className="commit-section-desc-hint">{t.sda_term_nn_def}</p>
            <p className="commit-section-hint">{t.commit_nn_limit}</p>

            <div className="commit-list">
              {data.nonNegotiables.map((nn, idx) => (
                <div key={idx} className="commit-item">
                  {editNNIdx === idx ? (
                    <div className="commit-item-edit">
                      <input
                        id={`nn-edit-${idx}`}
                        className="commit-input"
                        value={editNNText}
                        onChange={e => setEditNNText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveNN(idx);
                          if (e.key === 'Escape') setEditNNIdx(null);
                        }}
                        autoFocus
                        maxLength={80}
                        aria-label="Edit non-negotiable"
                      />
                      <div className="commit-item-actions">
                        <button
                          type="button"
                          className="commit-btn commit-btn--save"
                          onClick={() => saveNN(idx)}
                        >
                          {t.commit_save}
                        </button>
                        <button
                          type="button"
                          className="commit-btn commit-btn--cancel"
                          onClick={() => setEditNNIdx(null)}
                        >
                          {t.commit_cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="commit-item-row">
                      <span className="commit-nn-number" aria-hidden="true">{idx + 1}</span>
                      <span className="commit-item-text">{nn}</span>
                      <div className="commit-item-controls">
                        <button
                          type="button"
                          className="commit-icon-btn"
                          onClick={() => startEditNN(idx)}
                          aria-label={`${t.commit_edit}: ${nn}`}
                          title={t.commit_edit}
                        >
                          <AppIcon name="pencil" size={15} />
                        </button>
                        <button
                          type="button"
                          className="commit-icon-btn commit-icon-btn--delete"
                          onClick={() => deleteNN(idx)}
                          aria-label={`${t.commit_delete}: ${nn}`}
                          title={t.commit_delete}
                        >
                          <AppIcon name="trash-2" size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add / limit */}
              {nnAtLimit ? (
                <p className="commit-limit-msg" role="status">{t.commit_nn_limit_reached}</p>
              ) : addingNN ? (
                <div className="commit-item-add">
                  <input
                    id="nn-new-input"
                    className="commit-input"
                    placeholder={t.commit_nn_placeholder}
                    value={newNNText}
                    onChange={e => setNewNNText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitAddNN();
                      if (e.key === 'Escape') cancelAddNN();
                    }}
                    autoFocus
                    maxLength={80}
                    aria-label="New non-negotiable"
                  />
                  <div className="commit-item-actions">
                    <button type="button" className="commit-btn commit-btn--save" onClick={commitAddNN}>
                      {t.commit_save}
                    </button>
                    <button type="button" className="commit-btn commit-btn--cancel" onClick={cancelAddNN}>
                      {t.commit_cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-add-nn"
                  type="button"
                  className="commit-add-btn"
                  onClick={() => { setAddingNN(true); setEditNNIdx(null); }}
                >
                  {t.commit_nn_add}
                </button>
              )}
            </div>

            {/* Non-Negotiables Commitment Action */}
            {data.nonNegotiables.length > 0 ? (
              <div className="commit-nn-action-wrap">
                <button
                  id="btn-commit-nn"
                  type="button"
                  className="commit-nn-btn"
                  onClick={() => setShowCommitModal(true)}
                  aria-label={hasCommittedNN ? t.nn_recommit_btn : t.nn_commit_btn}
                >
                  <AppIcon name="zap" size={18} />
                  <span>{hasCommittedNN ? t.nn_recommit_btn : t.nn_commit_btn}</span>
                </button>
              </div>
            ) : (
              <div className="commit-nn-empty-notice" role="note">
                <p className="commit-nn-empty-text">{t.nn_commit_empty_hint}</p>
              </div>
            )}
          </section>

          {/* ════ 3. MY SLIPPERY ZONES ENTRY ════ */}
          <section className="commit-section commit-section--sz" aria-label={t.my_commitments_card_sz_title}>
            <h2 className="commit-section-title">{t.my_commitments_card_sz_title}</h2>
            <p className="commit-diet-hint">{t.my_commitments_card_sz_desc}</p>
            <button
              id="btn-commit-slippery-zones"
              type="button"
              className="commit-diet-btn"
              onClick={() => onNavigate('my-slippery-zones')}
            >
              <span className="commit-diet-btn-left">
                <span className="commit-diet-btn-icon commit-diet-btn-icon--amber" aria-hidden="true">
                  <AppIcon name="alert-triangle" size={18} />
                </span>
                <span>{t.my_commitments_card_sz_title}</span>
              </span>
              <span className="commit-diet-btn-arrow" aria-hidden="true">
                <AppIcon name="chevron-right" size={18} />
              </span>
            </button>
          </section>

          {/* ════ 4. STRUCTURED DIET ENTRY ════ */}
          <section className="commit-section commit-section--diet" aria-label={t.sdb_label}>
            <h2 className="commit-section-title">{t.sdb_label}</h2>
            <p className="commit-diet-hint">{t.sdb_commit_hint}</p>
            <button
              id="btn-structured-diet"
              type="button"
              className="commit-diet-btn"
              onClick={() => onNavigate('structured-diet')}
            >
              <span className="commit-diet-btn-left">
                <span className="commit-diet-btn-icon" aria-hidden="true">
                  <AppIcon name="utensils" size={18} />
                </span>
                <span>{t.sdb_open_builder}</span>
              </span>
              <span className="commit-diet-btn-arrow" aria-hidden="true">
                <AppIcon name="chevron-right" size={18} />
              </span>
            </button>
          </section>

          {/* ════ 5. SMART REMINDERS ENTRY ════ */}
          <section className="commit-section commit-section--reminders" aria-label={t.commit_reminders_label}>
            <h2 className="commit-section-title">{t.commit_reminders_label}</h2>
            <p className="commit-diet-hint">{t.commit_reminders_desc}</p>
            <button
              id="btn-reminders-settings"
              type="button"
              className="commit-diet-btn"
              onClick={() => onNavigate('notification-settings')}
            >
              <span className="commit-diet-btn-left">
                <span className="commit-diet-btn-icon" aria-hidden="true">
                  <AppIcon name="bell" size={18} />
                </span>
                <span>{t.commit_reminders_btn}</span>
              </span>
              <span className="commit-diet-btn-arrow" aria-hidden="true">
                <AppIcon name="chevron-right" size={18} />
              </span>
            </button>
          </section>

          {/* ════ 6. DATA & STATISTICS (SEPARATED DESTRUCTIVE ZONE) ════ */}
          <section className="commit-section commit-section--data-stats" aria-label={t.stats_section_title}>
            <h2 className="commit-section-title commit-section-title--danger">{t.stats_section_title}</h2>
            <p className="commit-diet-hint">{t.stats_reset_section_desc}</p>
            <button
              id="btn-reset-all-stats"
              type="button"
              className="commit-reset-stats-btn"
              onClick={() => setShowResetModal(true)}
            >
              <AppIcon name="rotate-ccw" size={16} />
              <span>{t.stats_reset_btn}</span>
            </button>
          </section>

          {/* Return to Main Menu Action */}
          <div className="recommit-cancel-wrap">
            <button
              id="btn-commitment-cancel"
              type="button"
              className="recommit-cancel-btn"
              onClick={() => onNavigate('home')}
              aria-label={t.btn_return_to_main}
            >
              <AppIcon name="home" size={16} />
              <span>{t.btn_return_to_main}</span>
            </button>
          </div>
        </div>
      </div>

      <ResetStatsModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          setData(loadPledge());
          setShowResetModal(false);
        }}
      />

      {/* Non-Negotiables Commit Modal */}
      <NonNegotiablesCommitModal
        isOpen={showCommitModal}
        nonNegotiables={data.nonNegotiables}
        onClose={() => setShowCommitModal(false)}
        onCommitSuccess={() => setHasCommittedNN(true)}
        onNavigateHome={() => onNavigate('home')}
      />
    </div>
  );
}
