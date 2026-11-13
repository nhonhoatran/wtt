import type { SideSource } from '@kamito/competition-engine';
import { Prisma } from '@kamito/db';

type MatchRef = { scopeKey: string; roundNumber: number; orderInRound: number };

/** Stored form of a side placeholder: WINNER_OF points at the feeding match by its event-wide matchNo. */
export function toStoredSource(source: SideSource | null, matchNoOf: (ref: MatchRef) => number): Prisma.InputJsonObject | undefined {
  if (!source) return undefined;
  if (source.type === 'WINNER_OF') return { type: 'WINNER_OF', matchNo: matchNoOf(source) };
  return { ...source };
}

export const jsonOrNull = (value: Prisma.InputJsonObject | undefined) => value ?? Prisma.DbNull;

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/** jsonb does not keep key order, so compare canonical forms. */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a ?? null)) === JSON.stringify(sortKeys(b ?? null));
}
