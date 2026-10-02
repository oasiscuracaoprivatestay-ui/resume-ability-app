/**
 * SDA AI Coach — Screen UI (Phase 33 & Phase 34)
 *
 * Dedicated conversational interface for the Super Diet-Ability Coach.
 *
 * Features:
 * - Mobile-first responsive layout with safe areas & bottom navigation padding
 * - Clean message bubble stream with Coach / User roles
 * - Starter prompt quick chips
 * - Clarification choices (Phase 34)
 * - Action Proposal preview cards with Confirm / Edit / Cancel (Phase 34)
 * - Proposal editor modal (Phase 34)
 * - Strictly read-only: Confirm button never mutates app data
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import {
  coachEngine,
  loadCoachConversation,
  saveCoachConversation,
  clearCoachConversation,
  type CoachMessage,
  type CoachActionProposal,
} from '../coach';
import './CoachScreen.css';

interface CoachScreenProps {
  onNavigate: (target: Screen) => void;
  onBack: () => void;
}

export default function CoachScreen({ onNavigate: _onNavigate, onBack }: CoachScreenProps) {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<CoachMessage[]>(() => loadCoachConversation().messages);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Proposal edit modal state (Phase 34)
  const [editingProposal, setEditingProposal] = useState<{
    messageId: string;
    summary: string;
    time: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Starter prompts
  const starterPrompts = [
    { id: 'today', text: t.coach_prompt_today },
    { id: 'motivation', text: t.coach_prompt_motivation },
    { id: 'almost_slipped', text: t.coach_prompt_almost_slipped },
    { id: 'slipped', text: t.coach_prompt_slipped },
    { id: 'structure', text: t.coach_prompt_structure },
    { id: 'review', text: t.coach_prompt_review },
    { id: 'slippery_zones', text: t.coach_prompt_slippery_zones },
    { id: 'commitment', text: t.coach_prompt_commitment },
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      _onNavigate('home');
    }
  };

  const handleSend = async (textToSend?: string) => {
    const message = (textToSend ?? inputText).trim();
    if (!message || isThinking) return;

    if (!textToSend) {
      setInputText('');
    }

    setIsThinking(true);
    setActionNotice(null);

    try {
      await coachEngine.sendMessage(message, lang as 'en' | 'es' | 'nl');
      const updated = loadCoachConversation();
      setMessages(updated.messages);
    } catch {
      // Preserve input text if submission fails unexpectedly
      if (!textToSend) {
        setInputText(message);
      }
      const updated = loadCoachConversation();
      setMessages(updated.messages);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearCoachConversation();
    setMessages([]);
    setShowClearConfirm(false);
    setActionNotice(null);
  };

  const handleConfirmAction = (_proposal: CoachActionProposal) => {
    // Phase 33 & 34 Confirmation-First: Strictly no mutation. Inform the user truthfully.
    setActionNotice(t.coach_action_not_enabled);
  };

  const handleOpenEditProposal = (msg: CoachMessage) => {
    if (!msg.actionProposal) return;
    const payload = msg.actionProposal.payload as Record<string, unknown>;
    setEditingProposal({
      messageId: msg.id,
      summary: msg.actionProposal.humanReadableSummary,
      time: (payload.startTime as string) || '',
    });
  };

  const handleSaveProposalEdit = () => {
    if (!editingProposal) return;
    const updated = messages.map(m => {
      if (m.id === editingProposal.messageId && m.actionProposal) {
        const updatedProposal: CoachActionProposal = {
          ...m.actionProposal,
          humanReadableSummary: editingProposal.summary,
          payload: {
            ...m.actionProposal.payload,
            startTime: editingProposal.time || undefined,
          },
        };
        return {
          ...m,
          actionProposal: updatedProposal,
        };
      }
      return m;
    });
    setMessages(updated);
    saveCoachConversation({
      schemaVersion: 1,
      ability: 'diet',
      messages: updated,
      updatedAt: Date.now(),
    });
    setEditingProposal(null);
  };

  const handleCancelAction = (msgId: string) => {
    const updated = messages.map(m => {
      if (m.id === msgId) {
        return { ...m, actionProposal: undefined };
      }
      return m;
    });
    setMessages(updated);
    saveCoachConversation({
      schemaVersion: 1,
      ability: 'diet',
      messages: updated,
      updatedAt: Date.now(),
    });
    setActionNotice(null);
  };

  return (
    <div className="coach-screen" id="coach-screen">
      {/* ── Header ── */}
      <header className="coach-header">
        <button
          id="btn-coach-back"
          className="coach-header-back"
          onClick={handleBack}
          aria-label={t.btn_return_to_main || 'Go back'}
          title={t.btn_return_to_main || 'Go back'}
        >
          ←
        </button>

        <div className="coach-header-titles">
          <div className="coach-title-row">
            <span className="coach-header-icon" aria-hidden="true">🤖</span>
            <h1 className="coach-header-title">{t.coach_screen_title}</h1>
          </div>
          <span className={`coach-header-status ${isThinking ? 'coach-header-status--thinking' : ''}`}>
            <span className="coach-status-dot" aria-hidden="true" />
            {isThinking ? t.coach_status_thinking : t.coach_status_ready}
          </span>
        </div>

        {messages.length > 0 && (
          <button
            id="btn-clear-conversation"
            className="coach-header-clear-btn"
            onClick={() => setShowClearConfirm(true)}
            aria-label={t.coach_clear_conversation}
            title={t.coach_clear_conversation}
          >
            🗑️
          </button>
        )}
      </header>

      {/* ── Clear Confirmation Modal ── */}
      {showClearConfirm && (
        <div className="coach-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coach-modal-card">
            <h3 className="coach-modal-title">🗑️ {t.coach_clear_conversation}</h3>
            <p className="coach-modal-desc">{t.coach_clear_confirm}</p>
            <div className="coach-modal-actions">
              <button
                id="btn-confirm-clear-cancel"
                className="coach-modal-btn coach-modal-btn--cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                {t.btn_cancel_to_main}
              </button>
              <button
                id="btn-confirm-clear-ok"
                className="coach-modal-btn coach-modal-btn--danger"
                onClick={handleClear}
              >
                {t.coach_clear_conversation}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Proposal Edit Modal (Phase 34) ── */}
      {editingProposal && (
        <div className="coach-modal-backdrop" role="dialog" aria-modal="true">
          <div className="coach-modal-card">
            <h3 className="coach-modal-title">✏️ {t.coach_proposal_edit_title}</h3>
            <div className="coach-edit-fields">
              <label className="coach-edit-label">
                <span>{t.coach_proposal_title}</span>
                <input
                  type="text"
                  className="coach-edit-input"
                  value={editingProposal.summary}
                  onChange={e => setEditingProposal({ ...editingProposal, summary: e.target.value })}
                />
              </label>
              <label className="coach-edit-label">
                <span>{t.coach_proposal_field_time}</span>
                <input
                  type="time"
                  className="coach-edit-input"
                  value={editingProposal.time}
                  onChange={e => setEditingProposal({ ...editingProposal, time: e.target.value })}
                />
              </label>
            </div>
            <div className="coach-modal-actions">
              <button
                id="btn-edit-proposal-cancel"
                className="coach-modal-btn coach-modal-btn--cancel"
                onClick={() => setEditingProposal(null)}
              >
                {t.coach_action_cancel}
              </button>
              <button
                id="btn-edit-proposal-save"
                className="coach-modal-btn coach-modal-btn--confirm"
                onClick={handleSaveProposalEdit}
              >
                {t.coach_proposal_save_edits}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Chat Area ── */}
      <main className="coach-chat-area" id="coach-chat-area">
        {messages.length === 0 ? (
          <div className="coach-intro-card" id="coach-intro-card">
            <div className="coach-intro-avatar" aria-hidden="true">
              <span>🌱</span>
            </div>
            <h2 className="coach-intro-title">{t.coach_intro_title}</h2>
            <p className="coach-intro-sub">{t.coach_intro_sub}</p>

            <div className="coach-starter-prompts-container">
              <span className="coach-starters-label">Suggestions:</span>
              <div className="coach-starter-prompts-grid">
                {starterPrompts.map(prompt => (
                  <button
                    key={prompt.id}
                    id={`btn-starter-${prompt.id}`}
                    className="coach-starter-chip"
                    onClick={() => handleSend(prompt.text)}
                    disabled={isThinking}
                  >
                    <span>💬</span>
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="coach-messages-list" id="coach-messages-list">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`coach-message-row coach-message-row--${msg.role}`}
              >
                {msg.role === 'coach' && (
                  <div className="coach-msg-avatar" aria-hidden="true">
                    <span>🤖</span>
                  </div>
                )}
                <div className={`coach-bubble coach-bubble--${msg.role}`}>
                  <p className="coach-bubble-text">{msg.text}</p>

                  {/* Clarification Choice Chips (Phase 34) */}
                  {msg.understanding?.requiresClarification && msg.understanding.ambiguities.length > 0 && (
                    <div className="coach-clarification-container">
                      <span className="coach-clarification-label">{t.coach_clarification_title}:</span>
                      <div className="coach-clarification-chips">
                        {msg.understanding.ambiguities[0].options?.map(opt => (
                          <button
                            key={opt.value}
                            id={`btn-clarify-${opt.value}`}
                            className="coach-clarification-chip"
                            onClick={() => handleSend(opt.label)}
                            disabled={isThinking}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Proposal Preview Card (Phase 33 & 34) */}
                  {msg.actionProposal && (
                    <div className="coach-action-proposal-card" id={`action-${msg.actionProposal.id}`}>
                      <div className="coach-action-proposal-header">
                        <span className="coach-action-icon">📋</span>
                        <span className="coach-action-title">{t.coach_proposal_title}</span>
                      </div>
                      <p className="coach-action-summary">{msg.actionProposal.humanReadableSummary}</p>
                      <div className="coach-action-buttons">
                        <button
                          id={`btn-confirm-action-${msg.actionProposal.id}`}
                          className="coach-action-btn coach-action-btn--confirm"
                          onClick={() => handleConfirmAction(msg.actionProposal!)}
                        >
                          {t.coach_action_confirm}
                        </button>
                        <button
                          id={`btn-edit-action-${msg.actionProposal.id}`}
                          className="coach-action-btn coach-action-btn--edit"
                          onClick={() => handleOpenEditProposal(msg)}
                        >
                          {t.coach_action_edit}
                        </button>
                        <button
                          id={`btn-cancel-action-${msg.actionProposal.id}`}
                          className="coach-action-btn coach-action-btn--cancel"
                          onClick={() => handleCancelAction(msg.id)}
                        >
                          {t.coach_action_cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isThinking && (
              <div className="coach-message-row coach-message-row--coach">
                <div className="coach-msg-avatar" aria-hidden="true">
                  <span>🤖</span>
                </div>
                <div className="coach-bubble coach-bubble--coach coach-bubble--thinking">
                  <span className="coach-thinking-dot" />
                  <span className="coach-thinking-dot" />
                  <span className="coach-thinking-dot" />
                </div>
              </div>
            )}

            {actionNotice && (
              <div className="coach-action-notice" role="alert">
                <span>ℹ️</span>
                <span>{actionNotice}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* ── Suggested Prompts Bar (when conversation is active) ── */}
      {messages.length > 0 && (
        <div className="coach-active-suggestions-bar">
          <div className="coach-active-suggestions-scroll">
            {starterPrompts.slice(0, 4).map(prompt => (
              <button
                key={prompt.id}
                className="coach-active-suggestion-chip"
                onClick={() => handleSend(prompt.text)}
                disabled={isThinking}
              >
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Composer ── */}
      <footer className="coach-composer-container">
        <form
          className="coach-composer-form"
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={textareaRef}
            id="coach-input"
            className="coach-textarea"
            placeholder={t.coach_composer_placeholder}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isThinking}
            aria-label={t.coach_composer_placeholder}
          />
          <button
            id="btn-coach-send"
            type="submit"
            className="coach-send-btn"
            disabled={!inputText.trim() || isThinking}
            aria-label={t.coach_send}
            title={t.coach_send}
          >
            <span className="coach-send-btn-text">{t.coach_send}</span>
            <span className="coach-send-btn-icon" aria-hidden="true">➤</span>
          </button>
        </form>
      </footer>
    </div>
  );
}
