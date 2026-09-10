import { useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './MotivationalTextScreen.css';

interface MotivationalTextScreenProps {
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function MotivationalTextScreen({
  onBack,
  onNavigate,
}: MotivationalTextScreenProps) {
  const { t } = useTranslation();

  const texts = t.motivational_texts ?? [];

  // Pick initial index randomly; lazy initialization prevents re-render changes
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (texts.length === 0) return 0;
    return Math.floor(Math.random() * texts.length);
  });

  const currentItem = texts[currentIndex] ?? {
    title: 'One Decision at a Time',
    body: 'You do not need to solve the whole day right now. Choose the next structured action.',
  };

  // Next message handler: picks another message intentionally, avoiding the same one
  const handleShowAnother = () => {
    if (texts.length <= 1) return;
    let nextIndex = Math.floor(Math.random() * texts.length);
    if (nextIndex === currentIndex) {
      nextIndex = (currentIndex + 1) % texts.length;
    }
    setCurrentIndex(nextIndex);
  };

  const handleReturnHome = () => {
    onNavigate('home');
  };

  return (
    <div className="screen motivational-text-screen">
      <ScreenHeader
        onBack={onBack}
        onHome={() => onNavigate('home')}
      />

      <div className="motivational-text-content">
        {/* Glow backdrop effects */}
        <div className="text-glow-top" aria-hidden="true" />
        <div className="text-glow-bottom" aria-hidden="true" />

        <div className="motivational-text-card">
          <div className="motivational-text-badge">
            <span className="motivational-text-badge-icon" aria-hidden="true">✦</span>
            <span className="motivational-text-badge-label">{t.motivational_text_label}</span>
          </div>

          <h2 className="motivational-text-title">{currentItem.title}</h2>

          <p className="motivational-text-body">{currentItem.body}</p>

          <div className="motivational-text-actions">
            <button
              id="btn-text-next"
              className="btn btn-secondary motivational-text-btn-next"
              onClick={handleShowAnother}
            >
              <span>↻</span>
              <span>{t.motivational_text_btn_next}</span>
            </button>

            <button
              id="btn-text-home"
              className="btn btn-primary btn-large motivational-text-btn-home"
              onClick={handleReturnHome}
            >
              {t.motivational_text_btn_home}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
