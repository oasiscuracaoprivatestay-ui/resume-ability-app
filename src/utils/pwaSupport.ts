/**
 * PWA Support & Installation Helpers — Phase 14
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

// Register install prompt listener if in browser
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((fn) => fn(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  });
}

/**
 * Check if the application is running in standalone mode (installed PWA).
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS Safari
  if ((navigator as unknown as { standalone?: boolean }).standalone) {
    return true;
  }

  // Standard display-mode query
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Check if device is iOS (iPhone, iPad, iPod).
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Check if the browser currently supports and allows triggering the PWA install prompt.
 */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null && !isStandaloneMode();
}

/**
 * Trigger the native PWA install prompt if available.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
    return choice.outcome === 'accepted';
  } catch (err) {
    console.warn('PWA install prompt error:', err);
    return false;
  }
}

/**
 * Subscribe to changes in install prompt availability.
 */
export function subscribeToInstallPrompt(callback: (canInstall: boolean) => void): () => void {
  installListeners.add(callback);
  callback(canPromptInstall());
  return () => {
    installListeners.delete(callback);
  };
}
