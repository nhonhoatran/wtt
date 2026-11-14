import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { addDays } from '@kamito/ranking-engine';
import { AuditService } from '../../common/audit/audit.service.js';
import { dateFromIso, toIsoDate, todayIso } from '../../common/validation/iso-date-field.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateManualPointsBody } from './ranking-points-dtos.js';

const snapshotOf = (row: { id: string; rankingListId: string; playerId: string; points: number; earnedAt: Date; expiresAt: Date; reason: string | null }) => ({
  id: row.id,
  rankingListId: row.rankingListId,
  playerId: row.playerId,
  points: row.points,
  earnedAt: toIsoDate(row.earnedAt),
  expiresAt: toIsoDate(row.expiresAt),
  reason: row.reason,
});

/** MANUAL ledger rows: history imports and adjustments. AUTO rows are only ever written by the worker. */
@Injectable()
export class RankingPointsManualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(body: CreateManualPointsBody, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.rankingList.findUnique({ where: { id: body.rankingListId }, select: { validityDays: true } });
      if (!list) throw fieldError('rankingListId', 'Bảng xếp hạng không tồn tại');
      const player = await tx.player.findUnique({ where: { id: body.playerId }, select: { isActive: true, mergedIntoId: true } });
      if (!player || player.mergedIntoId) throw fieldError('playerId', 'VĐV không tồn tại hoặc đã được gộp');
      if (!player.isActive) throw fieldError('playerId', 'VĐV đang bị ẩn');

      const earnedAt = body.earnedAt ?? todayIso();
      const expiresAt = body.expiresAt ?? addDays(earnedAt, list.validityDays);
      if (expiresAt <= earnedAt) throw fieldError('expiresAt', 'Ngày hết hạn phải sau ngày ghi nhận');
      const row = await tx.rankingPointsEarned.create({
        data: {
          rankingListId: body.rankingListId,
          playerId: body.playerId,
          source: 'MANUAL',
          points: body.points,
          earnedAt: dateFromIso(earnedAt),
          expiresAt: dateFromIso(expiresAt),
          reason: body.reason,
          createdById: actorUserId,
        },
      });
      await this.audit.record(
        { action: 'ranking.points.manual.create', entity: 'RankingPointsEarned', entityId: row.id, after: snapshotOf(row), reason: body.reason },
        tx,
      );
      return row;
    });
  }

  async remove(id: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.rankingPointsEarned.findUnique({ where: { id } });
      if (!row) throw new NotFoundException({ code: 'RANKING_POINTS_NOT_FOUND', message: 'Không tìm thấy dòng điểm' });
      if (row.source !== 'MANUAL') {
        throw new UnprocessableEntityException({ code: 'RANKING_POINTS_NOT_MANUAL', message: 'Chỉ xóa được điểm nhập thủ công; điểm tự động do hệ thống tính lại' });
      }
      await tx.rankingPointsEarned.delete({ where: { id } });
      await this.audit.record(
        { action: 'ranking.points.manual.delete', entity: 'RankingPointsEarned', entityId: id, before: snapshotOf(row), reason },
        tx,
      );
    });
    return { id };
  }
}
