import { useState, useCallback, useRef } from 'react';
import type { Screen } from '../types';
import { useAudio } from '../hooks/useAudio';
import { useTranslation } from '../i18n';
import { localizeAudioPath } from '../utils/audioPath';
import type { Translations } from '../i18n';
import ScreenHeader from '../components/ScreenHeader';
import PremiumInfoModal from '../components/PremiumInfoModal';
import { hasPremiumAccess } from '../utils/entitlements';
import {
  MOTIVATIONAL_AUDIO_TRACKS,
  type AudioTrackMetadata,
} from '../data/motivationalAudio';
import './DailyAudioScreen.css';

// ── Category pools ──

type DailySlot = 'morning' | 'midday' | 'evening';

interface SlotConfig {
  id: DailySlot;
  icon: string;
  titleKey: keyof Translations;
  descKey: keyof Translations;
  tracks: string[];            // pool of base audio paths
}

const SLOTS: SlotConfig[] = [
  {
    id: 'morning',
    icon: '🌅',
    titleKey: 'daily_morning',
    descKey: 'daily_morning_desc',
    tracks: [
      '/audio/morning-1.mp3',
      '/audio/morning-2.mp3',
      '/audio/morning-3.mp3',
      '/audio/morning-4.mp3',
    ],
  },
  {
    id: 'midday',
    icon: '☀️',
    titleKey: 'daily_midday',
    descKey: 'daily_midday_desc',
    tracks: [
      '/audio/midday-1.mp3',
      '/audio/midday-2.mp3',
      '/audio/midday-3.mp3',
      '/audio/midday-4.mp3',
    ],
  },
  {
    id: 'evening',
    icon: '🌙',
    titleKey: 'daily_evening',
    descKey: 'daily_evening_desc',
    tracks: [
      '/audio/evening-1.mp3',
      '/audio/evening-2.mp3',
      '/audio/evening-3.mp3',
      '/audio/evening-4.mp3',
    ],
  },
];

// ── Track selection helpers ──

function getSlot(id: DailySlot): SlotConfig {
  return SLOTS.find((s) => s.id === id)!;
}

/** Pick random track from a category, avoiding lastSrc if possible. */
function pickTrack(slot: DailySlot, lastSrc: string | null): string {
  const pool = getSlot(slot).tracks;
  if (pool.length === 1) return pool[0];
  const filtered = lastSrc ? pool.filter((t) => t !== lastSrc) : pool;
  const source = filtered.length > 0 ? filtered : pool;
  return source[Math.floor(Math.random() * source.length)];
}

/** Pick the next track in the category (sequential, wrapping). */
function nextTrackInSlot(slot: DailySlot, currentSrc: string | null): string {
  const pool = getSlot(slot).tracks;
  if (!currentSrc || pool.length <= 1) return pool[0];
  const idx = pool.indexOf(currentSrc);
  return pool[(idx + 1) % pool.length];
}

// ── Component ──

interface DailyAudioScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack?: () => void;
}

export default function DailyAudioScreen({ onNavigate, onBack }: DailyAudioScreenProps) {
  const { lang, t } = useTranslation();
  const [activeSlot, setActiveSlot] = useState<DailySlot | null>(null);
  const [activeSrcBase, setActiveSrcBase] = useState('');
  const [activeView, setActiveView] = useState<'slots' | 'library'>('slots');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedPremiumTitle, setSelectedPremiumTitle] = useState<string | undefined>();
  const [selectedPremiumDesc, setSelectedPremiumDesc] = useState<string | undefined>();

  const hasPremium = hasPremiumAccess();
  const lastSrcRef = useRef<string | null>(null);
  const activeSlotRef = useRef<DailySlot | null>(null);

  // Keep ref in sync for use inside callbacks
  activeSlotRef.current = activeSlot;

  // Resolve language-specific audio path
  const activeSrc = localizeAudioPath(activeSrcBase, lang);

  /** When a track ends, auto-advance to next track in same category. */
  const handleTrackEnd = useCallback(() => {
    const slot = activeSlotRef.current;
    if (!slot) return;
    const next = nextTrackInSlot(slot, lastSrcRef.current);
    lastSrcRef.current = next;
    setActiveSrcBase(next);
  }, []);

  const { isPlaying, loadState, togglePlay, stop } = useAudio(activeSrc, {
    onTrackEnd: handleTrackEnd,
  });

  // ── Helpers to start a category ──

  const startSlot = (slot: DailySlot, mode: 'pick' | 'next' | 'random' = 'pick') => {
    let src: string;
    if (mode === 'next') {
      src = nextTrackInSlot(slot, lastSrcRef.current);
    } else if (mode === 'random') {
      src = pickTrack(slot, lastSrcRef.current);
    } else {
      src = pickTrack(slot, null); // fresh pick when switching categories
    }
    lastSrcRef.current = src;
    setActiveSlot(slot);
    setActiveSrcBase(src);
  };

  // ── Handlers ──

  const handleSlotClick = (slot: DailySlot) => {
    if (activeSlot === slot) {
      togglePlay();
    } else {
      stop();
      startSlot(slot, 'pick');
    }
  };

  /** Track click from Library view */
  const handleLibraryTrackClick = (track: AudioTrackMetadata) => {
    if (track.isPremium && !hasPremium) {
      // Locked content must NOT begin playback
      setSelectedPremiumTitle(t[track.titleKey] as string);
      setSelectedPremiumDesc(t[track.descKey] as string);
      setShowPremiumModal(true);
      return;
    }

    if (!track.src) return;

    if (activeSrcBase === track.src) {
      togglePlay();
    } else {
      stop();
      lastSrcRef.current = track.src;
      setActiveSlot(track.slot);
      setActiveSrcBase(track.src);
    }
  };

  /** Next: advance to next track within same category. */
  const handleNext = () => {
    if (!activeSlot) {
      startSlot('morning', 'pick');
      return;
    }
    stop();
    startSlot(activeSlot, 'next');
  };

  /** Random: pick a random track within same category. */
  const handleRandom = () => {
    if (!activeSlot) {
      startSlot('morning', 'random');
      return;
    }
    stop();
    startSlot(activeSlot, 'random');
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
    ? (t[getSlot(activeSlot).titleKey] as string)
    : '';

  const handleBack = () => {
    stop();
    if (onBack) {
      onBack();
    } else {
      onNavigate('home');
    }
  };

  return (
    <div className="screen daily-screen">
      <ScreenHeader
        onBack={handleBack}
        onHome={() => handleNavigate('home')}
      />

      <div className="daily-content">
        <div className="daily-heading">
          <span className="section-label">{t.daily_label}</span>
          <h2 className="section-heading">{t.daily_heading}</h2>
        </div>

        {/* View switcher: Quick Play (Slots) vs Audio Library */}
        <div className="daily-view-toggle" role="tablist" aria-label={t.mot_lib_tab_all}>
          <button
            id="tab-audio-slots"
            role="tab"
            aria-selected={activeView === 'slots'}
            className={`daily-view-tab${activeView === 'slots' ? ' daily-view-tab--active' : ''}`}
            onClick={() => setActiveView('slots')}
          >
            {t.mot_lib_tab_slots}
          </button>
          <button
            id="tab-audio-library"
            role="tab"
            aria-selected={activeView === 'library'}
            className={`daily-view-tab${activeView === 'library' ? ' daily-view-tab--active' : ''}`}
            onClick={() => setActiveView('library')}
          >
            {t.mot_lib_tab_all}
          </button>
        </div>

        {activeView === 'slots' ? (
          <div className="daily-slots">
            {SLOTS.map((slot) => {
              const isActive = activeSlot === slot.id;
              const isSlotPlaying = isActive && isPlaying;
              const isLoading = isActive && loadState === 'loading';
              const hasError = isActive && loadState === 'error';

              return (
                <button
                  key={slot.id}
                  id={`btn-slot-${slot.id}`}
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
        ) : (
          <div className="daily-library-list" role="list">
            {MOTIVATIONAL_AUDIO_TRACKS.map((track) => {
              const isLocked = track.isPremium && !hasPremium;
              const isCurrent = activeSrcBase === track.src && track.src !== '';
              const isTrackPlaying = isCurrent && isPlaying;
              const isLoading = isCurrent && loadState === 'loading';

              const slotConfig = SLOTS.find((s) => s.id === track.slot);
              const slotIcon = slotConfig?.icon || '✦';

              return (
                <button
                  key={track.id}
                  id={`btn-track-${track.id}`}
                  role="listitem"
                  className={`daily-track-item${isCurrent ? ' daily-track-item--active' : ''}${isLocked ? ' daily-track-item--locked' : ''}`}
                  onClick={() => handleLibraryTrackClick(track)}
                  aria-label={`${t[track.titleKey] as string} - ${isLocked ? t.prem_badge : t.prem_free_badge}`}
                >
                  <span className="daily-track-icon">{slotIcon}</span>
                  <div className="daily-track-info">
                    <div className="daily-track-header-row">
                      <span className="daily-track-title">{t[track.titleKey] as string}</span>
                      {isLocked ? (
                        <span className="prem-badge-chip">
                          <span className="prem-chip-icon" aria-hidden="true">🔒</span>
                          {t.prem_badge}
                        </span>
                      ) : (
                        <span className="free-badge-chip">{t.prem_free_badge}</span>
                      )}
                    </div>
                    <span className="daily-track-desc">{t[track.descKey] as string}</span>
                    <div className="daily-track-meta">
                      <span className="daily-track-duration">{track.durationLabel}</span>
                    </div>
                  </div>
                  <span className="daily-track-action" aria-hidden="true">
                    {isLocked
                      ? '🔒'
                      : isLoading
                        ? '⏳'
                        : isTrackPlaying
                          ? '⏸'
                          : '▶'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

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

        {/* ── Timer action — separated from audio controls ── */}
        <div className="daily-timer-section">
          <button
            id="daily-start-timer"
            className="daily-start-timer"
            onClick={() => handleNavigate('context')}
          >
            <span className="daily-start-icon">⏱</span>
            <span>{t.global_start_timer}</span>
          </button>
        </div>
      </div>

      <PremiumInfoModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        title={selectedPremiumTitle}
        description={selectedPremiumDesc}
      />
    </div>
  );
}
