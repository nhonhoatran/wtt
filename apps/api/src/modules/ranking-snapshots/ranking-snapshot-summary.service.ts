import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { findPreviousSnapshot } from './ranking-snapshot-previous.js';

@Injectable()
export class RankingSnapshotSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Period KPIs. Expired points are ledger points whose expiry falls in (previous asOf, this asOf];
   * the builder treats expiresAt as exclusive, so those points are in the previous list but not this one.
   */
  async summarize(id: string) {
    const snapshot = await this.prisma.rankingSnapshot.findUnique({
      where: { id },
      select: { id: true, rankingListId: true, asOfDate: true, publishedAt: true },
    });
    if (!snapshot) throw new NotFoundException({ code: 'RANKING_SNAPSHOT_NOT_FOUND', message: 'Không tìm thấy bản chốt' });
    const previous = await findPreviousSnapshot(this.prisma, snapshot);

    const [rows, changed, newcomers, expired] = await Promise.all([
      this.prisma.rankingSnapshotRow.count({ where: { snapshotId: id } }),
      this.prisma.rankingSnapshotRow.count({ where: { snapshotId: id, movement: { not: 0 } } }),
      previous ? this.prisma.rankingSnapshotRow.count({ where: { snapshotId: id, previousRank: null } }) : 0,
      previous
        ? this.prisma.rankingPointsEarned.aggregate({
            where: { rankingListId: snapshot.rankingListId, expiresAt: { gt: previous.asOfDate, lte: snapshot.asOfDate } },
            _sum: { points: true },
          })
        : null,
    ]);
    return { data: { rows, changed, newcomers, expiredPoints: expired?._sum.points ?? 0, previous } };
  }
}
