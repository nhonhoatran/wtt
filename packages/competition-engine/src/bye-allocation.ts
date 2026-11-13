import { partnerPosition } from './bracket-size.js';
import type { Rng } from './seeded-random.js';
import { DrawParamsError } from './types.js';

export interface ByeAllocationParams {
  size: number;
  byeCount: number;
  /** Positions of the seeds, best seed first; their round-1 opponents receive the BYEs first. */
  seedOrder: readonly number[];
  occupied: ReadonlySet<number>;
  rng: Rng;
  /** Caps BYEs per half so the other half keeps room for forced placements (group runner-ups). */
  maxPerHalf?: number;
}

/** Never produces BYE vs BYE: at most one BYE per round-1 match, and never next to an occupied slot's BYE. */
export function allocateByePositions(params: ByeAllocationParams): Set<number> {
  const { size, byeCount, seedOrder, occupied, rng, maxPerHalf = Infinity } = params;
  const half = size / 2;
  const byes = new Set<number>();
  const taken = (position: number) => occupied.has(position) || byes.has(position);
  const countIn = (top: boolean) => [...byes].filter((p) => (p <= half) === top).length;

  for (const seedPosition of seedOrder) {
    if (byes.size >= byeCount) break;
    const partner = partnerPosition(seedPosition);
    if (!taken(partner) && countIn(partner <= half) < maxPerHalf) byes.add(partner);
  }

  if (byes.size < byeCount) {
    const open: number[] = [];
    for (let start = 1; start < size; start += 2) {
      if (!taken(start) && !taken(start + 1)) open.push(start);
    }
    const topMatches = rng.shuffle(open.filter((p) => p <= half));
    const bottomMatches = rng.shuffle(open.filter((p) => p > half));
    while (byes.size < byeCount) {
      const sides = countIn(true) <= countIn(false) ? [true, false] : [false, true];
      const top = sides.find((isTop) => countIn(isTop) < maxPerHalf && (isTop ? topMatches : bottomMatches).length > 0);
      if (top === undefined) {
        throw new DrawParamsError('CANNOT_PLACE', `Cannot place ${byeCount} BYEs in a bracket of ${size}`);
      }
      const start = (top ? topMatches : bottomMatches).pop() as number;
      byes.add(rng.int(2) === 0 ? start : start + 1);
    }
  }
  return byes;
}
