import { useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { playFeedback } from '../utils/feedback';
import {
  CELEBRATED_LEVEL_KEY,
  getCelebratedLevel,
  setCelebratedLevel,
} from '../utils/progressionEngine';
import './LevelUpModal.css';

export { CELEBRATED_LEVEL_KEY, getCelebratedLevel, setCelebratedLevel };

interface LevelUpModalProps {
  level: number;
  onClose: () => void;
}

export default function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    playFeedback('win');
  }, []);

  const handleDismiss = () => {
    setCelebratedLevel(level);
    onClose();
  };

  // Generate celebratory sparks and confetti pieces
  const particles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => (
      <div
        key={i}
        className="lvl-particle"
        style={{
          '--i': i,
          '--angle': `${i * 15}deg`,
          '--hue': (i * 25 + 45) % 360,
          left: `${(i * 4.1 + 6) % 88}%`,
        } as React.CSSProperties}
      />
    ));
  }, []);

  const isLevel10 = level >= 10;

  return (
    <div className="lvl-modal-backdrop" onClick={handleDismiss} role="dialog" aria-modal="true">
      <div className="lvl-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="lvl-particles-wrap" aria-hidden="true">
          {particles}
        </div>

        <div className="lvl-icon-ring">
          <span className="lvl-main-icon">{isLevel10 ? '👑' : '⭐'}</span>
        </div>

        <span className="lvl-pre-title">{t.level_up_title}</span>

        <div className="lvl-badge-hero">
          <span className="lvl-badge-hero-text">
            {t.level_label} {level}
          </span>
        </div>

        <p className="lvl-subtitle">
          {isLevel10
            ? t.level_max_description
            : t.level_up_subtitle.replace('{level}', String(level))}
        </p>

        <button
          id="btn-level-up-continue"
          className="lvl-continue-btn"
          onClick={handleDismiss}
        >
          {t.level_up_continue} →
        </button>
      </div>
    </div>
  );
}
