import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { createRng, deriveMatches, fillQualifierSlots, swapPositions } from '@kamito/competition-engine';
import { isStructureLocked, type Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { syncDerivedMatches } from './draw-derived-sync.js';
import type { SwapBody } from './draw-dtos.js';
import { conflict, invalid, notDraft, runEngine, structureLocked } from './draw-errors.js';
import { bumpVersion, loadDrawLocked } from './draw-lock.js';
import { refOf, toPositionData as toData, writePositions } from './draw-position-io.js';
import { toDrawSummary } from './draw-view.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DrawEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** positionA/positionB are BracketPosition ids from the bracket read; both must sit in the same section. */
  async swap(drawId: string, body: SwapBody) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, body.expectedVersion);
      if (draw.status !== 'DRAFT') throw notDraft();
      if (await isStructureLocked(tx, drawId)) throw structureLocked();
      if (body.positionA === body.positionB) throw invalid('INVALID_PARAMS', 'Chọn hai vị trí khác nhau');

      const rows = await tx.bracketPosition.findMany({ where: { drawId } });
      const a = rows.find((r) => r.id === body.positionA);
      const b = rows.find((r) => r.id === body.positionB);
      if (!a || !b) throw invalid('POSITION_NOT_FOUND', 'Vị trí không thuộc nhánh này');
      if (a.section !== b.section) throw invalid('CROSS_SECTION_SWAP', 'Chỉ đổi chỗ được trong cùng một nhánh con');

      const section = rows.filter((r) => r.section === a.section).map(toData);
      const swapped = runEngine(() => swapPositions(section, a.position, b.position));
      const derived = runEngine(() =>
        deriveMatches({
          positions: swapped,
          size: section.length,
          scopeKey: `S${a.section}`,
          section: a.section,
          roundStyle: draw.kind === 'QUALIFYING' ? 'QUALIFYING' : 'MAIN',
        }),
      );
      await writePositions(tx, rows.filter((r) => r.section === a.section), swapped);
      await syncDerivedMatches(tx, drawId, `S${a.section}`, derived.matches, 'full');
      const updated = await bumpVersion(tx, drawId);
      await this.audit.record(
        {
          action: 'draw.swap',
          entity: 'Draw',
          entityId: drawId,
          before: { version: draw.version, a: refOf(a), b: refOf(b) },
          after: { version: updated.version, a: { ...refOf(a), source: b.source, entryId: b.entryId }, b: { ...refOf(b), source: a.source, entryId: a.entryId } },
        },
        tx,
      );
      return { data: toDrawSummary(updated, false) };
    });
  }

  /** Needs every QUALIFYING section final OFFICIAL. Allowed on a published MAIN draw: only empty Q sides are filled. */
  async placeQualifiers(drawId: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const draw = await loadDrawLocked(tx, drawId, expectedVersion);
      if (draw.kind !== 'MAIN') throw invalid('KIND_NOT_ALLOWED', 'Chỉ xếp suất vòng loại vào nhánh chính');
      const rows = await tx.bracketPosition.findMany({ where: { drawId }, orderBy: { position: 'asc' } });
      if (!rows.some((r) => r.source === 'QUALIFIER')) throw conflict('NO_QUALIFIER_SLOTS', 'Nhánh chính không còn suất vòng loại nào cần xếp');

      const qualifying = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId: draw.subEventId, kind: 'QUALIFYING' } } });
      if (!qualifying) throw conflict('QUALIFYING_DRAW_MISSING', 'Chưa có nhánh vòng loại');
      // After a reopen only the freed slots are refilled, with the section winners not yet seated in this draw.
      const freeSlots = rows.filter((r) => r.source === 'QUALIFIER').length;
      const seated = new Set(rows.map((r) => r.entryId));
      const winners = (await this.sectionWinners(tx, qualifying.id, qualifying.qualifierCount ?? 0)).filter((id) => !seated.has(id));
      if (winners.length !== freeSlots) {
        throw conflict('QUALIFIER_SLOT_MISMATCH', `Còn ${freeSlots} suất vòng loại trống nhưng có ${winners.length} người thắng chưa được xếp. Kiểm tra lại các ô Q của nhánh chính`);
      }

      const positions = rows.map(toData);
      const placementSeed = randomBytes(16).toString('hex');
      const rng = createRng(placementSeed);
      const filled = runEngine(() => fillQualifierSlots(positions, winners, rng));
      const derived = runEngine(() => deriveMatches({ positions: filled, size: positions.length, scopeKey: 'S1', section: 1 }));
      await writePositions(tx, rows, filled);
      await syncDerivedMatches(tx, drawId, 'S1', derived.matches, 'fill');
      const updated = await bumpVersion(tx, drawId);
      await this.audit.record(
        {
          action: 'draw.placeQualifiers',
          entity: 'Draw',
          entityId: drawId,
          after: { version: updated.version, placementSeed, qualifierEntryIds: winners },
        },
        tx,
      );
      return { data: toDrawSummary(updated, await isStructureLocked(tx, drawId)) };
    });
  }

  private async sectionWinners(tx: Tx, qualifyingDrawId: string, sections: number): Promise<string[]> {
    const finals = await tx.match.findMany({
      where: { drawId: qualifyingDrawId, nextMatchId: null },
      select: { section: true, status: true, winnerSide: true, side1EntryId: true, side2EntryId: true },
      orderBy: { section: 'asc' },
    });
    const winners: string[] = [];
    const pending: number[] = [];
    for (let section = 1; section <= sections; section++) {
      const final = finals.find((m) => m.section === section);
      const id = final?.status === 'OFFICIAL' ? (final.winnerSide === 1 ? final.side1EntryId : final.winnerSide === 2 ? final.side2EntryId : null) : null;
      if (id) winners.push(id);
      else pending.push(section);
    }
    if (pending.length) {
      throw conflict('QUALIFYING_NOT_FINISHED', 'Vòng loại chưa đấu xong chung kết ở tất cả các nhánh con', { pendingSections: pending });
    }
    return winners;
  }
}
