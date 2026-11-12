import type { Prisma, PrismaClient } from '@kamito/db';
import { normalizePersonName } from '@kamito/shared';
import { buildPlayerIndex, type KnownPlayer, type PlayerIndex } from './player-matcher.js';

type Db = PrismaClient | Prisma.TransactionClient;

const SELECT = { id: true, code: true, fullName: true, normalizedName: true, gender: true, birthYear: true, birthDate: true, club: true } as const;

export interface PlayerQuery {
  code: string | null;
  fullName: string;
}

/**
 * Active, non-merged players that could match any of the typed codes or names.
 * `excludeIds` hides players created earlier by the same import so they never count as a name clash.
 */
export async function loadPlayerIndex(db: Db, wanted: PlayerQuery[], excludeIds: string[] = []): Promise<PlayerIndex> {
  const codes = new Set<string>();
  const names = new Set<string>();
  for (const item of wanted) {
    if (item.code) {
      codes.add(item.code);
      codes.add(item.code.toUpperCase());
    }
    if (item.fullName) names.add(normalizePersonName(item.fullName));
  }
  if (!codes.size && !names.size) return buildPlayerIndex([]);
  const rows: KnownPlayer[] = await db.player.findMany({
    where: {
      isActive: true,
      mergedIntoId: null,
      ...(excludeIds.length && { id: { notIn: excludeIds } }),
      OR: [{ code: { in: [...codes] } }, { normalizedName: { in: [...names] } }],
    },
    select: SELECT,
  });
  const merged = codes.size
    ? await db.player.findMany({ where: { mergedIntoId: { not: null }, code: { in: [...codes] } }, select: { code: true, mergedInto: { select: { code: true } } } })
    : [];
  const mergedCodes = new Map<string, string>();
  for (const player of merged) if (player.mergedInto) mergedCodes.set(player.code.toUpperCase(), player.mergedInto.code);
  return buildPlayerIndex(rows, mergedCodes);
}
