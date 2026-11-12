import ExcelJS from 'exceljs';
import type { Response } from 'express';

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Starts an xlsx download that is written straight to the response, never buffered whole in memory. */
export function startWorkbook(res: Response, fileName: string): ExcelJS.stream.xlsx.WorkbookWriter {
  res.status(200);
  res.setHeader('Content-Type', XLSX_CONTENT_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Cache-Control', 'no-store');
  return new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
}

export function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  row.alignment = { vertical: 'middle', wrapText: true };
}

/** A download that fails after the first byte cannot change its status code; cut the connection instead. */
export function abortDownload(res: Response, error: unknown): void {
  if (!res.headersSent) throw error;
  res.destroy(error instanceof Error ? error : undefined);
}
