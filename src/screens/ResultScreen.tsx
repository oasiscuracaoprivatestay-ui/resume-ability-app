import type { Screen, SlipStatus } from '../types';
import { formatDuration } from '../utils';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
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
  const { t } = useTranslation();
  const formattedDuration = formatDuration(recoverySeconds);

  const getRecoveryNote = () => {
    if (status === 'relapsed') return t.result_note_relapsed;
    if (recoverySeconds <= 900) return t.result_note_fast;
    if (recoverySeconds <= 1800) return t.result_note_solid;
    return t.result_note_default;
  };

  return (
    <div className="screen result-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        onBack={() => onNavigate('home')}
        title={status === 'relapsed' ? t.result_slip_recorded : 'Recovery Result'}
        eyebrow="TIMER COMPLETE"
        showScoreBadge
        onNavigate={onNavigate}
        rightAction={
          <button
            id="btn-header-home"
            className="sda-premium-header__home-btn"
            onClick={() => onNavigate('home')}
            aria-label="Go home"
          >
            ⌂
          </button>
        }
      />

      <div className="result-content">
        <div className="result-icon">
          {status === 'relapsed' ? '↻' : '✓'}
        </div>

        <h2 className="result-heading">
          {status === 'relapsed' ? (
            t.result_slip_recorded
          ) : (
            <>
              {t.result_recovered_in}<br />
              <span className="accent-text">{formattedDuration}</span>
            </>
          )}
        </h2>

        <p className="result-subtitle">
          {status === 'relapsed'
            ? t.result_duration.replace('{t}', formattedDuration)
            : t.result_control_restored}
        </p>

        <p className="result-note">{getRecoveryNote()}</p>

        <button
          id="btn-done"
          className="btn btn-primary btn-large"
          onClick={() => onNavigate('home')}
        >
          {t.result_continue}
        </button>
      </div>
    </div>
  );
}
