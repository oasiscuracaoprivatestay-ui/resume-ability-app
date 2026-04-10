import type { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import './HelpOptionsScreen.css';

interface HelpOptionsScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HelpOptionsScreen({ onNavigate }: HelpOptionsScreenProps) {
  return (
    <div className="screen help-screen">
      <ScreenHeader
        onBack={() => onNavigate('context')}
        onHome={() => onNavigate('home')}
      />

      <div className="help-content">
        <div className="help-heading">
          <span className="section-label">Recovery Path</span>
          <h2 className="help-question">
            How would you like<br />
            to <span className="accent-text">recover?</span>
          </h2>
        </div>

        <div className="help-options">
          <button
            id="help-timer"
            className="help-card"
            onClick={() => onNavigate('mode')}
          >
            <div className="help-card-left">
              <span className="help-card-icon">◎</span>
              <div className="help-card-text">
                <span className="help-card-title">Start motivational timer</span>
                <span className="help-card-desc">Guided recovery session</span>
              </div>
            </div>
          </button>

          <button
            id="help-learn"
            className="help-card"
            onClick={() => onNavigate('learn')}
          >
            <div className="help-card-left">
              <span className="help-card-icon">📖</span>
              <div className="help-card-text">
                <span className="help-card-title">Learn about this slip</span>
                <span className="help-card-desc">Understand the pattern</span>
              </div>
            </div>
          </button>

          <button
            id="help-ai"
            className="help-card help-card--disabled"
            disabled
          >
            <div className="help-card-left">
              <span className="help-card-icon">💬</span>
              <div className="help-card-text">
                <span className="help-card-title">Talk with AI</span>
                <span className="help-card-desc">Coming soon</span>
              </div>
            </div>
            <span className="help-card-badge">soon</span>
          </button>
        </div>
      </div>
    </div>
  );
}
