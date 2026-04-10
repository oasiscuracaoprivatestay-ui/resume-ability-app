import { useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import './ControlScreen.css';

interface ControlScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function ControlScreen({ onNavigate }: ControlScreenProps) {
  const { t } = useTranslation();

  const message = useMemo(
    () => t.control_messages[Math.floor(Math.random() * t.control_messages.length)],
    [t],
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
        {t.control_continue}
      </button>
    </div>
  );
}
