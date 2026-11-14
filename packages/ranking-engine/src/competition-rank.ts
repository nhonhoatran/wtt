export interface RankCandidate {
  playerId: string;
  total: number;
  counted: number;
  fullName: string;
}

export interface RankedCandidate extends RankCandidate {
  rank: number;
}

const nameCollator = new Intl.Collator('vi');

/** Competition ranking (1, 2, 2, 4); counted and name only fix the display order of equal totals. */
export function competitionRank(items: RankCandidate[]): RankedCandidate[] {
  const sorted = [...items].sort(
    (a, b) => b.total - a.total || a.counted - b.counted || nameCollator.compare(a.fullName, b.fullName),
  );
  let rank = 0;
  return sorted.map((item, index) => {
    if (index === 0 || item.total !== sorted[index - 1]!.total) rank = index + 1;
    return { ...item, rank };
  });
}
