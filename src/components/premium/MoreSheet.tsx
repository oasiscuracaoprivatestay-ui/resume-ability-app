/**
 * Super Diet-Ability — Premium "More" sheet (Phase 2)
 *
 * Accessible bottom sheet (mobile) / centered panel (desktop) that hosts every
 * secondary Home entry point, so nothing is removed from the app while Home
 * stays compact.
 *
 * Accessibility: role="dialog" + aria-modal, focus moves to the close button on
 * open, Tab/Shift+Tab are trapped, Esc and backdrop close, focus is restored to
 * the invoking control, and page scroll is locked while open.
 *
 * The sheet stays mounted (hidden) when closed so its entry points keep stable
 * DOM ids for existing automated regression scripts.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';
import { AppIcon } from '../icons/AppIcon';
import './MoreSheet.css';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MoreSheet({ open, onClose, children }: MoreSheetProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => closeRef.current?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const target = returnFocusRef.current;
      if (target && document.contains(target)) {
        target.focus();
      }
    };
  }, [open, onClose]);

  return (
    <div className={`sda-sheet-root${open ? ' sda-sheet-root--open' : ''}`} hidden={!open}>
      <div className="sda-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id="sda-more-sheet"
        className="sda-sheet"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-labelledby="sda-more-title"
      >
        <div className="sda-sheet-grabber" aria-hidden="true" />
        <header className="sda-sheet-head">
          <h2 id="sda-more-title" className="sda-sheet-title">{t.more_title}</h2>
          <button
            ref={closeRef}
            id="btn-more-close"
            type="button"
            className="sda-icon-btn"
            onClick={onClose}
            aria-label={t.more_close}
          >
            <AppIcon name="x" size={20} />
          </button>
        </header>
        <div className="sda-sheet-body">{children}</div>
      </div>
    </div>
  );
}

export default MoreSheet;
