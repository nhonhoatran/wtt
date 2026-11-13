import type { Locale } from './locales';

/**
 * Public fields with an English column fall back to Vietnamese when it is empty.
 * Language-neutral fields (codes, numbers, scores, club names) are rendered as stored.
 */
export function pickLocalized(locale: Locale, vi: string, en: string | null | undefined): string {
  return locale === 'en' && en ? en : vi;
}
