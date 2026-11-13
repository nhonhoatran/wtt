import {
  isCountedGroupMatch,
  scoreMatch,
  type GroupMatchInput,
  type GroupScoringRuleInput,
  type MatchFormatInput,
} from './group-match-scoring.js';
import { resolveTie, type EntryTotals } from './tiebreak-resolvers.js';
import { DrawParamsError } from './types.js';

export interface GroupStandingsInput {
  entryIds: readonly string[];
  /** Every match of the group, finished or not; completeness decides `qualified`. */
  matches: readonly GroupMatchInput[];
  rule: GroupScoringRuleInput;
  format: MatchFormatInput;
  advancePerGroup: number;
  /** Absolute group ranks an admin set by hand; kept only while the tie they settle is unchanged. */
  manualRanks?: Readonly<Record<string, number>>;
  /** Withdrawn entries keep their rank for display but never qualify; the slot passes to the next eligible entry. */
  withdrawnEntryIds?: readonly string[];
}

export interface GroupStandingRow extends EntryTotals {
  entryId: string;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  /** Tied entries that no criterion separates share the best rank of their block until resolved by hand. */
  rank: number;
  qualified: boolean;
  needsManualTiebreak: boolean;
  manualRank: number | null;
}

export interface GroupStandingsResult {
  rows: GroupStandingRow[];
  /** True when every non-voided match of the group is OFFICIAL. */
  complete: boolean;
}

function emptyRow(entryId: string): GroupStandingRow {
  return {
    entryId,
    played: 0,
    won: 0,
    lost: 0,
    matchPoints: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    rank: 0,
    qualified: false,
    needsManualTiebreak: false,
    manualRank: null,
  };
}

/** A hand-made order is valid when every tied entry has a distinct rank covering exactly the block's positions. */
function manualOrder(block: readonly string[], firstPosition: number, manual: Readonly<Record<string, number>>): string[] | null {
  const ranks = block.map((id) => manual[id]);
  const expected = Array.from({ length: block.length }, (_, i) => firstPosition + i);
  if (ranks.some((r) => r === undefined)) return null;
  const sorted = [...(ranks as number[])].sort((a, b) => a - b);
  if (sorted.some((rank, i) => rank !== expected[i])) return null;
  return [...block].sort((a, b) => (manual[a] as number) - (manual[b] as number));
}

/** Pure; always recomputes from scratch. */
export function calculateGroupStandings(input: GroupStandingsInput): GroupStandingsResult {
  const { entryIds, matches, rule, format, advancePerGroup, manualRanks = {}, withdrawnEntryIds = [] } = input;
  const withdrawn = new Set(withdrawnEntryIds);
  if (new Set(entryIds).size !== entryIds.length) throw new DrawParamsError('INVALID_PARAMS', 'Duplicate entry in group');
  const rows = new Map(entryIds.map((id) => [id, emptyRow(id)]));
  const rowOf = (id: string) => {
    const row = rows.get(id);
    if (!row) throw new DrawParamsError('INVALID_MATCH_DATA', `Match references entry ${id} outside the group`);
    return row;
  };

  const contributions = matches.filter(isCountedGroupMatch).map((m) => scoreMatch(m, rule, format));
  const apply = (id: string, won: boolean, gf: number, ga: number, pf: number, pa: number, matchPoints: number) => {
    const row = rowOf(id);
    row.played++;
    if (won) row.won++;
    else row.lost++;
    row.matchPoints += matchPoints;
    row.gamesFor += gf;
    row.gamesAgainst += ga;
    row.pointsFor += pf;
    row.pointsAgainst += pa;
  };
  for (const c of contributions) {
    apply(c.entry1, c.winner === c.entry1, c.games1, c.games2, c.points1, c.points2, c.matchPoints1);
    apply(c.entry2, c.winner === c.entry2, c.games2, c.games1, c.points2, c.points1, c.matchPoints2);
  }

  const complete = matches.filter((m) => !m.isVoided && m.resultType !== 'BYE').every((m) => m.status === 'OFFICIAL');
  const ctx = { totals: rows as ReadonlyMap<string, EntryTotals>, contributions };

  const byPoints = new Map<number, string[]>();
  for (const id of entryIds) {
    const points = rowOf(id).matchPoints;
    byPoints.set(points, [...(byPoints.get(points) ?? []), id]);
  }
  const ordered: GroupStandingRow[] = [];
  for (const points of [...byPoints.keys()].sort((a, b) => b - a)) {
    for (const block of resolveTie(byPoints.get(points) as string[], rule.tiebreakers, ctx)) {
      const firstPosition = ordered.length + 1;
      const manual = block.length > 1 ? manualOrder(block, firstPosition, manualRanks) : null;
      (manual ?? block).forEach((id) => {
        const row = rowOf(id);
        row.rank = manual ? (manualRanks[id] as number) : firstPosition;
        row.manualRank = manual ? (manualRanks[id] as number) : null;
        row.needsManualTiebreak = block.length > 1 && !manual;
        ordered.push(row);
      });
    }
  }

  let eligibleSoFar = 0;
  for (const row of ordered) {
    if (withdrawn.has(row.entryId)) continue;
    eligibleSoFar++;
    row.qualified = complete && !row.needsManualTiebreak && eligibleSoFar <= advancePerGroup;
  }
  return { rows: ordered, complete };
}
