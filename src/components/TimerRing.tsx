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
        <circle
          className="timer-ring-bg"
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          strokeWidth="4"
        />
        <circle
          className="timer-ring-progress"
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          strokeWidth="4"
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
