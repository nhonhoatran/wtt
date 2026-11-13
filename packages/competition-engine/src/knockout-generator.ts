import { bracketSize, partnerPosition } from './bracket-size.js';
import { allocateByePositions } from './bye-allocation.js';
import { deriveMatches } from './derive-matches.js';
import { seedPositions } from './seed-positions.js';
import type { Rng } from './seeded-random.js';
import { DrawParamsError, type BracketPositionData, type DrawEntry, type KnockoutDraw, type RoundStyle } from './types.js';

export interface KnockoutParams {
  entries: readonly DrawEntry[];
  /** Entries with seed 1..seedCount are placed by the seeding pattern; others are drawn. */
  seedCount: number;
  /** Main-draw slots Q1..Qk waiting for qualifiers. */
  qualifierSlots?: number;
  rng: Rng;
  scopeKey?: string;
  section?: number;
  roundStyle?: RoundStyle;
}

function collectSeeds(entries: readonly DrawEntry[], seedCount: number): DrawEntry[] {
  const seeded = entries
    .filter((e) => e.seed != null && e.seed >= 1 && e.seed <= seedCount)
    .sort((a, b) => (a.seed as number) - (b.seed as number));
  for (let i = 1; i < seeded.length; i++) {
    if (seeded[i]?.seed === seeded[i - 1]?.seed) {
      throw new DrawParamsError('INVALID_SEED', `Seed ${seeded[i]?.seed} is assigned to more than one entry`);
    }
  }
  return seeded;
}

export function generateKnockout(params: KnockoutParams): KnockoutDraw {
  const { entries, seedCount, rng, scopeKey = 'S1', section = 1, roundStyle = 'MAIN' } = params;
  const qualifierSlots = params.qualifierSlots ?? 0;
  const total = entries.length + qualifierSlots;
  if (total < 2) throw new DrawParamsError('NOT_ENOUGH_ENTRIES', 'A draw needs at least 2 participants');
  if (new Set(entries.map((e) => e.id)).size !== entries.length) {
    throw new DrawParamsError('INVALID_PARAMS', 'Duplicate entry in draw');
  }
  const size = bracketSize(total);
  const byeCount = size - total;
  if (byeCount > entries.length) {
    throw new DrawParamsError('NOT_ENOUGH_ENTRIES', 'Too many qualifier slots: not enough entries to face every BYE');
  }
  if (seedCount < 0 || seedCount > Math.max(1, size / 2)) {
    throw new DrawParamsError('INVALID_SEED', `Seed count ${seedCount} is too large for a bracket of ${size}`);
  }

  const seeds = collectSeeds(entries, seedCount);
  const seedSlots = seedPositions(size, seedCount, rng);
  const placed = new Map<number, BracketPositionData>();
  const place = (position: number, data: Omit<BracketPositionData, 'section' | 'position'>) =>
    placed.set(position, { section, position, ...data });

  const seedOrder: number[] = [];
  for (const entry of seeds) {
    const position = seedSlots.get(entry.seed as number) as number;
    place(position, { source: 'ENTRY', entryId: entry.id });
    seedOrder.push(position);
  }

  const byes = allocateByePositions({ size, byeCount, seedOrder, occupied: new Set(placed.keys()), rng });
  for (const position of byes) place(position, { source: 'BYE' });

  const free = () => Array.from({ length: size }, (_, i) => i + 1).filter((p) => !placed.has(p));
  const qualifierCandidates = rng.shuffle(free().filter((p) => placed.get(partnerPosition(p))?.source !== 'BYE'));
  if (qualifierCandidates.length < qualifierSlots) {
    throw new DrawParamsError('CANNOT_PLACE', 'No room for qualifier slots away from BYEs');
  }
  qualifierCandidates.slice(0, qualifierSlots).forEach((position, i) => {
    place(position, { source: 'QUALIFIER', sourceRef: { type: 'QUALIFIER', index: i + 1 } });
  });

  const seededIds = new Set(seeds.map((e) => e.id));
  const drawn = rng.shuffle(entries.filter((e) => !seededIds.has(e.id)));
  free().forEach((position, i) => place(position, { source: 'ENTRY', entryId: (drawn[i] as DrawEntry).id }));

  const positions = [...placed.values()].sort((a, b) => a.position - b.position);
  return { size, byeCount, positions, ...deriveMatches({ positions, size, scopeKey, section, roundStyle }) };
}
