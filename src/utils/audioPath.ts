import type { Language } from '../i18n';

/**
 * Construct a language-specific audio file path from a base English path.
 *
 * Convention:
 *   EN:  /audio/motivation-1.mp3        (base — unchanged)
 *   ES:  /audio/motivation-1-es.mp3     (suffix before extension)
 *   NL:  /audio/motivation-1-nl.mp3     (suffix before extension)
 *
 * If the path is empty (e.g. premium placeholder), returns it as-is.
 *
 * The useAudio hook's fetch-first strategy handles fallback:
 * if the localized file doesn't exist, the caller should fall back
 * to the English version.
 */
export function localizeAudioPath(basePath: string, lang: Language): string {
  if (!basePath || lang === 'en') return basePath;
  const dotIndex = basePath.lastIndexOf('.');
  if (dotIndex === -1) return basePath;
  const stem = basePath.slice(0, dotIndex);
  const ext = basePath.slice(dotIndex);
  return `${stem}-${lang}${ext}`;
}
