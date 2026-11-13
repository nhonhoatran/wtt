import type { Locale } from '../i18n/locales';

const INTL_LOCALE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };

/** Short "dd/MM HH:mm" in the event's own time zone, whatever zone the server runs in. */
export function formatMatchTime(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}
