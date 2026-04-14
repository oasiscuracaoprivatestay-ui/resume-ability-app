import { useState, useCallback } from 'react';
import type { Screen } from '../types';
import { useAudio } from '../hooks/useAudio';
import { useTranslation } from '../i18n';
import { localizeAudioPath } from '../utils/audioPath';
import type { Translations } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import './DailyAudioScreen.css';

// ── Audio slots ──

type DailySlot = 'morning' | 'midday' | 'evening';

interface SlotConfig {
  id: DailySlot;
  icon: string;
  titleKey: keyof Translations;
  descKey: keyof Translations;
  src: string;
}

const SLOTS: SlotConfig[] = [
  {
    id: 'morning',
    icon: '🌅',
    titleKey: 'daily_morning',
    descKey: 'daily_morning_desc',
    src: '/audio/morning-1.mp3',
  },
  {
    id: 'midday',
    icon: '☀️',
    titleKey: 'daily_midday',
    descKey: 'daily_midday_desc',
    src: '/audio/midday-1.mp3',
  },
  {
    id: 'evening',
    icon: '🌙',
    titleKey: 'daily_evening',
    descKey: 'daily_evening_desc',
    src: '/audio/evening-1.mp3',
  },
];

// ── Component ──

interface DailyAudioScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function DailyAudioScreen({ onNavigate }: DailyAudioScreenProps) {
  const { lang, t } = useTranslation();
  const [activeSlot, setActiveSlot] = useState<DailySlot | null>(null);

  // Resolve language-specific audio path
  const baseSrc = activeSlot
    ? SLOTS.find((s) => s.id === activeSlot)!.src
    : '';
  const activeSrc = localizeAudioPath(baseSrc, lang);

  const handleTrackEnd = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const { isPlaying, loadState, togglePlay, stop } = useAudio(activeSrc, {
    onTrackEnd: handleTrackEnd,
  });

  const handleSlotClick = (slot: DailySlot) => {
    if (activeSlot === slot) {
      // Toggle play/pause on the active slot
      togglePlay();
    } else {
      // Switch to a different slot
      stop();
      setActiveSlot(slot);
    }
  };

  const handleNavigate = useCallback(
    (target: Screen) => {
      stop();
      onNavigate(target);
    },
    [stop, onNavigate],
  );

  return (
    <div className="screen daily-screen">
      <ScreenHeader
        onBack={() => handleNavigate('home')}
        onHome={() => handleNavigate('home')}
      />

      <div className="daily-content">
        <div className="daily-heading">
          <span className="section-label">{t.daily_label}</span>
          <h2 className="section-heading">{t.daily_heading}</h2>
        </div>

        <div className="daily-slots">
          {SLOTS.map((slot) => {
            const isActive = activeSlot === slot.id;
            const isSlotPlaying = isActive && isPlaying;
            const isLoading = isActive && loadState === 'loading';
            const hasError = isActive && loadState === 'error';

            return (
              <button
                key={slot.id}
                className={`daily-slot${isActive ? ' daily-slot--active' : ''}`}
                onClick={() => handleSlotClick(slot.id)}
              >
                <span className="daily-slot-icon">{slot.icon}</span>
                <div className="daily-slot-text">
                  <span className="daily-slot-title">
                    {t[slot.titleKey] as string}
                  </span>
                  <span className="daily-slot-desc">
                    {t[slot.descKey] as string}
                  </span>
                </div>
                <span className="daily-slot-action">
                  {isLoading
                    ? '⏳'
                    : hasError
                      ? '⚠'
                      : isSlotPlaying
                        ? '⏸'
                        : '▶'}
                </span>
              </button>
            );
          })}
        </div>

        {activeSlot && loadState === 'error' && (
          <p className="daily-error">{t.daily_error}</p>
        )}
      </div>
    </div>
  );
}
