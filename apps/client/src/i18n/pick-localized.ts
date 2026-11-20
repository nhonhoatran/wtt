import type { Locale } from './locales';

/**
 * Public fields with an English column fall back to Vietnamese when it is empty:
 *   event name / summary / infoBody, sub-event name, tier, event type, venue/session name,
 *   player name/bio, ranking list/category names, article title/summary/body/category,
 *   video title/duration label, static-page title/body/footer group, sponsor role, image alt text.
 * News filter values stay unchanged; their English labels come from news.categoryLabelsEn.
 * Declared language-neutral and rendered as stored: identifiers/codes (including custom stage codes),
 *   numbers, scores, timestamps formatted for the locale, URLs, country codes, club, city,
 *   event short name, "presented by", sponsor and author names (proper names).
 */
export function pickLocalized(locale: Locale, vi: string, en: string | null | undefined): string {
  return locale === 'en' && en ? en : vi;
}

export function pickLocalizedOrNull(locale: Locale, vi: string | null, en: string | null | undefined): string | null {
  return vi === null ? (locale === 'en' && en ? en : null) : pickLocalized(locale, vi, en);
}
