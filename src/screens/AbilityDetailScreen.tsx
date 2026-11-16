import React, { useState, useMemo, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation, type Translations } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import { AppIcon } from '../components/icons/AppIcon';
import {
  getDietAbilityProgress,
  markDoctrineExplored,
  getDoctrineExplorationRecord,
  type CanonicalDietAbilityId,
} from '../abilities';
import { CHALLENGE_UPDATED_EVENT } from '../challenges';
import { STATS_RESET_EVENT } from '../utils/resetStats';
import { CANONICAL_SEVEN_DIET_ABILITIES } from '../coach/knowledge/abilities/sevenDietAbilities';
import { ABILITY_APP_ICONS } from './SevenAbilitiesScreen';
import './AbilityDetailScreen.css';

interface AbilityDetailScreenProps {
  abilityId: CanonicalDietAbilityId;
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onDiscussWithCoach: (abilityId: CanonicalDietAbilityId, prompt: string) => void;
}

const COACH_PROMPT_KEYS: Record<CanonicalDietAbilityId, keyof Translations> = {
  resume_ability: 'ability_detail_coach_prompt_resume',
  loss_maintenance_ability: 'ability_detail_coach_prompt_loss',
  appetite_fix_ability: 'ability_detail_coach_prompt_appetite',
  insulin_aware_ability: 'ability_detail_coach_prompt_insulin',
  keto_switching_ability: 'ability_detail_coach_prompt_keto',
  circadian_eating_ability: 'ability_detail_coach_prompt_circadian',
  micro_fasting_ability: 'ability_detail_coach_prompt_micro',
};

export const AbilityDetailScreen: React.FC<AbilityDetailScreenProps> = ({
  abilityId,
  onNavigate,
  onBack,
  onDiscussWithCoach,
}) => {
  const { t } = useTranslation();
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

  // Load progress and authoritative doctrine
  const progress = useMemo(() => {
    void refreshTick;
    return getDietAbilityProgress(abilityId);
  }, [abilityId, refreshTick]);

  const definition = CANONICAL_SEVEN_DIET_ABILITIES[abilityId];

  // Acknowledgment state initialized strictly from persistent storage and kept in sync when abilityId changes
  const initialRecord = useMemo(() => {
    void refreshTick;
    return getDoctrineExplorationRecord(abilityId);
  }, [abilityId, refreshTick]);

  const [isExplored, setIsExplored] = useState<boolean>(Boolean(initialRecord?.explored));
  const [exploredAt, setExploredAt] = useState<number | undefined>(initialRecord?.exploredAt);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);

  useEffect(() => {
    setIsExplored(Boolean(initialRecord?.explored));
    setExploredAt(initialRecord?.exploredAt);
    setAcknowledgeError(null);
  }, [initialRecord]);

  const iconName = ABILITY_APP_ICONS[abilityId] || 'shield';
  const isResume = abilityId === 'resume_ability';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      onNavigate('seven-abilities');
    }
  };

  const handleAcknowledge = () => {
    const result = markDoctrineExplored(abilityId);
    if (result.success) {
      setIsExplored(true);
      setExploredAt(result.exploredAt);
      setAcknowledgeError(null);
    } else {
      setAcknowledgeError(
        t.ability_detail_acknowledge_error ||
          'Unable to save review acknowledgment due to storage limitations.'
      );
    }
  };

  const handleDiscussWithCoach = () => {
    const promptKey = COACH_PROMPT_KEYS[abilityId];
    const promptText = (t[promptKey] as string) || `Can you explain ${definition.officialTitle}?`;
    onDiscussWithCoach(abilityId, promptText);
  };

  const formattedDate = exploredAt
    ? new Date(exploredAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const bookBadgeText = (t.ability_detail_book_badge || 'Book {book} of 7').replace(
    '{book}',
    String(definition.bookNumber)
  );

  return (
    <div className="screen ability-detail-screen" id="ability-detail-screen">
      {/* Compact sticky navigation bar — Hero Card below carries the full Ability title, book badge & subtitle */}
      <PremiumScreenHeader
        className="sda-premium-header--compact"
        backId="btn-header-back"
        title={t.ability_detail_screen_title || 'Ability Details'}
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

      <div className="ability-detail-content">
        {/* Ability Hero Card */}
        <header className="ability-detail-header" id="ability-detail-header">
          <div className="ability-detail-hero">
            <span className={`ability-detail-icon ${isResume ? 'ability-detail-icon--active' : ''}`} aria-hidden="true">
              <AppIcon name={iconName} size={24} strokeWidth={1.85} />
            </span>
            <div className="ability-detail-identity">
              <div className="ability-detail-pills">
                <span className="ability-detail-book-pill">{bookBadgeText}</span>
                {isExplored && (
                  <span className="ability-detail-reviewed-pill">
                    <AppIcon name="check" size={11} strokeWidth={2.4} />
                    <span>{t.ability_detail_acknowledged_badge || 'Principles Reviewed'}</span>
                  </span>
                )}
              </div>
              <h1 className="ability-detail-title" id="ability-detail-heading">
                {definition.officialTitle}
              </h1>
              <p className="ability-detail-subtitle">{definition.subtitle}</p>
            </div>
          </div>

          <div className="ability-detail-status-bar">
            <span
              className={`ad-status-badge ${
                isResume ? 'ad-status-badge--active' : 'ad-status-badge--coming-soon'
              }`}
            >
              {isResume ? (
                <>
                  <span className="ad-status-dot" aria-hidden="true" />
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
        </header>

        {/* Core Definition */}
        <section className="detail-card detail-card--definition" aria-labelledby="heading-definition">
          <div className="detail-section-head">
            <span className="detail-section-icon" aria-hidden="true">
              <AppIcon name="book-open" size={16} strokeWidth={1.9} />
            </span>
            <h2 className="detail-section-title" id="heading-definition">
              {t.ability_detail_section_definition || 'Core Definition'}
            </h2>
          </div>
          <p className="detail-definition-text">{definition.coreDefinition}</p>
        </section>

        {/* Central Paradigm Shift */}
        <section className="detail-card detail-card--paradigm" aria-labelledby="heading-paradigm">
          <div className="detail-section-head">
            <span className="detail-section-icon" aria-hidden="true">
              <AppIcon name="lightbulb" size={16} strokeWidth={1.9} />
            </span>
            <h2 className="detail-section-title" id="heading-paradigm">
              {t.ability_detail_section_paradigm || 'Central Paradigm Shift'}
            </h2>
          </div>
          <p className="detail-paradigm-text">{definition.centralParadigmShift}</p>
        </section>

        {/* Resume-Ability Evidence (Book 1 Only) */}
        {isResume && progress.evidence && (
          <section className="detail-card detail-card--evidence" aria-labelledby="heading-evidence">
            <div className="detail-section-head">
              <span className="detail-section-icon" aria-hidden="true">
                <AppIcon name="bar-chart" size={16} strokeWidth={1.9} />
              </span>
              <h2 className="detail-section-title" id="heading-evidence">
                {t.ability_detail_evidence_title || 'Recorded Practice & Evidence'}
              </h2>
            </div>
            <p className="evidence-section-notice">
              {t.ability_detail_evidence_notice ||
                'Grounded strictly in verified Challenge check-ins and recovery events.'}
            </p>

            {progress.evidence.hasActiveChallenge && (
              <div className="ad-active-challenge-notice" id="detail-active-challenge-banner">
                <span className="pulse-dot" aria-hidden="true" />
                <span>
                  {t.seven_abilities_active_badge || 'Active Challenge in Progress'} • Day{' '}
                  {progress.evidence.activeChallengeCurrentDay || 1} of{' '}
                  {progress.evidence.activeChallengeDurationDays || 7} (
                  {progress.evidence.activeChallengeDaysRemaining ?? 0} days remaining)
                </span>
              </div>
            )}

            <div className="ad-evidence-stats-grid" id="detail-resume-stats-grid">
              <div className="ad-evidence-stat-box">
                <span className="ad-stat-label">
                  {t.seven_abilities_stat_checkins || 'Challenge Check-Ins'}
                </span>
                <span className="ad-stat-val" id="detail-stat-checkins">
                  {progress.evidence.totalChallengeCheckIns}
                </span>
              </div>

              <div className="ad-evidence-stat-box">
                <span className="ad-stat-label">
                  {t.seven_abilities_stat_practice_days || 'Practice Days'}
                </span>
                <span className="ad-stat-val" id="detail-stat-practice-days">
                  {progress.evidence.uniquePracticeDays}
                </span>
              </div>

              <div className="ad-evidence-stat-box">
                <span className="ad-stat-label">
                  {t.seven_abilities_stat_completed || 'Challenges Completed'}
                </span>
                <span className="ad-stat-val" id="detail-stat-completed">
                  {progress.evidence.completedChallengesCount}
                </span>
              </div>

              <div className="ad-evidence-stat-box">
                <span className="ad-stat-label">
                  {t.seven_abilities_stat_recoveries || 'Verified Recoveries'}
                </span>
                <span className="ad-stat-val" id="detail-stat-recoveries">
                  {progress.evidence.eligibleSlipsCount > 0
                    ? `${progress.evidence.resumedSlipsCount} / ${progress.evidence.eligibleSlipsCount}`
                    : '0'}
                </span>
                <span className="ad-stat-sub" id="detail-stat-resume-rate">
                  {progress.evidence.hasResumeOpportunities && progress.evidence.resumeRate !== null
                    ? `${progress.evidence.resumeRate}% ${t.seven_abilities_stat_resume_rate || 'Resume Rate'}`
                    : (t.seven_abilities_stat_no_slips || 'No eligible slips recorded')}
                </span>
              </div>
            </div>

            <div className="detail-action-row">
              <button
                type="button"
                id="btn-detail-open-control-center"
                className="detail-btn-primary"
                onClick={() => onNavigate('challenges')}
              >
                <span className="ad-btn-lead">
                  <AppIcon name="shield" size={17} strokeWidth={2} />
                  <span>{t.ability_detail_btn_open_challenges || 'Open Challenge Control Center'}</span>
                </span>
                <AppIcon name="arrow-right" size={16} strokeWidth={2.1} className="ad-btn-trail" />
              </button>
            </div>
          </section>
        )}

        {/* Operational Status / Coming Soon Notice for Books 2-7 */}
        {!isResume && (
          <section className="detail-card detail-card--coming-soon" id="detail-coming-soon-card" aria-labelledby="heading-availability">
            <div className="detail-section-head">
              <span className="detail-section-icon detail-section-icon--muted" aria-hidden="true">
                <AppIcon name="clock" size={16} strokeWidth={1.9} />
              </span>
              <h2 className="detail-section-title detail-section-title--muted" id="heading-availability">
                {t.ability_detail_section_availability || 'Operational Status'}
              </h2>
            </div>
            <p className="coming-soon-desc">
              {t.ability_detail_status_coming_soon_desc ||
                'Educational principles are available below. Interactive challenge is scheduled for an upcoming release.'}
            </p>
            <div className="coming-soon-honest-box">
              <AppIcon name="info" size={14} strokeWidth={2} />
              <p className="coming-soon-honest-note">
                {t.ability_detail_coming_soon_notice ||
                  'Interactive Challenge Coming Soon. No fabricated progress or artificial mastery levels are displayed.'}
              </p>
            </div>
          </section>
        )}

        {/* Key Techniques */}
        <section className="detail-card detail-card--techniques" aria-labelledby="heading-techniques">
          <div className="detail-section-head">
            <span className="detail-section-icon" aria-hidden="true">
              <AppIcon name="layers" size={16} strokeWidth={1.9} />
            </span>
            <h2 className="detail-section-title" id="heading-techniques">
              {t.ability_detail_section_techniques || 'Key Techniques'}
            </h2>
          </div>
          <ul className="detail-list" role="list">
            {definition.keyTechniques.map((technique, idx) => (
              <li key={idx} className="detail-list-item">
                <span className="detail-step-num" aria-hidden="true">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="list-text">{technique}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Core Non-Negotiables */}
        <section className="detail-card detail-card--non-negotiables" aria-labelledby="heading-non-negotiables">
          <div className="detail-section-head">
            <span className="detail-section-icon" aria-hidden="true">
              <AppIcon name="anchor" size={16} strokeWidth={1.9} />
            </span>
            <h2 className="detail-section-title" id="heading-non-negotiables">
              {t.ability_detail_section_non_negotiables || 'Core Non-Negotiables'}
            </h2>
          </div>
          <ul className="detail-list" role="list">
            {definition.keyNonNegotiables.map((item, idx) => (
              <li key={idx} className="detail-list-item detail-list-item--anchor">
                <span className="detail-anchor-badge" aria-hidden="true">
                  <AppIcon name="anchor" size={13} strokeWidth={2} />
                </span>
                <span className="list-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Relationship to the Seven Diet-Abilities System */}
        {definition.relationshipsWithOtherAbilities && (
          <section className="detail-card detail-card--relationships" aria-labelledby="heading-relationships">
            <div className="detail-section-head">
              <span className="detail-section-icon" aria-hidden="true">
                <AppIcon name="globe" size={16} strokeWidth={1.9} />
              </span>
              <h2 className="detail-section-title" id="heading-relationships">
                {t.ability_detail_section_system_relationship || 'Role in the Seven Diet-Abilities System'}
              </h2>
            </div>
            <div className="relationships-grid" role="list">
              {Object.entries(definition.relationshipsWithOtherAbilities).map(([targetId, relationText]) => {
                const typedTargetId = targetId as CanonicalDietAbilityId;
                const targetDef = CANONICAL_SEVEN_DIET_ABILITIES[typedTargetId];
                const targetTitle = targetDef ? targetDef.officialTitle : targetId;
                const targetIcon = ABILITY_APP_ICONS[typedTargetId] || 'shield';
                const targetBook = targetDef
                  ? (t.seven_abilities_book_badge || 'Book {book}').replace('{book}', String(targetDef.bookNumber))
                  : '';

                return (
                  <div key={targetId} className="relationship-card" role="listitem">
                    <div className="relationship-target-header">
                      <span className="relationship-target-icon" aria-hidden="true">
                        <AppIcon name={targetIcon} size={14} strokeWidth={2} />
                      </span>
                      <span className="relationship-target-name">{targetTitle}</span>
                      {targetBook && <span className="relationship-target-book">{targetBook}</span>}
                    </div>
                    <p className="relationship-text">{relationText}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Educational Review Acknowledgment Card */}
        <section className="detail-card detail-card--acknowledgment" aria-labelledby="heading-acknowledgment">
          <div className="detail-section-head">
            <span className="detail-section-icon" aria-hidden="true">
              <AppIcon name="check-circle" size={16} strokeWidth={1.9} />
            </span>
            <h2 className="detail-section-title" id="heading-acknowledgment">
              {t.ability_detail_acknowledged_badge || 'Principles Reviewed'}
            </h2>
          </div>

          {isExplored ? (
            <div className="acknowledged-state-box" id="doctrine-acknowledged-state">
              <span className="acknowledged-check" aria-hidden="true">
                <AppIcon name="check-circle" size={20} strokeWidth={2.1} />
              </span>
              <div className="acknowledged-info">
                <span className="acknowledged-label">
                  {t.ability_detail_acknowledged_badge || 'Principles Reviewed'}
                </span>
                {formattedDate && (
                  <span className="acknowledged-date">
                    {(t.ability_detail_acknowledged_date || 'Reviewed on {date}').replace(
                      '{date}',
                      formattedDate
                    )}
                  </span>
                )}
                <p className="acknowledged-notice">
                  {t.ability_detail_acknowledged_notice ||
                    'Explicit doctrine review recorded. This educational review does not award XP or simulate practice.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="unacknowledged-state-box">
              <p className="unacknowledged-prompt">
                {t.ability_detail_acknowledged_notice ||
                  'Explicit doctrine review recorded. This educational review does not award XP or simulate practice.'}
              </p>
              <button
                type="button"
                id="btn-acknowledge-doctrine"
                className="detail-btn-acknowledge"
                onClick={handleAcknowledge}
              >
                <span className="ad-btn-lead">
                  <AppIcon name="check-circle" size={17} strokeWidth={2} />
                  <span>{t.ability_detail_btn_acknowledge || "I've Reviewed These Principles"}</span>
                </span>
              </button>
            </div>
          )}

          {acknowledgeError && (
            <div className="detail-error-notice" role="alert" id="acknowledge-error-notice">
              <AppIcon name="alert-triangle" size={16} strokeWidth={2} />
              <span>{acknowledgeError}</span>
            </div>
          )}
        </section>

        {/* Discuss with SDA AI Coach Action */}
        <section className="detail-card detail-card--coach" aria-labelledby="heading-coach-cta">
          <div className="detail-coach-cta">
            <span className="detail-coach-icon" aria-hidden="true">
              <AppIcon name="message-circle" size={20} strokeWidth={1.9} />
            </span>
            <div className="detail-coach-text">
              <h2 className="detail-coach-title" id="heading-coach-cta">
                {t.ability_detail_btn_coach_discuss || 'Discuss This Ability with SDA Coach'}
              </h2>
              <p className="detail-coach-sub">
                {(t.ability_detail_coach_banner_title || 'Focusing on {title}').replace(
                  '{title}',
                  definition.officialTitle
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-coach-discuss-ability"
            className="detail-btn-coach"
            onClick={handleDiscussWithCoach}
          >
            <span className="ad-btn-lead">
              <AppIcon name="message-circle" size={16} strokeWidth={2} />
              <span>{t.ability_detail_btn_coach_discuss || 'Discuss This Ability with SDA Coach'}</span>
            </span>
            <AppIcon name="arrow-right" size={16} strokeWidth={2} className="ad-btn-trail" />
          </button>
        </section>
      </div>
    </div>
  );
};

export default AbilityDetailScreen;
