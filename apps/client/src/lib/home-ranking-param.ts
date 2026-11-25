/** Picks the ranking tab from `?ranking=`; unknown, repeated or missing values fall back to the first list. */
export function pickHomeRanking<T extends { list: { code: string } }>(items: T[], param: string | string[] | undefined): T | null {
  if (items.length === 0) return null;
  const code = typeof param === 'string' ? param : '';
  return items.find((item) => item.list.code === code) ?? items[0]!;
}
