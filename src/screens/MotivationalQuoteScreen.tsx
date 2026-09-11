import { useState } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import type { CheckInStatus } from '../utils/checkInStorage';
import { getCheckIns } from '../utils/checkInStorage';
import { getPostCheckInQuoteItem } from '../data/motivationalTexts';
import './MotivationalQuoteScreen.css';

interface MotivationalQuoteScreenProps {
  onNavigate: (screen: Screen) => void;
  status?: CheckInStatus | null;
}

export default function MotivationalQuoteScreen({ onNavigate, status }: MotivationalQuoteScreenProps) {
  const { t, lang } = useTranslation();

  // Resolve effective check-in status (from prop or latest stored check-in)
  const resolvedStatus: CheckInStatus = status ?? (() => {
    const all = getCheckIns();
    return all.length > 0 ? all[all.length - 1].status : 'on-structure';
  })();

  // Pick one quote item randomly when the screen is first mounted.
  // Using lazy state initializer ensures the quote identity remains strictly stable across any re-renders.
  const [quoteItem] = useState(() => {
    return getPostCheckInQuoteItem(resolvedStatus);
  });

  const quoteText = quoteItem ? (quoteItem[lang] || quoteItem.en) : '';

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
              {quoteText}
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
