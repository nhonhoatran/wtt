import { normalizePersonName, PUBLIC_SEARCH_MAX_LENGTH, PUBLIC_URL_PART_PATTERN } from '@kamito/shared';

/**
 * Public query strings come straight from visitors' URLs, so a malformed value is ignored (treated as absent)
 * instead of answering 400: the page still renders and stays cacheable. Repeated keys arrive as arrays and are dropped.
 */
const single = (raw: unknown): string | undefined => (typeof raw === 'string' && raw.trim() ? raw.trim() : undefined);

const PAGE_MAX = 10_000;

export function parsePublicPage(raw: unknown): number {
  const value = Number(single(raw));
  return Number.isInteger(value) && value >= 1 && value <= PAGE_MAX ? value : 1;
}

/** Key of `map` (e.g. 'main' → 'MAIN'), or undefined. Own keys only, so `toString` never matches. */
export function parsePublicChoice<T extends Record<string, string>>(raw: unknown, map: T): T[keyof T] | undefined {
  const value = single(raw);
  return value !== undefined && Object.hasOwn(map, value) ? map[value as keyof T] : undefined;
}

export function parsePublicCode(raw: unknown): string | undefined {
  const value = single(raw);
  return value && PUBLIC_URL_PART_PATTERN.test(value) ? value : undefined;
}

export function parsePublicYear(raw: unknown): number | undefined {
  const value = Number(single(raw));
  return Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : undefined;
}

/** YYYY-MM-DD that is a real calendar date. */
export function parsePublicDate(raw: unknown): string | undefined {
  const value = single(raw);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : undefined;
}

/** Plain text search; longer input is cut, not rejected. Returns the raw text and its normalized form. */
export function parsePublicSearch(raw: unknown): { text: string; normalized: string } | undefined {
  const value = single(raw)?.slice(0, PUBLIC_SEARCH_MAX_LENGTH);
  if (!value) return undefined;
  const normalized = normalizePersonName(value);
  return normalized ? { text: value, normalized } : undefined;
}

export const pageWindow = (page: number, pageSize: number) => ({ skip: (page - 1) * pageSize, take: pageSize });

/** Independent local-date boundaries handle short/long DST days, midnight gaps and skipped calendar dates. */
export function zonedDayRange(date: string, timeZone: string): { gte: Date; lt: Date } {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const boundary = (day: string): Date => {
    const utc = Date.parse(`${day}T00:00:00Z`);
    // Technical bracket wider than any IANA UTC offset, including a full calendar-date skip.
    let low = utc - 48 * 3_600_000;
    let high = utc + 48 * 3_600_000;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (formatter.format(new Date(mid)) < day) low = mid;
      else high = mid;
    }
    return new Date(high);
  };
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { gte: boundary(date), lt: boundary(next) };
}
