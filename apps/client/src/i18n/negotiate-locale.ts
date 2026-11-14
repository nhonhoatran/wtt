import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

export const LOCALE_COOKIE = 'locale';

/** Cookie (set by the language switcher) wins, then the first supported Accept-Language entry by weight. */
export function negotiateLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (cookie && isLocale(cookie)) return cookie;
  const ranked = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { lang: tag.toLowerCase().split('-')[0] ?? '', q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((entry) => entry.lang && Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.lang).find(isLocale) ?? DEFAULT_LOCALE;
}
