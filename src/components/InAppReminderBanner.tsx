import type { ReminderCandidate } from '../utils/notificationScheduler';
import { useTranslation } from '../i18n';
import './InAppReminderBanner.css';

interface InAppReminderBannerProps {
  reminder: ReminderCandidate;
  onAction: () => void;
  onDismiss: () => void;
}

export default function InAppReminderBanner({
  reminder,
  onAction,
  onDismiss,
}: InAppReminderBannerProps) {
  const { t } = useTranslation();

  return (
    <aside
      className="in-app-reminder-banner"
      role="alert"
      aria-live="polite"
      aria-label={reminder.title}
    >
      <div className="reminder-banner-content">
        <div className="reminder-banner-header">
          <span className="reminder-banner-icon" aria-hidden="true">
            {reminder.icon}
          </span>
          <span className="reminder-banner-title">{reminder.title}</span>
        </div>
        <p className="reminder-banner-body">{reminder.body}</p>
        <div className="reminder-banner-actions">
          <button
            id="btn-reminder-action"
            className="reminder-btn reminder-btn--primary"
            onClick={onAction}
          >
            {reminder.actionLabel}
          </button>
          <button
            id="btn-reminder-dismiss"
            className="reminder-btn reminder-btn--dismiss"
            onClick={onDismiss}
          >
            {t.notif_btn_not_now}
          </button>
        </div>
      </div>
    </aside>
  );
}
