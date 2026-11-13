import { splitEvenly } from './bracket-size.js';
import type { Rng } from './seeded-random.js';
import { DrawParamsError, type DrawEntry } from './types.js';

export const MIN_GROUP_SIZE = 3;
const MAX_GROUPS = 26;

export interface GroupMemberSlot {
  entryId: string;
  /** 1 = pot 1 (top seeds). Also the slot used by the round-robin schedule. */
  slot: number;
}

export interface GroupAllocation {
  code: string;
  members: GroupMemberSlot[];
}

export function groupCodes(count: number): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_GROUPS) {
    throw new DrawParamsError('INVALID_PARAMS', `Group count must be 1..${MAX_GROUPS}, got ${count}`);
  }
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

export function groupSizes(entryCount: number, groupCount: number): number[] {
  const sizes = splitEvenly(entryCount, groupCount);
  if ((sizes.at(-1) ?? 0) < MIN_GROUP_SIZE) {
    throw new DrawParamsError('NOT_ENOUGH_ENTRIES', `${entryCount} entries make groups smaller than ${MIN_GROUP_SIZE}`);
  }
  return sizes;
}

function byStrength(a: DrawEntry, b: DrawEntry): number {
  const seedA = a.seed ?? Infinity;
  const seedB = b.seed ?? Infinity;
  if (seedA !== seedB) return seedA < seedB ? -1 : 1;
  return (b.pointsAtEntry ?? 0) - (a.pointsAtEntry ?? 0);
}

/** Pot 1 (the strongest G) goes to groups A..G in order; every later pot is dealt to groups in random order. */
export function allocateGroups(params: { entries: readonly DrawEntry[]; groupCount: number; rng: Rng }): GroupAllocation[] {
  const { entries, groupCount, rng } = params;
  groupSizes(entries.length, groupCount);
  const sorted = [...entries].sort(byStrength);
  const groups: GroupAllocation[] = groupCodes(groupCount).map((code) => ({ code, members: [] }));

  for (let start = 0, pot = 0; start < sorted.length; start += groupCount, pot++) {
    const order = pot === 0 ? groups.map((_, i) => i) : rng.shuffle(groups.map((_, i) => i));
    sorted.slice(start, start + groupCount).forEach((entry, i) => {
      (groups[order[i] as number] as GroupAllocation).members.push({ entryId: entry.id, slot: pot + 1 });
    });
  }
  return groups;
}
