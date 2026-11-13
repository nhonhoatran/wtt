import type { TiebreakCriterion } from '@kamito/shared';
import type { MatchContribution } from './group-match-scoring.js';
import { compareRatio, type Ratio } from './ratio-compare.js';

export interface EntryTotals {
  gamesFor: number;
  gamesAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TieContext {
  totals: ReadonlyMap<string, EntryTotals>;
  contributions: readonly MatchContribution[];
}

type Slice = { matchPoints: number; gamesFor: number; gamesAgainst: number; pointsFor: number; pointsAgainst: number };

/** Only matches among the tied entries count for head-to-head criteria. */
function headToHead(entryId: string, tieSet: ReadonlySet<string>, contributions: readonly MatchContribution[]): Slice {
  const slice: Slice = { matchPoints: 0, gamesFor: 0, gamesAgainst: 0, pointsFor: 0, pointsAgainst: 0 };
  for (const c of contributions) {
    if (!tieSet.has(c.entry1) || !tieSet.has(c.entry2)) continue;
    const isFirst = c.entry1 === entryId;
    if (!isFirst && c.entry2 !== entryId) continue;
    slice.matchPoints += isFirst ? c.matchPoints1 : c.matchPoints2;
    slice.gamesFor += isFirst ? c.games1 : c.games2;
    slice.gamesAgainst += isFirst ? c.games2 : c.games1;
    slice.pointsFor += isFirst ? c.points1 : c.points2;
    slice.pointsAgainst += isFirst ? c.points2 : c.points1;
  }
  return slice;
}

function valueOf(criterion: TiebreakCriterion, entryId: string, tieSet: ReadonlySet<string>, ctx: TieContext): Ratio {
  const total = ctx.totals.get(entryId) as EntryTotals;
  switch (criterion) {
    case 'HEAD_TO_HEAD_POINTS':
      return { num: headToHead(entryId, tieSet, ctx.contributions).matchPoints, den: 1 };
    case 'HEAD_TO_HEAD_GAME_RATIO': {
      const h = headToHead(entryId, tieSet, ctx.contributions);
      return { num: h.gamesFor, den: h.gamesAgainst };
    }
    case 'HEAD_TO_HEAD_POINT_RATIO': {
      const h = headToHead(entryId, tieSet, ctx.contributions);
      return { num: h.pointsFor, den: h.pointsAgainst };
    }
    case 'GAME_RATIO':
      return { num: total.gamesFor, den: total.gamesAgainst };
    case 'POINT_RATIO':
      return { num: total.pointsFor, den: total.pointsAgainst };
    case 'GAMES_WON':
      return { num: total.gamesFor, den: 1 };
    case 'DRAW_OF_LOTS':
      return { num: 0, den: 1 };
  }
}

/** Orders `tieSet` by one criterion, best first; entries with equal value stay together in one class. */
function splitByCriterion(criterion: TiebreakCriterion, tieSet: readonly string[], ctx: TieContext): string[][] {
  const members = new Set(tieSet);
  const scored = tieSet.map((id) => ({ id, value: valueOf(criterion, id, members, ctx) }));
  scored.sort((a, b) => compareRatio(b.value, a.value));
  const classes: string[][] = [];
  let previous: Ratio | undefined;
  for (const item of scored) {
    if (previous && compareRatio(previous, item.value) === 0) classes[classes.length - 1]?.push(item.id);
    else classes.push([item.id]);
    previous = item.value;
  }
  return classes;
}

/**
 * Returns blocks in rank order. A block with more than one entry could not be separated by any
 * criterion (DRAW_OF_LOTS is never resolved here: an admin orders it by hand).
 */
export function resolveTie(tieSet: readonly string[], criteria: readonly TiebreakCriterion[], ctx: TieContext): string[][] {
  if (tieSet.length <= 1) return [[...tieSet]];
  for (const criterion of criteria) {
    if (criterion === 'DRAW_OF_LOTS') break;
    const classes = splitByCriterion(criterion, tieSet, ctx);
    if (classes.length > 1) return classes.flatMap((subset) => resolveTie(subset, criteria, ctx));
  }
  return [[...tieSet]];
}
