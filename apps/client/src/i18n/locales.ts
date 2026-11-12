// Locales are tied to translation files shipped in code, so the list is fixed here on purpose.
export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
