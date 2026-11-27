import type { MatchListItem } from '../results/match-types';

export type ScheduleDiscipline = NonNullable<MatchListItem['discipline']>;

/** Catalog colors decorate borders/swatches; invalid or absent values keep the theme's neutral color. */
export function scheduleDisciplineColor(value: string | null | undefined): string | undefined {
  return value && /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
}

export function scheduleDisciplineLegend(matches: readonly Pick<MatchListItem, 'discipline'>[]): ScheduleDiscipline[] {
  const unique = new Map<string, ScheduleDiscipline>();
  for (const match of matches) if (match.discipline) unique.set(match.discipline.id, match.discipline);
  return [...unique.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
}
