import { useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import './MotivationalQuoteScreen.css';

interface MotivationalQuoteScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function MotivationalQuoteScreen({ onNavigate }: MotivationalQuoteScreenProps) {
  const { t } = useTranslation();

  // Pick one quote randomly when the screen is first mounted.
  // Using lazy state initializer ensures the quote remains strictly stable across any re-renders.
  const [quote] = useState(() => {
    const list = t.motivational_quotes;
    if (!list || list.length === 0) {
      return 'You don’t need perfection. You need the ability to return.';
    }
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  });

  const handleReturnHome = () => {
    onNavigate('home');
  };

  return (
    <div className="screen quote-screen">
      <div className="quote-container">
        {/* Background ambient glow effects */}
        <div className="quote-glow-top" aria-hidden="true" />
        <div className="quote-glow-bottom" aria-hidden="true" />

        <div className="quote-card">
          {/* Subtle indicator / badge */}
          <div className="quote-badge">
            <span className="quote-badge-dot" aria-hidden="true">✦</span>
            <span className="quote-badge-text">{t.quote_screen_label}</span>
          </div>

          {/* Atmospheric quote presentation */}
          <div className="quote-text-wrap">
            <span className="quote-mark quote-mark-start" aria-hidden="true">“</span>
            <blockquote className="quote-text">
              {quote}
            </blockquote>
            <span className="quote-mark quote-mark-end" aria-hidden="true">”</span>
          </div>

          {/* Primary CTA */}
          <div className="quote-actions">
            <button
              id="btn-quote-home"
              className="btn btn-primary btn-large quote-home-btn"
              onClick={handleReturnHome}
            >
              {t.quote_btn_home}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
