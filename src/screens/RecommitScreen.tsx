import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { loadPledge } from '../utils/pledgeStorage';
import { getActiveProfile, loadDietStore } from '../utils/dietStorage';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import HoldCommitButton from '../components/HoldCommitButton';
import { SuccessCelebration } from '../components/animations';
import NextActionModal from '../components/premium/NextActionModal';
import './RecommitScreen.css';

interface RecommitScreenProps {
  onComplete: () => boolean | void;
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

type RecommitStep = 'hold' | 'success';

export default function RecommitScreen({
  onComplete,
  onNavigate,
  onBack,
}: RecommitScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<RecommitStep>('hold');
  const [showNextAction, setShowNextAction] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [step]);

  // Load user's saved Why reason, Non-Negotiable anchors, and active Structured Diet name
  const commitmentContext = useMemo(() => {
    const pledge = loadPledge();
    const firstReason = pledge.reasons.find((r) => r.trim().length > 0) ?? null;
    const nonNegotiables = (pledge.nonNegotiables || []).filter((n) => n.trim().length > 0);
    const activeDietName = getActiveProfile(loadDietStore()).name;
    return { firstReason, nonNegotiables, activeDietName };
  }, []);

  const handleHoldComplete = useCallback((): boolean => {
    setSaveError(null);
    try {
      const saved = onComplete();
      if (saved === false) {
        setSaveError(t.anim_repledge_save_error);
        return false;
      }
      setStep('success');
      return true;
    } catch {
      setSaveError(t.anim_repledge_save_error);
      return false;
    }
  }, [onComplete, t.anim_repledge_save_error]);

  return (
    <div className="screen recommit-screen">
      <PremiumScreenHeader
        title={t.recommit_title}
        eyebrow={t.recommit_label || 'RECOVERY & FOCUS'}
        subtitle={step === 'hold' ? t.recommit_subtitle : undefined}
        onBack={() => {
          if (step === 'hold' && onBack) {
            onBack();
          } else if (onBack) {
            onBack();
          } else {
            onNavigate(step === 'hold' ? 'help' : 'home');
          }
        }}
        backId="btn-header-back"
        showScoreBadge
        onNavigate={onNavigate}
      />

      {step === 'hold' ? (
        <div className="recommit-content">
          <div className="recommit-heading">
            <span className="section-label">{t.recommit_label}</span>
            <h2 className="recommit-title">{t.recommit_title}</h2>
            <p className="recommit-subtitle">{t.recommit_subtitle}</p>
          </div>

          {/* ── Saved Why Reason Card (Prominently displayed) ── */}
          <div
            className="recommit-why-card"
            aria-label={t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}
          >
            <div className="recommit-why-header">
              <span className="recommit-why-question">
                {t.recommit_why_reminder || 'REMEMBER WHY YOU STARTED'}
              </span>
              <button
                id="btn-recommit-manage-why"
                type="button"
                className="recommit-why-manage-btn"
                onClick={() => onNavigate('commitment')}
                aria-label={`${t.pledge_why_manage} ${t.pledge_why_title}`}
              >
                {t.pledge_why_manage} ›
              </button>
            </div>
            <p
              className={`recommit-why-reason${
                commitmentContext.firstReason ? '' : ' recommit-why-reason--empty'
              }`}
            >
              {commitmentContext.firstReason ??
                (t.pledge_why_empty ||
                  'No Why specified yet. Recommit to return to your structured diet.')}
            </p>

            {/* Current Structured Diet & Non-Negotiables Commitment Context */}
            <div className="recommit-commitment-meta" id="recommit-commitment-summary">
              <div className="recommit-meta-row">
                <span className="recommit-meta-label">{t.anim_repledge_blueprint_label}</span>
                <span className="recommit-meta-val">{commitmentContext.activeDietName}</span>
              </div>
              {commitmentContext.nonNegotiables.length > 0 && (
                <div className="recommit-anchors-block">
                  <span className="recommit-meta-label">{t.anim_repledge_anchors_label}</span>
                  <ul className="recommit-anchors-list">
                    {commitmentContext.nonNegotiables.slice(0, 3).map((rule, idx) => (
                      <li key={idx} className="recommit-anchor-pill">
                        ✓ {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="recommit-save-error" id="recommit-save-error" role="alert">
              {saveError}
            </div>
          )}

          {/* ── Enhanced 3-Second Cyan-Blue Hold-to-Confirm Daily Re-Pledge ── */}
          <div className="recommit-ritual-section">
            <HoldCommitButton
              id="btn-recommit-hold"
              variant="repledge"
              durationMs={3000}
              showAccessibleConfirm={true}
              onComplete={handleHoldComplete}
            />

            {/* Unlimited Re-Commit Behavioral Reinforcement Hint */}
            <p className="recommit-unlimited-hint" id="recommit-unlimited-hint">
              {t.recommit_unlimited_hint ||
                'You can re-commit anytime you need to reset your focus.'}
            </p>

            {/* Cancel / Return Action */}
            <div className="recommit-cancel-wrap">
              <button
                id="btn-recommit-cancel"
                type="button"
                className="recommit-cancel-btn"
                onClick={() => {
                  if (onBack) onBack();
                  else onNavigate('home');
                }}
                aria-label={t.recommit_btn_cancel || 'Cancel / Return to Main Menu'}
              >
                ✕ {t.recommit_btn_cancel || 'Cancel / Return to Main Menu'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Animation B: Daily Re-Pledge Confirmation ── */
        <div className="recommit-success-content" id="recommit-success-screen">
          <SuccessCelebration
            id="celebration-repledge"
            variant="repledge"
            title={t.anim_repledge_confirmed_title}
            subtitle={t.anim_repledge_confirmed_sub}
            actions={[
              {
                id: 'btn-repledge-return-loop',
                label: t.anim_repledge_return_loop_btn,
                variant: 'primary',
                onClick: () => {
                  if (onBack) onBack();
                  else onNavigate('challenges');
                },
              },
              {
                id: 'btn-recommit-next-action',
                label: t.next_action_modal_title || 'Choose Your Next Step',
                variant: 'secondary',
                onClick: () => setShowNextAction(true),
              },
              {
                id: 'btn-recommit-home',
                label: t.recommit_btn_main_menu,
                variant: 'secondary',
                onClick: () => onNavigate('home'),
              },
            ]}
          />
        </div>
      )}

      {/* ── Premium Next Action After Recommit (Phase 5) ── */}
      <NextActionModal
        isOpen={showNextAction}
        onClose={() => setShowNextAction(false)}
        onNavigate={onNavigate}
        currentScreen="recommit"
      />
    </div>
  );
}
