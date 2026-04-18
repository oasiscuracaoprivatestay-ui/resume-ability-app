import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './TimerLearnScreen.css';

interface TimerLearnScreenProps {
  onNavigate: (screen: Screen) => void;
}

// The four educational sections, keyed into i18n
const SECTIONS = [
  { icon: '⏱', titleKey: 'tl_a_title', bodyKey: 'tl_a_body', delay: '0.05s' },
  { icon: '🧠', titleKey: 'tl_b_title', bodyKey: 'tl_b_body', delay: '0.1s' },
  { icon: '📋', titleKey: 'tl_c_title', bodyKey: 'tl_c_body', delay: '0.15s' },
  { icon: '✅', titleKey: 'tl_d_title', bodyKey: 'tl_d_body', delay: '0.2s' },
] as const;

export default function TimerLearnScreen({ onNavigate }: TimerLearnScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="screen tl-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="tl-content">
        {/* Hero */}
        <div className="tl-hero">
          <span className="tl-hero-icon">⏱</span>
          <div>
            <span className="section-label">{t.tl_label}</span>
            <h1 className="tl-heading">{t.tl_heading}</h1>
          </div>
        </div>

        {/* Four sections */}
        <div className="tl-sections">
          {SECTIONS.map((s) => (
            <div
              key={s.titleKey}
              className="tl-section"
              style={{ animationDelay: s.delay }}
            >
              <span className="tl-section-icon">{s.icon}</span>
              <div className="tl-section-text">
                <p className="tl-section-title">{t[s.titleKey]}</p>
                <p className="tl-section-body">{t[s.bodyKey]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="tl-actions">
          <button
            id="btn-tl-start"
            className="btn btn-primary btn-large"
            onClick={() => onNavigate('context')}
          >
            {t.global_start_timer}
          </button>
          <button
            id="btn-tl-back"
            className="btn btn-ghost"
            onClick={() => onNavigate('home')}
          >
            {t.tl_back}
          </button>
        </div>
      </div>
    </div>
  );
}
