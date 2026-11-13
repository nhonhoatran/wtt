import {
  allocateGroups,
  createRng,
  generateKnockout,
  generateQualifying,
  generateRoundRobin,
  placeGroupsInKnockout,
  type BracketPositionData,
  type DrawEntry,
  type MatchData,
  type RoundData,
} from '@kamito/competition-engine';
import type { EffectiveParams } from './draw-params.service.js';

export interface PlannedGroup {
  code: string;
  order: number;
  members: { entryId: string; slot: number }[];
}

/** Everything a draw persists, as plain engine data (no ids yet). */
export interface PlannedStructure {
  size: number | null;
  byeCount: number;
  positions: BracketPositionData[];
  rounds: RoundData[];
  matches: MatchData[];
  groups: PlannedGroup[];
}

const EMPTY: PlannedStructure = { size: null, byeCount: 0, positions: [], rounds: [], matches: [], groups: [] };

/** Deterministic for (randomSeed, entries, params); engine errors propagate as DrawParamsError. */
export function planDraw(params: EffectiveParams, entries: readonly DrawEntry[], randomSeed: string): PlannedStructure {
  const rng = createRng(randomSeed);

  if (params.kind === 'MAIN' && params.groupCodes) {
    const draw = placeGroupsInKnockout({ groupCodes: params.groupCodes, advancePerGroup: params.advancePerGroup ?? 0, rng });
    return { ...EMPTY, size: draw.size, byeCount: draw.byeCount, positions: draw.positions, rounds: draw.rounds, matches: draw.matches };
  }

  if (params.kind === 'MAIN') {
    const draw = generateKnockout({ entries, seedCount: params.seedCount, qualifierSlots: params.qualifierCount ?? 0, rng });
    return { ...EMPTY, size: draw.size, byeCount: draw.byeCount, positions: draw.positions, rounds: draw.rounds, matches: draw.matches };
  }

  if (params.kind === 'QUALIFYING') {
    const draw = generateQualifying({ entries, sectionCount: params.qualifierCount ?? 0, rng });
    const byeCount = draw.sections.reduce((sum, section) => sum + section.byeCount, 0);
    return { ...EMPTY, byeCount, positions: draw.positions, rounds: draw.rounds, matches: draw.matches };
  }

  const allocation = allocateGroups({ entries, groupCount: params.groupCount ?? 0, rng });
  const plan: PlannedStructure = { ...EMPTY, rounds: [], matches: [], groups: [] };
  allocation.forEach((group, index) => {
    const members = [...group.members].sort((a, b) => a.slot - b.slot);
    plan.groups.push({ code: group.code, order: index + 1, members });
    const schedule = generateRoundRobin(group.code, members.map((m) => m.entryId));
    plan.rounds.push(...schedule.rounds);
    plan.matches.push(...schedule.matches);
  });
  return plan;
}
