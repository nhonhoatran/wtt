import { Injectable, NotFoundException } from '@nestjs/common';
import { ENTRY_IMPORT_COLUMNS, GENDER_EXPORT_LABELS, QUOTA_EXPORT_LABELS, STAGE_EXPORT_LABELS } from '@kamito/shared';
import type ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { abortDownload, startWorkbook, styleHeader } from './xlsx-stream.js';

const PAGE = 1000;
const STATUS_HEADER = 'Trạng thái';
const STATUS_LABELS = { CONFIRMED: 'Đã xác nhận', WITHDRAWN: 'Đã rút' } as const;

const PLAYER_SELECT = { code: true, fullName: true, gender: true, birthYear: true, club: true } as const;
type PlayerCells = { code: string; fullName: string; gender: keyof typeof GENDER_EXPORT_LABELS; birthYear: number | null; club: string | null };

const playerCells = (player?: PlayerCells): Array<string | number> =>
  player ? [player.code, player.fullName, GENDER_EXPORT_LABELS[player.gender], player.birthYear ?? '', player.club ?? ''] : ['', '', '', '', ''];

/** Same columns as the import template, so an export can be edited and imported again. */
@Injectable()
export class EntriesExportService {
  constructor(private readonly prisma: PrismaService) {}

  async stream(eventId: string, subEventId: string | undefined, res: Response): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    if (subEventId && !(await this.prisma.subEvent.findFirst({ where: { id: subEventId, eventId }, select: { id: true } }))) {
      throw new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Không tìm thấy nội dung thi đấu' });
    }

    const workbook = startWorkbook(res, `dang-ky-${event.slug}.xlsx`);
    try {
      const sheet = workbook.addWorksheet('Đăng ký', { views: [{ state: 'frozen', ySplit: 1 }] });
      sheet.columns = [...ENTRY_IMPORT_COLUMNS.map((column) => ({ width: column.width })), { width: 14 }];
      const header = sheet.addRow([...ENTRY_IMPORT_COLUMNS.map((column) => column.header), STATUS_HEADER]);
      styleHeader(header);
      header.commit();

      const subEvents = await this.prisma.subEvent.findMany({
        where: { eventId, ...(subEventId && { id: subEventId }) },
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
        select: { id: true },
      });
      for (const subEvent of subEvents) await this.writeSubEvent(sheet, subEvent.id);
      sheet.commit();
      await workbook.commit();
    } catch (error) {
      abortDownload(res, error);
    }
  }

  /** Pages one sub-event by entry id, so a plain id cursor stays correct however many entries it has. */
  private async writeSubEvent(sheet: ExcelJS.Worksheet, subEventId: string): Promise<void> {
    let cursor: string | undefined;
    for (;;) {
      const entries = await this.prisma.entry.findMany({
        where: { subEventId },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          status: true,
          stage: true,
          quotaType: true,
          seed: true,
          notes: true,
          subEvent: { select: { code: true } },
          competitor: { select: { player: { select: PLAYER_SELECT }, pair: { select: { playerA: { select: PLAYER_SELECT }, playerB: { select: PLAYER_SELECT } } } } },
        },
      });
      for (const entry of entries) {
        const { player, pair } = entry.competitor;
        const [first, second] = pair ? [pair.playerA, pair.playerB] : [player ?? undefined, undefined];
        sheet
          .addRow([entry.subEvent.code, ...playerCells(first), ...playerCells(second), STAGE_EXPORT_LABELS[entry.stage], QUOTA_EXPORT_LABELS[entry.quotaType], entry.seed ?? '', entry.notes ?? '', STATUS_LABELS[entry.status]])
          .commit();
      }
      if (entries.length < PAGE) break;
      cursor = entries[entries.length - 1]!.id;
    }
  }
}
