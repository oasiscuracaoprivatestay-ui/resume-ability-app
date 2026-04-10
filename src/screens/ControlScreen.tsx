import { useMemo } from 'react';
import type { Screen } from '../types';
import './ControlScreen.css';

interface ControlScreenProps {
  onNavigate: (screen: Screen) => void;
}

const MESSAGES = [
  'Good. Stay with that.',
  "You're reinforcing control.",
  'This is how consistency grows.',
  "You're already on track.",
  'Keep going. This matters.',
];

export default function ControlScreen({ onNavigate }: ControlScreenProps) {
  const message = useMemo(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
    [],
  );

  return (
    <div className="screen control-screen">
      <div className="control-content">
        <div className="control-icon">✓</div>
        <p className="control-message">{message}</p>
      </div>

      <button
        id="btn-control-home"
        className="btn btn-primary btn-large"
        onClick={() => onNavigate('home')}
      >
        Continue
      </button>
    </div>
  );
}
