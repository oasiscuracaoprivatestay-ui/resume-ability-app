/**
 * Super Diet-Ability — Global More Sheet (Phase 9F)
 *
 * Accessible drawer accessible across all primary root screens (Home, Challenge,
 * Structured Diet, Progress), providing instant access to all secondary tools:
 * Coach, Commitments, Slippery Zones, Settings, Reminders, Glossary, and Practice.
 */

import React from 'react';
import type { Screen } from '../../types';
import { useTranslation } from '../../i18n';
import { PROGRAM_URL, FEEDBACK_EMAIL, FEEDBACK_SUBJECT } from '../../config';
import LanguageSelector from '../LanguageSelector';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { MoreSheet } from './MoreSheet';

interface GlobalMoreSheetProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: Screen) => void;
  onStartTimer: () => void;
}

function MoreItem({
  id,
  icon,
  label,
  onClick,
  className,
  external,
}: {
  id: string;
  icon: AppIconName;
  label: string;
  onClick: () => void;
  className?: string;
  external?: boolean;
}) {
  return (
    <li>
      <button
        id={id}
        type="button"
        className={['sda-more-item', className].filter(Boolean).join(' ')}
        onClick={onClick}
      >
        <span className="sda-more-item-icon" aria-hidden="true">
          <AppIcon name={icon} size={18} />
        </span>
        <span className="sda-more-item-label">{label}</span>
        <AppIcon
          name={external ? 'external-link' : 'chevron-right'}
          size={16}
          className="sda-more-item-chevron"
        />
      </button>
    </li>
  );
}

export const GlobalMoreSheet: React.FC<GlobalMoreSheetProps> = ({
  open,
  onClose,
  onNavigate,
  onStartTimer,
}) => {
  const { t } = useTranslation();

  const handleNav = (screen: Screen) => {
    onClose();
    onNavigate(screen);
  };

  const handleTimer = () => {
    onClose();
    onStartTimer();
  };

  const handleExit = () => {
    onClose();
    history.back();
    setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 200);
  };

  return (
    <MoreSheet open={open} onClose={onClose}>
      {/* ── 1. PRACTICE & RESET ── */}
      <section className="sda-more-group" aria-labelledby="more-group-practice">
        <h3 id="more-group-practice" className="sda-more-group-title">
          {t.more_group_practice}
        </h3>
        <ul className="sda-more-list">
          <li>
            <button
              id="btn-home-timer"
              type="button"
              className="sda-more-item"
              onClick={handleTimer}
              aria-label={t.home_timer_label || t.global_start_timer}
            >
              <span className="sda-more-item-icon" aria-hidden="true">
                <AppIcon name="timer" size={18} />
              </span>
              <span className="sda-more-item-label">
                {t.home_timer_label || t.global_start_timer}
              </span>
              <AppIcon name="chevron-right" size={16} className="sda-more-item-chevron" />
            </button>
          </li>
          <MoreItem
            id="btn-more-checkin-ritual"
            icon="check-circle"
            label={t.ci_entry_label}
            onClick={() => handleNav('check-in')}
          />
          <MoreItem
            id="btn-more-coach"
            icon="message-circle"
            label={t.home_quick_coach || 'SDA AI Coach'}
            onClick={() => handleNav('coach')}
          />
          <MoreItem
            id="btn-motivation"
            icon="music"
            label={t.home_motivation}
            onClick={() => handleNav('motivation-choice')}
          />
          <MoreItem
            id="nav-daily-audio"
            icon="headphones"
            label={t.home_daily_audio}
            onClick={() => handleNav('daily-audio')}
          />
          <li>
            <button
              id="btn-home-record-activity"
              type="button"
              className="sda-more-item home-btn-activity"
              onClick={() => {
                try {
                  sessionStorage.setItem('activity_log_open_modal', 'true');
                } catch {}
                handleNav('activity-log');
              }}
            >
              <span className="sda-more-item-icon" aria-hidden="true">
                <AppIcon name="footprints" size={18} />
              </span>
              <span className="sda-more-item-label">{t.act_btn_record}</span>
              <AppIcon name="chevron-right" size={16} className="sda-more-item-chevron" />
            </button>
          </li>
        </ul>
      </section>

      {/* ── 2. PLAN & RECOVERY ── */}
      <section className="sda-more-group" aria-labelledby="more-group-plan">
        <h3 id="more-group-plan" className="sda-more-group-title">
          {t.more_group_plan}
        </h3>
        <ul className="sda-more-list">
          <MoreItem
            id="btn-more-structured-diet"
            icon="utensils"
            label={t.home_structured_diet}
            onClick={() => handleNav('structured-diet')}
          />
          <MoreItem
            id="nav-commitment"
            icon="shield"
            label={t.commit_label}
            onClick={() => handleNav('commitment')}
          />
          <MoreItem
            id="btn-more-commitments"
            icon="shield"
            label={t.commit_title || 'My Commitments'}
            onClick={() => handleNav('my-commitments')}
          />
          <MoreItem
            id="btn-main-non-negotiables"
            icon="shield"
            label={t.commit_nn_section}
            onClick={() => {
              try {
                sessionStorage.setItem('commitment_focus', 'nn');
              } catch {}
              handleNav('commitment');
            }}
          />
          <MoreItem
            id="btn-home-slippery-zones"
            icon="alert-triangle"
            label={t.home_slippery_zones_shortcut}
            onClick={() => handleNav('my-slippery-zones')}
          />
          <MoreItem
            id="nav-history"
            icon="history"
            label={t.home_history}
            onClick={() => handleNav('history')}
          />
        </ul>
      </section>

      {/* ── 3. LEARN & FOUNDATIONS ── */}
      <section className="sda-more-group" aria-labelledby="more-group-learn">
        <h3 id="more-group-learn" className="sda-more-group-title">
          {t.more_group_learn}
        </h3>
        <ul className="sda-more-list">
          <MoreItem
            id="btn-seven-abilities-link"
            icon="layers"
            label={t.seven_abilities_nav_home || 'Seven Diet-Abilities'}
            onClick={() => handleNav('seven-abilities')}
          />
          <MoreItem
            id="btn-sda-terms-link"
            icon="book-open"
            label={t.sda_terms_link}
            onClick={() => handleNav('sda-terms')}
          />
          <MoreItem
            id="btn-quiz-entry"
            icon="help-circle"
            label={t.home_quiz_link}
            onClick={() => handleNav('quiz')}
          />
          <MoreItem
            id="btn-timer-learn"
            icon="clock"
            label={t.home_timer_learn_link}
            onClick={() => handleNav('timer-learn')}
          />
          <MoreItem
            id="btn-home-program"
            icon="sparkles"
            label={t.prog_btn_label}
            external
            onClick={() => window.open(PROGRAM_URL, '_blank', 'noopener,noreferrer')}
          />
        </ul>
      </section>

      {/* ── 4. APP & PREFERENCES ── */}
      <section className="sda-more-group" aria-labelledby="more-group-app">
        <h3 id="more-group-app" className="sda-more-group-title">
          {t.more_group_app}
        </h3>
        <ul className="sda-more-list">
          <li className="sda-more-lang">
            <span className="sda-more-lang-label">
              <span className="sda-more-item-icon" aria-hidden="true">
                <AppIcon name="globe" size={18} />
              </span>
              <span>{t.more_language}</span>
            </span>
            <LanguageSelector />
          </li>
          <MoreItem
            id="nav-reminders"
            icon="bell"
            label={t.nav_reminders}
            onClick={() => handleNav('notification-settings')}
          />
          <MoreItem
            id="nav-settings"
            icon="settings"
            label={t.nav_settings}
            onClick={() => handleNav('settings')}
          />
          <MoreItem
            id="btn-feedback"
            icon="mail"
            label={t.home_feedback}
            external
            onClick={() =>
              window.open(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`, '_blank')
            }
          />
          <MoreItem id="btn-exit-app" icon="log-out" label={t.home_exit} onClick={handleExit} />
        </ul>
      </section>
    </MoreSheet>
  );
};

export default GlobalMoreSheet;
