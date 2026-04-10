import { useState } from 'react';
import type { Screen, TimerMode } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './ModeScreen.css';

interface ModeScreenProps {
  onSelect: (mode: TimerMode, loopBlocks: number) => void;
  onNavigate: (screen: Screen) => void;
}

const LOOP_PRESETS = [
  { blocks: 2, label: '2 blocks', detail: '30 min' },
  { blocks: 4, label: '4 blocks', detail: '1 hour' },
  { blocks: 6, label: '6 blocks', detail: '1.5 hours' },
  { blocks: 96, label: '1 day', detail: '96 blocks' },
  { blocks: 192, label: '2 days', detail: '192 blocks' },
];

function formatBlockDuration(blocks: number): string {
  const minutes = blocks * 15;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hours}h`;
  return `${hours}h ${rem}m`;
}

type View = 'main' | 'loop-presets' | 'loop-custom';

export default function ModeScreen({ onSelect, onNavigate }: ModeScreenProps) {
  const [view, setView] = useState<View>('main');
  const [customBlocks, setCustomBlocks] = useState(3);

  const adjustBlocks = (delta: number) => {
    setCustomBlocks((prev) => Math.max(1, Math.min(96, prev + delta)));
  };

  return (
    <div className="screen mode-screen">
      <ScreenHeader
        onBack={() => onNavigate('help')}
        onHome={() => onNavigate('home')}
      />

      <div className="mode-content">
        <div className="mode-heading">
          <span className="section-label">Recovery Mode</span>
          <h2 className="mode-question">
            Choose your<br />
            <span className="accent-text">timer</span>
          </h2>
        </div>

        {/* ── Main mode selection ── */}
        {view === 'main' && (
          <div className="mode-options">
            <button
              id="mode-single"
              className="mode-card"
              onClick={() => onSelect('single', 1)}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">◎</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">Single</span>
                  <span className="mode-card-desc">One focused block</span>
                </div>
              </div>
              <span className="mode-card-badge">15 min</span>
            </button>

            <button
              id="mode-loop"
              className="mode-card"
              onClick={() => setView('loop-presets')}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">⟳</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">Loop</span>
                  <span className="mode-card-desc">Back-to-back blocks</span>
                </div>
              </div>
              <span className="mode-card-badge">multi</span>
            </button>

            <button
              id="mode-extended"
              className="mode-card"
              onClick={() => onSelect('extended-fast', 0)}
            >
              <div className="mode-card-left">
                <span className="mode-card-icon">▸</span>
                <div className="mode-card-text">
                  <span className="mode-card-title">Extended Fast</span>
                  <span className="mode-card-desc">Open-ended recovery</span>
                </div>
              </div>
              <span className="mode-card-badge">∞</span>
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
              ← Back to modes
            </button>
            {LOOP_PRESETS.map((opt) => (
              <button
                key={opt.blocks}
                id={`loop-${opt.blocks}`}
                className="loop-card"
                onClick={() => onSelect('loop', opt.blocks)}
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
              <span className="loop-card-label">Custom</span>
              <span className="loop-card-detail">choose blocks</span>
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
              ← Back to presets
            </button>

            <div className="stepper-card">
              <span className="stepper-label">Loop Blocks</span>
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
              onClick={() => onSelect('loop', customBlocks)}
            >
              Start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
