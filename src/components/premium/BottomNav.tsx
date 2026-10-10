/**
 * Super Diet-Ability — Premium Bottom Navigation (Phase 2)
 *
 * Five anchors: Home, Challenge, Diet, Progress, More.
 * Rendered on Home only in Phase 2. The host screen reserves matching bottom
 * padding (var(--sda-bottom-nav-h) + safe area) so content is never hidden.
 * "Progress" opens the existing Dashboard until My Progress & Victories ships.
 */

import { useTranslation } from '../../i18n';
import type { Screen } from '../../types';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import './BottomNav.css';

interface BottomNavProps {
  current: Screen;
  onNavigate: (screen: Screen) => void;
  onOpenMore: () => void;
  moreOpen: boolean;
}

interface NavItem {
  id: string;
  screen: Screen;
  icon: AppIconName;
  label: string;
}

export function BottomNav({ current, onNavigate, onOpenMore, moreOpen }: BottomNavProps) {
  const { t } = useTranslation();

  const items: NavItem[] = [
    { id: 'nav-home', screen: 'home', icon: 'home', label: t.nav_home },
    { id: 'nav-challenge', screen: 'challenges', icon: 'trophy', label: t.nav_challenge },
    { id: 'nav-diet', screen: 'structured-diet', icon: 'utensils', label: t.nav_diet },
    { id: 'nav-dashboard', screen: 'progress-victories', icon: 'bar-chart', label: t.nav_progress },
  ];

  return (
    <nav className="sda-bottom-nav" aria-label={t.nav_main_aria} id="sda-bottom-nav">
      <ul className="sda-bottom-nav-list">
        {items.map((item) => {
          const active = current === item.screen && !moreOpen;
          return (
            <li key={item.id}>
              <button
                id={item.id}
                type="button"
                className={`sda-nav-item${active ? ' sda-nav-item--active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (item.screen !== current) onNavigate(item.screen);
                }}
              >
                <AppIcon name={item.icon} size={22} />
                <span className="sda-nav-label">{item.label}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            id="nav-more"
            type="button"
            className={`sda-nav-item${moreOpen ? ' sda-nav-item--active' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="sda-more-sheet"
            onClick={onOpenMore}
          >
            <AppIcon name="more" size={22} />
            <span className="sda-nav-label">{t.nav_more}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default BottomNav;
