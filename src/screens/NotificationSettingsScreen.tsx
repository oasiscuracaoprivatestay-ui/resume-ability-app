import { useState, useCallback, useEffect } from 'react';
import type { Screen } from '../types';
import { useTranslation } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import type {
  NotificationSettings,
  ReminderFrequency,
} from '../utils/notificationSettingsStorage';
import {
  loadNotificationSettings,
  saveNotificationSettings,
} from '../utils/notificationSettingsStorage';
import {
  requestNotificationPermission,
  buildCandidate,
  dispatchBrowserNotification,
} from '../utils/notificationScheduler';
import type { ReminderCandidate } from '../utils/notificationScheduler';
import {
  getPushDeliveryStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  type PushDeliveryStatus,
} from '../utils/pushNotifications';
import {
  isStandaloneMode,
  isIOS,
  canPromptInstall,
  promptInstall,
  subscribeToInstallPrompt,
} from '../utils/pwaSupport';
import './NotificationSettingsScreen.css';

interface NotificationSettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  onTriggerInAppReminder?: (candidate: ReminderCandidate) => void;
  onBack?: () => void;
}

export default function NotificationSettingsScreen({
  onNavigate,
  onTriggerInAppReminder,
  onBack,
}: NotificationSettingsScreenProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings());
  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushStatus, setPushStatus] = useState<PushDeliveryStatus>(() => getPushDeliveryStatus());
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);
  const [testPushResult, setTestPushResult] = useState<{
    success: boolean;
    isBackendPush: boolean;
    msg: string;
  } | null>(null);
  const [canInstallPWA, setCanInstallPWA] = useState(() => canPromptInstall());
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());
  const isiOSDevice = isIOS();

  // Check current browser permission & push state on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    } else {
      setPermissionState('unsupported');
    }
    setPushStatus(getPushDeliveryStatus());
    setIsStandalone(isStandaloneMode());

    // Listen to install prompt availability
    const unsubInstall = subscribeToInstallPrompt((canInstall) => {
      setCanInstallPWA(canInstall);
    });
    return () => unsubInstall();
  }, []);

  const update = useCallback((updater: (s: NotificationSettings) => NotificationSettings) => {
    setSettings(prev => {
      const next = updater({ ...prev });
      saveNotificationSettings(next);
      return next;
    });
  }, []);

  // Handle master toggle switch
  const handleToggleMaster = async () => {
    const nextEnabled = !settings.enabled;
    if (nextEnabled) {
      // Request permission only upon explicit user action
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const perm = await requestNotificationPermission();
          setPermissionState(perm);
        } else {
          setPermissionState(Notification.permission);
        }
      }
    }
    update(s => ({ ...s, enabled: nextEnabled }));
  };

  // Handle frequency selection
  const handleSelectFrequency = (freq: ReminderFrequency) => {
    update(s => ({
      ...s,
      frequency: freq,
      dailyTimes:
        freq === 'twice-daily' && s.dailyTimes.length < 2
          ? ['10:00', '18:00']
          : s.dailyTimes,
    }));
  };

  // Handle push notifications toggle (Phase 14)
  const handleTogglePush = async () => {
    setIsPushLoading(true);
    setTestPushResult(null);

    if (pushStatus === 'enabled') {
      await unsubscribeFromPush();
      setPushStatus(getPushDeliveryStatus());
      setPushSuccessMsg(null);
    } else {
      const res = await subscribeToPush();
      setPushStatus(res.status);
      if (res.success) {
        setPushSuccessMsg(t.push_enabled_success);
        setTimeout(() => setPushSuccessMsg(null), 4000);
      }
    }
    setIsPushLoading(false);
  };

  // Handle PWA installation prompt
  const handlePromptInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setIsStandalone(true);
      setCanInstallPWA(false);
    }
  };

  // Handle sending a test reminder (Phase 14: distinguishes real push vs fallback)
  const handleTestReminder = async () => {
    if (pushStatus === 'enabled') {
      const res = await sendTestPush();
      if (res.success && res.isBackendPush) {
        setTestPushResult({
          success: true,
          isBackendPush: true,
          msg: t.push_test_sent_backend,
        });
        setTimeout(() => setTestPushResult(null), 4000);
        return;
      }
    }

    // Fallback: in-app / browser banner reminder
    const sample = buildCandidate('check-in', `test_${Date.now()}`, t, settings);
    dispatchBrowserNotification(sample, onNavigate);
    if (onTriggerInAppReminder) {
      onTriggerInAppReminder(sample);
    }
    setTestPushResult({
      success: true,
      isBackendPush: false,
      msg: pushStatus === 'enabled' ? t.push_test_failed : t.push_test_sent_fallback,
    });
    setTimeout(() => setTestPushResult(null), 4000);
  };

  const frequencies: { id: ReminderFrequency; label: string }[] = [
    { id: 'daily', label: t.notif_freq_daily },
    { id: 'twice-daily', label: t.notif_freq_twice_daily },
    { id: '1h', label: t.notif_freq_1h },
    { id: '30m', label: t.notif_freq_30m },
    { id: '15m', label: t.notif_freq_15m },
  ];

  return (
    <div className="screen notification-settings-screen">
      <ScreenHeader
        onBack={onBack ? onBack : () => onNavigate('home')}
        onHome={() => onNavigate('home')}
      />

      <div className="notif-settings-content">
        <div className="notif-settings-heading">
          <span className="section-label">{t.notif_screen_title}</span>
          <h1 className="notif-heading">{t.notif_screen_title}</h1>
          <p className="notif-subtitle">{t.notif_screen_subtitle}</p>
        </div>

        {/* ── MASTER TOGGLE ── */}
        <div className="notif-card notif-card--master">
          <div className="notif-card-row">
            <div className="notif-card-text">
              <span className="notif-card-title">{t.notif_master_label}</span>
              <p className="notif-card-desc">{t.notif_master_desc}</p>
            </div>
            <button
              id="btn-toggle-reminders"
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              className={`notif-switch ${settings.enabled ? 'notif-switch--on' : ''}`}
              onClick={handleToggleMaster}
              aria-label={t.notif_master_label}
            >
              <span className="notif-switch-handle" />
            </button>
          </div>
        </div>

        {/* ── CALM BROWSER PERMISSION BANNER ── */}
        {settings.enabled && permissionState === 'denied' && (
          <div className="notif-notice notif-notice--blocked" role="alert">
            <span className="notif-notice-icon" aria-hidden="true">ℹ️</span>
            <div className="notif-notice-text">
              <strong>{t.notif_perm_blocked}</strong>
              <p>{t.notif_perm_fallback_notice}</p>
            </div>
          </div>
        )}

        {/* ── CONFIGURATION SECTIONS (Only when enabled) ── */}
        {settings.enabled && (
          <div className="notif-sections">
            {/* ── 0. DELIVERY METHOD (Phase 14) ── */}
            <section className="notif-section notif-section--delivery" aria-labelledby="notif-delivery-heading">
              <h2 id="notif-delivery-heading" className="notif-section-title">
                {t.push_section_delivery}
              </h2>

              <div className="notif-card-stack">
                {/* Background Push Card */}
                <div className="notif-card notif-card--delivery">
                  <div className="notif-delivery-header">
                    <div className="notif-delivery-title-row">
                      <span className="notif-delivery-icon" aria-hidden="true">🌐</span>
                      <span className="notif-card-label">{t.push_channel_push}</span>
                    </div>
                    <span className={`notif-status-badge notif-status-badge--${pushStatus}`}>
                      {pushStatus === 'enabled' && `✓ ${t.push_status_enabled}`}
                      {pushStatus === 'available' && t.push_status_available}
                      {pushStatus === 'denied' && `✕ ${t.push_status_denied}`}
                      {pushStatus === 'unsupported' && t.push_status_unsupported}
                    </span>
                  </div>

                  {pushStatus === 'denied' && (
                    <p className="notif-delivery-hint notif-delivery-hint--denied">
                      {t.push_denied_desc}
                    </p>
                  )}
                  {pushStatus === 'unsupported' && (
                    <p className="notif-delivery-hint">{t.push_unsupported_desc}</p>
                  )}
                  {pushStatus === 'available' && (
                    <p className="notif-delivery-hint">{t.push_explain_prompt}</p>
                  )}

                  {pushStatus !== 'unsupported' && pushStatus !== 'denied' && (
                    <div className="notif-delivery-action">
                      <button
                        id="btn-toggle-push"
                        type="button"
                        className={`notif-push-btn ${pushStatus === 'enabled' ? 'notif-push-btn--disable' : 'notif-push-btn--enable'}`}
                        onClick={handleTogglePush}
                        disabled={isPushLoading}
                      >
                        {isPushLoading
                          ? '...'
                          : pushStatus === 'enabled'
                          ? t.push_btn_disable
                          : t.push_btn_enable}
                      </button>
                    </div>
                  )}

                  {pushSuccessMsg && (
                    <p className="notif-push-success" role="status">✓ {pushSuccessMsg}</p>
                  )}

                  {/* iOS Installation Instructions Card */}
                  {isiOSDevice && !isStandalone && (
                    <div className="notif-ios-card">
                      <span className="notif-ios-icon" aria-hidden="true">📲</span>
                      <div className="notif-ios-content">
                        <strong className="notif-ios-title">{t.push_ios_install_title}</strong>
                        <p className="notif-ios-desc">{t.push_ios_install_desc}</p>
                      </div>
                    </div>
                  )}

                  {/* Standard PWA Install Prompt Button (Android/Desktop) */}
                  {canInstallPWA && !isStandalone && (
                    <div className="notif-install-pwa-block">
                      <button
                        id="btn-install-pwa"
                        type="button"
                        className="notif-install-pwa-btn"
                        onClick={handlePromptInstall}
                      >
                        <span>⚡ {t.push_btn_install}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* In-App Reminder Card */}
                <div className="notif-card notif-card--delivery">
                  <div className="notif-delivery-header">
                    <div className="notif-delivery-title-row">
                      <span className="notif-delivery-icon" aria-hidden="true">📱</span>
                      <span className="notif-card-label">{t.push_channel_inapp}</span>
                    </div>
                    <span className="notif-status-badge notif-status-badge--enabled">
                      ✓ {t.push_status_enabled}
                    </span>
                  </div>
                  <p className="notif-delivery-hint">{t.push_inapp_desc}</p>
                </div>
              </div>
            </section>

            {/* ── 1. REMINDER TYPES ── */}
            <section className="notif-section" aria-labelledby="notif-types-heading">
              <h2 id="notif-types-heading" className="notif-section-title">
                {t.notif_section_types}
              </h2>
              <div className="notif-card-stack">
                <div className="notif-card notif-card--sub">
                  <div className="notif-card-row">
                    <div className="notif-card-text">
                      <span className="notif-card-label">🧭 {t.notif_type_checkin}</span>
                      <p className="notif-card-desc">{t.notif_type_checkin_desc}</p>
                    </div>
                    <button
                      id="toggle-type-checkin"
                      type="button"
                      role="switch"
                      aria-checked={settings.checkInEnabled}
                      className={`notif-switch ${settings.checkInEnabled ? 'notif-switch--on' : ''}`}
                      onClick={() => update(s => ({ ...s, checkInEnabled: !s.checkInEnabled }))}
                      aria-label={t.notif_type_checkin}
                    >
                      <span className="notif-switch-handle" />
                    </button>
                  </div>
                </div>

                <div className="notif-card notif-card--sub">
                  <div className="notif-card-row">
                    <div className="notif-card-text">
                      <span className="notif-card-label">🥗 {t.notif_type_diet}</span>
                      <p className="notif-card-desc">{t.notif_type_diet_desc}</p>
                    </div>
                    <button
                      id="toggle-type-diet"
                      type="button"
                      role="switch"
                      aria-checked={settings.structuredDietEnabled}
                      className={`notif-switch ${settings.structuredDietEnabled ? 'notif-switch--on' : ''}`}
                      onClick={() => update(s => ({ ...s, structuredDietEnabled: !s.structuredDietEnabled }))}
                      aria-label={t.notif_type_diet}
                    >
                      <span className="notif-switch-handle" />
                    </button>
                  </div>
                </div>

                <div className="notif-card notif-card--sub">
                  <div className="notif-card-row">
                    <div className="notif-card-text">
                      <span className="notif-card-label">🎯 {t.notif_type_why}</span>
                      <p className="notif-card-desc">{t.notif_type_why_desc}</p>
                    </div>
                    <button
                      id="toggle-type-why"
                      type="button"
                      role="switch"
                      aria-checked={settings.resumeAbilityEnabled}
                      className={`notif-switch ${settings.resumeAbilityEnabled ? 'notif-switch--on' : ''}`}
                      onClick={() => update(s => ({ ...s, resumeAbilityEnabled: !s.resumeAbilityEnabled }))}
                      aria-label={t.notif_type_why}
                    >
                      <span className="notif-switch-handle" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. FREQUENCY ── */}
            <section className="notif-section" aria-labelledby="notif-freq-heading">
              <h2 id="notif-freq-heading" className="notif-section-title">
                {t.notif_section_frequency}
              </h2>
              <div className="notif-freq-grid" role="radiogroup" aria-label={t.notif_section_frequency}>
                {frequencies.map(f => {
                  const isSelected = settings.frequency === f.id;
                  return (
                    <button
                      key={f.id}
                      id={`btn-freq-${f.id}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`notif-freq-btn ${isSelected ? 'notif-freq-btn--active' : ''}`}
                      onClick={() => handleSelectFrequency(f.id)}
                    >
                      <span className="notif-freq-radio-dot" />
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {settings.frequency === '15m' && (
                <div className="notif-notice notif-notice--caution" role="note">
                  <span className="notif-notice-icon">⚠️</span>
                  <p>{t.notif_freq_15m_caution}</p>
                </div>
              )}
            </section>

            {/* ── 3. SPECIFIC TIMES (For Once/Twice Daily) ── */}
            {(settings.frequency === 'daily' || settings.frequency === 'twice-daily') && (
              <section className="notif-section" aria-labelledby="notif-times-heading">
                <h2 id="notif-times-heading" className="notif-section-title">
                  {t.notif_section_specific_times}
                </h2>
                <div className="notif-times-row">
                  <div className="notif-time-input-group">
                    <label htmlFor="input-time-1" className="notif-input-label">
                      {t.notif_time_primary}
                    </label>
                    <input
                      id="input-time-1"
                      type="time"
                      className="notif-time-input"
                      value={settings.dailyTimes[0] || '10:00'}
                      onChange={e => {
                        const val = e.target.value;
                        if (val) {
                          update(s => {
                            const dailyTimes = [...s.dailyTimes];
                            dailyTimes[0] = val;
                            return { ...s, dailyTimes };
                          });
                        }
                      }}
                    />
                  </div>

                  {settings.frequency === 'twice-daily' && (
                    <div className="notif-time-input-group">
                      <label htmlFor="input-time-2" className="notif-input-label">
                        {t.notif_time_secondary}
                      </label>
                      <input
                        id="input-time-2"
                        type="time"
                        className="notif-time-input"
                        value={settings.dailyTimes[1] || '18:00'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val) {
                            update(s => {
                              const dailyTimes = [...s.dailyTimes];
                              dailyTimes[1] = val;
                              return { ...s, dailyTimes };
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── 4. ACTIVE HOURS ── */}
            <section className="notif-section" aria-labelledby="notif-hours-heading">
              <h2 id="notif-hours-heading" className="notif-section-title">
                {t.notif_section_active_hours}
              </h2>
              <div className="notif-times-row">
                <div className="notif-time-input-group">
                  <label htmlFor="input-active-start" className="notif-input-label">
                    {t.notif_active_from}
                  </label>
                  <input
                    id="input-active-start"
                    type="time"
                    className="notif-time-input"
                    value={settings.activeStart}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) update(s => ({ ...s, activeStart: val }));
                    }}
                  />
                </div>
                <div className="notif-time-input-group">
                  <label htmlFor="input-active-end" className="notif-input-label">
                    {t.notif_active_until}
                  </label>
                  <input
                    id="input-active-end"
                    type="time"
                    className="notif-time-input"
                    value={settings.activeEnd}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) update(s => ({ ...s, activeEnd: val }));
                    }}
                  />
                </div>
              </div>
            </section>

            {/* ── 5. RANDOMIZATION ── */}
            <section className="notif-section">
              <div className="notif-card notif-card--sub">
                <div className="notif-card-row">
                  <div className="notif-card-text">
                    <span className="notif-card-label">{t.notif_randomize_label}</span>
                    <p className="notif-card-desc">{t.notif_randomize_desc}</p>
                  </div>
                  <button
                    id="toggle-randomize"
                    type="button"
                    role="switch"
                    aria-checked={settings.randomize}
                    className={`notif-switch ${settings.randomize ? 'notif-switch--on' : ''}`}
                    onClick={() => update(s => ({ ...s, randomize: !s.randomize }))}
                    aria-label={t.notif_randomize_label}
                  >
                    <span className="notif-switch-handle" />
                  </button>
                </div>
              </div>
            </section>

            {/* ── 6. PRIVACY ── */}
            <section className="notif-section">
              <div className="notif-card notif-card--sub">
                <div className="notif-card-row">
                  <div className="notif-card-text">
                    <span className="notif-card-label">{t.notif_privacy_label}</span>
                    <p className="notif-card-desc">{t.notif_privacy_desc}</p>
                  </div>
                  <button
                    id="toggle-privacy-why"
                    type="button"
                    role="switch"
                    aria-checked={settings.showWhy}
                    className={`notif-switch ${settings.showWhy ? 'notif-switch--on' : ''}`}
                    onClick={() => update(s => ({ ...s, showWhy: !s.showWhy }))}
                    aria-label={t.notif_privacy_label}
                  >
                    <span className="notif-switch-handle" />
                  </button>
                </div>
              </div>
            </section>

            {/* ── 7. TEST REMINDER ── */}
            <div className="notif-test-section">
              <button
                id="btn-test-reminder"
                type="button"
                className="notif-test-btn"
                onClick={handleTestReminder}
              >
                🔔 {t.push_btn_send_test}
              </button>
              {testPushResult && (
                <p
                  className={`notif-test-feedback ${testPushResult.isBackendPush ? 'notif-test-feedback--push' : 'notif-test-feedback--fallback'}`}
                  role="status"
                >
                  {testPushResult.msg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
