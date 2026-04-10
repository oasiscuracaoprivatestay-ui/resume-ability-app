import { useTranslation, LANGUAGE_LABELS } from '../i18n';
import type { Language } from '../i18n';

const LANGS: Language[] = ['en', 'es', 'nl'];

export default function LanguageSelector() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="lang-selector">
      {LANGS.map((l) => (
        <button
          key={l}
          className={`lang-btn${l === lang ? ' lang-btn--active' : ''}`}
          onClick={() => setLang(l)}
          aria-label={`Switch to ${l}`}
        >
          {LANGUAGE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
