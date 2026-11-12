import { ENTRY_IMPORT_COLUMNS, type EntryImportColumnKey } from '@kamito/shared';
import { strToU8, zipSync } from 'fflate';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Text is a shared string, number a numeric cell, `{ formula, cached }` a formula with its stored result. */
export type ExcelSavedCell = string | number | { formula: string; cached: string };

export interface ExcelSavedRow {
  rowNo: number;
  cells: Partial<Record<EntryImportColumnKey, ExcelSavedCell>>;
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columnLetter = (index: number) => String.fromCharCode(65 + index);

/**
 * Hand-written xlsx laid out like a workbook saved by Excel: worksheet before sharedStrings and styles
 * in the zip, text in shared strings, numbers as numeric cells, formulas with cached string results.
 * Row 1 is the template header; `dataRows` must be in ascending rowNo order.
 */
export function buildExcelSavedXlsx(dataRows: ExcelSavedRow[], sheetName = 'Đăng ký'): Buffer {
  const strings: string[] = [];
  let references = 0;
  const sharedIndex = (text: string) => {
    references += 1;
    const existing = strings.indexOf(text);
    if (existing >= 0) return existing;
    strings.push(text);
    return strings.length - 1;
  };

  const cellXml = (ref: string, value: ExcelSavedCell) => {
    if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`;
    if (typeof value === 'string') return `<c r="${ref}" t="s"><v>${sharedIndex(value)}</v></c>`;
    return `<c r="${ref}" t="str"><f>${escapeXml(value.formula)}</f><v>${escapeXml(value.cached)}</v></c>`;
  };

  const headerXml = `<row r="1">${ENTRY_IMPORT_COLUMNS.map((column, i) => cellXml(`${columnLetter(i)}1`, column.header)).join('')}</row>`;
  const bodyXml = dataRows.map((row) => {
    const cells = ENTRY_IMPORT_COLUMNS.flatMap((column, i) => {
      const value = row.cells[column.key];
      return value === undefined ? [] : [cellXml(`${columnLetter(i)}${row.rowNo}`, value)];
    });
    return cells.length ? `<row r="${row.rowNo}">${cells.join('')}</row>` : `<row r="${row.rowNo}"/>`;
  });
  const lastRow = dataRows.reduce((max, row) => Math.max(max, row.rowNo), 1);

  const sheetXml = `${XML_DECL}<worksheet xmlns="${NS}" xmlns:r="${REL_NS}"><dimension ref="A1:${columnLetter(ENTRY_IMPORT_COLUMNS.length - 1)}${lastRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${headerXml}${bodyXml.join('')}</sheetData></worksheet>`;
  const sharedStringsXml = `${XML_DECL}<sst xmlns="${NS}" count="${references}" uniqueCount="${strings.length}">${strings.map((text) => `<si><t>${escapeXml(text)}</t></si>`).join('')}</sst>`;

  const entries: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8(`${XML_DECL}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${XML_DECL}<workbook xmlns="${NS}" xmlns:r="${REL_NS}"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${XML_DECL}<Relationships xmlns="${PKG_REL_NS}"><Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL_NS}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    'xl/sharedStrings.xml': strToU8(sharedStringsXml),
    'xl/styles.xml': strToU8(`${XML_DECL}<styleSheet xmlns="${NS}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
  };
  return Buffer.from(zipSync(entries));
}
