import React from 'react';
import { playFeedback } from '../utils/feedback';
import './CheckableCommitmentItem.css';

export interface CheckableCommitmentItemProps {
  id: string;
  index?: number;
  text: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export const CheckableCommitmentItem: React.FC<CheckableCommitmentItemProps> = ({
  id,
  index,
  text,
  checked,
  onToggle,
  disabled = false,
  ariaLabel,
}) => {
  const handleClick = () => {
    if (disabled) return;
    playFeedback('neutral');
    onToggle();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playFeedback('neutral');
      onToggle();
    }
  };

  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`checkable-commitment-item ${checked ? 'checkable-commitment-item--checked' : ''} ${disabled ? 'checkable-commitment-item--disabled' : ''}`}
      aria-label={ariaLabel || `${checked ? 'Reviewed' : 'Review'}: ${text}`}
    >
      <div className="checkable-item-status-icon" aria-hidden="true">
        {checked ? (
          <span className="checkable-box-checked">
            <svg viewBox="0 0 20 20" fill="none" className="checkable-svg-check">
              <path
                d="M4 10.5L8 14.5L16 5.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : (
          <span className="checkable-box-unchecked" />
        )}
      </div>

      {typeof index === 'number' && (
        <span className="checkable-item-num" aria-hidden="true">
          {index + 1}
        </span>
      )}

      <span className="checkable-item-text">{text}</span>

      <span className="checkable-item-badge" aria-hidden="true">
        {checked ? '✓' : '—'}
      </span>
    </button>
  );
};

export default CheckableCommitmentItem;
