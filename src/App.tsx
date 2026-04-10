import { useState, useCallback } from 'react';
import type { Screen, SlipContext, TimerMode, ActiveSession, SlipStatus } from './types';
import { generateId, saveSlip } from './utils';
import HomeScreen from './screens/HomeScreen';
import ContextScreen from './screens/ContextScreen';
import ModeScreen from './screens/ModeScreen';
import TimerScreen from './screens/TimerScreen';
import ResultScreen from './screens/ResultScreen';
import DashboardScreen from './screens/DashboardScreen';
import HistoryScreen from './screens/HistoryScreen';
import ControlScreen from './screens/ControlScreen';

const TIMER_DURATION = 900; // 15 minutes in seconds

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [pendingContext, setPendingContext] = useState<SlipContext | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastRecovery, setLastRecovery] = useState<{
    seconds: number;
    status: SlipStatus;
  } | null>(null);

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
    setScreen(target);
  }, []);

  // ── Context selected → go to mode selection ──
  const handleContextSelect = useCallback((context: SlipContext) => {
    setPendingContext(context);
    setScreen('mode');
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

  // ── Timer complete → save & show result ──
  const handleTimerComplete = useCallback(
    (durationSeconds: number, blocksCompleted?: number) => {
      if (!session) return;

      const status: SlipStatus =
        session.extensions > 0 ? 'extended' : 'recovered';

      saveSlip({
        id: generateId(),
        timestamp: session.startedAt,
        context: session.context,
        mode: session.mode,
        recoveryDuration: durationSeconds,
        status,
        blocksCompleted:
          session.mode === 'loop' ? blocksCompleted : undefined,
        blocksTotal:
          session.mode === 'loop' ? session.loopBlocks : undefined,
      });

      setLastRecovery({ seconds: durationSeconds, status });
      setSession(null);
      setPendingContext(null);
      setScreen('result');
    },
    [session],
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

  // ── Relapse ──
  const handleRelapse = useCallback(
    (blocksCompleted?: number) => {
      if (!session) return;

      const elapsed = Math.round((Date.now() - session.startedAt) / 1000);

      saveSlip({
        id: generateId(),
        timestamp: session.startedAt,
        context: session.context,
        mode: session.mode,
        recoveryDuration: elapsed,
        status: 'relapsed',
        blocksCompleted:
          session.mode === 'loop' ? blocksCompleted : undefined,
        blocksTotal:
          session.mode === 'loop' ? session.loopBlocks : undefined,
      });

      setLastRecovery({ seconds: elapsed, status: 'relapsed' });
      setSession(null);
      setPendingContext(null);
      setScreen('result');
    },
    [session],
  );

  // ── Render current screen ──
  switch (screen) {
    case 'home':
      return <HomeScreen onNavigate={navigate} />;

    case 'context':
      return (
        <ContextScreen
          onSelect={handleContextSelect}
          onNavigate={navigate}
        />
      );

    case 'mode':
      return (
        <ModeScreen
          onSelect={handleModeSelect}
          onNavigate={navigate}
        />
      );

    case 'timer':
      return session ? (
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

    case 'result':
      return lastRecovery ? (
        <ResultScreen
          recoverySeconds={lastRecovery.seconds}
          status={lastRecovery.status}
          onNavigate={navigate}
        />
      ) : (
        <HomeScreen onNavigate={navigate} />
      );

    case 'control':
      return <ControlScreen onNavigate={navigate} />;

    case 'dashboard':
      return <DashboardScreen onNavigate={navigate} />;

    case 'history':
      return <HistoryScreen onNavigate={navigate} />;

    default:
      return <HomeScreen onNavigate={navigate} />;
  }
}
