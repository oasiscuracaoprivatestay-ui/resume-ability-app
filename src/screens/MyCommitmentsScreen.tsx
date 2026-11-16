import React from 'react';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon } from '../components/icons/AppIcon';
import { Screen } from '../types';
import { useTranslation } from '../i18n';
import './MyCommitmentsScreen.css';

interface MyCommitmentsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const MyCommitmentsScreen: React.FC<MyCommitmentsScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const handleOpenCommitment = () => {
    try {
      sessionStorage.removeItem('commitment_focus');
    } catch {}
    onNavigate('commitment');
  };

  const handleOpenNonNegotiables = () => {
    try {
      sessionStorage.setItem('commitment_focus', 'nn');
    } catch {}
    onNavigate('commitment');
  };

  const handleOpenSlipperyZones = () => {
    onNavigate('my-slippery-zones');
  };

  return (
    <div className="screen my-commitments-screen" id="my-commitments-screen">
      <PremiumScreenHeader
        title={t.my_commitments_title}
        subtitle={t.my_commitments_subtitle}
        eyebrow="COMMITMENTS & AWARENESS"
        onBack={() => onNavigate('home')}
        backId="btn-header-back"
        backAriaLabel={t.global_back || 'Go back'}
        backText={t.global_back || 'Back'}
        showScoreBadge={true}
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

      <div className="my-commitments-content">
        <div className="commitments-hub-grid">
          {/* Card 1: My Commitment */}
          <button
            type="button"
            className="commitment-hub-card card-my-commitment"
            id="btn-hub-my-commitment"
            onClick={handleOpenCommitment}
          >
            <div className="hub-card-icon-wrap icon-commitment" aria-hidden="true">
              <AppIcon name="heart" size={22} />
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_commitment_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_commitment_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              <AppIcon name="chevron-right" size={18} />
            </div>
          </button>

          {/* Card 2: My Non-Negotiables */}
          <button
            type="button"
            className="commitment-hub-card card-non-negotiables"
            id="btn-hub-non-negotiables"
            onClick={handleOpenNonNegotiables}
          >
            <div className="hub-card-icon-wrap icon-nn" aria-hidden="true">
              <AppIcon name="shield" size={22} />
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_nn_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_nn_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              <AppIcon name="chevron-right" size={18} />
            </div>
          </button>

          {/* Card 3: My Slippery Zones */}
          <button
            type="button"
            className="commitment-hub-card card-slippery-zones"
            id="btn-hub-slippery-zones"
            onClick={handleOpenSlipperyZones}
          >
            <div className="hub-card-icon-wrap icon-sz" aria-hidden="true">
              <AppIcon name="alert-triangle" size={22} />
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_sz_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_sz_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              <AppIcon name="chevron-right" size={18} />
            </div>
          </button>
        </div>

        {/* Return to Main Menu Action */}
        <div className="recommit-cancel-wrap">
          <button
            id="btn-commitments-cancel"
            type="button"
            className="recommit-cancel-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_return_to_main}
          >
            <AppIcon name="home" size={16} />
            <span>{t.btn_return_to_main}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
