import { Injectable, NotFoundException } from '@nestjs/common';
import { lockDraw, lockSubEvent } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoundFormatBody } from './draw-dtos.js';
import { conflict, drawNotFound, versionConflict } from './draw-errors.js';
import { bumpVersion } from './draw-lock.js';

@Injectable()
export class RoundFormatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Sets (or clears, with null) the match format override of one round; null means inherit. */
  async setFormat(roundId: string, body: RoundFormatBody) {
    return this.prisma.$transaction(async (tx) => {
      const probe = await tx.round.findUnique({ where: { id: roundId }, select: { drawId: true, draw: { select: { subEventId: true } } } });
      if (!probe) throw new NotFoundException({ code: 'ROUND_NOT_FOUND', message: 'Không tìm thấy vòng đấu' });
      await lockSubEvent(tx, probe.draw.subEventId);
      await lockDraw(tx, probe.drawId);
      const draw = await tx.draw.findUnique({ where: { id: probe.drawId } });
      if (!draw) throw drawNotFound();
      if (draw.version !== body.expectedVersion) throw versionConflict(draw.version);

      const round = await tx.round.findUniqueOrThrow({ where: { id: roundId } });
      if (body.matchFormatId) {
        const format = await tx.matchFormat.findUnique({ where: { id: body.matchFormatId }, select: { isActive: true } });
        if (!format?.isActive) throw fieldError('matchFormatId', 'Thể thức trận không tồn tại hoặc đã ngừng dùng');
      }
      const started = await tx.match.count({ where: { roundId, status: { in: ['LIVE', 'OFFICIAL'] }, OR: [{ resultType: null }, { resultType: { not: 'BYE' } }] } });
      if (started) throw conflict('ROUND_STARTED', 'Vòng đã có trận bắt đầu, không đổi được thể thức');

      const updated = await tx.round.update({ where: { id: roundId }, data: { matchFormatId: body.matchFormatId } });
      const drawRow = await bumpVersion(tx, draw.id);
      await this.audit.record(
        {
          action: 'round.matchFormat',
          entity: 'Round',
          entityId: roundId,
          before: { matchFormatId: round.matchFormatId, drawId: draw.id },
          after: { matchFormatId: updated.matchFormatId, drawVersion: drawRow.version },
        },
        tx,
      );
      return { data: { id: updated.id, drawId: draw.id, matchFormatId: updated.matchFormatId, drawVersion: drawRow.version } };
    });
  }
}
