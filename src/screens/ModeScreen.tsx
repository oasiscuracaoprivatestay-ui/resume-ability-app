import { useState } from 'react';
import type { Screen, TimerMode } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './ModeScreen.css';

interface ModeScreenProps {
  onSelect: (mode: TimerMode, loopBlocks: number) => void;
  onNavigate: (screen: Screen) => void;
}

const LOOP_OPTIONS = [
  { blocks: 2, label: '2 blocks', detail: '30 min' },
  { blocks: 4, label: '4 blocks', detail: '1 hour' },
  { blocks: 6, label: '6 blocks', detail: '1.5 hours' },
  { blocks: 96, label: '1 day', detail: '96 blocks' },
  { blocks: 192, label: '2 days', detail: '192 blocks' },
];

export default function ModeScreen({ onSelect, onNavigate }: ModeScreenProps) {
  const [showLoopOptions, setShowLoopOptions] = useState(false);

  return (
    <div className="screen mode-screen">
      <ScreenHeader
        onBack={() => onNavigate('context')}
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

        {!showLoopOptions ? (
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
              onClick={() => setShowLoopOptions(true)}
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
        ) : (
          <div className="loop-options">
            <button
              className="loop-back"
              onClick={() => setShowLoopOptions(false)}
            >
              ← Back to modes
            </button>
            {LOOP_OPTIONS.map((opt) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
