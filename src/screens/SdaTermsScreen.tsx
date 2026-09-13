import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './SdaTermsScreen.css';

interface SdaTermsScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

export default function SdaTermsScreen({ onNavigate, onBack }: SdaTermsScreenProps) {
  const { t } = useTranslation();

  const terms = [
    {
      id: 'slip',
      icon: '🔄',
      title: t.sda_term_slip_title,
      definition: t.sda_term_slip_def,
    },
    {
      id: 'sz',
      icon: '⚡',
      title: t.sda_term_sz_title,
      definition: t.sda_term_sz_def,
    },
    {
      id: 'nn',
      icon: '🛡️',
      title: t.sda_term_nn_title,
      definition: t.sda_term_nn_def,
    },
    {
      id: 'ra',
      icon: '🚀',
      title: t.sda_term_ra_title,
      definition: t.sda_term_ra_def,
    },
    {
      id: 'sd',
      icon: '📋',
      title: t.sda_term_sd_title,
      definition: t.sda_term_sd_def,
    },
    {
      id: 'mf',
      icon: '⏱️',
      title: t.sda_term_mf_title,
      definition: t.sda_term_mf_def,
    },
  ];

  return (
    <div className="screen sda-terms-screen">
      <ScreenHeader
        onBack={onBack ? onBack : () => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="sda-terms-content">
        <div className="sda-terms-header">
          <span className="section-label">SDA</span>
          <h1 className="sda-terms-title">{t.sda_terms_title}</h1>
          <p className="sda-terms-subtitle">{t.sda_terms_subtitle}</p>
        </div>

        <div className="sda-terms-list">
          {terms.map((term) => (
            <div key={term.id} className="sda-term-card" id={`sda-card-${term.id}`}>
              <div className="sda-term-top">
                <span className="sda-term-icon">{term.icon}</span>
                <h3 className="sda-term-name">{term.title}</h3>
              </div>
              <p className="sda-term-def">{term.definition}</p>
            </div>
          ))}
        </div>

        <div className="sda-terms-footer">
          <button
            id="btn-sda-terms-home"
            type="button"
            className="btn btn-secondary sda-terms-home-btn"
            onClick={() => onNavigate('home')}
          >
            {t.sda_btn_home}
          </button>
        </div>
      </div>
    </div>
  );
}
