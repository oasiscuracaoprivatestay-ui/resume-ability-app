import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Language, Translations } from './types';
import { en } from './en';
import { es } from './es';
import { nl } from './nl';

// ── All locales ──
const LOCALES: Record<Language, Translations> = { en, es, nl };

// ── Persistence ──
const LANG_KEY = 'resume-ability-lang';

function loadLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'es' || saved === 'nl') return saved;
  } catch { /* ignore */ }
  return 'en';
}

function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch { /* ignore */ }
}

// ── Context ──
interface LanguageContextValue {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: en,
  setLang: () => {},
});

// ── Provider ──
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(loadLanguage);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    saveLanguage(newLang);
  }, []);

  const t = LOCALES[lang];

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──
export function useTranslation() {
  return useContext(LanguageContext);
}
