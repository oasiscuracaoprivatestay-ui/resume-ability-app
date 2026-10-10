import React, { useState, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation, type Translations } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import {
  getDietAbilityProgress,
  markDoctrineExplored,
  getDoctrineExplorationRecord,
  type CanonicalDietAbilityId,
} from '../abilities';
import { CANONICAL_SEVEN_DIET_ABILITIES } from '../coach/knowledge/abilities/sevenDietAbilities';
import './AbilityDetailScreen.css';

interface AbilityDetailScreenProps {
  abilityId: CanonicalDietAbilityId;
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onDiscussWithCoach: (abilityId: CanonicalDietAbilityId, prompt: string) => void;
}

const ABILITY_ICONS: Record<CanonicalDietAbilityId, string> = {
  resume_ability: '🛡️',
  loss_maintenance_ability: '⚖️',
  appetite_fix_ability: '🍽️',
  insulin_aware_ability: '🩸',
  keto_switching_ability: '🔄',
  circadian_eating_ability: '⏰',
  micro_fasting_ability: '⏳',
};

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

  // Load progress and authoritative doctrine
  const progress = useMemo(() => {
    return getDietAbilityProgress(abilityId);
  }, [abilityId]);

  const definition = CANONICAL_SEVEN_DIET_ABILITIES[abilityId];

  // Acknowledgment state initialized strictly from persistent storage
  const initialRecord = useMemo(() => {
    return getDoctrineExplorationRecord(abilityId);
  }, [abilityId]);

  const [isExplored, setIsExplored] = useState<boolean>(Boolean(initialRecord?.explored));
  const [exploredAt, setExploredAt] = useState<number | undefined>(initialRecord?.exploredAt);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);

  const icon = ABILITY_ICONS[abilityId] || '🛡️';
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
    <div className="screen ability-detail-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        title={definition.officialTitle}
        subtitle={definition.subtitle}
        eyebrow={`SUPER DIET-ABILITY • ${bookBadgeText}`}
        onBack={handleBack}
        showScoreBadge
        onNavigate={onNavigate}
      />

      <div className="ability-detail-content">
        {/* Ability Header Section (status bar and icon card) */}
        <header className="ability-detail-header" id="ability-detail-header">
          <div className="ability-detail-hero">
            <span className="ability-detail-icon" aria-hidden="true">{icon}</span>
            <div className="ability-detail-identity">
              <span className="ability-detail-book-pill">{bookBadgeText}</span>
              <h1 className="ability-detail-title" id="ability-detail-heading">
                {definition.officialTitle}
              </h1>
              <p className="ability-detail-subtitle">{definition.subtitle}</p>
            </div>
          </div>

          <div className="ability-detail-status-bar">
            <span
              className={`ability-status-badge ${
                isResume
                  ? 'ability-status-badge--active'
                  : 'ability-status-badge--coming-soon'
              }`}
            >
              {isResume
                ? (t.seven_abilities_status_active || 'Active Challenge Available')
                : (t.seven_abilities_status_coming_soon || 'Doctrine Available • Interactive Challenge Coming Soon')}
            </span>
          </div>
        </header>

        {/* Core Definition */}
        <section className="detail-card detail-card--definition" aria-labelledby="heading-definition">
          <h2 className="detail-section-title" id="heading-definition">
            📖 {t.ability_detail_section_definition || 'Core Definition'}
          </h2>
          <p className="detail-definition-text">{definition.coreDefinition}</p>
        </section>

        {/* Central Paradigm Shift */}
        <section className="detail-card detail-card--paradigm" aria-labelledby="heading-paradigm">
          <h2 className="detail-section-title" id="heading-paradigm">
            💡 {t.ability_detail_section_paradigm || 'Central Paradigm Shift'}
          </h2>
          <p className="detail-paradigm-text">{definition.centralParadigmShift}</p>
        </section>

        {/* Resume-Ability Evidence (Only on Resume-Ability) */}
        {isResume && progress.evidence && (
          <section className="detail-card detail-card--evidence" aria-labelledby="heading-evidence">
            <div className="evidence-header-row">
              <h2 className="detail-section-title" id="heading-evidence">
                📊 {t.ability_detail_evidence_title || 'Recorded Practice & Evidence'}
              </h2>
            </div>
            <p className="evidence-section-notice">
              {t.ability_detail_evidence_notice ||
                'Grounded strictly in verified Challenge check-ins and recovery events.'}
            </p>

            {progress.evidence.hasActiveChallenge && (
              <div className="active-challenge-notice" id="detail-active-challenge-banner">
                <span className="pulse-dot" aria-hidden="true" />
                <span>
                  {t.seven_abilities_active_badge || 'Active Challenge in Progress'} • Day{' '}
                  {progress.evidence.activeChallengeCurrentDay || 1} of{' '}
                  {progress.evidence.activeChallengeDurationDays || 7} (
                  {progress.evidence.activeChallengeDaysRemaining || 0} days remaining)
                </span>
              </div>
            )}

            <div className="evidence-stats-grid" id="detail-resume-stats-grid">
              <div className="evidence-stat-box">
                <span className="stat-label">
                  {t.seven_abilities_stat_checkins || 'Challenge Check-Ins'}
                </span>
                <span className="stat-val" id="detail-stat-checkins">
                  {progress.evidence.totalChallengeCheckIns}
                </span>
              </div>

              <div className="evidence-stat-box">
                <span className="stat-label">
                  {t.seven_abilities_stat_practice_days || 'Practice Days'}
                </span>
                <span className="stat-val" id="detail-stat-practice-days">
                  {progress.evidence.uniquePracticeDays}
                </span>
              </div>

              <div className="evidence-stat-box">
                <span className="stat-label">
                  {t.seven_abilities_stat_completed || 'Challenges Completed'}
                </span>
                <span className="stat-val" id="detail-stat-completed">
                  {progress.evidence.completedChallengesCount}
                </span>
              </div>

              <div className="evidence-stat-box">
                <span className="stat-label">
                  {t.seven_abilities_stat_recoveries || 'Verified Recoveries'}
                </span>
                <span className="stat-val" id="detail-stat-recoveries">
                  {progress.evidence.eligibleSlipsCount > 0
                    ? `${progress.evidence.resumedSlipsCount} / ${progress.evidence.eligibleSlipsCount}`
                    : '0'}
                </span>
                <span className="stat-sub" id="detail-stat-resume-rate">
                  {progress.evidence.hasResumeOpportunities && progress.evidence.resumeRate !== null
                    ? `${progress.evidence.resumeRate}% ${t.seven_abilities_stat_resume_rate || 'resume rate'}`
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
                <span>🛡️ {t.ability_detail_btn_open_challenges || 'Open Challenge Control Center'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}

        {/* Coming Soon Notice for Books 2-7 */}
        {!isResume && (
          <section className="detail-card detail-card--coming-soon" aria-label="Operational status">
            <div className="coming-soon-banner">
              <span className="coming-soon-icon" aria-hidden="true">⏳</span>
              <div className="coming-soon-text">
                <h3 className="coming-soon-title">
                  {t.ability_detail_section_availability || 'Operational Status'}
                </h3>
                <p className="coming-soon-desc">
                  {t.ability_detail_status_coming_soon_desc ||
                    'Educational principles are available below. Interactive challenge is scheduled for an upcoming release.'}
                </p>
                <p className="coming-soon-honest-note">
                  {t.ability_detail_coming_soon_notice ||
                    'Interactive Challenge Coming Soon. No fabricated progress or artificial mastery levels are displayed.'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Key Techniques */}
        <section className="detail-card detail-card--techniques" aria-labelledby="heading-techniques">
          <h2 className="detail-section-title" id="heading-techniques">
            🛠️ {t.ability_detail_section_techniques || 'Key Techniques'}
          </h2>
          <ul className="detail-list" role="list">
            {definition.keyTechniques.map((technique, idx) => (
              <li key={idx} className="detail-list-item">
                <span className="list-bullet" aria-hidden="true">•</span>
                <span className="list-text">{technique}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Core Non-Negotiables */}
        <section className="detail-card detail-card--non-negotiables" aria-labelledby="heading-non-negotiables">
          <h2 className="detail-section-title" id="heading-non-negotiables">
            ⚓ {t.ability_detail_section_non_negotiables || 'Core Non-Negotiables'}
          </h2>
          <ul className="detail-list" role="list">
            {definition.keyNonNegotiables.map((item, idx) => (
              <li key={idx} className="detail-list-item">
                <span className="list-bullet list-bullet--anchor" aria-hidden="true">⚓</span>
                <span className="list-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Relationship to the Seven Diet-Abilities System */}
        {definition.relationshipsWithOtherAbilities && (
          <section className="detail-card detail-card--relationships" aria-labelledby="heading-relationships">
            <h2 className="detail-section-title" id="heading-relationships">
              🌐 {t.ability_detail_section_system_relationship || 'Role in the Seven Diet-Abilities System'}
            </h2>
            <div className="relationships-grid" role="list">
              {Object.entries(definition.relationshipsWithOtherAbilities).map(([targetId, relationText]) => {
                const targetDef = CANONICAL_SEVEN_DIET_ABILITIES[targetId as CanonicalDietAbilityId];
                const targetTitle = targetDef ? targetDef.officialTitle : targetId;
                const targetIcon = ABILITY_ICONS[targetId as CanonicalDietAbilityId] || '🔹';

                return (
                  <div key={targetId} className="relationship-card" role="listitem">
                    <div className="relationship-target-header">
                      <span className="relationship-target-icon" aria-hidden="true">{targetIcon}</span>
                      <span className="relationship-target-name">{targetTitle}</span>
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
          <h2 className="detail-section-title" id="heading-acknowledgment">
            ✅ {t.ability_detail_acknowledged_badge || 'Principles Reviewed'}
          </h2>

          {isExplored ? (
            <div className="acknowledged-state-box" id="doctrine-acknowledged-state">
              <span className="acknowledged-check" aria-hidden="true">✓</span>
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
                <span>✓ {t.ability_detail_btn_acknowledge || "I've Reviewed These Principles"}</span>
              </button>
            </div>
          )}

          {acknowledgeError && (
            <div className="detail-error-notice" role="alert" id="acknowledge-error-notice">
              <span aria-hidden="true">⚠️</span>
              <span>{acknowledgeError}</span>
            </div>
          )}
        </section>

        {/* Discuss with SDA AI Coach Action */}
        <section className="detail-card detail-card--coach" aria-label="Discuss with SDA Coach">
          <div className="detail-coach-cta">
            <span className="detail-coach-icon" aria-hidden="true">💬</span>
            <div className="detail-coach-text">
              <h3 className="detail-coach-title">
                {t.ability_detail_btn_coach_discuss || 'Discuss This Ability with SDA Coach'}
              </h3>
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
            <span>💬 {t.ability_detail_btn_coach_discuss || 'Discuss This Ability with SDA Coach'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </section>
      </div>
    </div>
  );
};

export default AbilityDetailScreen;
