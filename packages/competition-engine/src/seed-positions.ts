import { isPowerOfTwo } from './bracket-size.js';
import type { Rng } from './seeded-random.js';
import { DrawParamsError } from './types.js';

/**
 * Standard pattern: seeds 1 and 2 at the two ends; each following tier (seeds k+1..2k) is drawn
 * at random into the k section-boundary slots left free (S/2 and S/2+1 for seeds 3-4, quarter
 * boundaries for 5-8, ...). Pending organiser confirmation (gate G1a).
 * Returns seed number -> position (1-based).
 */
export function seedPositions(size: number, seedCount: number, rng: Rng): Map<number, number> {
  if (!isPowerOfTwo(size) || size < 2) throw new DrawParamsError('INVALID_SIZE', `Invalid bracket size: ${size}`);
  if (!Number.isInteger(seedCount) || seedCount < 0 || seedCount > size) {
    throw new DrawParamsError('INVALID_SEED', `Seed count ${seedCount} does not fit a bracket of ${size}`);
  }

  const result = new Map<number, number>();
  if (seedCount >= 1) result.set(1, 1);
  if (seedCount >= 2) result.set(2, size);
  const used = new Set(result.values());

  for (let tier = 2; tier < size && result.size < seedCount; tier *= 2) {
    const step = size / tier;
    const candidates: number[] = [];
    for (let boundary = 1; boundary < tier; boundary++) {
      for (const position of [boundary * step, boundary * step + 1]) {
        if (!used.has(position)) candidates.push(position);
      }
    }
    const shuffled = rng.shuffle(candidates);
    for (let seed = tier + 1; seed <= Math.min(tier * 2, seedCount); seed++) {
      const position = shuffled[seed - tier - 1] as number;
      result.set(seed, position);
      used.add(position);
    }
  }
  return result;
}
