import { useState } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import type { Language } from '../i18n/types';
import ScreenHeader from '../components/ScreenHeader';
import ResetStatsModal from '../components/ResetStatsModal';
import './SettingsScreen.css';

interface SettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

export default function SettingsScreen({ onNavigate, onBack }: SettingsScreenProps) {
  const { lang, setLang, t } = useTranslation();

  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLanguageSelect = (newLang: Language) => {
    setLang(newLang);
    setShowLanguageModal(false);
    const langNames: Record<Language, string> = {
      en: 'English',
      es: 'Español',
      nl: 'Nederlands',
    };
    showToast(`✓ Language set to ${langNames[newLang]}`);
  };

  const getLanguageName = (code: Language) => {
    switch (code) {
      case 'es':
        return t.settings_lang_es;
      case 'nl':
        return t.settings_lang_nl;
      default:
        return t.settings_lang_en;
    }
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-inner">
        <ScreenHeader
          onBack={onBack ? onBack : () => onNavigate('home')}
          onHome={() => onNavigate('home')}
        />

        <div className="settings-content">
          {/* Heading */}
          <div className="settings-heading">
            <span className="section-label">{t.settings_title}</span>
            <h1 className="settings-title">{t.settings_title}</h1>
            <p className="settings-subtitle">{t.settings_subtitle}</p>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="settings-toast" role="status" aria-live="polite">
              {toastMessage}
            </div>
          )}

          {/* ── SECTION 1: ACCOUNT & APP ── */}
          <section className="settings-section" aria-labelledby="sec-heading-account">
            <h2 id="sec-heading-account" className="settings-section-title">
              {t.settings_sec_account}
            </h2>
            <div className="settings-card-group">
              {/* Language Selection */}
              <button
                id="btn-settings-language"
                type="button"
                className="settings-row-btn"
                onClick={() => setShowLanguageModal(true)}
                aria-haspopup="dialog"
              >
                <div className="settings-row-icon" aria-hidden="true">🌐</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_lang_title}</span>
                  <span className="settings-row-desc">{t.settings_lang_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-pill settings-pill--accent">
                    {getLanguageName(lang)}
                  </span>
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* Appearance / Theme */}
              <button
                id="btn-settings-theme"
                type="button"
                className="settings-row-btn"
                onClick={() => showToast(t.settings_theme_notice)}
              >
                <div className="settings-row-icon" aria-hidden="true">🎨</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_theme_title}</span>
                  <span className="settings-row-desc">{t.settings_theme_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-pill settings-pill--muted">
                    {t.settings_theme_active}
                  </span>
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* App Version Info */}
              <div className="settings-row-static">
                <div className="settings-row-icon" aria-hidden="true">📱</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_app_name}</span>
                  <span className="settings-row-desc">{t.settings_app_framework}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-pill settings-pill--outline">
                    {t.settings_app_version}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: PERSONAL EXPERIENCE ── */}
          <section className="settings-section" aria-labelledby="sec-heading-experience">
            <h2 id="sec-heading-experience" className="settings-section-title">
              {t.settings_sec_experience}
            </h2>
            <div className="settings-card-group">
              {/* Reminders / Notifications */}
              <button
                id="btn-settings-reminders"
                type="button"
                className="settings-row-btn"
                onClick={() => onNavigate('notification-settings')}
              >
                <div className="settings-row-icon" aria-hidden="true">🔔</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_reminders_title}</span>
                  <span className="settings-row-desc">{t.settings_reminders_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* Sound & Haptics */}
              <button
                id="btn-settings-sound"
                type="button"
                className="settings-row-btn"
                onClick={() => onNavigate('sound-haptics')}
              >
                <div className="settings-row-icon" aria-hidden="true">🔊</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_sound_title}</span>
                  <span className="settings-row-desc">{t.settings_sound_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* Motivation Preferences */}
              <button
                id="btn-settings-motivation"
                type="button"
                className="settings-row-btn"
                onClick={() => onNavigate('motivation-choice')}
              >
                <div className="settings-row-icon" aria-hidden="true">♫</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_motivation_title}</span>
                  <span className="settings-row-desc">{t.settings_motivation_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>
            </div>
          </section>

          {/* ── SECTION 3: DATA & PROGRESS ── */}
          <section className="settings-section" aria-labelledby="sec-heading-data">
            <h2 id="sec-heading-data" className="settings-section-title">
              {t.settings_sec_data}
            </h2>
            <div className="settings-card-group">
              {/* Review History / Dashboard */}
              <button
                id="btn-settings-history"
                type="button"
                className="settings-row-btn"
                onClick={() => onNavigate('dashboard')}
              >
                <div className="settings-row-icon" aria-hidden="true">📊</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_history_title}</span>
                  <span className="settings-row-desc">{t.settings_history_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* Export Data Placeholder */}
              <div className="settings-row-static">
                <div className="settings-row-icon" aria-hidden="true">💾</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_export_title}</span>
                  <span className="settings-row-desc">{t.settings_export_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-pill settings-pill--muted">
                    {t.settings_export_soon}
                  </span>
                </div>
              </div>

              {/* Reset All Stats */}
              <button
                id="btn-settings-reset-stats"
                type="button"
                className="settings-row-btn settings-row-btn--danger"
                onClick={() => setShowResetModal(true)}
              >
                <div className="settings-row-icon settings-row-icon--danger" aria-hidden="true">⚠️</div>
                <div className="settings-row-main">
                  <span className="settings-row-label settings-row-label--danger">
                    {t.settings_reset_stats_title}
                  </span>
                  <span className="settings-row-desc">{t.settings_reset_stats_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-pill settings-pill--danger">Reset</span>
                </div>
              </button>
            </div>
          </section>

          {/* ── SECTION 4: SUPPORT & ABOUT ── */}
          <section className="settings-section" aria-labelledby="sec-heading-support">
            <h2 id="sec-heading-support" className="settings-section-title">
              {t.settings_sec_support}
            </h2>
            <div className="settings-card-group">
              {/* SDA Terms & Help */}
              <button
                id="btn-settings-terms"
                type="button"
                className="settings-row-btn"
                onClick={() => onNavigate('sda-terms')}
              >
                <div className="settings-row-icon" aria-hidden="true">📖</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_terms_title}</span>
                  <span className="settings-row-desc">{t.settings_terms_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>

              {/* Privacy / Disclaimer */}
              <button
                id="btn-settings-privacy"
                type="button"
                className="settings-row-btn"
                onClick={() => setShowPrivacyModal(true)}
              >
                <div className="settings-row-icon" aria-hidden="true">🔒</div>
                <div className="settings-row-main">
                  <span className="settings-row-label">{t.settings_privacy_title}</span>
                  <span className="settings-row-desc">{t.settings_privacy_desc}</span>
                </div>
                <div className="settings-row-right">
                  <span className="settings-chevron" aria-hidden="true">›</span>
                </div>
              </button>
            </div>

            {/* About Super Diet-Ability Card */}
            <div className="settings-about-card">
              <div className="settings-about-header">
                <div className="settings-about-titles">
                  <span className="settings-about-name">{t.settings_app_name}</span>
                  <span className="settings-about-sub">SDA</span>
                </div>
                <span className="settings-about-version">{t.settings_app_version}</span>
              </div>
              <div className="settings-about-slogan-box">
                <p className="settings-about-slogan">"{t.sda_slogan}"</p>
              </div>
              <p className="settings-about-summary">{t.settings_about_summary}</p>
            </div>
          </section>
        </div>
      </div>

      {/* ── Reused Reset Stats Modal ── */}
      <ResetStatsModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          setShowResetModal(false);
          showToast('✓ All stats have been successfully reset.');
        }}
      />

      {/* ── Language Selector Modal ── */}
      {showLanguageModal && (
        <div className="settings-modal-overlay" onClick={() => setShowLanguageModal(false)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3 id="lang-modal-title" className="settings-modal-title">
                {t.settings_lang_modal_title}
              </h3>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setShowLanguageModal(false)}
                aria-label="Close language selector"
              >
                ✕
              </button>
            </div>
            <div className="settings-lang-options" role="radiogroup" aria-label="Language options">
              <button
                id="btn-lang-en"
                type="button"
                role="radio"
                aria-checked={lang === 'en'}
                className={`settings-lang-option ${lang === 'en' ? 'settings-lang-option--active' : ''}`}
                onClick={() => handleLanguageSelect('en')}
              >
                <div className="settings-lang-option-text">
                  <span className="settings-lang-name">English</span>
                  <span className="settings-lang-native">English</span>
                </div>
                {lang === 'en' && <span className="settings-lang-check">✓</span>}
              </button>

              <button
                id="btn-lang-es"
                type="button"
                role="radio"
                aria-checked={lang === 'es'}
                className={`settings-lang-option ${lang === 'es' ? 'settings-lang-option--active' : ''}`}
                onClick={() => handleLanguageSelect('es')}
              >
                <div className="settings-lang-option-text">
                  <span className="settings-lang-name">Español</span>
                  <span className="settings-lang-native">Spanish</span>
                </div>
                {lang === 'es' && <span className="settings-lang-check">✓</span>}
              </button>

              <button
                id="btn-lang-nl"
                type="button"
                role="radio"
                aria-checked={lang === 'nl'}
                className={`settings-lang-option ${lang === 'nl' ? 'settings-lang-option--active' : ''}`}
                onClick={() => handleLanguageSelect('nl')}
              >
                <div className="settings-lang-option-text">
                  <span className="settings-lang-name">Nederlands</span>
                  <span className="settings-lang-native">Dutch</span>
                </div>
                {lang === 'nl' && <span className="settings-lang-check">✓</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy & Health Disclaimer Modal ── */}
      {showPrivacyModal && (
        <div className="settings-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="settings-modal-header">
              <h3 id="privacy-modal-title" className="settings-modal-title">
                {t.settings_privacy_modal_title}
              </h3>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setShowPrivacyModal(false)}
                aria-label="Close privacy modal"
              >
                ✕
              </button>
            </div>
            <div className="settings-privacy-body">
              <p className="settings-privacy-text">{t.settings_privacy_content}</p>
              <div className="settings-privacy-highlight">
                <span className="settings-privacy-icon" aria-hidden="true">🔒</span>
                <span>All your check-ins and commitments remain strictly on your local device.</span>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button
                type="button"
                className="settings-modal-btn"
                onClick={() => setShowPrivacyModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
