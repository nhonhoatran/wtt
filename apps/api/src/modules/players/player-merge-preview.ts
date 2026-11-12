import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@kamito/db';

type Db = Pick<Prisma.TransactionClient, 'player' | 'entry' | 'pair'>;

export type MergeConflictCode = 'SAME_SUB_EVENT' | 'PAIR_OF_BOTH' | 'ALREADY_MERGED' | 'SAME_PLAYER';

export interface MergeConflict {
  code: MergeConflictCode;
  message: string;
  subEventId?: string;
}

const PLAYER_SELECT = { id: true, code: true, fullName: true, club: true, birthYear: true, mergedIntoId: true } as const;

/** Sub-events where any of the players has an entry, alone or through a pair, sorted by id. */
export async function affectedSubEventIds(db: Pick<Db, 'entry'>, playerIds: string[]): Promise<string[]> {
  const rows = await db.entry.findMany({
    where: {
      competitor: { OR: [{ playerId: { in: playerIds } }, { pair: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] } }] },
    },
    select: { subEventId: true },
    distinct: ['subEventId'],
  });
  return rows.map((row) => row.subEventId).sort();
}

/** Read-only analysis shared by the preview endpoint and the merge transaction. */
export async function analyseMerge(db: Db, targetId: string, sourceId: string) {
  // Sequential: inside an interactive transaction one connection must not run queries in parallel.
  const target = await db.player.findUnique({ where: { id: targetId }, select: PLAYER_SELECT });
  const source = await db.player.findUnique({ where: { id: sourceId }, select: PLAYER_SELECT });
  if (!target || !source) throw new NotFoundException({ code: 'PLAYER_NOT_FOUND', message: 'Không tìm thấy VĐV' });

  const conflicts: MergeConflict[] = [];
  if (targetId === sourceId) {
    conflicts.push({ code: 'SAME_PLAYER', message: 'Không thể gộp một hồ sơ vào chính nó' });
    return { target, source, counts: { entries: 0, pairs: 0, matches: 0 }, conflicts, canMerge: false };
  }
  for (const player of [target, source]) {
    if (player.mergedIntoId) {
      conflicts.push({ code: 'ALREADY_MERGED', message: `${player.fullName} (${player.code}) đã được gộp vào hồ sơ khác` });
    }
  }

  const pairs = await db.pair.findMany({
    where: { OR: [{ playerAId: sourceId }, { playerBId: sourceId }] },
    select: { playerAId: true, playerBId: true },
  });
  if (pairs.some((pair) => pair.playerAId === targetId || pair.playerBId === targetId)) {
    conflicts.push({ code: 'PAIR_OF_BOTH', message: `${target.fullName} và ${source.fullName} đang là một cặp đôi, gộp sẽ tạo cặp trùng người` });
  }

  const ids = [targetId, sourceId];
  const entries = await db.entry.findMany({
    where: {
      competitor: { OR: [{ playerId: { in: ids } }, { pair: { OR: [{ playerAId: { in: ids } }, { playerBId: { in: ids } }] } }] },
    },
    select: {
      subEventId: true,
      subEvent: { select: { code: true, event: { select: { name: true } } } },
      competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } },
    },
  });
  const bySubEvent = new Map<string, { label: string; target: boolean; source: boolean }>();
  let sourceEntries = 0;
  for (const entry of entries) {
    const members = [entry.competitor.playerId, entry.competitor.pair?.playerAId, entry.competitor.pair?.playerBId];
    const slot = bySubEvent.get(entry.subEventId) ?? { label: `${entry.subEvent.code} (${entry.subEvent.event.name})`, target: false, source: false };
    slot.target ||= members.includes(targetId);
    if (members.includes(sourceId)) {
      slot.source = true;
      sourceEntries += 1;
    }
    bySubEvent.set(entry.subEventId, slot);
  }
  for (const [subEventId, slot] of bySubEvent) {
    if (slot.target && slot.source) {
      conflicts.push({ code: 'SAME_SUB_EVENT', subEventId, message: `Cả hai hồ sơ đều có đăng ký trong nội dung ${slot.label}` });
    }
  }

  return { target, source, counts: { entries: sourceEntries, pairs: pairs.length, matches: 0 }, conflicts, canMerge: conflicts.length === 0 };
}

export function toPreviewView(analysis: Awaited<ReturnType<typeof analyseMerge>>) {
  const brief = ({ id, code, fullName, club, birthYear }: (typeof analysis)['target']) => ({ id, code, fullName, club, birthYear });
  return { target: brief(analysis.target), source: brief(analysis.source), counts: analysis.counts, conflicts: analysis.conflicts, canMerge: analysis.canMerge };
}
