import type { Locale } from './locales';

/**
 * Public fields with an English column fall back to Vietnamese when it is empty:
 *   event name / summary / infoBody, sub-event name, tier, event type, venue, player name, image alt text.
 * Declared language-neutral and rendered as stored: codes, numbers, scores, dates, club, city,
 *   event short name and "presented by" (proper names).
 */
export function pickLocalized(locale: Locale, vi: string, en: string | null | undefined): string {
  return locale === 'en' && en ? en : vi;
}

export function pickLocalizedOrNull(locale: Locale, vi: string | null, en: string | null | undefined): string | null {
  return vi === null ? (locale === 'en' && en ? en : null) : pickLocalized(locale, vi, en);
}
