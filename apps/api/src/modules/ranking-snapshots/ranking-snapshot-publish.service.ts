import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { findDirtySubEventIds, type Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { toIsoDate } from '../../common/validation/iso-date-field.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';

type Tx = Prisma.TransactionClient;
type RowKey = { playerId: string; rank: number; points: number };

const notFound = () => new NotFoundException({ code: 'RANKING_SNAPSHOT_NOT_FOUND', message: 'Không tìm thấy bản chốt' });

/** Players that are new, moved, changed points, or dropped out versus the previously published snapshot. */
function changedPlayerIds(previous: RowKey[], next: RowKey[]): string[] {
  const before = new Map(previous.map((row) => [row.playerId, row]));
  const after = new Map(next.map((row) => [row.playerId, row]));
  const changed = next.filter((row) => {
    const old = before.get(row.playerId);
    return !old || old.rank !== row.rank || old.points !== row.points;
  });
  const dropped = previous.filter((row) => !after.has(row.playerId));
  return [...changed, ...dropped].map((row) => row.playerId);
}

@Injectable()
export class RankingSnapshotPublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  async publish(id: string, actorUserId: string) {
    const outcome = await this.prisma.$transaction((tx) => this.publishLocked(tx, id, actorUserId), { timeout: 60_000 });
    const warnings = await this.revalidate(outcome.listCode, outcome.playerSlugs);
    return { data: { id, status: 'PUBLISHED', publishedAt: outcome.publishedAt, changedPlayers: outcome.playerSlugs.length }, ...(warnings.length > 0 && { warnings }) };
  }

  async remove(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await tx.rankingSnapshot.findUnique({ where: { id }, select: { id: true, status: true, rankingListId: true, asOfDate: true } });
      if (!snapshot) throw notFound();
      if (snapshot.status !== 'DRAFT') {
        throw new ConflictException({ code: 'RANKING_SNAPSHOT_PUBLISHED', message: 'Bản chốt đã công bố nên không xóa được' });
      }
      await tx.rankingSnapshot.delete({ where: { id } });
      await this.audit.record(
        { action: 'ranking.snapshot.delete', entity: 'RankingSnapshot', entityId: id, before: { status: 'DRAFT', rankingListId: snapshot.rankingListId, asOfDate: toIsoDate(snapshot.asOfDate) } },
        tx,
      );
    });
    return { id };
  }

  private async publishLocked(tx: Tx, id: string, actorUserId: string) {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "RankingSnapshot" WHERE "id" = ${id} FOR UPDATE`;
    if (!locked.length) throw notFound();
    const snapshot = await tx.rankingSnapshot.findUniqueOrThrow({ where: { id }, include: { rankingList: { select: { code: true } } } });
    if (snapshot.status !== 'DRAFT') {
      throw new ConflictException({ code: 'RANKING_SNAPSHOT_NOT_DRAFT', message: 'Bản chốt này đã được công bố' });
    }
    const dirty = await findDirtySubEventIds(tx, snapshot.rankingListId);
    if (dirty.length) {
      throw new ConflictException({ code: 'RANKING_SNAPSHOT_STALE', message: `${dirty.length} nội dung chưa tính lại, hãy dựng lại bản nháp`, dirtySubEvents: dirty });
    }

    const pick = { playerId: true, rank: true, points: true } as const;
    const previous = await tx.rankingSnapshot.findFirst({
      where: { rankingListId: snapshot.rankingListId, status: 'PUBLISHED' },
      orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }],
      select: { id: true },
    });
    const [previousRows, rows] = await Promise.all([
      previous ? tx.rankingSnapshotRow.findMany({ where: { snapshotId: previous.id }, select: pick }) : Promise.resolve([]),
      tx.rankingSnapshotRow.findMany({ where: { snapshotId: id }, select: pick }),
    ]);
    const changed = changedPlayerIds(previousRows, rows);
    const slugs = changed.length ? await tx.player.findMany({ where: { id: { in: changed } }, select: { slug: true } }) : [];

    const publishedAt = new Date();
    await tx.rankingSnapshot.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt, publishedById: actorUserId } });
    await this.audit.record(
      {
        action: 'ranking.snapshot.publish',
        entity: 'RankingSnapshot',
        entityId: id,
        before: { status: 'DRAFT' },
        after: { status: 'PUBLISHED', rankingListId: snapshot.rankingListId, asOfDate: toIsoDate(snapshot.asOfDate), rows: rows.length, changedPlayers: changed.length },
      },
      tx,
    );
    return { listCode: snapshot.rankingList.code, playerSlugs: slugs.map((row) => row.slug), publishedAt };
  }

  private async revalidate(listCode: string, playerSlugs: string[]): Promise<string[]> {
    const tags = CACHE_TAGS['ranking.publish']({ listCode, playerSlugs });
    return this.revalidation.enqueue(() => tags);
  }
}
