import { ConflictException, Injectable } from '@nestjs/common';
import { findOrCreateCompetitor, lockPlayersForUpdate, lockSubEventsInOrder, orderPairIds, refreshCompetitorNames, type Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MergeBody } from './player-dtos.js';
import { affectedSubEventIds, analyseMerge, toPreviewView } from './player-merge-preview.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PlayerMergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(targetId: string, sourceId: string) {
    return toPreviewView(await analyseMerge(this.prisma, targetId, sourceId));
  }

  async merge(body: MergeBody) {
    const { targetId, sourceId, reason } = body;
    return this.prisma.$transaction(async (tx) => {
      // Lock order: sub-events by id, then players by id (same as entry writers).
      const members = [targetId, sourceId];
      const planned = await affectedSubEventIds(tx, members);
      await lockSubEventsInOrder(tx, planned);
      await lockPlayersForUpdate(tx, members);
      const current = await affectedSubEventIds(tx, members);
      if (current.join() !== planned.join()) {
        throw new ConflictException({ code: 'MERGE_RETRY', message: 'Dữ liệu vừa thay đổi, hãy thử lại' });
      }
      const analysis = await analyseMerge(tx, targetId, sourceId);
      if (!analysis.canMerge) {
        throw new ConflictException({
          code: 'MERGE_CONFLICT',
          message: analysis.conflicts[0]?.message ?? 'Không gộp được hai hồ sơ này',
          issues: analysis.conflicts,
        });
      }

      const affected = await tx.entry.findMany({
        where: {
          competitor: { OR: [{ playerId: sourceId }, { pair: { OR: [{ playerAId: sourceId }, { playerBId: sourceId }] } }] },
        },
        select: { id: true },
      });
      const movedEntryIds = affected.map((entry) => entry.id);
      await this.moveSingles(tx, targetId, sourceId);
      const pairMoves = await this.movePairs(tx, targetId, sourceId);
      await refreshCompetitorNames(tx, targetId);
      // Phase 09 hook: re-point ledger rows to target and mark sub-events rankingDirtyAt
      await tx.player.update({ where: { id: sourceId }, data: { mergedIntoId: targetId, mergedAt: new Date(), isActive: false } });

      await this.audit.record(
        {
          action: 'player.merge',
          entity: 'Player',
          entityId: targetId,
          reason,
          before: { sourceId, sourceCode: analysis.source.code, sourceName: analysis.source.fullName, entryIds: movedEntryIds, pairIds: pairMoves.map((move) => move.fromPairId) },
          after: { targetId, targetCode: analysis.target.code, entryIds: movedEntryIds, pairs: pairMoves },
        },
        tx,
      );
      return { targetId, sourceId, movedEntries: movedEntryIds.length, movedPairs: pairMoves.length };
    });
  }

  private async moveSingles(tx: Tx, targetId: string, sourceId: string): Promise<void> {
    const competitor = await tx.competitor.findUnique({ where: { playerId: sourceId }, select: { id: true } });
    if (!competitor) return;
    if ((await tx.entry.count({ where: { competitorId: competitor.id } })) > 0) {
      const into = await findOrCreateCompetitor(tx, [targetId]);
      await tx.entry.updateMany({ where: { competitorId: competitor.id }, data: { competitorId: into.id } });
    }
    await tx.competitor.delete({ where: { id: competitor.id } });
  }

  /** Pair (source, X) becomes (target, X); an existing (target, X) absorbs its entries instead. */
  private async movePairs(tx: Tx, targetId: string, sourceId: string) {
    const pairs = await tx.pair.findMany({ where: { OR: [{ playerAId: sourceId }, { playerBId: sourceId }] } });
    const moves: { fromPairId: string; toPairId: string; absorbed: boolean }[] = [];
    for (const pair of pairs) {
      const otherId = pair.playerAId === sourceId ? pair.playerBId : pair.playerAId;
      const [playerAId, playerBId] = orderPairIds(targetId, otherId);
      const existing = await tx.pair.findUnique({ where: { playerAId_playerBId: { playerAId, playerBId } } });
      if (!existing) {
        await tx.pair.update({ where: { id: pair.id }, data: { playerAId, playerBId } });
        moves.push({ fromPairId: pair.id, toPairId: pair.id, absorbed: false });
        continue;
      }
      const competitor = await tx.competitor.findUnique({ where: { pairId: pair.id }, select: { id: true } });
      if (competitor) {
        if ((await tx.entry.count({ where: { competitorId: competitor.id } })) > 0) {
          const into = await findOrCreateCompetitor(tx, [targetId, otherId]);
          await tx.entry.updateMany({ where: { competitorId: competitor.id }, data: { competitorId: into.id } });
        }
        await tx.competitor.delete({ where: { id: competitor.id } });
      }
      await tx.pair.delete({ where: { id: pair.id } });
      moves.push({ fromPairId: pair.id, toPairId: existing.id, absorbed: true });
    }
    return moves;
  }
}
