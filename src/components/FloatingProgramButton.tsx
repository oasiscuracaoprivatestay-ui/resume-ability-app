import { useTranslation } from '../i18n';
import { PROGRAM_URL } from '../config';
import type { Screen } from '../types';
import './FloatingProgramButton.css';

// Hide on action, planning, setup, and recovery screens to prevent mobile button overlap
const HIDDEN_ON: Screen[] = [
  'home',
  'timer',
  'mode',
  'context',
  'slip-type',
  'slip-non-negotiable',
  'slip-insights',
  'help',
  'recommit',
  'control',
  'commit',
  'check-in',
  'quote',
  'motivation-choice',
  'motivational-text',
  'sda-terms',
  'structured-diet',
  'notification-settings',
];

interface FloatingProgramButtonProps {
  currentScreen: Screen;
}

export default function FloatingProgramButton({ currentScreen }: FloatingProgramButtonProps) {
  const { t } = useTranslation();

  if (HIDDEN_ON.includes(currentScreen)) return null;

  const handleClick = () => {
    window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      id="floating-program-btn"
      className="floating-program-btn"
      onClick={handleClick}
      aria-label={t.prog_btn_label}
    >
      <span className="floating-program-icon">🔓</span>
      <span className="floating-program-label">{t.prog_btn_label}</span>
    </button>
  );
}
