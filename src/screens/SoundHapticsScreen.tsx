import { useState, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import {
  loadFeedbackSettings,
  saveFeedbackSettings,
  isHapticsSupported,
  type FeedbackSettings,
} from '../utils/feedbackSettingsStorage';
import { playFeedback } from '../utils/feedback';
import './SoundHapticsScreen.css';

interface SoundHapticsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function SoundHapticsScreen({ onNavigate }: SoundHapticsScreenProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<FeedbackSettings>(() => loadFeedbackSettings());
  const [hapticsSupported, setHapticsSupported] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeButton, setActiveButton] = useState<'sound' | 'haptic' | 'success' | null>(null);

  useEffect(() => {
    setHapticsSupported(isHapticsSupported());
  }, []);

  const showStatus = (msg: string, btn: 'sound' | 'haptic' | 'success') => {
    setStatusMessage(msg);
    setActiveButton(btn);
    setTimeout(() => {
      setStatusMessage(null);
      setActiveButton(null);
    }, 2400);
  };

  const handleToggleSound = () => {
    const updated = saveFeedbackSettings({ soundEnabled: !settings.soundEnabled });
    setSettings(updated);
  };

  const handleToggleHaptics = () => {
    const updated = saveFeedbackSettings({ hapticsEnabled: !settings.hapticsEnabled });
    setSettings(updated);
  };

  const handleTestSound = () => {
    if (!settings.soundEnabled) {
      showStatus(t.feedback_sound_disabled, 'sound');
      return;
    }
    playFeedback('win');
    showStatus(t.feedback_playing, 'sound');
  };

  const handleTestHaptic = () => {
    if (!hapticsSupported) {
      showStatus(t.haptic_unsupported_notice, 'haptic');
      return;
    }
    if (!settings.hapticsEnabled) {
      showStatus(t.feedback_haptic_disabled, 'haptic');
      return;
    }
    playFeedback('recovery');
    showStatus(t.feedback_vibrated, 'haptic');
  };

  const handleTestSuccess = () => {
    if (!settings.soundEnabled && (!settings.hapticsEnabled || !hapticsSupported)) {
      showStatus(t.feedback_sound_disabled, 'success');
      return;
    }
    playFeedback('check-in');
    showStatus(t.feedback_test_success, 'success');
  };

  return (
    <div className="screen sound-haptics-screen">
      <div className="sound-haptics-inner">
        <ScreenHeader
          onBack={() => onNavigate('settings')}
          onHome={() => onNavigate('home')}
        />

        <div className="sound-haptics-content">
          <div className="sound-haptics-heading">
            <span className="section-label">{t.settings_sec_experience}</span>
            <h1 className="sound-haptics-title">{t.settings_sound_screen_title}</h1>
            <p className="sound-haptics-subtitle">{t.settings_sound_screen_subtitle}</p>
          </div>

          {/* Preferences Stack */}
          <div className="sound-card-stack">
            {/* Sound Effects Toggle */}
            <div className="sound-setting-card">
              <div className="sound-setting-info">
                <div className="sound-setting-icon-row">
                  <span className="sound-setting-icon" aria-hidden="true">🔊</span>
                  <span className="sound-setting-name">{t.sound_toggle_label}</span>
                </div>
                <p className="sound-setting-desc">{t.sound_toggle_desc}</p>
              </div>
              <button
                id="btn-toggle-sound"
                type="button"
                role="switch"
                aria-checked={settings.soundEnabled}
                className={`feedback-switch ${settings.soundEnabled ? 'feedback-switch--on' : ''}`}
                onClick={handleToggleSound}
                aria-label={t.sound_toggle_label}
              >
                <span className="feedback-switch-handle" />
              </button>
            </div>

            {/* Haptic Feedback Toggle */}
            <div className="sound-setting-card">
              <div className="sound-setting-info">
                <div className="sound-setting-icon-row">
                  <span className="sound-setting-icon" aria-hidden="true">📳</span>
                  <span className="sound-setting-name">{t.haptic_toggle_label}</span>
                </div>
                <p className="sound-setting-desc">{t.haptic_toggle_desc}</p>
                {!hapticsSupported && (
                  <span className="haptic-unsupported-tag">
                    {t.haptic_unsupported_notice}
                  </span>
                )}
              </div>
              <button
                id="btn-toggle-haptics"
                type="button"
                role="switch"
                aria-checked={settings.hapticsEnabled}
                className={`feedback-switch ${settings.hapticsEnabled ? 'feedback-switch--on' : ''}`}
                onClick={handleToggleHaptics}
                aria-label={t.haptic_toggle_label}
              >
                <span className="feedback-switch-handle" />
              </button>
            </div>
          </div>

          {/* Preview / Test Section */}
          <div className="feedback-test-section">
            <h2 className="feedback-test-title">{t.feedback_test_title}</h2>

            <div className="feedback-test-grid">
              <button
                id="btn-test-sound"
                type="button"
                className={`feedback-action-btn ${activeButton === 'sound' ? 'feedback-action-btn--active' : ''}`}
                onClick={handleTestSound}
              >
                <span className="feedback-btn-icon" aria-hidden="true">🎵</span>
                <span>{t.feedback_test_sound}</span>
              </button>

              <button
                id="btn-test-haptic"
                type="button"
                className={`feedback-action-btn ${activeButton === 'haptic' ? 'feedback-action-btn--active' : ''}`}
                onClick={handleTestHaptic}
              >
                <span className="feedback-btn-icon" aria-hidden="true">⚡</span>
                <span>{t.feedback_test_haptic}</span>
              </button>

              <button
                id="btn-test-success"
                type="button"
                className={`feedback-action-btn feedback-action-btn--wide ${activeButton === 'success' ? 'feedback-action-btn--active' : ''}`}
                onClick={handleTestSuccess}
              >
                <span className="feedback-btn-icon" aria-hidden="true">✨</span>
                <span>{t.feedback_test_success}</span>
              </button>
            </div>

            {/* Status / Feedback feedback toast banner */}
            {statusMessage && (
              <div className="feedback-status-banner" role="status">
                <span className="feedback-status-text">{statusMessage}</span>
              </div>
            )}
          </div>

          {/* Back to Settings button */}
          <div className="sound-footer-actions">
            <button
              id="btn-sound-back-settings"
              type="button"
              className="sound-back-settings-btn"
              onClick={() => onNavigate('settings')}
            >
              ← {t.settings_title}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
