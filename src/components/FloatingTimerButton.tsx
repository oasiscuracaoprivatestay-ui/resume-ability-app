import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import './FloatingTimerButton.css';

// Screens where the floating button should NOT appear
// (timer is already running, or the button would be redundant/conflicting)
const HIDDEN_ON: Screen[] = [
  'home',
  'timer',
  'mode',
  'context',
  'slip-insights',
  'help',
  'recommit',
  'control',
  'commit',
  'daily-audio',
  'slip-type',
  'slip-non-negotiable',
];

interface FloatingTimerButtonProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onStartTimer: () => void;
}

export default function FloatingTimerButton({
  currentScreen,
  onStartTimer,
}: FloatingTimerButtonProps) {
  const { t } = useTranslation();

  if (HIDDEN_ON.includes(currentScreen)) return null;

  return (
    <button
      id="floating-start-timer"
      className="floating-timer-btn"
      onClick={onStartTimer}
      aria-label={t.global_start_timer}
    >
      <span className="floating-timer-icon">⏱</span>
      <span className="floating-timer-label">{t.global_start_timer}</span>
    </button>
  );
}
