import { useState, useCallback, useRef } from 'react';
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

const SLOT_IDS: DailySlot[] = SLOTS.map((s) => s.id);

/** Pick the next slot in order, wrapping around. */
function nextSlot(current: DailySlot): DailySlot {
  const idx = SLOT_IDS.indexOf(current);
  return SLOT_IDS[(idx + 1) % SLOT_IDS.length];
}

/** Pick a random slot, avoiding the current one. */
function randomSlot(current: DailySlot | null): DailySlot {
  const pool = current ? SLOT_IDS.filter((id) => id !== current) : SLOT_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Component ──

interface DailyAudioScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function DailyAudioScreen({ onNavigate }: DailyAudioScreenProps) {
  const { lang, t } = useTranslation();
  const [activeSlot, setActiveSlot] = useState<DailySlot | null>(null);
  const lastSlotRef = useRef<DailySlot | null>(null);

  // Resolve language-specific audio path
  const baseSrc = activeSlot
    ? SLOTS.find((s) => s.id === activeSlot)!.src
    : '';
  const activeSrc = localizeAudioPath(baseSrc, lang);

  const handleTrackEnd = useCallback(() => {
    // Auto-advance to next slot when track ends
    if (lastSlotRef.current) {
      const next = nextSlot(lastSlotRef.current);
      lastSlotRef.current = next;
      setActiveSlot(next);
    }
  }, []);

  const { isPlaying, loadState, togglePlay, stop } = useAudio(activeSrc, {
    onTrackEnd: handleTrackEnd,
  });

  // ── Handlers ──

  const handleSlotClick = (slot: DailySlot) => {
    if (activeSlot === slot) {
      togglePlay();
    } else {
      stop();
      lastSlotRef.current = slot;
      setActiveSlot(slot);
    }
  };

  const handleNext = () => {
    if (!activeSlot) {
      // Nothing playing → start first
      lastSlotRef.current = SLOT_IDS[0];
      setActiveSlot(SLOT_IDS[0]);
      return;
    }
    stop();
    const next = nextSlot(activeSlot);
    lastSlotRef.current = next;
    setActiveSlot(next);
  };

  const handleRandom = () => {
    stop();
    const picked = randomSlot(activeSlot);
    lastSlotRef.current = picked;
    setActiveSlot(picked);
  };

  const handleNavigate = useCallback(
    (target: Screen) => {
      stop();
      onNavigate(target);
    },
    [stop, onNavigate],
  );

  // ── Active slot label for control bar ──
  const activeLabel = activeSlot
    ? (t[SLOTS.find((s) => s.id === activeSlot)!.titleKey] as string)
    : '';

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

      {/* ── Bottom control bar ── */}
      <div className="daily-controls">
        {activeSlot && (
          <p className="daily-controls-label">{activeLabel}</p>
        )}
        <div className="daily-controls-row">
          <button
            className="daily-ctrl-btn daily-ctrl-btn--random"
            onClick={handleRandom}
            aria-label={t.daily_random}
          >
            <span className="daily-ctrl-icon">🔀</span>
            <span className="daily-ctrl-text">{t.daily_random}</span>
          </button>

          <button
            className="daily-ctrl-btn daily-ctrl-btn--play"
            onClick={() => (activeSlot ? togglePlay() : handleNext())}
            aria-label={isPlaying ? t.daily_pause : t.daily_play}
          >
            <span className="daily-ctrl-play-icon">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>

          <button
            className="daily-ctrl-btn daily-ctrl-btn--next"
            onClick={handleNext}
            aria-label={t.daily_next}
          >
            <span className="daily-ctrl-icon">⏭</span>
            <span className="daily-ctrl-text">{t.daily_next}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
