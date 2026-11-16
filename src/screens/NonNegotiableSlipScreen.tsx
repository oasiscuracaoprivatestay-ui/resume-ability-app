import { useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import ScreenHeader from '../components/ScreenHeader';
import { AppIcon } from '../components/icons/AppIcon';
import './NonNegotiableSlipScreen.css';

interface NonNegotiableSlipScreenProps {
  onSelect: (rule: string) => void;
  onNavigate: (screen: Screen) => void;
}

export default function NonNegotiableSlipScreen({
  onSelect,
  onNavigate,
}: NonNegotiableSlipScreenProps) {
  const { t } = useTranslation();

  // Load user's saved non-negotiables directly from pledge storage (no duplication)
  const nonNegotiables = useMemo(() => {
    return loadPledge().nonNegotiables.filter((n) => n.trim().length > 0);
  }, []);

  const hasRules = nonNegotiables.length > 0;

  return (
    <div className="screen nn-slip-screen">
      <ScreenHeader
        onBack={() => onNavigate('slip-type')}
        onHome={() => onNavigate('home')}
      />

      <div className="nn-slip-content">
        <div className="nn-slip-heading">
          <span className="section-label">{t.slip_nn_label}</span>
          <h1 className="nn-slip-question">
            {t.slip_nn_question}{' '}
            <span className="accent-text">{t.slip_nn_question_accent}</span>
          </h1>
        </div>

        {hasRules ? (
          <div className="nn-slip-list">
            {nonNegotiables.map((rule, idx) => (
              <button
                key={idx}
                id={`nn-rule-${idx}`}
                type="button"
                className="nn-slip-card"
                onClick={() => onSelect(rule)}
              >
                <div className="nn-slip-card-left">
                  <span className="nn-slip-badge">{idx + 1}</span>
                  <span className="nn-slip-text">{rule}</span>
                </div>
                <span className="nn-slip-card-arrow" aria-hidden="true">
                  <AppIcon name="chevron-right" size={18} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="nn-slip-empty" id="nn-slip-empty-state">
            <span className="nn-empty-icon" aria-hidden="true">
              <AppIcon name="shield" size={30} />
            </span>
            <h2 className="nn-empty-title">{t.slip_nn_empty_title}</h2>
            <p className="nn-empty-desc">{t.slip_nn_empty_desc}</p>
            <button
              id="btn-nn-go-commitment"
              type="button"
              className="nn-empty-btn"
              onClick={() => onNavigate('commitment')}
            >
              {t.slip_nn_empty_cta}
            </button>
          </div>
        )}

        {/* Cancel / Return to Main Menu Action (Phase 29B) */}
        <div className="recommit-cancel-wrap">
          <button
            id="btn-nn-slip-cancel"
            type="button"
            className="recommit-cancel-btn"
            onClick={() => onNavigate('home')}
            aria-label={t.btn_cancel_to_main}
          >
            <AppIcon name="x" size={15} />
            <span>{t.btn_cancel_to_main}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
