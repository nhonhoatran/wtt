import { NotFoundException } from '@nestjs/common';
import type ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { abortDownload, startWorkbook, styleHeader } from './xlsx-stream.js';

const PAGE = 1000;

export interface SheetColumn {
  header: string;
  width: number;
}

export async function requireExportEvent(prisma: PrismaService, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true, timezone: true } });
  if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
  return event;
}

/** Streams one worksheet: header, then pages of rows fetched by id cursor so memory stays flat however many matches exist. */
export async function streamMatchSheet<T extends { id: string }>(
  res: Response,
  options: { fileName: string; sheetName: string; columns: SheetColumn[] },
  fetchPage: (cursor: string | undefined, take: number) => Promise<T[]>,
  toRow: (item: T) => Array<string | number>,
): Promise<void> {
  let items: T[];
  try {
    // Read the first page before any header goes out, so a database error still yields a clean JSON error.
    items = await fetchPage(undefined, PAGE);
  } catch (error) {
    return abortDownload(res, error);
  }
  const workbook = startWorkbook(res, options.fileName);
  try {
    const sheet: ExcelJS.Worksheet = workbook.addWorksheet(options.sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = options.columns.map((c) => ({ width: c.width }));
    const header = sheet.addRow(options.columns.map((c) => c.header));
    styleHeader(header);
    header.commit();
    for (;;) {
      for (const item of items) sheet.addRow(toRow(item)).commit();
      if (items.length < PAGE || res.destroyed) break;
      items = await fetchPage(items[items.length - 1]!.id, PAGE);
    }
    sheet.commit();
    if (!res.destroyed) await workbook.commit();
  } catch (error) {
    abortDownload(res, error);
  }
}
