import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import type { ManualRanksBody } from '../draws/draw-dtos.js';
import { conflict, invalid } from '../draws/draw-errors.js';
import { assertGroupsNotPlaced } from '../draws/groups-placed-guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { GroupStandingsService } from './group-standings.service.js';
import { GroupViewService } from './group-view.service.js';

type Tx = Prisma.TransactionClient;

const GROUPS_PLACED_MESSAGE = 'Các bảng đã xếp vào nhánh chính, không đổi được thứ hạng nữa';

const rankOf = (rows: { entryId: string; rank: number | null }[]) => rows.map((r) => ({ entryId: r.entryId, rank: r.rank }));

@Injectable()
export class GroupAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
    private readonly views: GroupViewService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  private async storedState(tx: Tx, groupId: string) {
    const rows = await tx.groupStanding.findMany({ where: { groupId } });
    return {
      manualRanks: Object.fromEntries(rows.filter((r) => r.manualRank !== null).map((r) => [r.entryId, r.manualRank])),
      ranking: rankOf(rows),
    };
  }

  /** `ranks` replaces all manual ranks of the group and must cover exactly the tied blocks it settles. */
  async setManualRanks(groupId: string, body: ManualRanksBody) {
    const dirty = await this.prisma.$transaction(async (tx) => {
      const { draw, group } = await this.standings.lockForWrite(tx, groupId);
      await assertGroupsNotPlaced(tx, draw.subEventId, GROUPS_PLACED_MESSAGE);
      if (group.version !== body.expectedVersion) {
        throw conflict('GROUP_VERSION_CONFLICT', 'Bảng vừa được người khác thay đổi. Tải lại rồi thao tác lại', { currentVersion: group.version });
      }
      const before = await this.storedState(tx, groupId);
      const { result, version } = await this.standings.recompute(tx, groupId, body.ranks);
      const accepted = new Set(result.rows.filter((r) => r.manualRank !== null).map((r) => r.entryId));
      const rejected = Object.keys(body.ranks).filter((entryId) => !accepted.has(entryId));
      if (rejected.length) {
        throw invalid('INVALID_MANUAL_RANKS', 'Thứ hạng nhập tay phải phủ đúng nhóm đang hòa, mỗi VĐV một hạng khác nhau, liên tiếp từ hạng cao nhất của nhóm');
      }
      await this.audit.record(
        {
          action: 'group.manualRanks',
          entity: 'Group',
          entityId: groupId,
          reason: body.reason,
          before: { version: group.version, ...before },
          after: { version, manualRanks: body.ranks, ranking: rankOf(result.rows) },
        },
        tx,
      );
      return markRankingDirty(tx, [draw.subEventId]);
    });
    return this.respond(groupId, dirty);
  }

  async recompute(groupId: string) {
    const dirty = await this.prisma.$transaction(async (tx) => {
      const { draw, group } = await this.standings.lockForWrite(tx, groupId);
      await assertGroupsNotPlaced(tx, draw.subEventId, GROUPS_PLACED_MESSAGE);
      const before = await this.storedState(tx, groupId);
      const { result, version } = await this.standings.recompute(tx, groupId);
      await this.audit.record(
        {
          action: 'group.recompute',
          entity: 'Group',
          entityId: groupId,
          before: { version: group.version, ranking: before.ranking },
          after: { version, ranking: rankOf(result.rows), complete: result.complete },
        },
        tx,
      );
      return markRankingDirty(tx, [draw.subEventId]);
    });
    return this.respond(groupId, dirty);
  }

  private async respond(groupId: string, dirty: string[]) {
    const warnings = await this.ranking.enqueueRecompute(dirty);
    return { data: await this.views.forGroup(groupId), ...(warnings.length > 0 && { warnings }) };
  }
}
