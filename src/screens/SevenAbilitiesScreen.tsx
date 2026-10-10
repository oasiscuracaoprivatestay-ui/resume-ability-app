import React, { useState, useMemo } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import { PremiumScreenHeader } from '../components/premium/PremiumScreenHeader';
import {
  getSevenDietAbilitiesOverview,
  type CanonicalDietAbilityId,
  type DietAbilityProgress,
} from '../abilities';
import {
  CANONICAL_SEVEN_DIET_ABILITIES,
} from '../coach/knowledge/abilities/sevenDietAbilities';
import './SevenAbilitiesScreen.css';

interface SevenAbilitiesScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
  onSelectAbility?: (abilityId: CanonicalDietAbilityId) => void;
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

export const SevenAbilitiesScreen: React.FC<SevenAbilitiesScreenProps> = ({
  onNavigate,
  onBack,
  onSelectAbility,
}) => {
  const { t } = useTranslation();
  const [sequenceMode, setSequenceMode] = useState<'recovery' | 'breakdown'>('recovery');
  const [expandedPreviewId, setExpandedPreviewId] = useState<CanonicalDietAbilityId | null>(null);

  const overview = useMemo(() => {
    return getSevenDietAbilitiesOverview();
  }, []);

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

  const togglePreview = (id: CanonicalDietAbilityId) => {
    setExpandedPreviewId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="screen seven-abilities-screen">
      <PremiumScreenHeader
        backId="btn-header-back"
        title={t.seven_abilities_title || 'The Seven Diet-Abilities'}
        subtitle={t.seven_abilities_subtitle || 'Mastery through recovery, consistency, and awareness.'}
        eyebrow="SUPER DIET-ABILITY"
        onBack={handleBack}
        showScoreBadge
        onNavigate={onNavigate}
      />

      <div className="seven-abilities-content">
        {/* Screen Header hidden via CSS for PremiumScreenHeader */}
        <header className="seven-abilities-header" style={{ display: 'none' }}>
          <span className="section-label">SUPER DIET-ABILITY</span>
          <h1 className="seven-abilities-title" id="seven-abilities-heading">
            {t.seven_abilities_title || 'The Seven Diet-Abilities'}
          </h1>
          <p className="seven-abilities-subtitle">
            {t.seven_abilities_subtitle || 'Mastery through recovery, consistency, and awareness.'}
          </p>
        </header>

        {/* Clear Progression Separation Notice */}
        <div className="seven-abilities-notice-card" id="seven-abilities-progression-notice">
          <span className="notice-icon" aria-hidden="true">💡</span>
          <p className="notice-text">
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
            <div className="sequence-pill-buttons" role="group" aria-label="Sequence order">
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
          {orderedAbilityIds.map((abilityId) => {
            const item: DietAbilityProgress = overview.abilities[abilityId];
            const meta = CANONICAL_SEVEN_DIET_ABILITIES[abilityId];
            const icon = ABILITY_ICONS[abilityId] || '🛡️';
            const isResume = abilityId === 'resume_ability';
            const isPreviewOpen = expandedPreviewId === abilityId;
            const bookBadgeText = (t.seven_abilities_book_badge || 'Book {book}').replace(
              '{book}',
              String(item.bookNumber)
            );

            return (
              <article
                key={abilityId}
                id={`card-ability-${abilityId}`}
                className={`ability-overview-card ${isResume ? 'ability-overview-card--active' : ''}`}
                role="listitem"
              >
                <div className="ability-card-top-bar">
                  <div className="ability-identity">
                    <span className="ability-icon" aria-hidden="true">{icon}</span>
                    <div className="ability-title-col">
                      <span className="ability-book-pill">{bookBadgeText}</span>
                      <h2 className="ability-title">{item.officialTitle}</h2>
                    </div>
                  </div>
                  <span
                    className={`ability-status-badge ${
                      item.operationalStatus === 'active_challenge'
                        ? 'ability-status-badge--active'
                        : 'ability-status-badge--coming-soon'
                    }`}
                  >
                    {item.operationalStatus === 'active_challenge'
                      ? (t.seven_abilities_status_active || 'Active Challenge Available')
                      : (t.seven_abilities_status_coming_soon || 'Doctrine Available • Interactive Challenge Coming Soon')}
                  </span>
                </div>

                <p className="ability-subtitle">{item.subtitle}</p>

                {/* Resume-Ability Evidence Section */}
                {isResume && item.evidence && (
                  <div className="ability-evidence-section" id="resume-ability-evidence-grid">
                    {item.evidence.hasActiveChallenge && (
                      <div className="active-challenge-notice">
                        <span className="pulse-dot" aria-hidden="true" />
                        <span>
                          {t.seven_abilities_active_badge || 'Active Challenge in Progress'} • Day{' '}
                          {item.evidence.activeChallengeCurrentDay || 1} of{' '}
                          {item.evidence.activeChallengeDurationDays || 7} (
                          {item.evidence.activeChallengeDaysRemaining || 0} days remaining)
                        </span>
                      </div>
                    )}

                    <div className="evidence-stats-grid">
                      <div className="evidence-stat-box">
                        <span className="stat-label">
                          {t.seven_abilities_stat_checkins || 'Challenge Check-Ins'}
                        </span>
                        <span className="stat-val" id="val-resume-checkins">
                          {item.evidence.totalChallengeCheckIns}
                        </span>
                      </div>

                      <div className="evidence-stat-box">
                        <span className="stat-label">
                          {t.seven_abilities_stat_practice_days || 'Practice Days'}
                        </span>
                        <span className="stat-val" id="val-resume-practice-days">
                          {item.evidence.uniquePracticeDays}
                        </span>
                      </div>

                      <div className="evidence-stat-box">
                        <span className="stat-label">
                          {t.seven_abilities_stat_completed || 'Challenges Completed'}
                        </span>
                        <span className="stat-val" id="val-resume-completed">
                          {item.evidence.completedChallengesCount}
                        </span>
                      </div>

                      <div className="evidence-stat-box">
                        <span className="stat-label">
                          {t.seven_abilities_stat_recoveries || 'Verified Recoveries'}
                        </span>
                        <span className="stat-val" id="val-resume-recoveries">
                          {item.evidence.eligibleSlipsCount > 0
                            ? `${item.evidence.resumedSlipsCount} / ${item.evidence.eligibleSlipsCount}`
                            : '0'}
                        </span>
                        <span className="stat-sub">
                          {item.evidence.hasResumeOpportunities && item.evidence.resumeRate !== null
                            ? `${item.evidence.resumeRate}% ${t.seven_abilities_stat_resume_rate || 'resume rate'}`
                            : (t.seven_abilities_stat_no_slips || 'No eligible slips recorded')}
                        </span>
                      </div>
                    </div>

                    <div className="ability-action-row">
                      <button
                        type="button"
                        id="btn-open-challenge-control-center"
                        className="ability-btn-primary"
                        onClick={() => onNavigate('challenges')}
                      >
                        <span>🛡️ {t.seven_abilities_btn_control_center || 'Open Challenge Control Center'}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                      <button
                        type="button"
                        id={`btn-detail-${abilityId}`}
                        className="ability-btn-secondary"
                        onClick={() => {
                          if (onSelectAbility) {
                            onSelectAbility(abilityId);
                          } else {
                            onNavigate('ability-detail');
                          }
                        }}
                      >
                        <span>📖 {t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Inactive Abilities Preview Section */}
                {!isResume && (
                  <div className="ability-doctrine-section">
                    <div className="doctrine-actions-row">
                      <button
                        type="button"
                        id={`btn-preview-${abilityId}`}
                        className="ability-btn-preview"
                        onClick={() => togglePreview(abilityId)}
                        aria-expanded={isPreviewOpen}
                        aria-controls={`preview-content-${abilityId}`}
                      >
                        <span>
                          {isPreviewOpen
                            ? `✕ ${t.seven_abilities_btn_close_preview || 'Close Preview'}`
                            : `📖 ${t.seven_abilities_btn_preview || 'Explore Principles'}`}
                        </span>
                        <span className={`preview-chevron ${isPreviewOpen ? 'preview-chevron--open' : ''}`} aria-hidden="true">
                          ▼
                        </span>
                      </button>

                      <button
                        type="button"
                        id={`btn-detail-${abilityId}`}
                        className="ability-btn-detail"
                        onClick={() => {
                          if (onSelectAbility) {
                            onSelectAbility(abilityId);
                          } else {
                            onNavigate('ability-detail');
                          }
                        }}
                      >
                        <span>{t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                        <span aria-hidden="true">→</span>
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
                              <li key={idx}>• {tech}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="preview-block">
                          <h3 className="preview-block-title">
                            {t.seven_abilities_preview_non_negotiables || 'Core Non-Negotiables'}
                          </h3>
                          <ul className="preview-techniques-list">
                            {meta.keyNonNegotiables.map((nn, idx) => (
                              <li key={idx}>• {nn}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="preview-honest-notice">
                          <span aria-hidden="true">ℹ️</span>
                          <p>
                            {t.seven_abilities_preview_notice ||
                              'Interactive challenges for this ability will be released in an upcoming phase. Reviewing doctrine does not fabricate artificial progress.'}
                          </p>
                        </div>

                        <button
                          type="button"
                          id={`btn-preview-deep-dive-${abilityId}`}
                          className="preview-deep-dive-btn"
                          onClick={() => {
                            if (onSelectAbility) {
                              onSelectAbility(abilityId);
                            } else {
                              onNavigate('ability-detail');
                            }
                          }}
                        >
                          <span>{t.ability_detail_btn_view_details || 'View Full Principles'}</span>
                          <span aria-hidden="true">→</span>
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
