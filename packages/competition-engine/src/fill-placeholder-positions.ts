import type { Rng } from './seeded-random.js';
import { DrawParamsError, type BracketPositionData } from './types.js';

function resolved(position: BracketPositionData, entryId: string): BracketPositionData {
  return { section: position.section, position: position.position, source: 'ENTRY', entryId };
}

/** Draws the qualifiers into the Q1..Qk slots at random (seeded); call deriveMatches afterwards. */
export function fillQualifierSlots(
  positions: readonly BracketPositionData[],
  qualifierEntryIds: readonly string[],
  rng: Rng,
): BracketPositionData[] {
  const slots = positions.filter((p) => p.source === 'QUALIFIER');
  if (slots.length !== qualifierEntryIds.length) {
    throw new DrawParamsError('INVALID_PLACEHOLDER_FILL', `${slots.length} qualifier slots but ${qualifierEntryIds.length} qualifiers`);
  }
  const drawn = rng.shuffle(qualifierEntryIds);
  const assignment = new Map(
    [...slots].sort((a, b) => a.position - b.position).map((slot, i) => [slot.position, drawn[i] as string]),
  );
  return positions.map((p) => (assignment.has(p.position) ? resolved(p, assignment.get(p.position) as string) : p));
}

/** `entryByPlace` is keyed `${group}:${place}`, e.g. "A:1". */
export function fillGroupPlaces(
  positions: readonly BracketPositionData[],
  entryByPlace: ReadonlyMap<string, string>,
): BracketPositionData[] {
  return positions.map((p) => {
    if (p.source !== 'GROUP_PLACE' || p.sourceRef?.type !== 'GROUP_PLACE') return p;
    const entryId = entryByPlace.get(`${p.sourceRef.group}:${p.sourceRef.place}`);
    if (!entryId) {
      throw new DrawParamsError('INVALID_PLACEHOLDER_FILL', `No entry for group ${p.sourceRef.group} place ${p.sourceRef.place}`);
    }
    return resolved(p, entryId);
  });
}
