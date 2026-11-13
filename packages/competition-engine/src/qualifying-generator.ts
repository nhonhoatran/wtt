import { splitEvenly } from './bracket-size.js';
import { generateKnockout } from './knockout-generator.js';
import type { Rng } from './seeded-random.js';
import {
  DrawParamsError,
  type BracketPositionData,
  type DrawEntry,
  type MatchData,
  type RoundData,
} from './types.js';

export interface QualifyingParams {
  entries: readonly DrawEntry[];
  /** Number of independent sections = number of qualifier slots into the main draw. */
  sectionCount: number;
  rng: Rng;
}

export interface QualifyingSection {
  section: number;
  scopeKey: string;
  entryCount: number;
  size: number;
  byeCount: number;
}

export interface QualifyingDraw {
  sections: QualifyingSection[];
  positions: BracketPositionData[];
  rounds: RoundData[];
  matches: MatchData[];
}

/** The winner of section i becomes qualifier i. The best `sectionCount` seeded entries are spread one per section. */
export function generateQualifying(params: QualifyingParams): QualifyingDraw {
  const { entries, sectionCount, rng } = params;
  if (!Number.isInteger(sectionCount) || sectionCount < 1) {
    throw new DrawParamsError('INVALID_PARAMS', `Invalid section count: ${sectionCount}`);
  }
  if (entries.length < sectionCount * 2) {
    throw new DrawParamsError('NOT_ENOUGH_ENTRIES', `${entries.length} entries cannot fill ${sectionCount} sections of at least 2`);
  }

  const seeded = entries
    .filter((e) => e.seed != null)
    .sort((a, b) => (a.seed as number) - (b.seed as number))
    .slice(0, sectionCount);
  const seededIds = new Set(seeded.map((e) => e.id));
  const pool = rng.shuffle(entries.filter((e) => !seededIds.has(e.id)));
  const sizes = rng.shuffle(splitEvenly(entries.length, sectionCount));

  const result: QualifyingDraw = { sections: [], positions: [], rounds: [], matches: [] };
  let cursor = 0;
  sizes.forEach((entryCount, i) => {
    const holder = seeded[i];
    const take = pool.slice(cursor, cursor + entryCount - (holder ? 1 : 0));
    cursor += take.length;
    const members: DrawEntry[] = [...(holder ? [{ ...holder, seed: 1 }] : []), ...take.map((e) => ({ ...e, seed: null }))];
    const section = i + 1;
    const draw = generateKnockout({
      entries: members,
      seedCount: holder ? 1 : 0,
      rng,
      scopeKey: `S${section}`,
      section,
      roundStyle: 'QUALIFYING',
    });
    result.sections.push({ section, scopeKey: `S${section}`, entryCount, size: draw.size, byeCount: draw.byeCount });
    result.positions.push(...draw.positions);
    result.rounds.push(...draw.rounds);
    result.matches.push(...draw.matches);
  });
  return result;
}
