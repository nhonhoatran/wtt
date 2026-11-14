import { normalizePersonName, PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';

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
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined;
}

export function parsePublicYear(raw: unknown): number | undefined {
  const value = Number(single(raw));
  return Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : undefined;
}

/** YYYY-MM-DD that is a real calendar date. */
export function parsePublicDate(raw: unknown): string | undefined {
  const value = single(raw);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T00:00:00Z`).toISOString().startsWith(value) ? value : undefined;
}

/** Plain text search; longer input is cut, not rejected. Returns the raw text and its normalized form. */
export function parsePublicSearch(raw: unknown): { text: string; normalized: string } | undefined {
  const value = single(raw)?.slice(0, PUBLIC_SEARCH_MAX_LENGTH);
  if (!value) return undefined;
  const normalized = normalizePersonName(value);
  return normalized ? { text: value, normalized } : undefined;
}

export const pageWindow = (page: number, pageSize: number) => ({ skip: (page - 1) * pageSize, take: pageSize });

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - at.getTime();
}

/** UTC instants bounding one calendar day in `timeZone`; offset taken at 12:00 UTC, so DST-switch days may be off by an hour. */
export function zonedDayRange(date: string, timeZone: string): { gte: Date; lt: Date } {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  const start = midnightUtc - zoneOffsetMs(new Date(midnightUtc + 12 * 3_600_000), timeZone);
  return { gte: new Date(start), lt: new Date(start + 24 * 3_600_000) };
}
