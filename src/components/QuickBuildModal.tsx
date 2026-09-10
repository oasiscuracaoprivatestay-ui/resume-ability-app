import { useState, useMemo, useEffect } from 'react';
import type { DayKey, StructuredDietBlock } from '../utils/dietStorage';
import { generateBlockId, timeToMinutes } from '../utils/dietStorage';
import { TIME_SLOTS, formatTime } from '../data/dietData';
import { useTranslation } from '../i18n';
import './QuickBuildModal.css';

export interface QuickBuildModalProps {
  isOpen: boolean;
  dayKey: DayKey;
  dayName: string;
  hasExistingBlocks: boolean;
  onClose: () => void;
  onConfirm: (blocks: StructuredDietBlock[], mode: 'add' | 'replace') => void;
}

type ModalStep = 'config' | 'conflict';

interface IntervalOption {
  minutes: number;
  hours: number;
}

const INTERVAL_OPTIONS: IntervalOption[] = [
  { minutes: 60, hours: 1 },
  { minutes: 90, hours: 1.5 },
  { minutes: 120, hours: 2 },
  { minutes: 150, hours: 2.5 },
  { minutes: 180, hours: 3 },
  { minutes: 210, hours: 3.5 },
  { minutes: 240, hours: 4 },
];

const BLOCK_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export default function QuickBuildModal({
  isOpen,
  dayKey: _dayKey,
  dayName,
  hasExistingBlocks,
  onClose,
  onConfirm,
}: QuickBuildModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<ModalStep>('config');
  const [startTime, setStartTime] = useState<string>('08:00');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(180); // 3 hours default
  const [blockCount, setBlockCount] = useState<number>(4);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setStartTime('08:00');
      setIntervalMinutes(180);
      setBlockCount(4);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute generated blocks and check midnight overflow
  const { generatedBlocks, isOverflow } = useMemo(() => {
    const startMins = timeToMinutes(startTime);
    const blocks: StructuredDietBlock[] = [];
    let overflow = false;

    for (let i = 0; i < blockCount; i++) {
      const blockStartMins = startMins + i * intervalMinutes;
      const blockEndMins = blockStartMins + 30; // 30-minute block duration

      // Current day ends at 24:00 (1440 minutes)
      if (blockEndMins > 1440) {
        overflow = true;
        break;
      }

      const sh = Math.floor(blockStartMins / 60);
      const sm = blockStartMins % 60;
      const eh = Math.floor(blockEndMins / 60);
      const em = blockEndMins % 60;

      const sStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const eStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      blocks.push({
        id: generateBlockId(),
        startTime: sStr,
        endTime: eStr,
        type: 'custom',
        items: [],
        customText: '',
      });
    }

    return {
      generatedBlocks: overflow ? [] : blocks,
      isOverflow: overflow,
    };
  }, [startTime, intervalMinutes, blockCount]);

  const handleCreateClick = () => {
    if (isOverflow || generatedBlocks.length === 0) return;

    if (hasExistingBlocks) {
      setStep('conflict');
    } else {
      onConfirm(generatedBlocks, 'replace');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="qb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qb-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qb-modal" role="document">
        {step === 'config' ? (
          <div className="qb-body">
            {/* Header */}
            <div className="qb-header">
              <div className="qb-header-title-wrap">
                <span className="qb-badge">⚡ {t.sdb_quick_build}</span>
                <h2 id="qb-modal-title" className="qb-title">
                  {dayName}
                </h2>
              </div>
              <button
                id="btn-qb-close"
                type="button"
                className="qb-close-btn"
                onClick={onClose}
                aria-label={t.sdb_qb_btn_cancel}
              >
                ✕
              </button>
            </div>

            <p className="qb-sub">{t.sdb_qb_sub}</p>

            {/* Step 1: Start Time */}
            <div className="qb-field">
              <label htmlFor="qb-select-start-time" className="qb-label">
                1. {t.sdb_qb_start_time}
              </label>
              <select
                id="qb-select-start-time"
                className="qb-select"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.value} ({slot.label})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Interval */}
            <div className="qb-field">
              <span className="qb-label">2. {t.sdb_qb_interval}</span>
              <div className="qb-pill-grid" role="radiogroup" aria-label={t.sdb_qb_interval}>
                {INTERVAL_OPTIONS.map((opt) => {
                  const isSelected = intervalMinutes === opt.minutes;
                  const label = opt.hours === 1
                    ? t.sdb_qb_hour_unit_singular
                    : t.sdb_qb_hours_unit.replace('{hours}', String(opt.hours));

                  return (
                    <button
                      key={opt.minutes}
                      id={`btn-qb-interval-${opt.minutes}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`qb-pill ${isSelected ? 'qb-pill--active' : ''}`}
                      onClick={() => setIntervalMinutes(opt.minutes)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Block Count */}
            <div className="qb-field">
              <span className="qb-label">3. {t.sdb_qb_block_count}</span>
              <div className="qb-count-row" role="radiogroup" aria-label={t.sdb_qb_block_count}>
                {BLOCK_COUNT_OPTIONS.map((num) => {
                  const isSelected = blockCount === num;
                  return (
                    <button
                      key={num}
                      id={`btn-qb-count-${num}`}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`qb-count-pill ${isSelected ? 'qb-count-pill--active' : ''}`}
                      onClick={() => setBlockCount(num)}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Preview */}
            <div className="qb-preview-section">
              <span className="qb-label">4. {t.sdb_qb_preview}</span>
              {isOverflow ? (
                <div className="qb-overflow-warning" role="alert">
                  <span className="qb-warning-icon">⚠️</span>
                  <p className="qb-warning-text">{t.sdb_qb_err_overflow}</p>
                </div>
              ) : (
                <div className="qb-preview-card">
                  <div className="qb-preview-list">
                    {generatedBlocks.map((b, idx) => (
                      <div key={idx} className="qb-preview-item">
                        <span className="qb-preview-num">{idx + 1}</span>
                        <span className="qb-preview-time">
                          {b.startTime} – {b.endTime}
                        </span>
                        <span className="qb-preview-tag">
                          ({formatTime(b.startTime)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="qb-modal-actions">
              <button
                id="btn-qb-create-blocks"
                type="button"
                className="qb-btn qb-btn--create"
                onClick={handleCreateClick}
                disabled={isOverflow}
              >
                ✓ {t.sdb_qb_btn_create}
              </button>
              <button
                id="btn-qb-cancel"
                type="button"
                className="qb-btn qb-btn--cancel"
                onClick={onClose}
              >
                {t.sdb_qb_btn_cancel}
              </button>
            </div>
          </div>
        ) : (
          /* Conflict resolution step (when selected day already has blocks) */
          <div className="qb-conflict-body" role="alertdialog">
            <div className="qb-conflict-icon-wrap">
              <span className="qb-conflict-icon">⚠️</span>
            </div>

            <h2 id="qb-modal-title" className="qb-conflict-title">
              {t.sdb_qb_conflict_title}
            </h2>
            <p className="qb-conflict-desc">{t.sdb_qb_conflict_desc}</p>

            <div className="qb-conflict-actions">
              <button
                id="btn-qb-add-existing"
                type="button"
                className="qb-btn qb-btn--add"
                onClick={() => onConfirm(generatedBlocks, 'add')}
              >
                + {t.sdb_qb_btn_add_existing}
              </button>
              <button
                id="btn-qb-replace-existing"
                type="button"
                className="qb-btn qb-btn--replace"
                onClick={() => onConfirm(generatedBlocks, 'replace')}
              >
                ↻ {t.sdb_qb_btn_replace_existing}
              </button>
              <button
                id="btn-qb-conflict-cancel"
                type="button"
                className="qb-btn qb-btn--cancel"
                onClick={() => setStep('config')}
              >
                {t.sdb_qb_btn_cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
