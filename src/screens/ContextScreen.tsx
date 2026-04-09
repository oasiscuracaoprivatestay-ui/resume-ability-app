import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_LABELS, SLIP_CONTEXT_ICONS } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './ContextScreen.css';

interface ContextScreenProps {
  onSelect: (context: SlipContext) => void;
  onNavigate: (screen: Screen) => void;
}

const CONTEXTS: SlipContext[] = [
  'late-night',
  'stress',
  'social',
  'boredom',
  'habit',
  'after-meal',
];

export default function ContextScreen({ onSelect, onNavigate }: ContextScreenProps) {
  return (
    <div className="screen context-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="context-content">
        <div className="context-heading">
          <span className="section-label">Context Mapping</span>
          <h2 className="context-question">
            Where did it<br />
            <span className="accent-text">happen?</span>
          </h2>
        </div>

        <div className="context-grid">
          {CONTEXTS.map((ctx) => (
            <button
              key={ctx}
              id={`ctx-${ctx}`}
              className="context-option"
              onClick={() => onSelect(ctx)}
            >
              <span className="context-icon">{SLIP_CONTEXT_ICONS[ctx]}</span>
              <span className="context-label">{SLIP_CONTEXT_LABELS[ctx]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
