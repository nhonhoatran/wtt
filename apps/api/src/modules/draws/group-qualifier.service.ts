import { Injectable } from '@nestjs/common';
import { deriveMatches, fillGroupPlaces } from '@kamito/competition-engine';
import { isStructureLocked, lockGroups } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { GroupStandingsService } from '../groups/group-standings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { syncDerivedMatches } from './draw-derived-sync.js';
import { conflict, invalid, runEngine } from './draw-errors.js';
import { bumpVersion, loadDrawLocked } from './draw-lock.js';
import { toPositionData, writePositions } from './draw-position-io.js';
import { toDrawSummary } from './draw-view.js';

@Injectable()
export class GroupQualifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly standings: GroupStandingsService,
  ) {}

  /**
   * Fills the GROUP_PLACE slots of the MAIN draw with the entries that finished 1st/2nd in each group.
   * Standings are computed fresh from the matches (not read from stored rows) so a stale table can never be placed.
   */
  async place(drawId: string, expectedVersion: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const draw = await loadDrawLocked(tx, drawId, expectedVersion);
        const subEvent = await tx.subEvent.findUniqueOrThrow({ where: { id: draw.subEventId }, select: { format: true } });
        if (draw.kind !== 'MAIN' || subEvent.format !== 'GROUP_KNOCKOUT') {
          throw invalid('KIND_NOT_ALLOWED', 'Chỉ xếp đội đi tiếp vào nhánh chính của nội dung có vòng bảng');
        }
        const rows = await tx.bracketPosition.findMany({ where: { drawId }, orderBy: { position: 'asc' } });
        if (!rows.some((r) => r.source === 'GROUP_PLACE')) throw conflict('NO_GROUP_PLACE_SLOTS', 'Nhánh chính không còn ô nào chờ đội đi tiếp từ bảng');

        const groupDraw = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId: draw.subEventId, kind: 'GROUP' } } });
        if (!groupDraw || groupDraw.advancePerGroup === null) throw conflict('GROUP_DRAW_MISSING', 'Chưa có nhánh vòng bảng');
        await lockGroups(tx, groupDraw.id);
        const groups = await tx.group.findMany({ where: { drawId: groupDraw.id }, orderBy: { order: 'asc' } });

        const entryByPlace = new Map<string, string>();
        const unfinished: string[] = [];
        const tied: string[] = [];
        for (const group of groups) {
          const result = await this.standings.compute(tx, group.id);
          if (!result.complete) {
            unfinished.push(group.code);
            continue;
          }
          const qualified = result.rows.filter((r) => r.qualified);
          for (let place = 1; place <= groupDraw.advancePerGroup; place++) {
            const row = qualified[place - 1];
            if (!row) {
              tied.push(group.code);
              break;
            }
            entryByPlace.set(`${group.code}:${place}`, row.entryId);
          }
        }
        if (unfinished.length) throw conflict('GROUPS_NOT_FINISHED', 'Một số bảng chưa đấu xong', { pendingGroups: unfinished });
        if (tied.length) throw conflict('MANUAL_TIEBREAK_PENDING', 'Một số bảng còn hòa cần xếp hạng tay', { groups: tied });

        const filled = runEngine(() => fillGroupPlaces(rows.map(toPositionData), entryByPlace));
        const derived = runEngine(() => deriveMatches({ positions: filled, size: rows.length, scopeKey: 'S1', section: 1 }));
        await writePositions(tx, rows, filled);
        await syncDerivedMatches(tx, drawId, 'S1', derived.matches, 'fill');
        const updated = await bumpVersion(tx, drawId);
        await this.audit.record(
          {
            action: 'draw.placeGroupQualifiers',
            entity: 'Draw',
            entityId: drawId,
            after: { version: updated.version, groupDrawId: groupDraw.id, places: Object.fromEntries(entryByPlace) },
          },
          tx,
        );
        return { data: toDrawSummary(updated, await isStructureLocked(tx, drawId)) };
      },
      { timeout: 30_000 },
    );
  }
}
