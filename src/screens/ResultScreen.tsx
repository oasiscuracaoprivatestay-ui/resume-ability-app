import type { Screen, SlipStatus } from '../types';
import { formatDuration } from '../utils';
import ScreenHeader from '../components/ScreenHeader';
import './ResultScreen.css';

interface ResultScreenProps {
  recoverySeconds: number;
  status: SlipStatus;
  onNavigate: (screen: Screen) => void;
}

export default function ResultScreen({
  recoverySeconds,
  status,
  onNavigate,
}: ResultScreenProps) {
  const formattedDuration = formatDuration(recoverySeconds);

  // Small recovery message
  const getRecoveryNote = () => {
    if (status === 'relapsed') return 'Every attempt counts. Try again.';
    if (recoverySeconds <= 900) return 'Fast recovery. Well done.';
    if (recoverySeconds <= 1800) return 'Solid recovery. Keep it up.';
    return 'You came back. That\u2019s what matters.';
  };

  return (
    <div className="screen result-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="result-content">
        <div className="result-icon">
          {status === 'relapsed' ? '↻' : '✓'}
        </div>

        <h2 className="result-heading">
          {status === 'relapsed' ? (
            'Slip recorded'
          ) : (
            <>
              You recovered in<br />
              <span className="accent-text">{formattedDuration}</span>
            </>
          )}
        </h2>

        <p className="result-subtitle">
          {status === 'relapsed'
            ? `Duration: ${formattedDuration}`
            : 'Control restored'}
        </p>

        <p className="result-note">{getRecoveryNote()}</p>

        <button
          id="btn-done"
          className="btn btn-primary btn-large"
          onClick={() => onNavigate('home')}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
