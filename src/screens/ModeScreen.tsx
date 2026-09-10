import { useState } from 'react';
import type { Screen, TimerMode } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './ModeScreen.css';

interface ModeScreenProps {
  onSelect: (mode: TimerMode, loopBlocks: number, audioEnabled: boolean) => void;
  onNavigate: (screen: Screen) => void;
  backTo: Screen;
}

function formatBlockDuration(blocks: number): string {
  const minutes = blocks * 15;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours}h`;
  return `${hours}h ${rem}m`;
}

type View = 'main' | 'loop-presets' | 'loop-custom';

export default function ModeScreen({ onSelect, onNavigate, backTo }: ModeScreenProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('main');
  const [customBlocks, setCustomBlocks] = useState(3);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const adjustBlocks = (delta: number) => {
    setCustomBlocks((prev) => Math.max(1, Math.min(96, prev + delta)));
  };

  const LOOP_PRESETS = [
    { blocks: 2, label: t.loop_2_label, detail: t.loop_2_detail },
    { blocks: 4, label: t.loop_4_label, detail: t.loop_4_detail },
    { blocks: 6, label: t.loop_6_label, detail: t.loop_6_detail },
    { blocks: 96, label: t.loop_day_label, detail: t.loop_day_detail },
    { blocks: 192, label: t.loop_2days_label, detail: t.loop_2days_detail },
  ];

  return (
    <div className="screen mode-screen">
      <ScreenHeader
        onBack={() => onNavigate(backTo)}
        onHome={() => onNavigate('home')}
      />

      <div className="mode-content">
        <div className="mode-heading">
          <span className="section-label">{t.mode_label}</span>
          <h2 className="mode-question">
            {t.mode_question}<br />
            <span className="accent-text">{t.mode_question_accent}</span>
          </h2>
        </div>

        {/* ── Audio Option Toggle (Phase 7H) ── */}
        <div className="mode-audio-toggle-section">
          <span className="mode-audio-toggle-label">{t.timer_audio_toggle_label}</span>
          <div className="mode-audio-toggle" role="group" aria-label={t.timer_audio_toggle_label}>
            <button
              id="btn-timer-audio-with"
              type="button"
              className={`mode-audio-btn ${audioEnabled ? 'mode-audio-btn--active' : ''}`}
              aria-pressed={audioEnabled}
              onClick={() => setAudioEnabled(true)}
            >
              <span className="mode-audio-icon" aria-hidden="true">🔊</span>
              <span>{t.timer_audio_with}</span>
            </button>
            <button
              id="btn-timer-audio-without"
              type="button"
              className={`mode-audio-btn ${!audioEnabled ? 'mode-audio-btn--active' : ''}`}
              aria-pressed={!audioEnabled}
              onClick={() => setAudioEnabled(false)}
            >
              <span className="mode-audio-icon" aria-hidden="true">🔇</span>
              <span>{t.timer_audio_without}</span>
            </button>
          </div>
        </div>

        {/* ── Main mode selection ── */}
        {view === 'main' && (
          <div className="mode-options">
            <button
              id="mode-single"
              className="mode-card"
              onClick={() => onSelect('single', 1, audioEnabled)}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">◎</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">{t.mode_single_title}</span>
                  <span className="mode-card-desc">{t.mode_single_desc}</span>
                </div>
              </div>
              <span className="mode-card-badge">{t.mode_single_badge}</span>
            </button>

            <button
              id="mode-loop"
              className="mode-card"
              onClick={() => setView('loop-presets')}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">⟳</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">{t.mode_loop_title}</span>
                  <span className="mode-card-desc">{t.mode_loop_desc}</span>
                </div>
              </div>
              <span className="mode-card-badge">{t.mode_loop_badge}</span>
            </button>

            <button
              id="mode-extended"
              className="mode-card"
              onClick={() => onSelect('extended-fast', 0, audioEnabled)}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">▸</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">{t.mode_extended_title}</span>
                  <span className="mode-card-desc">{t.mode_extended_desc}</span>
                </div>
              </div>
              <span className="mode-card-badge">{t.mode_extended_badge}</span>
            </button>
          </div>
        )}

        {/* ── Loop presets ── */}
        {view === 'loop-presets' && (
          <div className="loop-options">
            <button
              className="loop-back"
              onClick={() => setView('main')}
            >
              {t.mode_back_to_modes}
            </button>
            {LOOP_PRESETS.map((opt) => (
              <button
                key={opt.blocks}
                id={`loop-${opt.blocks}`}
                className="loop-card"
                onClick={() => onSelect('loop', opt.blocks, audioEnabled)}
              >
                <span className="loop-card-label">{opt.label}</span>
                <span className="loop-card-detail">{opt.detail}</span>
              </button>
            ))}
            <button
              id="loop-custom"
              className="loop-card loop-card--custom"
              onClick={() => setView('loop-custom')}
            >
              <span className="loop-card-label">{t.mode_custom}</span>
              <span className="loop-card-detail">{t.mode_choose_blocks}</span>
            </button>
          </div>
        )}

        {/* ── Custom stepper ── */}
        {view === 'loop-custom' && (
          <div className="custom-stepper">
            <button
              className="loop-back"
              onClick={() => setView('loop-presets')}
            >
              {t.mode_back_to_presets}
            </button>

            <div className="stepper-card">
              <span className="stepper-label">{t.mode_loop_blocks}</span>
              <div className="stepper-row">
                <button
                  className="stepper-btn"
                  onClick={() => adjustBlocks(-1)}
                  disabled={customBlocks <= 1}
                  aria-label="Decrease blocks"
                >
                  −
                </button>
                <span className="stepper-value">{customBlocks}</span>
                <button
                  className="stepper-btn"
                  onClick={() => adjustBlocks(1)}
                  disabled={customBlocks >= 96}
                  aria-label="Increase blocks"
                >
                  +
                </button>
              </div>
              <span className="stepper-detail">
                {formatBlockDuration(customBlocks)}
              </span>
            </div>

            <button
              id="btn-start-custom"
              className="btn btn-primary btn-large"
              onClick={() => onSelect('loop', customBlocks, audioEnabled)}
            >
              {t.mode_start}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
