import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../icons/AppIcon';
import { useTranslation } from '../../i18n';
import type { AchievementKind } from '../../utils/achievementRewardsStorage';
import './MotivationalRewardCard.css';

export interface ShareAchievementModalProps {
  isOpen: boolean;
  kind: AchievementKind;
  onClose: () => void;
}

/**
 * Wraps text onto canvas lines cleanly without overflowing width.
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

async function renderShareCardBlob(params: {
  brand: string;
  genericTitle: string;
  genericMessage: string;
}): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base obsidian-emerald background fallback
  const baseGrad = ctx.createLinearGradient(0, 0, 0, H);
  baseGrad.addColorStop(0, '#0a261f');
  baseGrad.addColorStop(0.55, '#061713');
  baseGrad.addColorStop(1, '#040d0a');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  // Attempt to paint local scenic mountain image if available (100% same-origin local asset)
  try {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(W / img.width, H / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        ctx.drawImage(img, (W - drawW) / 2, (H - drawH) * 0.38, drawW, drawH);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = '/images/hero-atmosphere.jpg';
    });
  } catch {
    // Keep gradient background
  }

  // Dark Midnight Intelligence × Premium Wellness overlay scrim
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  scrim.addColorStop(0, 'rgba(4, 15, 12, 0.50)');
  scrim.addColorStop(0.5, 'rgba(5, 22, 18, 0.82)');
  scrim.addColorStop(1, 'rgba(4, 13, 11, 0.96)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  // Subtle gold inner frame
  ctx.strokeStyle = 'rgba(245, 196, 81, 0.42)';
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // Brand header
  ctx.fillStyle = '#fde68a';
  ctx.font = '800 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(params.brand, 96, 132);

  // Generic Title (strictly non-sensitive)
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 64px system-ui, -apple-system, sans-serif';
  const nextY = drawWrappedText(ctx, params.genericTitle, 96, 680, W - 192, 78);

  // Generic Motivational Message
  ctx.fillStyle = '#d7ebe4';
  ctx.font = '500 38px system-ui, -apple-system, sans-serif';
  drawWrappedText(ctx, params.genericMessage, 96, nextY + 24, W - 192, 52);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

/**
 * Privacy-by-Default Share My Achievement Dialog (Phase 5C.2 — Section 6).
 *
 * Strictly excludes name, weight, waist/fat-loss measurements, meal/fasting schedules,
 * slip details, personal notes, medical/glucose data, and private statistics.
 * Never uploads data externally or publishes automatically.
 */
export const ShareAchievementModal: React.FC<ShareAchievementModalProps> = ({
  isOpen,
  kind,
  onClose,
}) => {
  const { t } = useTranslation();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showManualCopyBox, setShowManualCopyBox] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const manualCopyRef = useRef<HTMLTextAreaElement | null>(null);

  const canUseWebShare = useMemo(() => {
    void isOpen;
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }, [isOpen]);

  const sanitizedCopy = useMemo(() => {
    if (kind === 'resume') {
      return {
        title: t.rw_share_generic_title_resume,
        message: t.rw_share_generic_msg_resume,
      };
    }
    if (kind === 'repledge') {
      return {
        title: t.rw_share_generic_title_repledge,
        message: t.rw_share_generic_msg_repledge,
      };
    }
    if (kind === 'milestone_90d') {
      return {
        title: t.rw_share_generic_title_milestone,
        message: t.rw_share_generic_msg_milestone,
      };
    }
    return {
      title: t.rw_share_generic_title_challenge,
      message: t.rw_share_generic_msg_challenge,
    };
  }, [kind, t]);

  const plainShareText = useMemo(() => {
    return `${t.rw_share_brand} — ${sanitizedCopy.title}\n${sanitizedCopy.message}`;
  }, [sanitizedCopy, t.rw_share_brand]);

  useEffect(() => {
    if (!isOpen) {
      setStatusMessage(null);
      setShowManualCopyBox(false);
      return;
    }
    const prev = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      if (prev && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    setStatusMessage(null);
    try {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        setStatusMessage(t.rw_share_status_error);
        return;
      }
      await navigator.share({
        title: `${t.rw_share_brand} — ${sanitizedCopy.title}`,
        text: plainShareText,
      });
      setStatusMessage(t.rw_share_status_shared);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        return;
      }
      setStatusMessage(t.rw_share_status_error);
    }
  };

  const handleCopyText = async () => {
    setStatusMessage(null);
    let copied = false;

    // 1. Attempt synchronous selection copy first while transient user activation is active
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = plainShareText;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, plainShareText.length);
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }

    // 2. Also write via modern Async Clipboard API when supported
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(plainShareText);
        copied = true;
      } catch {
        // Keep synchronous result if async clipboard permission is restricted
      }
    }

    if (copied) {
      setShowManualCopyBox(false);
      setStatusMessage(t.rw_share_status_copied);
    } else {
      setShowManualCopyBox(true);
      setStatusMessage(t.rw_share_status_copied);
      setTimeout(() => {
        manualCopyRef.current?.focus();
        manualCopyRef.current?.select();
      }, 20);
    }
  };

  const handleDownloadCard = async () => {
    setStatusMessage(null);
    try {
      const blob = await renderShareCardBlob({
        brand: t.rw_share_brand,
        genericTitle: sanitizedCopy.title,
        genericMessage: sanitizedCopy.message,
      });
      if (!blob || typeof document === 'undefined') {
        setStatusMessage(t.rw_share_status_error);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'super-diet-ability-achievement.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMessage(t.rw_share_status_downloaded);
    } catch {
      setStatusMessage(t.rw_share_status_error);
    }
  };

  return (
    <div
      className="sda-share-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="modal-share-achievement"
        className="sda-share-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="heading-share-achievement"
      >
        <div className="sda-share-modal-head">
          <h3 className="sda-share-modal-title" id="heading-share-achievement">
            {t.rw_share_modal_title}
          </h3>
          <button
            ref={closeBtnRef}
            type="button"
            id="btn-close-share-modal"
            className="sda-share-close-btn"
            aria-label={t.anim_dismiss_aria}
            onClick={onClose}
          >
            <AppIcon name="x" size={16} />
          </button>
        </div>

        <span className="sda-share-preview-eyebrow">{t.rw_share_preview_label}</span>

        {/* Strictly Sanitized Share Card Preview */}
        <div className="sda-share-preview-card" id="share-achievement-preview-card">
          <div className="sda-share-preview-bg" aria-hidden="true" />
          <div className="sda-share-preview-scrim" aria-hidden="true" />

          <div className="sda-share-brand-row">
            <span className="sda-share-brand-badge" aria-hidden="true">
              <AppIcon name="award" size={15} />
            </span>
            <span className="sda-share-brand-text" id="share-preview-brand">
              {t.rw_share_brand}
            </span>
          </div>

          <div className="sda-share-preview-copy">
            <h4 className="sda-share-preview-heading" id="share-preview-title">
              {sanitizedCopy.title}
            </h4>
            <p className="sda-share-preview-msg" id="share-preview-message">
              {sanitizedCopy.message}
            </p>
          </div>
        </div>

        <div className="sda-share-privacy-banner" id="share-privacy-guarantee">
          <span className="sda-share-privacy-icon" aria-hidden="true">
            <AppIcon name="lock" size={15} />
          </span>
          <span>{t.rw_share_privacy_note}</span>
        </div>

        {statusMessage && (
          <p className="sda-share-status" id="share-feedback-status" role="status" aria-live="polite">
            {statusMessage}
          </p>
        )}

        {showManualCopyBox && (
          <textarea
            ref={manualCopyRef}
            id="share-manual-copy-box"
            className="sda-reward-note-textarea"
            rows={2}
            readOnly
            value={plainShareText}
            aria-label={t.rw_share_btn_copy}
            onFocus={(e) => e.currentTarget.select()}
          />
        )}

        <div className="sda-share-actions">
          {canUseWebShare && (
            <button
              type="button"
              id="btn-share-native"
              className="sda-share-action-btn sda-share-action-btn--primary"
              onClick={handleNativeShare}
            >
              <AppIcon name="external-link" size={16} />
              <span>{t.rw_share_btn_native}</span>
            </button>
          )}

          <button
            type="button"
            id="btn-share-copy-text"
            className={`sda-share-action-btn ${
              canUseWebShare
                ? 'sda-share-action-btn--secondary'
                : 'sda-share-action-btn--primary'
            }`}
            onClick={handleCopyText}
          >
            <AppIcon name="clipboard-list" size={16} />
            <span>{t.rw_share_btn_copy}</span>
          </button>

          <button
            type="button"
            id="btn-share-download-png"
            className="sda-share-action-btn sda-share-action-btn--secondary"
            onClick={handleDownloadCard}
          >
            <AppIcon name="download" size={16} />
            <span>{t.rw_share_btn_download}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
