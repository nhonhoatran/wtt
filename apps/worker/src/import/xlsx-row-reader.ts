import { ENTRY_IMPORT_COLUMNS, normalizePersonName, type EntryImportRawRow } from '@kamito/shared';
import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ImportFailure } from './import-row-types.js';

export interface SheetRow {
  rowNo: number;
  cells: EntryImportRawRow;
}

/** Plain text of a cell: formulas give their result, rich text its runs, dates ISO date. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if ('richText' in value) return value.richText.map((run) => run.text).join('').trim();
  if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
  if ('text' in value) return cellText(value.text as ExcelJS.CellValue);
  if ('error' in value) return '';
  return '';
}

const headerKey = (text: string) => normalizePersonName(text);

function assertHeader(header: ExcelJS.Row | undefined): void {
  ENTRY_IMPORT_COLUMNS.forEach((column, i) => {
    const actual = header ? cellText(header.getCell(i + 1).value) : '';
    if (headerKey(actual) !== headerKey(column.header)) {
      throw new ImportFailure(`Cột ${i + 1} phải có tiêu đề "${column.header}", file đang có "${actual || '(trống)'}"`);
    }
  });
}

const SHEET_ENTRY = /^xl\/worksheets\/sheet\d+\.xml$/;

/** exceljs' stream reader drops zip entries that follow a worksheet, so worksheets are moved last (stored, not compressed). */
function worksheetsLast(bytes: Buffer, maxUnzippedBytes: number): Buffer {
  // unzipSync follows the central directory, so entries sharing one local entry are counted (and allocated) once each.
  let declared = 0;
  const entries = unzipSync(new Uint8Array(bytes), {
    filter: (file) => {
      declared += file.originalSize;
      if (declared > maxUnzippedBytes) throw new ImportFailure('File giải nén quá lớn');
      return true;
    },
  });
  const ordered: Record<string, Uint8Array> = {};
  const names = Object.keys(entries).filter((name) => !name.endsWith('/'));
  for (const name of names) if (!SHEET_ENTRY.test(name)) ordered[name] = entries[name]!;
  for (const name of names.filter((item) => SHEET_ENTRY.test(item)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) ordered[name] = entries[name]!;
  return Buffer.from(zipSync(ordered, { level: 0 }));
}

async function collectRows(file: string, maxRows: number): Promise<SheetRow[]> {
  // Streaming keeps memory flat: the in-memory loader needed ~330 MB of heap for a 50 MB unzipped sheet.
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(file, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    entries: 'ignore',
  });
  // exceljs 4.4.0 dereferences the workbook model for every sheet but leaves it unset when workbook.xml
  // is not fully parsed (seen with some writers); the sheet names it supplies are not needed here.
  let model: object = {};
  Object.defineProperty(reader, 'model', { get: () => model, set: (value?: object) => void (model = value ?? model) });
  const rows: SheetRow[] = [];
  let first = true;
  // Later sheets are drained, not skipped: breaking early would leave exceljs' temp copy of a sheet behind.
  for await (const sheet of reader) {
    if (!first) {
      for await (const row of sheet) void row;
      continue;
    }
    first = false;
    let headerChecked = false;
    for await (const row of sheet) {
      if (!headerChecked) {
        headerChecked = true;
        assertHeader(row.number === 1 ? row : undefined);
        if (row.number === 1) continue;
      }
      const cells: EntryImportRawRow = {};
      let filled = false;
      ENTRY_IMPORT_COLUMNS.forEach((column, i) => {
        const text = cellText(row.getCell(i + 1).value);
        if (text) filled = true;
        cells[column.key] = text;
      });
      if (!filled) continue;
      rows.push({ rowNo: row.number, cells });
      if (rows.length > maxRows) throw new ImportFailure(`File có hơn ${maxRows} dòng dữ liệu`);
    }
    if (!headerChecked) assertHeader(undefined);
  }
  if (first) throw new ImportFailure('File Excel không có trang tính nào');
  return rows;
}

/**
 * Reads the first worksheet of a verified xlsx buffer: header row must match the template and
 * fully empty rows are skipped. Stops with ImportFailure once more than `maxRows` data rows exist.
 */
export async function readEntryRows(bytes: Buffer, maxRows: number, maxUnzippedBytes: number): Promise<SheetRow[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kamito-import-'));
  try {
    const file = path.join(dir, 'upload.xlsx');
    await writeFile(file, worksheetsLast(bytes, maxUnzippedBytes));
    return await collectRows(file, maxRows);
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    throw new ImportFailure('File Excel bị hỏng hoặc không đọc được');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
