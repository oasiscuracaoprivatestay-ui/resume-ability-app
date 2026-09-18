import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import './PremiumInfoModal.css';

interface PremiumInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function PremiumInfoModal({
  isOpen,
  onClose,
  title,
  description,
}: PremiumInfoModalProps) {
  const { t } = useTranslation();
  const [showingComingSoon, setShowingComingSoon] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset coming soon state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setShowingComingSoon(false);
    }
  }, [isOpen]);

  // Trap focus and handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]');
    firstFocusable?.focus();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showingComingSoon]);

  if (!isOpen) return null;

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="prem-modal-overlay"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prem-modal-title"
    >
      <div className="prem-modal-card" ref={modalRef}>
        <div className="prem-modal-header">
          <div className="prem-modal-badge">
            <span className="prem-badge-icon" aria-hidden="true">🔒</span>
            <span className="prem-badge-text">{t.prem_badge}</span>
          </div>
          <button
            className="prem-modal-close"
            onClick={onClose}
            aria-label={t.commit_cancel}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="prem-modal-body">
          {!showingComingSoon ? (
            <>
              <h2 id="prem-modal-title" className="prem-modal-title">
                {title || t.prem_info_title}
              </h2>
              <div className="prem-modal-slogan-wrap">
                <span className="prem-modal-slogan-badge">SDA</span>
                <p className="prem-modal-slogan">{t.sda_slogan_tagline}</p>
              </div>
              <p className="prem-modal-desc">
                {description || t.prem_info_desc}
              </p>

              <div className="prem-modal-features">
                <div className="prem-feature-item">
                  <span className="prem-feat-icon" aria-hidden="true">🎧</span>
                  <span className="prem-feat-text">{t.prem_feature_audio}</span>
                </div>
                <div className="prem-feature-item">
                  <span className="prem-feat-icon" aria-hidden="true">📖</span>
                  <span className="prem-feat-text">{t.prem_feature_reading}</span>
                </div>
                <div className="prem-feature-item">
                  <span className="prem-feat-icon" aria-hidden="true">✦</span>
                  <span className="prem-feat-text">{t.prem_feature_library}</span>
                </div>
              </div>

              <div className="prem-modal-actions">
                <button
                  id="btn-explore-premium"
                  type="button"
                  className="prem-btn-explore"
                  onClick={() => setShowingComingSoon(true)}
                >
                  {t.prem_btn_explore}
                </button>
                <button
                  type="button"
                  className="prem-btn-cancel"
                  onClick={onClose}
                >
                  {t.commit_cancel}
                </button>
              </div>
            </>
          ) : (
            <div className="prem-coming-soon-block">
              <div className="prem-coming-soon-icon-wrap" aria-hidden="true">
                <span className="prem-coming-soon-icon">✦</span>
              </div>
              <h2 id="prem-modal-title" className="prem-coming-soon-title">
                {t.prem_coming_soon_title}
              </h2>
              <p className="prem-coming-soon-desc">
                {t.prem_coming_soon_desc}
              </p>
              <div className="prem-modal-actions">
                <button
                  id="btn-close-coming-soon"
                  type="button"
                  className="prem-btn-explore"
                  onClick={onClose}
                >
                  {t.sda_btn_close}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
