import type { Screen } from '../types';
import './HomeScreen.css';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export default function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div className="screen home-screen">
      <header className="home-top-bar">
        <span className="home-brand">Resume Ability</span>
        <button
          className="header-btn"
          onClick={() => onNavigate('home')}
          aria-label="Home"
        >
          ⌂
        </button>
      </header>

      <div className="home-content">
        <div className="home-question-block">
          <h1 className="home-question">
            Are you in<br />
            <span className="accent-text">control?</span>
          </h1>
          <p className="home-subtitle">
            Be honest. Fast recovery starts with awareness.
          </p>
        </div>

        <div className="home-actions">
          <button
            id="btn-slipped"
            className="home-btn-slip"
            onClick={() => onNavigate('context')}
          >
            <span className="home-btn-icon">↻</span>
            <span>I slipped</span>
          </button>
          <button
            id="btn-in-control"
            className="home-btn-control"
            onClick={() => onNavigate('control')}
          >
            <span className="home-btn-icon">✓</span>
            <span>I'm in control</span>
          </button>
        </div>
      </div>

      <nav className="home-nav">
        <button
          id="nav-dashboard"
          className="nav-link"
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </button>
        <span className="nav-dot">·</span>
        <button
          id="nav-history"
          className="nav-link"
          onClick={() => onNavigate('history')}
        >
          History
        </button>
      </nav>
    </div>
  );
}
