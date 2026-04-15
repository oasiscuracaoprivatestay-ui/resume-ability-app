import { useCallback } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import type { Translations } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './PremiumScreen.css';

const PROGRAM_URL = 'https://your-website-link.com';

// ── Feature list ──

interface Feature {
  icon: string;
  titleKey: keyof Translations;
  descKey: keyof Translations;
}

const FEATURES: Feature[] = [
  { icon: '🎧', titleKey: 'prem_feat_audio',    descKey: 'prem_feat_audio_desc' },
  { icon: '🧘', titleKey: 'prem_feat_sessions', descKey: 'prem_feat_sessions_desc' },
  { icon: '☀️', titleKey: 'prem_feat_daily',    descKey: 'prem_feat_daily_desc' },
  { icon: '🤖', titleKey: 'prem_feat_ai',       descKey: 'prem_feat_ai_desc' },
  { icon: '📖', titleKey: 'prem_feat_book',     descKey: 'prem_feat_book_desc' },
];

// ── Component ──

interface PremiumScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function PremiumScreen({ onNavigate }: PremiumScreenProps) {
  const { t } = useTranslation();

  const handleUpgrade = useCallback(() => {
    window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="screen premium-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="premium-content">
        {/* ── Hero ── */}
        <div className="premium-hero">
          <div className="premium-badge">✦</div>
          <h2 className="premium-title">{t.prem_title}</h2>
          <p className="premium-subtitle">{t.prem_subtitle}</p>
        </div>

        {/* ── Features ── */}
        <div className="premium-features">
          {FEATURES.map((feat) => (
            <div key={feat.titleKey} className="premium-feat">
              <span className="premium-feat-icon">{feat.icon}</span>
              <div className="premium-feat-text">
                <span className="premium-feat-title">
                  {t[feat.titleKey] as string}
                </span>
                <span className="premium-feat-desc">
                  {t[feat.descKey] as string}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Value statement ── */}
        <div className="premium-value">
          {t.prem_value.split('\n').map((line, i) => (
            <p key={i} className="premium-value-line">{line}</p>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="premium-cta">
          <button
            id="btn-upgrade"
            className="btn btn-primary btn-large"
            onClick={handleUpgrade}
          >
            {t.prem_upgrade}
          </button>
          <button
            className="btn-text"
            onClick={() => onNavigate('home')}
          >
            {t.prem_free}
          </button>
        </div>
      </div>
    </div>
  );
}
