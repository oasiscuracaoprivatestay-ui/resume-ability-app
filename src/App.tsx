import { useState, useCallback, useEffect, useRef } from 'react';
import type { Screen, SlipContext, TimerMode, ActiveSession, SlipStatus } from './types';
import { generateId, saveSlip, updateSlip } from './utils';
import HomeScreen from './screens/HomeScreen';
import SlipTypeScreen from './screens/SlipTypeScreen';
import NonNegotiableSlipScreen from './screens/NonNegotiableSlipScreen';
import ContextScreen from './screens/ContextScreen';
import SlipInsightsScreen from './screens/SlipInsightsScreen';
import ModeScreen from './screens/ModeScreen';
import TimerScreen from './screens/TimerScreen';
import ResultScreen from './screens/ResultScreen';
import DashboardScreen from './screens/DashboardScreen';
import HistoryScreen from './screens/HistoryScreen';
import ControlScreen from './screens/ControlScreen';
import HelpOptionsScreen from './screens/HelpOptionsScreen';
import RecommitScreen from './screens/RecommitScreen';
import CommitScreen from './screens/CommitScreen';
import LearnScreen from './screens/LearnScreen';
import DailyAudioScreen from './screens/DailyAudioScreen';
import PremiumScreen from './screens/PremiumScreen';
import TimerLearnScreen from './screens/TimerLearnScreen';
import QuizScreen from './screens/QuizScreen';
import CheckInScreen from './screens/CheckInScreen';
import CommitmentScreen from './screens/CommitmentScreen';
import StructuredDietScreen from './screens/StructuredDietScreen';
import FloatingTimerButton from './components/FloatingTimerButton';
import FloatingProgramButton from './components/FloatingProgramButton';
import type { TargetSlipInfo } from './utils/slipInsights';
import { saveRecommitEvent } from './utils/recommitStorage';
import { saveInControlEvent, saveCommitEvent } from './utils/inControlStorage';

const TIMER_DURATION = 900; // 15 minutes in seconds

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pendingContext, setPendingContext] = useState<SlipContext | null>(null);
  const [currentReportedSlip, setCurrentReportedSlip] = useState<TargetSlipInfo | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastRecovery, setLastRecovery] = useState<{
    seconds: number;
    status: SlipStatus;
  } | null>(null);

  // Active InControl event ID to link positive Commit events
  const [activeInControlId, setActiveInControlId] = useState<string | null>(null);

  // ID of the slip created when the user picks a context.
  // Timer completion / relapse will update this same record.
  const [slipId, setSlipId] = useState<string | null>(null);

  // When true the user entered the Timer directly (no slip reported).
  // handleModeSelect and handleTimerComplete skip slip storage in this mode.
  const [timerOnly, setTimerOnly] = useState(false);

  // ── Back-button override ──
  // Track current screen in a ref so the popstate handler always has fresh value.
  const screenRef = useRef<Screen>('home');

  // ── Navigation ──
  const navigate = useCallback((target: Screen) => {
    if (target === 'home' || target === 'slip-type') {
      setSession(null);
      setPendingContext(null);
      setTimerOnly(false);
      setSlipId(null);
      setCurrentReportedSlip(null);
      setActiveInControlId(null);
    } else if (target === 'context' || target === 'slip-non-negotiable') {
      setSession(null);
      setPendingContext(null);
      setTimerOnly(false);
    } else if (target === 'mode') {
      setSession(null);
      // keep pendingContext so the user can pick a different mode
    }
    // Push a history entry whenever navigating away from home so the
    // popstate handler has something to intercept.
    if (target !== 'home') {
      history.pushState({ screen: target }, '');
    }
    screenRef.current = target;
    setScreen(target);
  }, []);

  // ── Start Timer (no slip) — skips context / slip recording ──
  const handleStartTimer = useCallback(() => {
    setTimerOnly(true);
    setSlipId(null);
    setCurrentReportedSlip(null);
    setPendingContext(null);
    history.pushState({ screen: 'mode' }, '');
    screenRef.current = 'mode';
    setScreen('mode');
  }, []);

  // Intercept the browser / Android hardware back button.
  useEffect(() => {
    // Seed an initial entry so there's always one entry to pop back to.
    history.pushState({ screen: 'home' }, '');

    const handlePopState = () => {
      if (screenRef.current !== 'home') {
        // Navigate to home instead of exiting.
        screenRef.current = 'home';
        setScreen('home');
        setSession(null);
        setPendingContext(null);
        setTimerOnly(false);
        setSlipId(null);
        setCurrentReportedSlip(null);
        // Push a replacement entry so subsequent back presses keep firing.
        history.pushState({ screen: 'home' }, '');
      }
      // If already on home: do nothing — the browser/OS handles exit.
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context selected → record slip (or update if navigating back) & open Insights ──
  const handleContextSelect = useCallback((context: SlipContext) => {
    let currentId = slipId;
    if (currentId) {
      // User navigated back from insights to re-choose: update existing record
      updateSlip(currentId, {
        context,
        slipType: 'slippery-zone',
        nonNegotiableText: undefined,
      });
    } else {
      currentId = generateId();
      saveSlip({
        id: currentId,
        timestamp: Date.now(),
        context,
        mode: 'single',        // best-guess placeholder
        recoveryDuration: 0,   // will be updated
        status: 'recovered',   // will be updated
        slipType: 'slippery-zone',
      });
      setSlipId(currentId);
    }

    setPendingContext(context);
    setCurrentReportedSlip({
      slipType: 'slippery-zone',
      context,
    });
    history.pushState({ screen: 'slip-insights' }, '');
    screenRef.current = 'slip-insights';
    setScreen('slip-insights');
  }, [slipId]);

  // ── Non-Negotiable rule selected → record slip (or update) & open Insights ──
  const handleNonNegotiableSelect = useCallback((rule: string) => {
    let currentId = slipId;
    if (currentId) {
      // User navigated back from insights to re-choose: update existing record
      updateSlip(currentId, {
        context: 'all-or-nothing',
        slipType: 'non-negotiable',
        nonNegotiableText: rule,
      });
    } else {
      currentId = generateId();
      saveSlip({
        id: currentId,
        timestamp: Date.now(),
        context: 'all-or-nothing',
        mode: 'single',
        recoveryDuration: 0,
        status: 'recovered',
        slipType: 'non-negotiable',
        nonNegotiableText: rule,
      });
      setSlipId(currentId);
    }

    setPendingContext('all-or-nothing');
    setCurrentReportedSlip({
      slipType: 'non-negotiable',
      context: 'all-or-nothing',
      nonNegotiableText: rule,
    });
    history.pushState({ screen: 'slip-insights' }, '');
    screenRef.current = 'slip-insights';
    setScreen('slip-insights');
  }, [slipId]);

  // ── Mode selected → create session and start timer ──
  const handleModeSelect = useCallback(
    (mode: TimerMode, loopBlocks: number) => {
      // timerOnly: no slip context required — enter timer directly.
      // Slip flow: pendingContext must exist.
      if (!timerOnly && !pendingContext) return;

      setSession({
        startedAt: Date.now(),
        context: pendingContext ?? 'stress', // placeholder context for timer-only
        mode,
        timerDuration: mode === 'extended-fast' ? 0 : TIMER_DURATION,
        extensions: 0,
        loopBlocks,
        completedBlocks: 0,
      });
      setScreen('timer');
    },
    [timerOnly, pendingContext],
  );

  // ── Timer complete → update existing slip record ──
  const handleTimerComplete = useCallback(
    (durationSeconds: number, blocksCompleted?: number) => {
      if (!session) return;

      const status: SlipStatus =
        session.extensions > 0 ? 'extended' : 'recovered';

      // Only update a slip record if this was a slip-reporting session.
      if (slipId && !timerOnly) {
        // Enrich the slip that was already saved at context selection.
        updateSlip(slipId, {
          mode: session.mode,
          recoveryDuration: durationSeconds,
          status,
          blocksCompleted:
            session.mode === 'loop' ? blocksCompleted : undefined,
          blocksTotal:
            session.mode === 'loop' ? session.loopBlocks : undefined,
        });
      }

      setLastRecovery({ seconds: durationSeconds, status });
      setSession(null);
      setPendingContext(null);
      setSlipId(null);
      setTimerOnly(false);
      setScreen('result');
    },
    [session, slipId, timerOnly],
  );

  // ── Extend timer (single mode only) ──
  const handleExtend = useCallback(() => {
    if (!session) return;
    setSession({
      ...session,
      timerDuration: TIMER_DURATION,
      extensions: session.extensions + 1,
    });
  }, [session]);

  // ── Relapse → update existing slip record ──
  const handleRelapse = useCallback(
    (blocksCompleted?: number) => {
      if (!session) return;

      const elapsed = Math.round((Date.now() - session.startedAt) / 1000);

      if (slipId && !timerOnly) {
        updateSlip(slipId, {
          mode: session.mode,
          recoveryDuration: elapsed,
          status: 'relapsed',
          blocksCompleted:
            session.mode === 'loop' ? blocksCompleted : undefined,
          blocksTotal:
            session.mode === 'loop' ? session.loopBlocks : undefined,
        });
      }

      setLastRecovery({ seconds: elapsed, status: 'relapsed' });
      setSession(null);
      setPendingContext(null);
      setSlipId(null);
      setTimerOnly(false);
      setScreen('result');
    },
    [session, slipId, timerOnly],
  );

  // ── Re-Commit Success Handler ──
  const handleRecommitSuccess = useCallback(() => {
    const id = generateId();
    saveRecommitEvent({
      id,
      timestamp: Date.now(),
      slipId: slipId ?? undefined,
    });
  }, [slipId]);

  // ── "I Am in Control" Handler ──
  const handleInControl = useCallback(() => {
    const id = generateId();
    saveInControlEvent({
      id,
      timestamp: Date.now(),
    });
    setActiveInControlId(id);
    navigate('control');
  }, [navigate]);

  // ── Positive Commit Success Handler ──
  const handleCommitSuccess = useCallback(() => {
    const id = generateId();
    saveCommitEvent({
      id,
      timestamp: Date.now(),
      source: 'in-control',
      inControlEventId: activeInControlId ?? undefined,
    });
  }, [activeInControlId]);

  // ── Render current screen ──
  let content: React.ReactNode;
  // Back destination for ModeScreen depends on entry path.
  const modeBackTo: Screen = timerOnly ? 'home' : 'help';

  switch (screen) {
    case 'home':
      content = (
        <HomeScreen
          onNavigate={navigate}
          onStartTimer={handleStartTimer}
          onInControl={handleInControl}
        />
      );
      break;

    case 'recommit':
      content = (
        <RecommitScreen
          onComplete={handleRecommitSuccess}
          onNavigate={navigate}
        />
      );
      break;

    case 'slip-type':
      content = <SlipTypeScreen onNavigate={navigate} />;
      break;

    case 'slip-non-negotiable':
      content = (
        <NonNegotiableSlipScreen
          onSelect={handleNonNegotiableSelect}
          onNavigate={navigate}
        />
      );
      break;

    case 'context':
      content = (
        <ContextScreen
          onSelect={handleContextSelect}
          onNavigate={navigate}
        />
      );
      break;

    case 'slip-insights':
      content = currentReportedSlip ? (
        <SlipInsightsScreen
          target={currentReportedSlip}
          onContinue={() => navigate('help')}
          onNavigate={navigate}
        />
      ) : (
        <HomeScreen onNavigate={navigate} onStartTimer={handleStartTimer} />
      );
      break;

    case 'mode':
      content = (
        <ModeScreen
          onSelect={handleModeSelect}
          onNavigate={navigate}
          backTo={modeBackTo}
        />
      );
      break;

    case 'timer':
      content = session ? (
        <TimerScreen
          session={session}
          onComplete={handleTimerComplete}
          onExtend={handleExtend}
          onRelapse={handleRelapse}
          onNavigate={navigate}
        />
      ) : (
        <HomeScreen onNavigate={navigate} onStartTimer={handleStartTimer} />
      );
      break;

    case 'result':
      content = lastRecovery ? (
        <ResultScreen
          recoverySeconds={lastRecovery.seconds}
          status={lastRecovery.status}
          onNavigate={navigate}
        />
      ) : (
        <HomeScreen onNavigate={navigate} onStartTimer={handleStartTimer} />
      );
      break;

    case 'help':
      content = <HelpOptionsScreen onNavigate={navigate} />;
      break;

    case 'learn':
      content = (
        <LearnScreen
          context={pendingContext}
          onNavigate={navigate}
        />
      );
      break;

    case 'control':
      content = <ControlScreen onNavigate={navigate} />;
      break;

    case 'commit':
      content = (
        <CommitScreen
          onComplete={handleCommitSuccess}
          onNavigate={navigate}
        />
      );
      break;

    case 'dashboard':
      content = <DashboardScreen onNavigate={navigate} />;
      break;

    case 'history':
      content = <HistoryScreen onNavigate={navigate} />;
      break;

    case 'daily-audio':
      content = <DailyAudioScreen onNavigate={navigate} />;
      break;

    case 'premium':
      content = <PremiumScreen onNavigate={navigate} />;
      break;

    case 'timer-learn':
      content = <TimerLearnScreen onNavigate={navigate} />;
      break;

    case 'quiz':
      content = <QuizScreen onNavigate={navigate} />;
      break;

    case 'check-in':
      content = <CheckInScreen onNavigate={navigate} />;
      break;

    case 'commitment':
      content = <CommitmentScreen onNavigate={navigate} />;
      break;

    case 'structured-diet':
      content = <StructuredDietScreen onNavigate={navigate} />;
      break;

    default:
      content = (
        <HomeScreen
          onNavigate={navigate}
          onStartTimer={handleStartTimer}
          onInControl={handleInControl}
        />
      );
  }

  return (
    <div className="app-shell">
      {content}
      <div className="floating-buttons-stack">
        <FloatingProgramButton currentScreen={screen} />
        <FloatingTimerButton currentScreen={screen} onNavigate={navigate} onStartTimer={handleStartTimer} />
      </div>
    </div>
  );
}
