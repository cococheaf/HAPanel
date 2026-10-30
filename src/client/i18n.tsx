import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Languages } from 'lucide-react';
import {
  errorMessage,
  isLanguage,
  languages,
  resolveLanguage,
  translate,
  type Language,
  type LanguagePreference,
  type MessageKey,
  type MessageParams,
} from '../shared/i18n';

const storageKey = 'hapanel-language';
let memoryPreference: LanguagePreference = 'auto';
function readPreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'auto' || (saved && isLanguage(saved)) ? saved : 'auto';
  } catch {
    /* Private browsing may disable storage. */
  }
  return memoryPreference;
}
export function requestLanguage(): Language {
  const preference = readPreference();
  return preference === 'auto' ? resolveLanguage(navigator.languages) : preference;
}
type I18n = {
  language: Language;
  intlLocale: string;
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  describeError: (error: unknown) => string;
};
const Context = createContext<I18n | undefined>(undefined);
export function I18nProvider({
  children,
  page,
}: {
  children: ReactNode;
  page: 'studio' | 'display' | 'demo';
}) {
  const [preference, updatePreference] = useState<LanguagePreference>(readPreference);
  const [browserLanguages, setBrowserLanguages] = useState<readonly string[]>(navigator.languages);
  const language = preference === 'auto' ? resolveLanguage(browserLanguages) : preference;
  const value = useMemo<I18n>(
    () => ({
      language,
      preference,
      intlLocale: languages[language].intlLocale,
      setPreference: (next) => {
        memoryPreference = next;
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          /* Keep the choice for this session. */
        }
        updatePreference(next);
      },
      t: (key, params) => translate(language, key, params),
      describeError: (error) => errorMessage(error, language),
    }),
    [language, preference],
  );
  useEffect(() => {
    memoryPreference = preference;
    document.documentElement.lang = language;
    document.title = translate(language, `app.title.${page}`);
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(language, 'sample.subtitle'));
  }, [language, preference, page]);
  useEffect(() => {
    const browserChanged = () => setBrowserLanguages(navigator.languages);
    const stored = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) updatePreference(readPreference());
    };
    window.addEventListener('languagechange', browserChanged);
    window.addEventListener('storage', stored);
    return () => {
      window.removeEventListener('languagechange', browserChanged);
      window.removeEventListener('storage', stored);
    };
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('I18nProvider is missing.');
  return value;
}
export function LanguageSwitcher() {
  const { t, preference, setPreference, language } = useI18n();
  return (
    <label
      className="language-picker"
      title={`${t(preference === 'auto' ? 'language.automatic' : 'language.label')}: ${languages[language].name}`}
    >
      <Languages size={14} aria-hidden="true" />
      <select
        aria-label={t('language.label')}
        value={preference}
        onChange={(e) => setPreference(e.target.value as LanguagePreference)}
      >
        <option value="auto">{t('language.auto')}</option>
        {Object.entries(languages).map(([code, definition]) => (
          <option key={code} value={code}>
            {definition.name}
          </option>
        ))}
      </select>
    </label>
  );
}
