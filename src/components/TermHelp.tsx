import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import './TermHelp.css';

export type SdaTermKey = 'slip' | 'sz' | 'nn' | 'ra' | 'sd' | 'mf';

interface TermHelpProps {
  termKey?: SdaTermKey;
  title?: string;
  definition?: string;
  className?: string;
  btnId?: string;
}

export default function TermHelp({
  termKey,
  title,
  definition,
  className = '',
  btnId,
}: TermHelpProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Derive term title and definition from key if provided
  let termTitle = title;
  let termDef = definition;

  if (termKey) {
    switch (termKey) {
      case 'slip':
        termTitle = termTitle || t.sda_term_slip_title;
        termDef = termDef || t.sda_term_slip_def;
        break;
      case 'sz':
        termTitle = termTitle || t.sda_term_sz_title;
        termDef = termDef || t.sda_term_sz_def;
        break;
      case 'nn':
        termTitle = termTitle || t.sda_term_nn_title;
        termDef = termDef || t.sda_term_nn_def;
        break;
      case 'ra':
        termTitle = termTitle || t.sda_term_ra_title;
        termDef = termDef || t.sda_term_ra_def;
        break;
      case 'sd':
        termTitle = termTitle || t.sda_term_sd_title;
        termDef = termDef || t.sda_term_sd_def;
        break;
      case 'mf':
        termTitle = termTitle || t.sda_term_mf_title;
        termDef = termDef || t.sda_term_mf_def;
        break;
    }
  }

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(true);
  };

  const handleClose = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setIsOpen(false);
  };

  return (
    <>
      <button
        id={btnId}
        type="button"
        className={`term-help-trigger ${className}`}
        onClick={handleOpen}
        aria-label={`${t.sda_info_aria}: ${termTitle || ''}`}
        aria-expanded={isOpen}
      >
        <span className="term-help-icon" aria-hidden="true">?</span>
      </button>

      {isOpen && (
        <div
          className="term-help-backdrop"
          onClick={handleClose}
          role="presentation"
        >
          <div
            className="term-help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="term-help-title"
            aria-describedby="term-help-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="term-help-header">
              <span className="term-help-badge">SDA</span>
              <h3 id="term-help-title" className="term-help-title">
                {termTitle}
              </h3>
              <button
                type="button"
                className="term-help-close-x"
                onClick={handleClose}
                aria-label={t.sda_btn_close}
              >
                ✕
              </button>
            </div>
            <p id="term-help-desc" className="term-help-body">
              {termDef}
            </p>
            <div className="term-help-actions">
              <button
                type="button"
                className="term-help-btn-primary"
                onClick={handleClose}
              >
                {t.sda_btn_close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
