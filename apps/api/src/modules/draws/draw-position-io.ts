import type { BracketPositionData } from '@kamito/competition-engine';
import { Prisma, type BracketPosition } from '@kamito/db';
import { sameJson } from './draw-source-json.js';

type Tx = Prisma.TransactionClient;

export const toPositionData = (row: BracketPosition): BracketPositionData => ({
  section: row.section,
  position: row.position,
  source: row.source,
  ...(row.entryId && { entryId: row.entryId }),
  ...(row.sourceRef && { sourceRef: row.sourceRef as unknown as BracketPositionData['sourceRef'] }),
});

export const refOf = (row: BracketPosition) => ({ id: row.id, section: row.section, position: row.position, source: row.source, entryId: row.entryId });

/** Persists only the positions whose content differs from the engine output. */
export async function writePositions(tx: Tx, before: BracketPosition[], after: BracketPositionData[]): Promise<void> {
  const byPosition = new Map(after.map((p) => [`${p.section}:${p.position}`, p]));
  for (const row of before) {
    const next = byPosition.get(`${row.section}:${row.position}`)!;
    if (next.source === row.source && (next.entryId ?? null) === row.entryId && sameJson(next.sourceRef, row.sourceRef)) continue;
    await tx.bracketPosition.update({
      where: { id: row.id },
      data: { source: next.source, entryId: next.entryId ?? null, sourceRef: next.sourceRef ? (next.sourceRef as unknown as Prisma.InputJsonObject) : Prisma.DbNull },
    });
  }
}
