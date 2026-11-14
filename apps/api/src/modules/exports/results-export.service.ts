import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { formatDateOnly } from '../events/date-only.js';
import { MATCH_DETAIL_INCLUDE } from '../matches/match-result-view.js';
import { toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { requireExportEvent, streamMatchSheet, type SheetColumn } from './match-export-support.js';

const RESULT_TYPE_LABELS = { NORMAL: 'Thường', WALKOVER: 'Không đến', RETIRED: 'Bỏ cuộc', DISQUALIFIED: 'Truất quyền', BYE: 'BYE' } as const;
const COLUMNS: SheetColumn[] = [
  { header: 'Mã trận', width: 10 },
  { header: 'Nội dung', width: 22 },
  { header: 'Vòng', width: 10 },
  { header: 'Bảng', width: 8 },
  { header: 'Bên 1', width: 28 },
  { header: 'Bên 2', width: 28 },
  { header: 'Số ván bên 1', width: 12 },
  { header: 'Số ván bên 2', width: 12 },
  { header: 'Điểm từng ván', width: 32 },
  { header: 'Bên thắng', width: 28 },
  { header: 'Loại kết quả', width: 14 },
  { header: 'Ngày chốt', width: 12 },
];

@Injectable()
export class ResultsExportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Confirmed results only; BYEs carry no result and are left out. */
  async stream(eventId: string, res: Response): Promise<void> {
    const event = await requireExportEvent(this.prisma, eventId);
    await streamMatchSheet(
      res,
      { fileName: `ket-qua-${event.slug}.xlsx`, sheetName: 'Kết quả', columns: COLUMNS },
      (cursor, take) =>
        this.prisma.match.findMany({
          where: { eventId, isVoided: false, status: 'OFFICIAL', OR: [{ resultType: null }, { resultType: { not: 'BYE' } }] },
          include: MATCH_DETAIL_INCLUDE,
          orderBy: { matchNo: 'asc' },
          take,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        }),
      (m) => {
        const side1 = toEntryBrief(m.side1Entry);
        const side2 = toEntryBrief(m.side2Entry);
        const winner = m.winnerSide === 1 ? side1 : m.winnerSide === 2 ? side2 : null;
        return [
          m.matchNo,
          m.subEvent.name ?? m.subEvent.code,
          m.round.code,
          m.group?.code ?? '',
          side1?.displayName ?? '',
          side2?.displayName ?? '',
          m.games1 ?? '',
          m.games2 ?? '',
          m.games.map((g) => `${g.score1}-${g.score2}`).join(', '),
          winner?.displayName ?? '',
          m.resultType ? RESULT_TYPE_LABELS[m.resultType] : '',
          m.officialAt ? formatDateOnly(m.officialAt) : '',
        ];
      },
    );
  }
}
