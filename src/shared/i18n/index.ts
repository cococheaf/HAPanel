import en from './locales/en.json';
import de from './locales/de.json';

export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;
type Catalog = Record<MessageKey, string>;

/** Register additional, complete catalogs here; language controls use this registry. */
export const languages = {
  de: { name: 'Deutsch', intlLocale: 'de-AT', messages: de satisfies Catalog },
  en: { name: 'English', intlLocale: 'en-GB', messages: en satisfies Catalog },
};
export type Language = keyof typeof languages;
export type LanguagePreference = Language | 'auto';
export const fallbackLanguage: Language = 'en';
export function isLanguage(value: string): value is Language {
  return Object.hasOwn(languages, value);
}
export function isMessageKey(value: string): value is MessageKey {
  return Object.hasOwn(en, value);
}
/** Accept browser language lists or an HTTP Accept-Language header. */
export function resolveLanguage(input: string | readonly string[] | undefined): Language {
  const candidates = (typeof input === 'string' ? input.split(',') : (input ?? []))
    .map((value, index) => {
      const [tag, ...parameters] = value.trim().split(';');
      const quality = parameters.find((p) => p.trim().startsWith('q='));
      return {
        tag: tag.trim().toLowerCase().split('-')[0],
        quality: quality ? Number(quality.trim().slice(2)) : 1,
        index,
      };
    })
    .filter((item) => Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return (candidates.find((item) => isLanguage(item.tag))?.tag as Language) ?? fallbackLanguage;
}
export function translate(language: Language, key: MessageKey, params: MessageParams = {}) {
  const message: string = languages[language]?.messages[key] ?? en[key];
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}
export class UserError extends Error {
  constructor(
    public messageKey: MessageKey,
    public params: MessageParams = {},
  ) {
    super(translate(fallbackLanguage, messageKey, params));
  }
}
export function validationMessage(
  issue: { message: string; path?: readonly PropertyKey[] },
  language: Language,
) {
  return isMessageKey(issue.message)
    ? translate(language, issue.message)
    : translate(language, 'error.invalidField', {
        path: issue.path?.map(String).join('.') || 'document',
      });
}
export function errorMessage(error: unknown, language: Language): string {
  if (error && typeof error === 'object') {
    if ('issues' in error && Array.isArray(error.issues))
      return error.issues
        .slice(0, 3)
        .map((issue) => validationMessage(issue, language))
        .join(' ');
    if (
      'messageKey' in error &&
      typeof error.messageKey === 'string' &&
      isMessageKey(error.messageKey)
    )
      return translate(
        language,
        error.messageKey,
        'params' in error ? (error.params as MessageParams) : {},
      );
    if ('message' in error && typeof error.message === 'string') return error.message;
  }
  return translate(language, 'error.requestFailed');
}
