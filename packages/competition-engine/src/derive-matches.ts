import { roundCountForSize } from './bracket-size.js';
import { roundCode } from './round-codes.js';
import {
  DrawParamsError,
  type BracketPositionData,
  type KnockoutStructure,
  type MatchData,
  type MatchTarget,
  type RoundData,
  type RoundStyle,
  type SideSource,
} from './types.js';

export interface DeriveMatchesParams {
  /** Every position 1..size of one knockout section. */
  positions: readonly BracketPositionData[];
  size: number;
  scopeKey: string;
  section: number;
  roundStyle?: RoundStyle;
}

interface Side {
  entryId?: string;
  source: SideSource | null;
}

/** Where the winner of a match goes next; null for the section final. */
export function advancementTarget(roundNumber: number, orderInRound: number, totalRounds: number): MatchTarget | null {
  if (roundNumber >= totalRounds) return null;
  return { roundNumber: roundNumber + 1, orderInRound: Math.ceil(orderInRound / 2), side: orderInRound % 2 === 1 ? 1 : 2 };
}

function sideOf(position: BracketPositionData): Side {
  if (position.source === 'ENTRY') {
    if (!position.entryId) throw new DrawParamsError('INVALID_PARAMS', `Position ${position.position} has no entry`);
    return { entryId: position.entryId, source: null };
  }
  if (position.source === 'BYE') return { source: null };
  if (!position.sourceRef) throw new DrawParamsError('INVALID_PARAMS', `Position ${position.position} has no source reference`);
  return { source: position.sourceRef };
}

function assignSide(match: MatchData, side: 1 | 2, value: Side): void {
  if (side === 1) {
    if (value.entryId) match.side1EntryId = value.entryId;
    match.side1Source = value.source;
  } else {
    if (value.entryId) match.side2EntryId = value.entryId;
    match.side2Source = value.source;
  }
}

/** Rebuilds rounds and matches from positions alone: BYE results, advanced winners and waiting-slot labels. */
export function deriveMatches(params: DeriveMatchesParams): KnockoutStructure {
  const { positions, size, scopeKey, section, roundStyle = 'MAIN' } = params;
  const totalRounds = roundCountForSize(size);
  const byPosition = new Map(positions.map((p) => [p.position, p]));
  if (positions.length !== size || byPosition.size !== size || [...byPosition.keys()].some((p) => p < 1 || p > size)) {
    throw new DrawParamsError('INVALID_PARAMS', `Positions must cover 1..${size} exactly once`);
  }

  const rounds: RoundData[] = [];
  const matches: MatchData[] = [];
  const index = new Map<string, MatchData>();
  for (let round = 1; round <= totalRounds; round++) {
    const roundsFromFinal = totalRounds - round + 1;
    rounds.push({ scopeKey, section, number: round, code: roundCode(roundStyle, 2 ** roundsFromFinal, roundsFromFinal) });
    for (let order = 1; order <= size / 2 ** round; order++) {
      const match: MatchData = {
        scopeKey,
        roundNumber: round,
        orderInRound: order,
        section,
        side1Source: null,
        side2Source: null,
        status: 'SCHEDULED',
      };
      const next = advancementTarget(round, order, totalRounds);
      if (next) match.next = next;
      if (round > 1) {
        for (const side of [1, 2] as const) {
          const feeder = { type: 'WINNER_OF', scopeKey, roundNumber: round - 1, orderInRound: order * 2 - 2 + side } as const;
          assignSide(match, side, { source: feeder });
        }
      }
      matches.push(match);
      index.set(`${round}:${order}`, match);
    }
  }

  for (let order = 1; order <= size / 2; order++) {
    const match = index.get(`1:${order}`) as MatchData;
    const first = byPosition.get(order * 2 - 1) as BracketPositionData;
    const second = byPosition.get(order * 2) as BracketPositionData;
    assignSide(match, 1, sideOf(first));
    assignSide(match, 2, sideOf(second));
    const firstBye = first.source === 'BYE';
    const secondBye = second.source === 'BYE';
    if (firstBye && secondBye) throw new DrawParamsError('BYE_VS_BYE', `BYE faces BYE at positions ${first.position}/${second.position}`);
    if (!firstBye && !secondBye) continue;
    const winnerSide = firstBye ? 2 : 1;
    match.bye = { winnerSide };
    match.status = 'OFFICIAL';
    if (match.next) {
      const target = index.get(`${match.next.roundNumber}:${match.next.orderInRound}`) as MatchData;
      assignSide(target, match.next.side, sideOf(winnerSide === 1 ? first : second));
    }
  }
  return { rounds, matches };
}

/** Draft edit: exchange what two slots hold. Refuses results the generator itself would never produce. */
export function swapPositions(positions: readonly BracketPositionData[], positionA: number, positionB: number): BracketPositionData[] {
  const a = positions.find((p) => p.position === positionA);
  const b = positions.find((p) => p.position === positionB);
  if (!a || !b) throw new DrawParamsError('INVALID_PARAMS', `Unknown position ${positionA} or ${positionB}`);
  const swapped = positions.map((p) => {
    const donor = p === a ? b : p === b ? a : null;
    if (!donor) return p;
    const copy: BracketPositionData = { section: p.section, position: p.position, source: donor.source };
    if (donor.entryId) copy.entryId = donor.entryId;
    if (donor.sourceRef) copy.sourceRef = donor.sourceRef;
    return copy;
  });
  const byPosition = new Map(swapped.map((p) => [p.position, p]));
  for (const p of swapped) {
    const partner = byPosition.get(p.position % 2 === 1 ? p.position + 1 : p.position - 1);
    if (!partner) continue;
    if (p.source === 'BYE' && partner.source === 'BYE') {
      throw new DrawParamsError('BYE_VS_BYE', 'Swap would put a BYE against a BYE');
    }
    if (p.source === 'QUALIFIER' && partner.source === 'BYE') {
      throw new DrawParamsError('QUALIFIER_VS_BYE', 'Swap would put a qualifier slot against a BYE');
    }
  }
  return swapped;
}
