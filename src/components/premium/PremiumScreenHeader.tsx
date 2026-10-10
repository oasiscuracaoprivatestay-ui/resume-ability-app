import React from 'react';
import type { Screen } from '../../types';
import GlobalScoreBadge from '../GlobalScoreBadge';
import './PremiumScreenHeader.css';

export interface PremiumScreenHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  onBack?: () => void;
  backId?: string;
  backAriaLabel?: string;
  backText?: string;
  rightAction?: React.ReactNode;
  showScoreBadge?: boolean;
  onNavigate?: (screen: Screen) => void;
  className?: string;
}

export const PremiumScreenHeader: React.FC<PremiumScreenHeaderProps> = ({
  title,
  subtitle,
  eyebrow,
  onBack,
  backId = 'btn-header-back',
  backAriaLabel = 'Go back',
  backText = 'Back',
  rightAction,
  showScoreBadge = false,
  onNavigate,
  className = '',
}) => {
  return (
    <header className={`sda-premium-header ${className}`} id="sda-premium-header">
      <div className="sda-premium-header__left">
        {onBack && (
          <button
            type="button"
            id={backId}
            className="sda-premium-header__back-btn"
            onClick={onBack}
            aria-label={backAriaLabel}
            title={backAriaLabel}
          >
            <span className="sda-premium-header__back-icon" aria-hidden="true">
              ‹
            </span>
            <span className="sda-premium-header__back-text">{backText}</span>
          </button>
        )}
      </div>

      <div className="sda-premium-header__center">
        {eyebrow && <span className="sda-premium-header__eyebrow">{eyebrow}</span>}
        <h1 className="sda-premium-header__title">{title}</h1>
        {subtitle && <span className="sda-premium-header__subtitle">{subtitle}</span>}
      </div>

      <div className="sda-premium-header__right">
        {showScoreBadge && <GlobalScoreBadge mode="header" onNavigate={onNavigate} />}
        {rightAction}
      </div>
    </header>
  );
};

export default PremiumScreenHeader;
