import { useTranslation } from '../i18n';
import { PROGRAM_URL } from '../config';
import './FloatingProgramButton.css';

export default function FloatingProgramButton() {
  const { t } = useTranslation();

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
