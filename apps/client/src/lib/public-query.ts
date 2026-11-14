/** A query value is kept only when its rule accepts it. */
export type QueryRules = Record<string, (value: string) => boolean>;

/**
 * Only values the API would act on reach the cached fetch, in a stable key order, so a bot
 * cannot mint one cache entry per made-up value (Next's file cache has no size limit).
 */
export function toQuery(params: Record<string, string | string[] | undefined>, rules: QueryRules): string {
  const search = new URLSearchParams();
  for (const [key, accept] of Object.entries(rules)) {
    const value = params[key];
    if (typeof value === 'string' && value.trim() && accept(value.trim())) search.set(key, value.trim());
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const oneOf = (values: readonly string[]) => (value: string) => values.includes(value);
export const anyText = () => true;
export const isPageParam = (value: string) => /^[1-9]\d{0,3}$/.test(value);
/** Same range the API accepts (parsePublicYear). */
export const isYearParam = (value: string) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;
