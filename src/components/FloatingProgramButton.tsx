import { PROGRAM_URL } from '../config';
import './FloatingProgramButton.css';

export default function FloatingProgramButton() {
  const handleClick = () => {
    window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      id="floating-program-btn"
      className="floating-program-btn"
      onClick={handleClick}
      aria-label="Access the Program"
    >
      <span className="floating-program-icon">🔓</span>
      <span className="floating-program-label">Access the Program</span>
    </button>
  );
}
