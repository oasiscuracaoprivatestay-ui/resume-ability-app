import React from 'react';
import ScreenHeader from '../components/ScreenHeader';
import { Screen } from '../types';
import { useTranslation } from '../i18n';
import './MyCommitmentsScreen.css';

interface MyCommitmentsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const MyCommitmentsScreen: React.FC<MyCommitmentsScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const handleOpenCommitment = () => {
    sessionStorage.removeItem('commitment_focus');
    onNavigate('commitment');
  };

  const handleOpenNonNegotiables = () => {
    sessionStorage.setItem('commitment_focus', 'nn');
    onNavigate('commitment');
  };

  const handleOpenSlipperyZones = () => {
    onNavigate('my-slippery-zones');
  };

  return (
    <div className="screen my-commitments-screen" id="my-commitments-screen">
      <ScreenHeader
        onBack={() => onNavigate('home')}
        onHome={() => onNavigate('home')}
        onNavigate={onNavigate}
      />

      <div className="my-commitments-content">
        <div className="commitments-screen-header">
          <h1 className="commitments-screen-title">{t.my_commitments_title}</h1>
          <p className="commitments-screen-sub">{t.my_commitments_subtitle}</p>
        </div>

        <div className="commitments-hub-grid">
          {/* Card 1: My Commitment */}
          <button
            type="button"
            className="commitment-hub-card card-my-commitment"
            id="btn-hub-my-commitment"
            onClick={handleOpenCommitment}
          >
            <div className="hub-card-icon-wrap icon-commitment" aria-hidden="true">
              🤝
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_commitment_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_commitment_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              →
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
              🛡️
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_nn_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_nn_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              →
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
              ⚠️
            </div>
            <div className="hub-card-body">
              <h2 className="hub-card-title">{t.my_commitments_card_sz_title}</h2>
              <p className="hub-card-desc">{t.my_commitments_card_sz_desc}</p>
            </div>
            <div className="hub-card-arrow" aria-hidden="true">
              →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
