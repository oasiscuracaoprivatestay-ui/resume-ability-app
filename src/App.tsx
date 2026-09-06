import { useState, useCallback, useEffect, useRef } from 'react';
import type { Screen, SlipContext, TimerMode, ActiveSession, SlipStatus } from './types';
import { generateId, saveSlip, updateSlip } from './utils';
import HomeScreen from './screens/HomeScreen';
import ContextScreen from './screens/ContextScreen';
import ModeScreen from './screens/ModeScreen';
import TimerScreen from './screens/TimerScreen';
import ResultScreen from './screens/ResultScreen';
import DashboardScreen from './screens/DashboardScreen';
import HistoryScreen from './screens/HistoryScreen';
import ControlScreen from './screens/ControlScreen';
import HelpOptionsScreen from './screens/HelpOptionsScreen';
import LearnScreen from './screens/LearnScreen';
import DailyAudioScreen from './screens/DailyAudioScreen';
import PremiumScreen from './screens/PremiumScreen';
import TimerLearnScreen from './screens/TimerLearnScreen';
import QuizScreen from './screens/QuizScreen';
import CheckInScreen from './screens/CheckInScreen';
import CommitmentScreen from './screens/CommitmentScreen';
import FloatingTimerButton from './components/FloatingTimerButton';
import FloatingProgramButton from './components/FloatingProgramButton';

const TIMER_DURATION = 900; // 15 minutes in seconds

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pendingContext, setPendingContext] = useState<SlipContext | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastRecovery, setLastRecovery] = useState<{
    seconds: number;
    status: SlipStatus;
  } | null>(null);

  // ID of the slip created when the user picks a context.
  // Timer completion / relapse will update this same record.
  const [slipId, setSlipId] = useState<string | null>(null);

  // ── Back-button override ──
  // Track current screen in a ref so the popstate handler always has fresh value.
  const screenRef = useRef<Screen>('home');

  // ── Navigation ──
  const navigate = useCallback((target: Screen) => {
    if (target === 'home') {
      setSession(null);
      setPendingContext(null);
    } else if (target === 'context') {
      setSession(null);
      setPendingContext(null);
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
        // Push a replacement entry so subsequent back presses keep firing.
        history.pushState({ screen: 'home' }, '');
      }
      // If already on home: do nothing — the browser/OS handles exit.
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Context selected → record the slip immediately, then go to help options ──
  const handleContextSelect = useCallback((context: SlipContext) => {
    const id = generateId();

    // Record the slip the moment the user admits it.
    // mode / recoveryDuration / status are placeholders — updated when the
    // timer finishes (see handleTimerComplete / handleRelapse).
    saveSlip({
      id,
      timestamp: Date.now(),
      context,
      mode: 'single',        // best-guess placeholder
      recoveryDuration: 0,   // will be updated
      status: 'recovered',   // will be updated
    });

    setSlipId(id);
    setPendingContext(context);
    setScreen('help');
  }, []);

  // ── Mode selected → create session and start timer ──
  const handleModeSelect = useCallback(
    (mode: TimerMode, loopBlocks: number) => {
      if (!pendingContext) return;

      setSession({
        startedAt: Date.now(),
        context: pendingContext,
        mode,
        timerDuration: mode === 'extended-fast' ? 0 : TIMER_DURATION,
        extensions: 0,
        loopBlocks,
        completedBlocks: 0,
      });
      setScreen('timer');
    },
    [pendingContext],
  );

  // ── Timer complete → update existing slip record ──
  const handleTimerComplete = useCallback(
    (durationSeconds: number, blocksCompleted?: number) => {
      if (!session) return;

      const status: SlipStatus =
        session.extensions > 0 ? 'extended' : 'recovered';

      if (slipId) {
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
      setScreen('result');
    },
    [session, slipId],
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

      if (slipId) {
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
      setScreen('result');
    },
    [session, slipId],
  );

  // ── Render current screen ──
  let content: React.ReactNode;

  switch (screen) {
    case 'home':
      content = <HomeScreen onNavigate={navigate} />;
      break;

    case 'context':
      content = (
        <ContextScreen
          onSelect={handleContextSelect}
          onNavigate={navigate}
        />
      );
      break;

    case 'mode':
      content = (
        <ModeScreen
          onSelect={handleModeSelect}
          onNavigate={navigate}
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
        <HomeScreen onNavigate={navigate} />
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
        <HomeScreen onNavigate={navigate} />
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

    default:
      content = <HomeScreen onNavigate={navigate} />;
  }

  return (
    <div className="app-shell">
      {content}
      <div className="floating-buttons-stack">
        <FloatingProgramButton currentScreen={screen} />
        <FloatingTimerButton currentScreen={screen} onNavigate={navigate} />
      </div>
    </div>
  );
}
