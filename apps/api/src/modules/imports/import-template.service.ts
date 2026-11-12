import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ENTRY_IMPORT_COLUMNS,
  GENDER_EXPORT_LABELS,
  importSettings,
  effectiveLimit,
  QUOTA_EXPORT_LABELS,
  STAGE_EXPORT_LABELS,
} from '@kamito/shared';
import type ExcelJS from 'exceljs';
import type { Response } from 'express';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { abortDownload, startWorkbook, styleHeader } from '../exports/xlsx-stream.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { INSTRUCTIONS, PLAYER_SHEET_COLUMNS } from './import-template-content.js';

const PLAYER_PAGE = 1000;
const SHEET_REGISTER = 'Đăng ký';
const SHEET_GUIDE = 'Hướng dẫn';
const SHEET_PLAYERS = 'VĐV đã có';
const SHEET_CODES = 'Mã nội dung';

const listValidation = (formula: string) => ({ type: 'list' as const, allowBlank: true, formulae: [formula], showErrorMessage: true });
/** Fixed labels stay far below Excel's 255-character limit for an inline list. */
const inlineList = (values: string[]) => listValidation(`"${values.join(',')}"`);
/** Sub-event codes grow with the event, so they live in a sheet range instead of an inline list. */
const codesRange = (count: number) => listValidation(`'${SHEET_CODES}'!$A$2:$A$${count + 1}`);

@Injectable()
export class ImportTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async stream(eventId: string, res: Response): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    const subEvents = await this.prisma.subEvent.findMany({
      where: { eventId },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, discipline: { select: { name: true, competitorKind: true } } },
    });
    const maxRows = effectiveLimit(await this.settings.get(importSettings.maxRows), this.env.IMPORT_MAX_ROWS);

    const workbook = startWorkbook(res, `mau-import-${event.slug}.xlsx`);
    try {
      this.registerSheet(workbook, subEvents.map((subEvent) => subEvent.code), maxRows);
      this.guideSheet(workbook, subEvents);
      await this.playerSheet(workbook);
      this.codesSheet(workbook, subEvents.map((subEvent) => subEvent.code));
      await workbook.commit();
    } catch (error) {
      abortDownload(res, error);
    }
  }

  private registerSheet(workbook: ExcelJS.stream.xlsx.WorkbookWriter, codes: string[], maxRows: number): void {
    const sheet = workbook.addWorksheet(SHEET_REGISTER, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = ENTRY_IMPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));
    const header = sheet.addRow(ENTRY_IMPORT_COLUMNS.map((column) => column.header));
    styleHeader(header);
    header.commit();
    const lastRow = maxRows + 1;
    const validations: Array<[string, ReturnType<typeof listValidation> | null]> = [
      ['subEventCode', codes.length ? codesRange(codes.length) : null],
      ['player1Gender', inlineList(Object.values(GENDER_EXPORT_LABELS))],
      ['player2Gender', inlineList(Object.values(GENDER_EXPORT_LABELS))],
      ['stage', inlineList(Object.values(STAGE_EXPORT_LABELS))],
      ['quotaType', inlineList(Object.values(QUOTA_EXPORT_LABELS))],
    ];
    for (const [key, validation] of validations) {
      if (!validation) continue;
      const letter = columnLetter(ENTRY_IMPORT_COLUMNS.findIndex((column) => column.key === key));
      // The streaming writer owns a dataValidations collection that the shared Worksheet typings omit.
      (sheet as unknown as { dataValidations: { add(address: string, validation: object): void } }).dataValidations.add(`${letter}2:${letter}${lastRow}`, validation);
    }
    sheet.commit();
  }

  private codesSheet(workbook: ExcelJS.stream.xlsx.WorkbookWriter, codes: string[]): void {
    const sheet = workbook.addWorksheet(SHEET_CODES, { state: 'hidden' });
    sheet.addRow(['Mã nội dung']).commit();
    for (const code of codes) sheet.addRow([code]).commit();
    sheet.commit();
  }

  private guideSheet(workbook: ExcelJS.stream.xlsx.WorkbookWriter, subEvents: Array<{ code: string; name: string | null; discipline: { name: string; competitorKind: string } }>): void {
    const sheet = workbook.addWorksheet(SHEET_GUIDE);
    sheet.columns = [{ width: 110 }];
    for (const line of INSTRUCTIONS) sheet.addRow([line]).commit();
    sheet.addRow(['']).commit();
    const title = sheet.addRow(['Mã nội dung của giải này']);
    styleHeader(title);
    title.commit();
    for (const subEvent of subEvents) {
      const kind = subEvent.discipline.competitorKind === 'DOUBLES' ? 'đôi, nhập đủ VĐV 1 và VĐV 2' : 'đơn, chỉ nhập VĐV 1';
      sheet.addRow([`${subEvent.code} - ${subEvent.name ?? subEvent.discipline.name} (${kind})`]).commit();
    }
    sheet.commit();
  }

  private async playerSheet(workbook: ExcelJS.stream.xlsx.WorkbookWriter): Promise<void> {
    const sheet = workbook.addWorksheet(SHEET_PLAYERS, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = PLAYER_SHEET_COLUMNS.map((column) => ({ width: column.width }));
    const header = sheet.addRow(PLAYER_SHEET_COLUMNS.map((column) => column.header));
    styleHeader(header);
    header.commit();
    let cursor: string | undefined;
    for (;;) {
      const players = await this.prisma.player.findMany({
        where: { isActive: true, mergedIntoId: null },
        orderBy: { id: 'asc' },
        take: PLAYER_PAGE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: { id: true, code: true, fullName: true, gender: true, birthYear: true, club: true },
      });
      for (const player of players) {
        sheet.addRow([player.code, player.fullName, GENDER_EXPORT_LABELS[player.gender], player.birthYear, player.club]).commit();
      }
      if (players.length < PLAYER_PAGE) break;
      cursor = players[players.length - 1]!.id;
    }
    sheet.commit();
  }
}

function columnLetter(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}
