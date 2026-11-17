import { PUBLIC_SEARCH_MAX_LENGTH } from '@kamito/shared';

/** A query value is kept only when its rule accepts it. */
export type QueryRules = Record<string, (value: string) => boolean>;

/**
 * Only values the API would act on reach the cached fetch, in a stable key order, so a bot
 * cannot mint one cached response per made-up value in the shared public cache.
 */
export function toQuery(params: Record<string, string | string[] | undefined>, rules: QueryRules): string {
  const search = new URLSearchParams();
  for (const [key, accept] of Object.entries(rules)) {
    const raw = params[key];
    if (typeof raw !== 'string') continue;
    const value = key === 'q' ? raw.trim().slice(0, PUBLIC_SEARCH_MAX_LENGTH) : raw.trim();
    if (value && accept(value)) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const oneOf = (values: readonly string[]) => (value: string) => values.includes(value);
export const anyText = () => true;
export const isPageParam = (value: string) => /^[1-9]\d{0,3}$/.test(value);
/** Same range the API accepts (parsePublicYear). */
export const isYearParam = (value: string) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;

/** Real calendar dates only, bounded by the event rather than by a rendered list of options. */
export const dateWithin = (start: string, end: string) => (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < start || value > end) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
