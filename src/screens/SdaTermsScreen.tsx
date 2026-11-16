import { useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';
import './SdaTermsScreen.css';

interface SdaTermsScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

export default function SdaTermsScreen({ onNavigate, onBack }: SdaTermsScreenProps) {
  const { t } = useTranslation();

  const terms: { id: string; icon: AppIconName; title: string; definition: string }[] = [
    {
      id: 'slip',
      icon: 'rotate-ccw',
      title: t.sda_term_slip_title,
      definition: t.sda_term_slip_def,
    },
    {
      id: 'sz',
      icon: 'zap',
      title: t.sda_term_sz_title,
      definition: t.sda_term_sz_def,
    },
    {
      id: 'nn',
      icon: 'shield',
      title: t.sda_term_nn_title,
      definition: t.sda_term_nn_def,
    },
    {
      id: 'ra',
      icon: 'refresh-cw',
      title: t.sda_term_ra_title,
      definition: t.sda_term_ra_def,
    },
    {
      id: 'sd',
      icon: 'clipboard-list',
      title: t.sda_term_sd_title,
      definition: t.sda_term_sd_def,
    },
    {
      id: 'mf',
      icon: 'timer',
      title: t.sda_term_mf_title,
      definition: t.sda_term_mf_def,
    },
  ];

  // All 6 core terms start expanded so full definitions are immediately readable;
  // users can tap any card header to collapse/expand while scanning.
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const toggleTerm = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="screen sda-terms-screen" id="sda-terms-screen">
      <PremiumScreenHeader
        className="sda-premium-header--compact"
        backId="btn-header-back"
        onBack={onBack ? onBack : () => onNavigate('home')}
        backText={t.global_back || 'Back'}
        backAriaLabel={t.global_back || 'Go back'}
        title={t.sda_terms_title}
        showScoreBadge
        onNavigate={onNavigate}
        rightAction={
          <button
            id="btn-header-home"
            type="button"
            className="sda-premium-header__home-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_return_to_main || 'Go home'}
          >
            <AppIcon name="home" size={18} />
          </button>
        }
      />

      <div className="sda-terms-content">
        <div className="sda-terms-intro-card">
          <p className="sda-terms-slogan">{t.sda_slogan}</p>
          <p className="sda-terms-subtitle">{t.sda_terms_subtitle}</p>
        </div>

        <div className="sda-terms-list" role="list">
          {terms.map((term, idx) => {
            const isExpanded = !collapsedIds[term.id];
            return (
              <article
                key={term.id}
                className={`sda-term-card ${isExpanded ? 'sda-term-card--open' : 'sda-term-card--collapsed'}`}
                id={`sda-card-${term.id}`}
                role="listitem"
              >
                <button
                  type="button"
                  id={`btn-toggle-term-${term.id}`}
                  className="sda-term-trigger"
                  onClick={() => toggleTerm(term.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`sda-def-${term.id}`}
                >
                  <span className="sda-term-icon" aria-hidden="true">
                    <AppIcon name={term.icon} size={17} strokeWidth={1.95} />
                  </span>
                  <span className="sda-term-title-group">
                    <span className="sda-term-index">0{idx + 1}</span>
                    <h2 className="sda-term-name">{term.title}</h2>
                  </span>
                  <AppIcon
                    name="chevron-down"
                    size={16}
                    strokeWidth={2}
                    className={`sda-term-chevron ${isExpanded ? 'sda-term-chevron--open' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div id={`sda-def-${term.id}`} className="sda-term-body">
                    <p className="sda-term-def">{term.definition}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="sda-terms-footer">
          <button
            id="btn-sda-terms-home"
            type="button"
            className="sda-terms-home-btn"
            onClick={() => onNavigate('home')}
          >
            <AppIcon name="home" size={16} strokeWidth={2} />
            <span>{t.sda_btn_home}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
