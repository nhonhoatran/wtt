import type { PlaceholderRef } from './types.js';

export interface ImpactMatch {
  id: string;
  matchNo: number;
  status: 'SCHEDULED' | 'LIVE' | 'OFFICIAL';
  resultType: string | null;
  winnerSide: number | null;
  /** Null when the system completed the match (settled walkover). */
  officialById: string | null;
  side1EntryId: string | null;
  side2EntryId: string | null;
  nextMatchId: string | null;
  nextMatchSide: number | null;
}

/** A bracket slot of another draw that holds an entry coming from the reopened match's draw. */
export interface ImpactSeat {
  entryId: string;
  /** First-round match of the target draw that contains the slot. */
  matchId: string;
  side: 1 | 2;
  positionId: string;
  /** What the slot waited for before it was filled. */
  ref: PlaceholderRef;
}

export interface ReopenImpactInput {
  rootId: string;
  /** Every match of the sub-event that the winner may have reached. */
  matches: readonly ImpactMatch[];
  /** Qualifier slots (root in QUALIFYING) or group places (root in GROUP) already filled in the main draw. */
  seats: readonly ImpactSeat[];
  rootIsGroupMatch: boolean;
}

/**
 * CLEAR_SIDE: unplayed match, only the entry leaves its side.
 * REVERT_AUTO: system-made BYE or settled walkover; the entry leaves and the winner it produced leaves too.
 * RESET_RESULT: played (LIVE or OFFICIAL) match; blocks a plain reopen, wiped by a forced one.
 */
export type ImpactEffect = 'CLEAR_SIDE' | 'REVERT_AUTO' | 'RESET_RESULT';

export interface ImpactCell {
  matchId: string;
  matchNo: number;
  side: 1 | 2;
  entryId: string;
  status: ImpactMatch['status'];
  effect: ImpactEffect;
  /** The target is a walkover (pending or settled) and the leaving entry is its loser, so the walkover itself must be dropped. */
  walkoverLoser: boolean;
  /** Match whose winner this entry was; null when the entry sat in a bracket slot of another draw. */
  fromMatchId: string | null;
  seat: ImpactSeat | null;
}

export interface ReopenImpact {
  /** Discovery order: a feeding match always comes before the matches it fed. */
  cells: ImpactCell[];
  affected: ImpactCell[];
  blocking: ImpactCell[];
}

const sideEntry = (m: ImpactMatch, side: 1 | 2) => (side === 1 ? m.side1EntryId : m.side2EntryId);

function winnerEntry(m: ImpactMatch): string | null {
  if (m.status !== 'OFFICIAL' || (m.winnerSide !== 1 && m.winnerSide !== 2)) return null;
  return sideEntry(m, m.winnerSide);
}

const isAutoCompleted = (m: ImpactMatch) => m.resultType === 'BYE' || (m.resultType === 'WALKOVER' && m.officialById === null);

/**
 * Walks forward from a match that is about to be reopened and lists every place its winner currently
 * sits (next matches, qualifier slot of the main draw, group place of the knockout), following results
 * that become invalid as the entry leaves. Pure: the caller loads the snapshot and applies the cells.
 */
export function computeReopenImpact(input: ReopenImpactInput): ReopenImpact {
  const byId = new Map(input.matches.map((m) => [m.id, m]));
  const root = byId.get(input.rootId);
  if (!root) throw new Error(`Match ${input.rootId} is not part of the impact snapshot`);
  const cells: ImpactCell[] = [];
  const seen = new Set<string>();

  const remove = (target: ImpactMatch | undefined, side: 1 | 2, entryId: string, fromMatchId: string | null, seat: ImpactSeat | null) => {
    if (!target || sideEntry(target, side) !== entryId || seen.has(`${target.id}:${side}`)) return;
    seen.add(`${target.id}:${side}`);
    const effect: ImpactEffect = target.status === 'SCHEDULED' ? 'CLEAR_SIDE' : isAutoCompleted(target) ? 'REVERT_AUTO' : 'RESET_RESULT';
    const walkoverLoser = target.resultType === 'WALKOVER' && (target.winnerSide === 1 || target.winnerSide === 2) && target.winnerSide !== side;
    cells.push({ matchId: target.id, matchNo: target.matchNo, side, entryId, status: target.status, effect, walkoverLoser, fromMatchId, seat });
    if (effect !== 'CLEAR_SIDE') winnerLeaves(target);
  };

  const winnerLeaves = (from: ImpactMatch) => {
    const entryId = winnerEntry(from);
    if (!entryId) return;
    if (from.nextMatchId) {
      remove(byId.get(from.nextMatchId), from.nextMatchSide === 1 ? 1 : 2, entryId, from.id, null);
      return;
    }
    for (const seat of input.seats) if (seat.entryId === entryId) remove(byId.get(seat.matchId), seat.side, entryId, null, seat);
  };

  if (input.rootIsGroupMatch) {
    for (const seat of input.seats) remove(byId.get(seat.matchId), seat.side, seat.entryId, null, seat);
  } else {
    winnerLeaves(root);
  }
  return {
    cells,
    affected: cells.filter((c) => c.effect !== 'RESET_RESULT'),
    blocking: cells.filter((c) => c.effect === 'RESET_RESULT'),
  };
}
