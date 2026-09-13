import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from '../i18n';
import type { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import PremiumInfoModal from '../components/PremiumInfoModal';
import { hasPremiumAccess } from '../utils/entitlements';
import {
  getMotivationalTexts,
  getFreeMotivationalTexts,
  type MotivationalTextItem,
} from '../data/motivationalTexts';
import { recordScoreEvent } from '../utils/scoringEngine';
import { getLocalDateKey } from '../utils/dietStorage';
import './MotivationalTextScreen.css';

interface MotivationalTextScreenProps {
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
}

export default function MotivationalTextScreen({
  onBack,
  onNavigate,
}: MotivationalTextScreenProps) {
  const { t, lang } = useTranslation();
  const hasPremium = hasPremiumAccess();

  const [activeView, setActiveView] = useState<'quick' | 'library'>('quick');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [selectedPremiumTitle, setSelectedPremiumTitle] = useState<string | undefined>();
  const [selectedPremiumDesc, setSelectedPremiumDesc] = useState<string | undefined>();

  // For quick reading, strictly use free texts so emergency motivation is always free & instant
  const freeTexts = useMemo(() => {
    const items = getFreeMotivationalTexts(lang);
    if (items.length > 0) return items;
    return (
      t.motivational_texts?.map((tItem, i) => ({
        id: `fallback-${i}`,
        category: 'mindset' as const,
        title: tItem.title,
        body: tItem.body,
        isPremium: false,
      })) ?? []
    );
  }, [lang, t.motivational_texts]);

  // All texts for library browsing
  const allTexts = useMemo(() => {
    return getMotivationalTexts(lang);
  }, [lang]);

  // Pick initial index randomly; lazy initialization prevents re-render changes
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (freeTexts.length === 0) return 0;
    return Math.floor(Math.random() * freeTexts.length);
  });

  const currentItem: MotivationalTextItem = freeTexts[currentIndex] ?? {
    id: 'default',
    category: 'mindset',
    title: 'One Decision at a Time',
    body: 'You do not need to solve the whole day right now. Choose the next structured action.',
    isPremium: false,
  };

  // Record MOTIVATION_CONSUMED scoring event when user views/reads motivational content
  useEffect(() => {
    if (currentItem?.id) {
      recordScoreEvent({
        activityType: 'MOTIVATION_CONSUMED',
        sourceId: `mot_text_${getLocalDateKey()}_${currentItem.id}`,
      });
    }
  }, [currentItem?.id]);

  // Next message handler for quick reading
  const handleShowAnother = () => {
    if (freeTexts.length <= 1) return;
    let nextIndex = Math.floor(Math.random() * freeTexts.length);
    if (nextIndex === currentIndex) {
      nextIndex = (currentIndex + 1) % freeTexts.length;
    }
    setCurrentIndex(nextIndex);
  };

  const handleSelectLibraryItem = (item: MotivationalTextItem) => {
    if (item.isPremium && !hasPremium) {
      // Locked content must NOT reveal/open full locked reading content
      setSelectedPremiumTitle(item.title);
      setSelectedPremiumDesc(t.prem_info_desc);
      setShowPremiumModal(true);
      return;
    }
    // For free items, load into quick reader view
    const freeIdx = freeTexts.findIndex((f) => f.id === item.id);
    if (freeIdx !== -1) {
      setCurrentIndex(freeIdx);
    }
    setActiveView('quick');
  };

  const handleReturnHome = () => {
    onNavigate('home');
  };

  return (
    <div className="screen motivational-text-screen">
      <ScreenHeader
        onBack={onBack}
        onHome={() => onNavigate('home')}
      />

      <div className="motivational-text-content">
        {/* Glow backdrop effects */}
        <div className="text-glow-top" aria-hidden="true" />
        <div className="text-glow-bottom" aria-hidden="true" />

        {/* View Switcher: Quick Reading vs Reading Library */}
        <div className="mot-reading-view-toggle" role="tablist" aria-label={t.mot_reading_lib_title}>
          <button
            id="tab-reading-quick"
            role="tab"
            aria-selected={activeView === 'quick'}
            className={`mot-reading-tab${activeView === 'quick' ? ' mot-reading-tab--active' : ''}`}
            onClick={() => setActiveView('quick')}
          >
            {t.mot_reading_btn_quick}
          </button>
          <button
            id="tab-reading-library"
            role="tab"
            aria-selected={activeView === 'library'}
            className={`mot-reading-tab${activeView === 'library' ? ' mot-reading-tab--active' : ''}`}
            onClick={() => setActiveView('library')}
          >
            {t.mot_reading_lib_title}
          </button>
        </div>

        {activeView === 'quick' ? (
          <div className="motivational-text-card">
            <div className="motivational-text-badge">
              <span className="motivational-text-badge-icon" aria-hidden="true">✦</span>
              <span className="motivational-text-badge-label">{t.motivational_text_label}</span>
            </div>

            <h2 className="motivational-text-title">{currentItem.title}</h2>

            <p className="motivational-text-body">{currentItem.body}</p>

            <div className="motivational-text-actions">
              <button
                id="btn-text-next"
                className="btn btn-secondary motivational-text-btn-next"
                onClick={handleShowAnother}
              >
                <span>↻</span>
                <span>{t.motivational_text_btn_next}</span>
              </button>

              <button
                id="btn-text-back"
                className="btn btn-secondary motivational-text-btn-back"
                onClick={onBack}
              >
                <span>←</span>
                <span>{t.motivational_text_btn_back}</span>
              </button>

              <button
                id="btn-text-home"
                className="btn btn-primary btn-large motivational-text-btn-home"
                onClick={handleReturnHome}
              >
                {t.motivational_text_btn_home}
              </button>
            </div>
          </div>
        ) : (
          <div className="mot-reading-library" role="list">
            {allTexts.map((item) => {
              const isLocked = item.isPremium && !hasPremium;
              return (
                <button
                  key={item.id}
                  id={`btn-read-${item.id}`}
                  role="listitem"
                  className={`mot-reading-item${isLocked ? ' mot-reading-item--locked' : ''}`}
                  onClick={() => handleSelectLibraryItem(item)}
                  aria-label={`${item.title} - ${isLocked ? t.prem_badge : t.prem_free_badge}`}
                >
                  <div className="mot-reading-item-header">
                    <span className="mot-reading-item-category">{item.category}</span>
                    {isLocked ? (
                      <span className="prem-badge-chip">
                        <span className="prem-chip-icon" aria-hidden="true">🔒</span>
                        {t.prem_badge}
                      </span>
                    ) : (
                      <span className="free-badge-chip">{t.prem_free_badge}</span>
                    )}
                  </div>
                  <h3 className="mot-reading-item-title">{item.title}</h3>
                  {isLocked ? (
                    <div className="mot-reading-locked-msg">
                      <span className="mot-reading-lock-icon" aria-hidden="true">🔒</span>
                      <span>{t.prem_info_title}</span>
                    </div>
                  ) : (
                    <p className="mot-reading-item-snippet">{item.body.slice(0, 110)}...</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
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
