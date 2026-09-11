/**
 * Central Sound & Haptic Feedback Engine (Phase 17)
 *
 * Provides subtle, optional auditory and tactile reinforcement for meaningful positive actions.
 * - Awareness, successful check-ins, commitments, and recoveries.
 * - Never harsh, punishing, or game-arcade-like.
 * - Fails silently if Web Audio or navigator.vibrate are blocked or unsupported.
 * - Reads preferences from feedbackSettingsStorage.
 */

import { isSoundEnabled, isHapticsEnabled } from './feedbackSettingsStorage';

export type FeedbackType = 'check-in' | 'win' | 'commit' | 'recovery' | 'neutral';

// Shared AudioContext instance (initialized lazily upon user interaction)
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    } catch {
      sharedAudioCtx = null;
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes a soft, warm procedural tone using Web Audio API.
 */
function playTone(
  frequencies: { freq: number; duration: number; delay?: number }[],
  options: { type?: OscillatorType; gainPeak?: number } = {},
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    const peak = options.gainPeak ?? 0.14;
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.connect(ctx.destination);

    frequencies.forEach(({ freq, duration, delay = 0 }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = options.type ?? 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      const startTime = ctx.currentTime + delay;
      const endTime = startTime + duration;

      noteGain.gain.setValueAtTime(0.001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(peak, startTime + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(endTime);
    });
  } catch {
    // Fail silently without disrupting user interaction
  }
}

/**
 * Triggers subtle vibration pattern if supported and enabled.
 */
function triggerHaptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Fail silently
  }
}

/**
 * Plays sound and haptic feedback for a specific action type.
 * Respects user preferences.
 */
export function playFeedback(type: FeedbackType): void {
  const soundOn = isSoundEnabled();
  const hapticsOn = isHapticsEnabled();

  switch (type) {
    case 'check-in':
      // Soft, warm confirmation tone (C5 gently floating to G5)
      if (soundOn) {
        playTone(
          [
            { freq: 523.25, duration: 0.28, delay: 0 },
            { freq: 659.25, duration: 0.32, delay: 0.08 },
          ],
          { type: 'sine', gainPeak: 0.12 },
        );
      }
      if (hapticsOn) {
        triggerHaptic(30);
      }
      break;

    case 'win':
      // Uplifting, gentle rising two-note chime
      if (soundOn) {
        playTone(
          [
            { freq: 587.33, duration: 0.25, delay: 0 },
            { freq: 880.0, duration: 0.35, delay: 0.1 },
          ],
          { type: 'sine', gainPeak: 0.15 },
        );
      }
      if (hapticsOn) {
        triggerHaptic([35, 45, 35]);
      }
      break;

    case 'commit':
      // Grounded, resonant confirmation tone
      if (soundOn) {
        playTone(
          [
            { freq: 392.0, duration: 0.3, delay: 0 },
            { freq: 523.25, duration: 0.38, delay: 0.07 },
          ],
          { type: 'sine', gainPeak: 0.16 },
        );
      }
      if (hapticsOn) {
        triggerHaptic(45);
      }
      break;

    case 'recovery':
      // Warm upward progression suggesting return / fresh momentum
      if (soundOn) {
        playTone(
          [
            { freq: 440.0, duration: 0.2, delay: 0 },
            { freq: 554.37, duration: 0.22, delay: 0.08 },
            { freq: 659.25, duration: 0.35, delay: 0.16 },
          ],
          { type: 'sine', gainPeak: 0.13 },
        );
      }
      if (hapticsOn) {
        triggerHaptic([30, 40, 50]);
      }
      break;

    case 'neutral':
      // Minimal soft tap sound
      if (soundOn) {
        playTone([{ freq: 600, duration: 0.12 }], { type: 'sine', gainPeak: 0.08 });
      }
      if (hapticsOn) {
        triggerHaptic(20);
      }
      break;
  }
}
