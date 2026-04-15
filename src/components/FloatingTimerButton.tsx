import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import './FloatingTimerButton.css';

// Screens where the floating button should NOT appear
// (timer is already running, or the button would be redundant/conflicting)
const HIDDEN_ON: Screen[] = ['timer', 'mode', 'context', 'help', 'daily-audio'];

interface FloatingTimerButtonProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export default function FloatingTimerButton({
  currentScreen,
  onNavigate,
}: FloatingTimerButtonProps) {
  const { t } = useTranslation();

  if (HIDDEN_ON.includes(currentScreen)) return null;

  return (
    <button
      id="floating-start-timer"
      className="floating-timer-btn"
      onClick={() => onNavigate('context')}
      aria-label={t.global_start_timer}
    >
      <span className="floating-timer-icon">⏱</span>
      <span className="floating-timer-label">{t.global_start_timer}</span>
    </button>
  );
}
