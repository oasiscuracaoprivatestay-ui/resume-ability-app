import { useState, useCallback } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import {
  loadPledge,
  savePledge,
  MAX_NON_NEGOTIABLES,
} from '../utils/pledgeStorage';
import type { PledgeData } from '../utils/pledgeStorage';
import './CommitmentScreen.css';

interface CommitmentScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function CommitmentScreen({ onNavigate }: CommitmentScreenProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<PledgeData>(() => loadPledge());

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="screen commit-screen">
      <div className="commit-inner">
        <ScreenHeader
          onBack={() => onNavigate('home')}
          onHome={() => onNavigate('home')}
        />

        <div className="commit-content">
          {/* Heading */}
          <div className="commit-heading-block">
            <span className="section-label">{t.commit_label}</span>
            <h1 className="commit-heading">{t.commit_heading}</h1>
          </div>

          {/* ════ WHY I'M DOING THIS ════ */}
          <section className="commit-section" aria-label={t.commit_why_section}>
            <h2 className="commit-section-title">{t.commit_why_section}</h2>

            <div className="commit-list">
              {data.reasons.map((reason, idx) => (
                <div key={idx} className="commit-item">
                  {editReasonIdx === idx ? (
                    /* ── Edit mode ── */
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
                          className="commit-btn commit-btn--save"
                          onClick={() => saveReason(idx)}
                        >
                          {t.commit_save}
                        </button>
                        <button
                          className="commit-btn commit-btn--cancel"
                          onClick={() => setEditReasonIdx(null)}
                        >
                          {t.commit_cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div className="commit-item-row">
                      <span className="commit-reason-dot" aria-hidden="true">◉</span>
                      <span className="commit-item-text">{reason}</span>
                      <div className="commit-item-controls">
                        <button
                          className="commit-icon-btn"
                          onClick={() => startEditReason(idx)}
                          aria-label={`${t.commit_edit}: ${reason}`}
                          title={t.commit_edit}
                        >
                          ✎
                        </button>
                        <button
                          className="commit-icon-btn commit-icon-btn--delete"
                          onClick={() => deleteReason(idx)}
                          aria-label={`${t.commit_delete}: ${reason}`}
                          title={t.commit_delete}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* ── Add reason ── */}
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
                    <button className="commit-btn commit-btn--save" onClick={commitAddReason}>
                      {t.commit_save}
                    </button>
                    <button className="commit-btn commit-btn--cancel" onClick={cancelAddReason}>
                      {t.commit_cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-add-reason"
                  className="commit-add-btn"
                  onClick={() => { setAddingReason(true); setEditReasonIdx(null); }}
                >
                  {t.commit_why_add}
                </button>
              )}
            </div>
          </section>

          {/* ════ NON-NEGOTIABLES ════ */}
          <section className="commit-section" aria-label={t.commit_nn_section}>
            <div className="commit-section-header">
              <h2 className="commit-section-title">{t.commit_nn_section}</h2>
              <span className="commit-nn-count">
                {data.nonNegotiables.length} / {MAX_NON_NEGOTIABLES}
              </span>
            </div>
            <p className="commit-section-hint">{t.commit_nn_limit}</p>

            <div className="commit-list">
              {data.nonNegotiables.map((nn, idx) => (
                <div key={idx} className="commit-item">
                  {editNNIdx === idx ? (
                    /* ── Edit mode ── */
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
                          className="commit-btn commit-btn--save"
                          onClick={() => saveNN(idx)}
                        >
                          {t.commit_save}
                        </button>
                        <button
                          className="commit-btn commit-btn--cancel"
                          onClick={() => setEditNNIdx(null)}
                        >
                          {t.commit_cancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div className="commit-item-row">
                      <span className="commit-nn-number" aria-hidden="true">{idx + 1}</span>
                      <span className="commit-item-text">{nn}</span>
                      <div className="commit-item-controls">
                        <button
                          className="commit-icon-btn"
                          onClick={() => startEditNN(idx)}
                          aria-label={`${t.commit_edit}: ${nn}`}
                          title={t.commit_edit}
                        >
                          ✎
                        </button>
                        <button
                          className="commit-icon-btn commit-icon-btn--delete"
                          onClick={() => deleteNN(idx)}
                          aria-label={`${t.commit_delete}: ${nn}`}
                          title={t.commit_delete}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* ── Add / limit ── */}
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
                    <button className="commit-btn commit-btn--save" onClick={commitAddNN}>
                      {t.commit_save}
                    </button>
                    <button className="commit-btn commit-btn--cancel" onClick={cancelAddNN}>
                      {t.commit_cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  id="btn-add-nn"
                  className="commit-add-btn"
                  onClick={() => { setAddingNN(true); setEditNNIdx(null); }}
                >
                  {t.commit_nn_add}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
