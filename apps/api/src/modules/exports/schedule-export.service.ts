import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { formatDateOnly } from '../events/date-only.js';
import { MATCH_RESULT_INCLUDE } from '../matches/match-result-view.js';
import { toEntryBrief } from '../matches/match-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { instantToHhmm } from '../sessions/session-time.js';
import { requireExportEvent, streamMatchSheet, type SheetColumn } from './match-export-support.js';

const STATUS_LABELS = { SCHEDULED: 'Chưa đấu', LIVE: 'Đang đấu', OFFICIAL: 'Đã có kết quả' } as const;
const COLUMNS: SheetColumn[] = [
  { header: 'Ngày', width: 12 },
  { header: 'Buổi', width: 10 },
  { header: 'Giờ', width: 8 },
  { header: 'Bàn', width: 12 },
  { header: 'Thứ tự', width: 8 },
  { header: 'Mã trận', width: 10 },
  { header: 'Nội dung', width: 22 },
  { header: 'Vòng', width: 10 },
  { header: 'Bảng', width: 8 },
  { header: 'Bên 1', width: 28 },
  { header: 'CLB bên 1', width: 24 },
  { header: 'Bên 2', width: 28 },
  { header: 'CLB bên 2', width: 24 },
  { header: 'Trạng thái', width: 14 },
];

const INCLUDE = { ...MATCH_RESULT_INCLUDE, session: { select: { code: true, date: true } } } as const;

const clubs = (side: ReturnType<typeof toEntryBrief>) => [...new Set((side?.players ?? []).map((p) => p.club).filter(Boolean))].join(' / ');

@Injectable()
export class ScheduleExportService {
  constructor(private readonly prisma: PrismaService) {}

  async stream(eventId: string, res: Response): Promise<void> {
    const event = await requireExportEvent(this.prisma, eventId);
    await streamMatchSheet(
      res,
      { fileName: `lich-thi-dau-${event.slug}.xlsx`, sheetName: 'Lịch thi đấu', columns: COLUMNS },
      (cursor, take) =>
        this.prisma.match.findMany({
          where: { eventId, isVoided: false, sessionId: { not: null } },
          include: INCLUDE,
          orderBy: [{ scheduledAt: 'asc' }, { matchNo: 'asc' }],
          take,
          ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        }),
      (m) => {
        const side1 = toEntryBrief(m.side1Entry);
        const side2 = toEntryBrief(m.side2Entry);
        return [
          m.session ? formatDateOnly(m.session.date) : '',
          m.session?.code ?? '',
          m.scheduledAt ? instantToHhmm(m.scheduledAt, event.timezone) : '',
          m.table ? (m.table.displayName ?? m.table.code) : '',
          m.orderInSession ?? '',
          m.matchNo,
          m.subEvent.name ?? m.subEvent.code,
          m.round.code,
          m.group?.code ?? '',
          side1?.displayName ?? '',
          clubs(side1),
          side2?.displayName ?? '',
          clubs(side2),
          STATUS_LABELS[m.status],
        ];
      },
    );
  }
}
