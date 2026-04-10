import type { Screen, SlipContext } from '../types';
import { SLIP_CONTEXT_LABELS, SLIP_CONTEXT_ICONS } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './LearnScreen.css';

interface LearnScreenProps {
  context: SlipContext | null;
  onNavigate: (screen: Screen) => void;
}

const SLIP_INSIGHTS: Record<SlipContext, string> = {
  'late-night':
    "Late-night slips happen when willpower is lowest. Your body's tired, your guard is down. This is normal. The key is not to fight it with discipline — it's to make the environment safer before nighttime arrives.",
  'stress':
    "Stress eating is your nervous system seeking regulation. Food provides a quick dopamine hit when cortisol is high. Recognizing the trigger is the first step. You're not weak — you're wired to seek relief.",
  'social':
    "Social situations create pressure to match others' behavior. Saying no feels socially risky. The slip isn't about food — it's about belonging. You can learn to be present without conforming.",
  'boredom':
    "Boredom slips come from understimulation. Your brain craves novelty, and food is the easiest source. Building a micro-routine for idle moments breaks this cycle over time.",
  'habit':
    "Habitual slips are the hardest to notice because they feel automatic. They're tied to cues — a time, a place, a sequence. Awareness alone starts to weaken the loop. You're already doing that by being here.",
  'after-meal':
    "Post-meal cravings often come from the dopamine pathway, not hunger. Your body got a reward and wants more. Waiting 15 minutes lets the signal pass. The craving is temporary — your decision is permanent.",
};

export default function LearnScreen({ context, onNavigate }: LearnScreenProps) {
  const label = context ? SLIP_CONTEXT_LABELS[context] : 'Unknown';
  const icon = context ? SLIP_CONTEXT_ICONS[context] : '?';
  const insight = context ? SLIP_INSIGHTS[context] : 'Select a context to learn more.';

  return (
    <div className="screen learn-screen">
      <ScreenHeader
        onBack={() => onNavigate('help')}
        onHome={() => onNavigate('home')}
      />

      <div className="learn-content">
        <div className="learn-heading">
          <span className="section-label">Understanding Your Slip</span>
          <div className="learn-context-badge">
            <span>{icon}</span>
            <span>{label}</span>
          </div>
        </div>

        <div className="learn-card">
          <p className="learn-insight">{insight}</p>
        </div>

        <button
          id="btn-learn-timer"
          className="btn btn-primary btn-large"
          onClick={() => onNavigate('mode')}
        >
          Start recovery timer
        </button>

        <button
          id="btn-learn-back"
          className="btn-text"
          onClick={() => onNavigate('help')}
        >
          Back to options
        </button>
      </div>
    </div>
  );
}
