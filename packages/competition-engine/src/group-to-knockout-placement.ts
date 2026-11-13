import { bracketSize } from './bracket-size.js';
import { allocateByePositions } from './bye-allocation.js';
import { deriveMatches } from './derive-matches.js';
import { seedPositions } from './seed-positions.js';
import type { Rng } from './seeded-random.js';
import { DrawParamsError, type BracketPositionData, type KnockoutDraw } from './types.js';

export interface GroupPlacementParams {
  /** Group codes in table order (A, B, ...); group winners are seeded in this order. */
  groupCodes: readonly string[];
  advancePerGroup: number;
  rng: Rng;
  scopeKey?: string;
  section?: number;
}

/**
 * Builds the main knockout from group places. Winners take the seed slots; a runner-up is drawn
 * into the half opposite its own group winner so the pair cannot meet before the final.
 */
export function placeGroupsInKnockout(params: GroupPlacementParams): KnockoutDraw {
  const { groupCodes, advancePerGroup, rng, scopeKey = 'S1', section = 1 } = params;
  if (advancePerGroup !== 1 && advancePerGroup !== 2) {
    throw new DrawParamsError('INVALID_PARAMS', `advancePerGroup must be 1 or 2, got ${advancePerGroup}`);
  }
  const groupCount = groupCodes.length;
  const total = groupCount * advancePerGroup;
  if (total < 2) throw new DrawParamsError('NOT_ENOUGH_ENTRIES', 'At least 2 qualifiers are needed for a knockout');
  const size = bracketSize(total);
  const byeCount = size - total;
  const half = size / 2;

  const placed = new Map<number, BracketPositionData>();
  const place = (position: number, data: Omit<BracketPositionData, 'section' | 'position'>) =>
    placed.set(position, { section, position, ...data });

  const winnerSlots = seedPositions(size, groupCount, rng);
  const winnerPosition = new Map<string, number>();
  const seedOrder: number[] = [];
  groupCodes.forEach((group, i) => {
    const position = winnerSlots.get(i + 1) as number;
    winnerPosition.set(group, position);
    seedOrder.push(position);
    place(position, { source: 'GROUP_PLACE', sourceRef: { type: 'GROUP_PLACE', group, place: 1 } });
  });

  const byes = allocateByePositions({
    size,
    byeCount,
    seedOrder,
    occupied: new Set(placed.keys()),
    rng,
    ...(advancePerGroup === 2 ? { maxPerHalf: byeCount / 2 } : {}),
  });
  for (const position of byes) place(position, { source: 'BYE' });

  if (advancePerGroup === 2) {
    for (const group of groupCodes) {
      const oppositeIsTop = (winnerPosition.get(group) as number) > half;
      const open = Array.from({ length: half }, (_, i) => i + 1 + (oppositeIsTop ? 0 : half)).filter((p) => !placed.has(p));
      if (open.length === 0) throw new DrawParamsError('CANNOT_PLACE', `No free slot opposite the winner of group ${group}`);
      place(open[rng.int(open.length)] as number, {
        source: 'GROUP_PLACE',
        sourceRef: { type: 'GROUP_PLACE', group, place: 2 },
      });
    }
  }

  const positions = [...placed.values()].sort((a, b) => a.position - b.position);
  return { size, byeCount, positions, ...deriveMatches({ positions, size, scopeKey, section }) };
}
