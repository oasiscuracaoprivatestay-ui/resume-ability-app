import { formatTimer } from '../utils';
import './TimerRing.css';

interface TimerRingProps {
  displaySeconds: number;    // time to show in the center
  progress: number;          // 0-1 ring fill amount
  isCountUp?: boolean;       // if true, count-up visual treatment
}

export default function TimerRing({ displaySeconds, progress, isCountUp }: TimerRingProps) {
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <div className={`timer-ring-container${isCountUp ? ' timer-ring-countup' : ''}`}>
      <svg className="timer-ring" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="timerRingEmeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        <circle
          className="timer-ring-bg"
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          strokeWidth="6"
        />
        <circle
          className="timer-ring-progress"
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          stroke="url(#timerRingEmeraldGradient)"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 150 150)"
        />
      </svg>
      <div className="timer-display">
        <span className="timer-digits">{formatTimer(displaySeconds)}</span>
        {!isCountUp && displaySeconds === 0 && (
          <span className="timer-done-label">Time's up</span>
        )}
        {isCountUp && (
          <span className="timer-countup-label">Elapsed</span>
        )}
      </div>
    </div>
  );
}
