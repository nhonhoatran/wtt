import { useCatalogRows } from '../../resources/events/use-catalog-options';
import type { SubEventRecord } from './sub-event-labels';

export type CompetitorKind = SubEventRecord['discipline']['competitorKind'];
export type DisciplineGenderRule = SubEventRecord['discipline']['genderRule'];

export interface RankingListOption {
  id: string;
  code: string;
  name: string;
  competitorKind: CompetitorKind;
  genderRule: DisciplineGenderRule;
  categoryId: string | null;
}

/** What a sub-event is about to be: the three attributes that decide which ranking list fits it. */
export interface RankingListTarget {
  kind: CompetitorKind;
  genderRule: DisciplineGenderRule;
  categoryId: string | null;
}

/** Every active ranking list of one singles/doubles kind (the catalog is small). */
export function useRankingListOptions(kind: CompetitorKind | null) {
  const query = useCatalogRows('ranking-lists', { competitorKind: kind ?? '' }, kind !== null);
  return { ...query, data: query.data as unknown as RankingListOption[] | undefined };
}

/** The single list matching every target, or null when none or several (or different) lists fit. */
export function suggestRankingListId(rows: RankingListOption[], targets: RankingListTarget[]): string | null {
  const ids = new Set(
    targets.map((target) => {
      const fits = rows.filter((row) => row.genderRule === target.genderRule && row.categoryId === target.categoryId);
      return fits.length === 1 ? fits[0]!.id : null;
    }),
  );
  const only = [...ids];
  return only.length === 1 ? only[0]! : null;
}
