import { Injectable } from '@nestjs/common';
import { isStructureLocked } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SwapGroupMembersBody } from './draw-dtos.js';
import { invalid, notDraft, structureLocked } from './draw-errors.js';
import { bumpVersion, loadDrawLocked } from './draw-lock.js';
import { toDrawSummary } from './draw-view.js';

@Injectable()
export class GroupMemberSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Swaps two entries of a DRAFT group draw (across groups or inside one group). Each entry takes the
   * other's group and slot, and the generated group matches follow the entries.
   */
  async swap(drawId: string, body: SwapGroupMembersBody) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, body.expectedVersion);
      if (draw.status !== 'DRAFT') throw notDraft();
      if (draw.kind !== 'GROUP') throw invalid('KIND_NOT_ALLOWED', 'Chỉ đổi chỗ thành viên ở vòng bảng');
      if (await isStructureLocked(tx, drawId)) throw structureLocked();
      if (body.entryA === body.entryB) throw invalid('INVALID_PARAMS', 'Chọn hai VĐV khác nhau');

      const members = await tx.groupMember.findMany({ where: { entryId: { in: [body.entryA, body.entryB] }, group: { drawId } } });
      const a = members.find((m) => m.entryId === body.entryA);
      const b = members.find((m) => m.entryId === body.entryB);
      if (!a || !b) throw invalid('ENTRY_NOT_IN_DRAW', 'VĐV không thuộc vòng bảng này');

      const moves = [
        { entryId: a.entryId, from: a.groupId, to: b.groupId, slot: b.slot },
        { entryId: b.entryId, from: b.groupId, to: a.groupId, slot: a.slot },
      ];
      // Entries move out of the primary key's group one by one; (groupId, entryId) stays unique throughout.
      for (const m of moves) {
        await tx.groupMember.update({ where: { groupId_entryId: { groupId: m.from, entryId: m.entryId } }, data: { groupId: m.to, slot: m.slot } });
        await tx.groupStanding.update({ where: { groupId_entryId: { groupId: m.from, entryId: m.entryId } }, data: { groupId: m.to } });
      }

      const other = (id: string | null) => (id === a.entryId ? b.entryId : id === b.entryId ? a.entryId : id);
      const matches = await tx.match.findMany({
        where: { drawId, OR: [{ side1EntryId: { in: [a.entryId, b.entryId] } }, { side2EntryId: { in: [a.entryId, b.entryId] } }] },
        select: { id: true, side1EntryId: true, side2EntryId: true },
      });
      for (const m of matches) {
        await tx.match.update({
          where: { id: m.id },
          data: { side1EntryId: other(m.side1EntryId), side2EntryId: other(m.side2EntryId), version: { increment: 1 } },
        });
      }

      const updated = await bumpVersion(tx, drawId);
      await this.audit.record(
        {
          action: 'draw.swapGroupMembers',
          entity: 'Draw',
          entityId: drawId,
          before: { version: draw.version, a: { entryId: a.entryId, groupId: a.groupId, slot: a.slot }, b: { entryId: b.entryId, groupId: b.groupId, slot: b.slot } },
          after: { version: updated.version, a: { entryId: a.entryId, groupId: b.groupId, slot: b.slot }, b: { entryId: b.entryId, groupId: a.groupId, slot: a.slot } },
        },
        tx,
      );
      return { data: toDrawSummary(updated, false) };
    });
  }
}
