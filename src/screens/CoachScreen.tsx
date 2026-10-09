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
  voiceController,
  requestAudioMotivation,
  requestAudioAdvice,
  type CoachMessage,
  type CoachActionProposal,
  type VoiceSessionState,
  executeActionProposal,
} from '../coach';
import type { CanonicalDietAbilityId } from '../abilities';
import { CANONICAL_SEVEN_DIET_ABILITIES } from '../coach/knowledge/abilities/sevenDietAbilities';
import './CoachScreen.css';

interface CoachScreenProps {
  onNavigate: (target: Screen) => void;
  onBack: () => void;
  initialPrompt?: string;
  initialAbilityId?: CanonicalDietAbilityId;
}

export default function CoachScreen({
  onNavigate: _onNavigate,
  onBack,
  initialPrompt,
  initialAbilityId,
}: CoachScreenProps) {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = useState<CoachMessage[]>(() => loadCoachConversation().messages);
  // User's unsent draft preservation: do NOT overwrite if the user already has a pending draft
  const [inputText, setInputText] = useState(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const draft = window.sessionStorage.getItem('coach_unsent_draft');
      if (draft && draft.trim().length > 0) {
        return draft;
      }
    }
    return initialPrompt || '';
  });
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceSessionState>(() => voiceController.getState());

  // Proposal edit modal state (Phase 34)
  const [editingProposal, setEditingProposal] = useState<{
    messageId: string;
    summary: string;
    time: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to Voice Controller state updates
  useEffect(() => {
    const unsubscribe = voiceController.subscribe(state => {
      setVoiceState(state);
    });
    return () => {
      unsubscribe();
      voiceController.stopSpeaking();
      voiceController.cancelListening();
    };
  }, []);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Starter prompts including dedicated Audio Motivation & Audio Advice
  const starterPrompts = [
    { id: 'today', text: t.coach_prompt_today },
    { id: 'motivation', text: t.coach_prompt_motivation },
    { id: 'audio_motivation', text: `🎙️ ${t.coach_voice_motivation_button}` },
    { id: 'audio_advice', text: `🎙️ ${t.coach_voice_advice_button}` },
    { id: 'almost_slipped', text: t.coach_prompt_almost_slipped },
    { id: 'slipped', text: t.coach_prompt_slipped },
    { id: 'structure', text: t.coach_prompt_structure },
    { id: 'review', text: t.coach_prompt_review },
    { id: 'slippery_zones', text: t.coach_prompt_slippery_zones },
    { id: 'commitment', text: t.coach_prompt_commitment },
  ];

  const handleBack = () => {
    // If the input was only the auto-suggested question and never edited, clean it up
    if (initialPrompt && inputText === initialPrompt) {
      setInputText('');
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('coach_unsent_draft');
      }
    }
    if (onBack) {
      onBack();
    } else {
      _onNavigate('home');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('coach_unsent_draft', val);
    }
  };

  const handleDiscardBanner = () => {
    setIsBannerDismissed(true);
    if (inputText === initialPrompt) {
      setInputText('');
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('coach_unsent_draft');
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const message = (textToSend ?? inputText).trim();
    if (!message || isThinking) return;

    if (!textToSend) {
      setInputText('');
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem('coach_unsent_draft');
      }
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

  const handlePromptClick = async (prompt: { id: string; text: string }) => {
    if (isThinking) return;

    if (prompt.id === 'audio_motivation') {
      setIsThinking(true);
      setActionNotice(null);
      try {
        await requestAudioMotivation(lang as 'en' | 'es' | 'nl');
        const updated = loadCoachConversation();
        setMessages(updated.messages);
      } catch {
        setActionNotice(t.coach_error_generic);
      } finally {
        setIsThinking(false);
      }
      return;
    }

    if (prompt.id === 'audio_advice') {
      setIsThinking(true);
      setActionNotice(null);
      try {
        await requestAudioAdvice(lang as 'en' | 'es' | 'nl');
        const updated = loadCoachConversation();
        setMessages(updated.messages);
      } catch {
        setActionNotice(t.coach_error_generic);
      } finally {
        setIsThinking(false);
      }
      return;
    }

    handleSend(prompt.text);
  };

  const handleTranscriptResult = (transcript: any) => {
    if (transcript && transcript.text && transcript.text.trim()) {
      setActionNotice(null);
      handleSend(transcript.text);
    } else {
      const err = voiceController.getState().lastError;
      if (err) {
        setActionNotice(t.coach_voice_error_transcription);
      } else {
        setActionNotice(t.coach_voice_no_speech);
      }
    }
  };

  const handleToggleMic = async () => {
    if (isThinking) return;

    if (voiceState.inputState === 'listening') {
      const transcript = await voiceController.stopListening();
      handleTranscriptResult(transcript);
    } else if (voiceState.inputState === 'idle' || voiceState.inputState === 'error' || voiceState.inputState === 'complete') {
      setActionNotice(null);
      try {
        await voiceController.startListening(
          lang as 'en' | 'es' | 'nl',
          (partial) => {
            setInputText(partial);
          },
          (autoTranscript) => {
            handleTranscriptResult(autoTranscript);
          }
        );
      } catch {
        setActionNotice(t.coach_voice_error_mic);
      }
    }
  };

  const handleToggleListen = async (msg: CoachMessage) => {
    if (voiceController.isSpeakingMessage(msg.id)) {
      await voiceController.stopSpeaking();
    } else {
      // Only final validated Coach text is spoken
      await voiceController.speakResponse(msg.text, lang as 'en' | 'es' | 'nl', 'coach_response', msg.id);
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

  const handleConfirmAction = async (proposal: CoachActionProposal) => {
    if (executingProposalId) return;
    if (proposal.executed) return;

    setExecutingProposalId(proposal.id);
    setActionNotice(null);

    try {
      const result = await executeActionProposal(proposal);

      if (result.success) {
        const updated = messages.map(m => {
          if (m.actionProposal && m.actionProposal.id === proposal.id) {
            const updatedProposal: CoachActionProposal = {
              ...m.actionProposal,
              executed: true,
              executedAt: Date.now(),
              executionStatus: 'executed',
              recordId: result.recordId,
              pointsAwarded: result.pointsAwarded,
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

        const ptsText = typeof result.pointsAwarded === 'number' && result.pointsAwarded > 0
          ? ` (+${result.pointsAwarded} pts)`
          : '';
        setActionNotice(`${t.coach_action_success || 'Recorded'}${ptsText}`);
      } else {
        if (result.status === 'expired') {
          setActionNotice(t.coach_action_expired || 'This proposal has expired. Please create a new one.');
        } else {
          setActionNotice(result.message || t.coach_action_error || 'Could not execute action.');
        }
      }
    } catch {
      setActionNotice(t.coach_action_error || 'Could not execute action.');
    } finally {
      setExecutingProposalId(null);
    }
  };

  const handleOpenEditProposal = (msg: CoachMessage) => {
    if (!msg.actionProposal || msg.actionProposal.executed) return;
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
          id: `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          humanReadableSummary: editingProposal.summary,
          executed: false,
          executionStatus: 'pending',
          createdAt: Date.now(),
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
                    onClick={() => handlePromptClick(prompt)}
                    disabled={isThinking}
                  >
                    <span>{prompt.id.startsWith('audio_') ? '🎙️' : '💬'}</span>
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

                  {/* Spoken Response Listen Control (Phase 38A) */}
                  {msg.role === 'coach' && (
                    <div className="coach-bubble-voice-row">
                      <button
                        type="button"
                        id={`btn-voice-listen-${msg.id}`}
                        className={`coach-listen-btn ${voiceController.isSpeakingMessage(msg.id) ? 'coach-listen-btn--active' : ''}`}
                        onClick={() => handleToggleListen(msg)}
                        aria-label={voiceController.isSpeakingMessage(msg.id) ? t.coach_voice_stop_response : t.coach_voice_listen_response}
                        title={voiceController.isSpeakingMessage(msg.id) ? t.coach_voice_stop_response : t.coach_voice_listen_response}
                      >
                        <span className="coach-listen-icon" aria-hidden="true">
                          {voiceController.isSpeakingMessage(msg.id) ? '⏹' : '🔊'}
                        </span>
                        <span className="coach-listen-text">
                          {voiceController.isSpeakingMessage(msg.id) ? t.coach_voice_stop_response : t.coach_voice_listen_response}
                        </span>
                      </button>
                    </div>
                  )}

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

                  {/* Action Proposal Preview Card (Phase 33 & 34 & 39B) */}
                  {msg.actionProposal && (
                    <div
                      className={`coach-action-proposal-card ${msg.actionProposal.executed ? 'coach-action-proposal-card--executed' : ''}`}
                      id={`action-${msg.actionProposal.id}`}
                    >
                      <div className="coach-action-proposal-header">
                        <span className="coach-action-icon">{msg.actionProposal.executed ? '✓' : '📋'}</span>
                        <span className="coach-action-title">
                          {msg.actionProposal.executed ? (t.coach_action_success || 'Recorded') : t.coach_proposal_title}
                        </span>
                      </div>
                      <p className="coach-action-summary">{msg.actionProposal.humanReadableSummary}</p>
                      {msg.actionProposal.executed ? (
                        <div className="coach-action-completed-badge" id={`action-completed-${msg.actionProposal.id}`}>
                          <span className="coach-action-check">✓</span>
                          <span>{t.coach_action_success || 'Recorded'}</span>
                          {typeof msg.actionProposal.pointsAwarded === 'number' && msg.actionProposal.pointsAwarded > 0 && (
                            <span className="coach-action-points">+{msg.actionProposal.pointsAwarded} pts</span>
                          )}
                        </div>
                      ) : (
                        <div className="coach-action-buttons">
                          <button
                            id={`btn-confirm-action-${msg.actionProposal.id}`}
                            className="coach-action-btn coach-action-btn--confirm"
                            onClick={() => handleConfirmAction(msg.actionProposal!)}
                            disabled={executingProposalId !== null}
                          >
                            {executingProposalId === msg.actionProposal.id
                              ? (t.coach_action_executing || 'Saving...')
                              : t.coach_action_confirm}
                          </button>
                          <button
                            id={`btn-edit-action-${msg.actionProposal.id}`}
                            className="coach-action-btn coach-action-btn--edit"
                            onClick={() => handleOpenEditProposal(msg)}
                            disabled={executingProposalId !== null}
                          >
                            {t.coach_action_edit}
                          </button>
                          <button
                            id={`btn-cancel-action-${msg.actionProposal.id}`}
                            className="coach-action-btn coach-action-btn--cancel"
                            onClick={() => handleCancelAction(msg.id)}
                            disabled={executingProposalId !== null}
                          >
                            {t.coach_action_cancel}
                          </button>
                        </div>
                      )}
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
                onClick={() => handlePromptClick(prompt)}
                disabled={isThinking}
              >
                {prompt.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Focus Ability Context Banner (Phase 42.4) ── */}
      {initialAbilityId && !isBannerDismissed && (
        <div className="coach-ability-focus-banner" id="coach-ability-focus-banner">
          <div className="coach-focus-banner-left">
            <span className="coach-focus-banner-icon" aria-hidden="true">🎯</span>
            <div className="coach-focus-banner-texts">
              <span className="coach-focus-banner-title">
                {(t.ability_detail_coach_banner_title || 'Focusing on {title}').replace(
                  '{title}',
                  CANONICAL_SEVEN_DIET_ABILITIES[initialAbilityId]?.officialTitle || initialAbilityId
                )}
              </span>
              <span className="coach-focus-banner-sub">
                {t.ability_detail_coach_banner_subtitle || 'Ask Coach about this ability'}
              </span>
            </div>
          </div>
          <div className="coach-focus-banner-actions">
            {initialPrompt && inputText !== initialPrompt && (
              <button
                type="button"
                id="btn-coach-insert-prompt"
                className="coach-focus-banner-btn"
                onClick={() => {
                  setInputText(initialPrompt);
                  if (typeof window !== 'undefined' && window.sessionStorage) {
                    window.sessionStorage.setItem('coach_unsent_draft', initialPrompt);
                  }
                }}
              >
                {t.ability_detail_coach_banner_action || 'Insert Question'}
              </button>
            )}
            <button
              type="button"
              id="btn-coach-discard-banner"
              className="coach-focus-banner-discard-btn"
              onClick={handleDiscardBanner}
              aria-label={t.ability_detail_coach_banner_discard || 'Discard'}
              title={t.ability_detail_coach_banner_discard || 'Discard'}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Composer with Voice Input (Phase 38A) ── */}
      <footer className="coach-composer-container">
        {(voiceState.inputState === 'listening' || voiceState.inputState === 'transcribing') && (
          <div className="coach-voice-listening-banner" role="status" aria-live="polite">
            <span className={voiceState.inputState === 'transcribing' ? 'coach-voice-pulse coach-voice-pulse--transcribing' : 'coach-voice-pulse'} aria-hidden="true" />
            <span className="coach-voice-banner-text">
              {voiceState.inputState === 'transcribing' ? t.coach_voice_processing : t.coach_voice_listening}
            </span>
            {voiceState.inputState === 'listening' && (
              <button
                type="button"
                className="coach-voice-cancel-btn"
                onClick={() => voiceController.cancelListening()}
                aria-label="Cancel"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <form
          className="coach-composer-form"
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
        >
          <button
            id="btn-coach-mic"
            type="button"
            className={`coach-mic-btn coach-mic-btn--${voiceState.inputState}`}
            onClick={handleToggleMic}
            disabled={isThinking}
            aria-label={voiceState.inputState === 'listening' ? t.coach_voice_stop_mic : t.coach_voice_mic_button}
            title={voiceState.inputState === 'listening' ? t.coach_voice_stop_mic : t.coach_voice_mic_button}
          >
            <span className="coach-mic-icon" aria-hidden="true">
              {voiceState.inputState === 'listening' ? '⏹' : '🎙️'}
            </span>
          </button>
          <textarea
            ref={textareaRef}
            id="coach-input"
            className="coach-textarea"
            placeholder={t.coach_composer_placeholder}
            value={inputText}
            onChange={handleInputChange}
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
