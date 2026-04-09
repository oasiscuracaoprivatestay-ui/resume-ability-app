
interface ScreenHeaderProps {
  onBack: () => void;
  onHome: () => void;
}

export default function ScreenHeader({ onBack, onHome }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <button
        className="header-btn"
        onClick={onBack}
        aria-label="Go back"
      >
        ←
      </button>
      <span className="screen-brand">Resume Ability</span>
      <button
        className="header-btn"
        onClick={onHome}
        aria-label="Go home"
      >
        ⌂
      </button>
    </header>
  );
}
