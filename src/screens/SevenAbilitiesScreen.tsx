import React, { useState, useMemo, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon, type AppIconName } from '../components/icons/AppIcon';
import {
  getSevenDietAbilitiesOverview,
  type CanonicalDietAbilityId,
  type DietAbilityProgress,
} from '../abilities';
import { CHALLENGE_UPDATED_EVENT } from '../challenges';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import {
  CANONICAL_SEVEN_DIET_ABILITIES,
} from '../coach/knowledge/abilities/sevenDietAbilities';
import './SevenAbilitiesScreen.css';

interface SevenAbilitiesScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onSelectAbility?: (abilityId: CanonicalDietAbilityId) => void;
}

export const ABILITY_APP_ICONS: Record<CanonicalDietAbilityId, AppIconName> = {
  resume_ability: 'shield',
  loss_maintenance_ability: 'scale',
  appetite_fix_ability: 'utensils',
  insulin_aware_ability: 'droplet',
  keto_switching_ability: 'refresh-cw',
  circadian_eating_ability: 'sun',
  micro_fasting_ability: 'timer',
};

export const SevenAbilitiesScreen: React.FC<SevenAbilitiesScreenProps> = ({
  onNavigate,
  onBack,
  onSelectAbility,
}) => {
  const { t } = useTranslation();
  const [sequenceMode, setSequenceMode] = useState<'recovery' | 'breakdown'>('recovery');
  const [expandedPreviewId, setExpandedPreviewId] = useState<CanonicalDietAbilityId | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshTick((n) => n + 1);
    window.addEventListener(CHALLENGE_UPDATED_EVENT, refresh);
    window.addEventListener(STATS_RESET_EVENT, refresh);
    return () => {
      window.removeEventListener(CHALLENGE_UPDATED_EVENT, refresh);
      window.removeEventListener(STATS_RESET_EVENT, refresh);
    };
  }, []);

  const overview = useMemo(() => {
    void refreshTick;
    return getSevenDietAbilitiesOverview();
  }, [refreshTick]);

  const orderedAbilityIds = useMemo(() => {
    return sequenceMode === 'recovery'
      ? overview.recoverySequence
      : overview.breakdownSequence;
  }, [sequenceMode, overview]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('home');
    }
  };

  const handleOpenDetail = (abilityId: CanonicalDietAbilityId) => {
    if (onSelectAbility) {
      onSelectAbility(abilityId);
    } else {
      onNavigate('ability-detail');
    }
  };

  const togglePreview = (id: CanonicalDietAbilityId) => {
    setExpandedPreviewId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="screen seven-abilities-screen" id="seven-abilities-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        title={t.seven_abilities_title || 'The Seven Diet-Abilities'}
        subtitle={t.seven_abilities_subtitle || 'Mastery through recovery, consistency, and awareness.'}
        eyebrow="SUPER DIET-ABILITY"
        onBack={handleBack}
        backText={t.global_back || 'Back'}
        backAriaLabel={t.global_back || 'Go back'}
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

      <div className="seven-abilities-content">
        {/* Progression Separation Notice */}
        <div className="seven-abilities-notice-card" id="seven-abilities-progression-notice">
          <span className="sa-notice-icon" aria-hidden="true">
            <AppIcon name="lightbulb" size={18} strokeWidth={1.9} />
          </span>
          <p className="sa-notice-text">
            {t.seven_abilities_progression_notice ||
              "Your Diet-Ability development is based on recorded practice and recovery. It is separate from your XP Level and today's score."}
          </p>
        </div>

        {/* Sequence Mode Toggle */}
        <div className="sequence-toggle-card">
          <div className="sequence-toggle-header">
            <span className="sequence-toggle-label">
              {t.seven_abilities_seq_toggle_label || 'Sequence Order'}
            </span>
            <div className="sequence-pill-buttons" role="group" aria-label={t.seven_abilities_seq_toggle_label || 'Sequence Order'}>
              <button
                type="button"
                id="btn-seq-recovery"
                className={`sequence-pill-btn ${sequenceMode === 'recovery' ? 'sequence-pill-btn--active' : ''}`}
                onClick={() => setSequenceMode('recovery')}
                aria-pressed={sequenceMode === 'recovery'}
              >
                {t.seven_abilities_seq_recovery || 'Recovery Sequence'}
              </button>
              <button
                type="button"
                id="btn-seq-breakdown"
                className={`sequence-pill-btn ${sequenceMode === 'breakdown' ? 'sequence-pill-btn--active' : ''}`}
                onClick={() => setSequenceMode('breakdown')}
                aria-pressed={sequenceMode === 'breakdown'}
              >
                {t.seven_abilities_seq_breakdown || 'Breakdown Sequence'}
              </button>
            </div>
          </div>
          <p className="sequence-desc">
            {sequenceMode === 'recovery'
              ? (t.seven_abilities_seq_recovery_desc ||
                  'When rebuilding consistency, restore abilities starting with Resume-Ability (Book 1) through Micro-Fasting (Book 7).')
              : (t.seven_abilities_seq_breakdown_desc ||
                  'When diet structure erodes under pressure, abilities tend to fail in reverse order, ending at Resume-Ability.')}
          </p>
        </div>

        {/* Seven Abilities Cards List */}
        <div className="abilities-cards-list" role="list">
          {orderedAbilityIds.map((abilityId, index) => {
            const item: DietAbilityProgress = overview.abilities[abilityId];
            const meta = CANONICAL_SEVEN_DIET_ABILITIES[abilityId];
            const iconName = ABILITY_APP_ICONS[abilityId] || 'shield';
            const isResume = abilityId === 'resume_ability';
            const isPreviewOpen = expandedPreviewId === abilityId;
            const bookBadgeText = (t.seven_abilities_book_badge || 'Book {book}').replace(
              '{book}',
              String(item.bookNumber)
            );
            const sequenceStep = index + 1;

            return (
              <article
                key={abilityId}
                id={`card-ability-${abilityId}`}
                className={`ability-overview-card ${isResume ? 'ability-overview-card--active' : ''}`}
                role="listitem"
              >
                <div className="ability-card-top">
                  <span className={`ability-icon-emblem ${isResume ? 'ability-icon-emblem--active' : ''}`} aria-hidden="true">
                    <AppIcon name={iconName} size={20} strokeWidth={1.85} />
                  </span>
                  <div className="ability-title-col">
                    <div className="ability-pills-row">
                      <span className="ability-book-pill">{bookBadgeText}</span>
                      <span className="ability-seq-pill">#{sequenceStep}</span>
                      {item.doctrineExplored && (
                        <span className="ability-reviewed-pill">
                          <AppIcon name="check" size={11} strokeWidth={2.4} />
                          <span>{t.ability_detail_acknowledged_badge || 'Principles Reviewed'}</span>
                        </span>
                      )}
                    </div>
                    <h2 className="ability-title">{item.officialTitle}</h2>
                  </div>
                </div>

                <p className="ability-subtitle">{item.subtitle}</p>

                <div className="ability-status-row">
                  <span
                    className={`sa-status-badge ${
                      item.operationalStatus === 'active_challenge'
                        ? 'sa-status-badge--active'
                        : 'sa-status-badge--coming-soon'
                    }`}
                  >
                    {item.operationalStatus === 'active_challenge' ? (
                      <>
                        <span className="sa-status-dot" aria-hidden="true" />
                        <span>{t.seven_abilities_status_active || 'Active Challenge Available'}</span>
                      </>
                    ) : (
                      <>
                        <AppIcon name="clock" size={13} strokeWidth={2} />
                        <span>
                          {t.seven_abilities_status_coming_soon ||
                            'Doctrine Available • Interactive Challenge Coming Soon'}
                        </span>
                      </>
                    )}
                  </span>
                </div>

                {/* Resume-Ability Evidence Section */}
                {isResume && item.evidence && (
                  <div className="ability-evidence-section" id="resume-ability-evidence-grid">
                    {item.evidence.hasActiveChallenge && (
                      <div className="sa-active-challenge-notice" id="overview-active-challenge-banner">
                        <span className="pulse-dot" aria-hidden="true" />
                        <span>
                          {t.seven_abilities_active_badge || 'Active Challenge in Progress'} • Day{' '}
                          {item.evidence.activeChallengeCurrentDay || 1} of{' '}
                          {item.evidence.activeChallengeDurationDays || 7} (
                          {item.evidence.activeChallengeDaysRemaining ?? 0} days remaining)
                        </span>
                      </div>
                    )}

                    <div className="sa-evidence-stats-grid">
                      <div className="sa-evidence-stat-box">
                        <span className="sa-stat-label">
                          {t.seven_abilities_stat_checkins || 'Challenge Check-Ins'}
                        </span>
                        <span className="sa-stat-val" id="val-resume-checkins">
                          {item.evidence.totalChallengeCheckIns}
                        </span>
                      </div>

                      <div className="sa-evidence-stat-box">
                        <span className="sa-stat-label">
                          {t.seven_abilities_stat_practice_days || 'Practice Days'}
                        </span>
                        <span className="sa-stat-val" id="val-resume-practice-days">
                          {item.evidence.uniquePracticeDays}
                        </span>
                      </div>

                      <div className="sa-evidence-stat-box">
                        <span className="sa-stat-label">
                          {t.seven_abilities_stat_completed || 'Challenges Completed'}
                        </span>
                        <span className="sa-stat-val" id="val-resume-completed">
                          {item.evidence.completedChallengesCount}
                        </span>
                      </div>

                      <div className="sa-evidence-stat-box">
                        <span className="sa-stat-label">
                          {t.seven_abilities_stat_recoveries || 'Verified Recoveries'}
                        </span>
                        <span className="sa-stat-val" id="val-resume-recoveries">
                          {item.evidence.eligibleSlipsCount > 0
                            ? `${item.evidence.resumedSlipsCount} / ${item.evidence.eligibleSlipsCount}`
                            : '0'}
                        </span>
                        <span className="sa-stat-sub">
                          {item.evidence.hasResumeOpportunities && item.evidence.resumeRate !== null
                            ? `${item.evidence.resumeRate}% ${t.seven_abilities_stat_resume_rate || 'Resume Rate'}`
                            : (t.seven_abilities_stat_no_slips || 'No eligible slips recorded')}
                        </span>
                      </div>
                    </div>

                    <div className="sa-card-actions-grid">
                      <button
                        type="button"
                        id="btn-open-challenge-control-center"
                        className="sa-btn sa-btn--primary"
                        onClick={() => onNavigate('challenges')}
                      >
                        <span className="sa-btn-lead">
                          <AppIcon name="shield" size={17} strokeWidth={2} />
                          <span>{t.seven_abilities_btn_control_center || 'Open Challenge Control Center'}</span>
                        </span>
                        <AppIcon name="arrow-right" size={16} strokeWidth={2.1} className="sa-btn-trail" />
                      </button>

                      <button
                        type="button"
                        id={`btn-detail-${abilityId}`}
                        className="sa-btn sa-btn--secondary"
                        onClick={() => handleOpenDetail(abilityId)}
                      >
                        <span className="sa-btn-lead">
                          <AppIcon name="book-open" size={16} strokeWidth={1.9} />
                          <span>{t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                        </span>
                        <AppIcon name="arrow-right" size={16} strokeWidth={2} className="sa-btn-trail" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Books 2-7 Doctrine Preview & Full Principles Actions */}
                {!isResume && (
                  <div className="ability-doctrine-section">
                    <div className="sa-card-actions-grid">
                      <button
                        type="button"
                        id={`btn-preview-${abilityId}`}
                        className={`sa-btn sa-btn--ghost ${isPreviewOpen ? 'sa-btn--ghost-open' : ''}`}
                        onClick={() => togglePreview(abilityId)}
                        aria-expanded={isPreviewOpen}
                        aria-controls={`preview-content-${abilityId}`}
                      >
                        <span className="sa-btn-lead">
                          <AppIcon name={isPreviewOpen ? 'x' : 'book-open'} size={16} strokeWidth={1.9} />
                          <span>
                            {isPreviewOpen
                              ? (t.seven_abilities_btn_close_preview || 'Close Preview')
                              : (t.seven_abilities_btn_preview || 'Explore Principles')}
                          </span>
                        </span>
                        <AppIcon
                          name="chevron-down"
                          size={16}
                          strokeWidth={2}
                          className={`preview-chevron ${isPreviewOpen ? 'preview-chevron--open' : ''}`}
                        />
                      </button>

                      <button
                        type="button"
                        id={`btn-detail-${abilityId}`}
                        className="sa-btn sa-btn--secondary"
                        onClick={() => handleOpenDetail(abilityId)}
                      >
                        <span className="sa-btn-lead">
                          <AppIcon name="layers" size={16} strokeWidth={1.9} />
                          <span>{t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                        </span>
                        <AppIcon name="arrow-right" size={16} strokeWidth={2} className="sa-btn-trail" />
                      </button>
                    </div>

                    {isPreviewOpen && (
                      <div
                        id={`preview-content-${abilityId}`}
                        className="ability-doctrine-preview"
                        role="region"
                        aria-label={`${item.officialTitle} doctrine preview`}
                      >
                        <div className="preview-block">
                          <h3 className="preview-block-title">
                            {t.seven_abilities_preview_paradigm || 'Central Paradigm Shift'}
                          </h3>
                          <p className="preview-block-text">{meta.centralParadigmShift}</p>
                        </div>

                        <div className="preview-block">
                          <h3 className="preview-block-title">
                            {t.seven_abilities_preview_techniques || 'Key Techniques'}
                          </h3>
                          <ul className="preview-techniques-list">
                            {meta.keyTechniques.map((tech, idx) => (
                              <li key={idx}>
                                <span className="preview-bullet" aria-hidden="true" />
                                <span>{tech}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="preview-block">
                          <h3 className="preview-block-title">
                            {t.seven_abilities_preview_non_negotiables || 'Core Non-Negotiables'}
                          </h3>
                          <ul className="preview-techniques-list">
                            {meta.keyNonNegotiables.map((nn, idx) => (
                              <li key={idx}>
                                <span className="preview-bullet preview-bullet--anchor" aria-hidden="true">
                                  <AppIcon name="anchor" size={12} strokeWidth={2} />
                                </span>
                                <span>{nn}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="preview-honest-notice">
                          <span className="preview-honest-icon" aria-hidden="true">
                            <AppIcon name="info" size={15} strokeWidth={2} />
                          </span>
                          <p>
                            {t.seven_abilities_preview_notice ||
                              'Interactive challenges for this ability will be released in an upcoming phase. Reviewing doctrine does not fabricate artificial progress.'}
                          </p>
                        </div>

                        <button
                          type="button"
                          id={`btn-preview-deep-dive-${abilityId}`}
                          className="sa-btn sa-btn--secondary sa-btn--full"
                          onClick={() => handleOpenDetail(abilityId)}
                        >
                          <span className="sa-btn-lead">
                            <AppIcon name="book-open" size={16} strokeWidth={1.9} />
                            <span>{t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                          </span>
                          <AppIcon name="arrow-right" size={16} strokeWidth={2} className="sa-btn-trail" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SevenAbilitiesScreen;
