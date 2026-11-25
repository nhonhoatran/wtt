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

// Calendar dates (YYYY-MM-DD) carry no zone; formatting them in UTC keeps the day as written.
const dayFormat = (locale: Locale, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: 'UTC', ...opts });

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** "12/03 – 15/03/2026"; one day prints once. */
export function formatDateRange(start: string, end: string, locale: Locale): string {
  const full = dayFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (start === end) return full.format(asDate(start));
  const short = dayFormat(locale, { day: '2-digit', month: '2-digit' });
  return `${(start.slice(0, 4) === end.slice(0, 4) ? short : full).format(asDate(start))} – ${full.format(asDate(end))}`;
}

/** "Tháng 3 năm 2026" / "March 2026" from YYYY-MM. */
export function formatMonth(month: string, locale: Locale): string {
  return dayFormat(locale, { month: 'long', year: 'numeric' }).format(asDate(`${month}-01`));
}

/** Short day label for a date chooser: "T7 14/11" / "Sat 14/11". */
export function formatDay(day: string, locale: Locale): string {
  return dayFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit' }).format(asDate(day));
}

/** Full calendar date, independent of the server's time zone. */
export function formatFullDate(day: string, locale: Locale): string {
  return dayFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(asDate(day));
}

/** "14/03": day and month of a calendar date (YYYY-MM-DD), independent of the server time zone. */
export function formatShortDay(day: string, locale: Locale): string {
  const parts = dayFormat(locale, { day: '2-digit', month: '2-digit' }).formatToParts(asDate(day));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}`;
}

/** "14:30" in the event time zone. */
export function formatClock(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "14/03/2027" of an instant, read in the event time zone. */
export function formatInstantDate(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}
