import { useEffect, useState } from 'react';

/**
 * Reactive accessibility hook for `prefers-reduced-motion: reduce`.
 * When true, celebration components skip expanding rings and particle bursts
 * and present an immediate, high-contrast static confirmation state.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (document.documentElement.classList.contains('sda-force-reduced-motion')) {
      return true;
    }
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      const forced = document.documentElement.classList.contains('sda-force-reduced-motion');
      setReduced(forced || mq.matches);
    };

    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(update);
    }

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      if (typeof mq.removeEventListener === 'function') {
        mq.removeEventListener('change', update);
      } else if (typeof mq.removeListener === 'function') {
        mq.removeListener(update);
      }
      observer.disconnect();
    };
  }, []);

  return reduced;
}
