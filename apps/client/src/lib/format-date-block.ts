import type { Locale } from '../i18n/locales';

const INTL_LOCALE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };

const part = (day: string, locale: Locale, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: 'UTC', ...opts }).format(new Date(`${day}T00:00:00Z`));

/**
 * Text of a date tile: "12–16" over "thg 3 2027". Day numbers come from the calendar strings,
 * so the server's time zone cannot shift them. Spans over months or years name both ends.
 */
export function formatDateBlock(start: string, end: string, locale: Locale): { days: string; period: string } {
  const startMonth = part(start, locale, { month: 'short' });
  const endMonth = part(end, locale, { month: 'short' });
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const startDay = start.slice(8, 10);
  const endDay = end.slice(8, 10);
  if (start === end) return { days: startDay, period: `${startMonth} ${startYear}` };
  const days = `${startDay}–${endDay}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return { days, period: `${startMonth} ${startYear}` };
  if (startYear === endYear) return { days, period: `${startMonth} – ${endMonth} ${startYear}` };
  return { days, period: `${startMonth} ${startYear} – ${endMonth} ${endYear}` };
}
