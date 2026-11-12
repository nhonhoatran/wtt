import {
  cleanPersonName,
  GENDER_IMPORT_VALUES,
  normalizePersonName,
  QUOTA_IMPORT_VALUES,
  STAGE_IMPORT_VALUES,
  type DisciplineCompetitorKind,
  type DisciplineGenderRule,
  type EntryImportRawRow,
} from '@kamito/shared';
import type { Gender, RowData } from './import-row-types.js';

export interface SubEventInfo {
  id: string;
  code: string;
  competitorKind: DisciplineCompetitorKind;
  genderRule: DisciplineGenderRule;
  hasQualifying: boolean;
  maxEntries: number | null;
  category: { name: string; minAge: number | null; maxAge: number | null } | null;
}

export interface ParsedSlot {
  slot: 1 | 2;
  code: string | null;
  fullName: string;
  gender: Gender | null;
  birthYear: number | null;
  club: string | null;
}

export interface ParsedRow {
  subEvent: SubEventInfo | null;
  header: Pick<RowData, 'subEventCode' | 'stage' | 'quotaType' | 'stageGiven' | 'quotaTypeGiven' | 'seed' | 'notes'>;
  slots: ParsedSlot[];
  errors: string[];
}

const MAX_NAME = 120;
const MAX_CLUB = 120;
const MAX_NOTES = 500;
const MIN_BIRTH_YEAR = 1900;

const lookup = <T>(table: Record<string, T>, text: string): T | undefined => table[normalizePersonName(text)];

function parseSlot(raw: EntryImportRawRow, slot: 1 | 2, currentYear: number, errors: string[]): ParsedSlot | null {
  const get = (field: 'Code' | 'Name' | 'Gender' | 'BirthYear' | 'Club') => raw[`player${slot}${field}` as keyof EntryImportRawRow] ?? '';
  const code = get('Code');
  const name = cleanPersonName(get('Name'));
  const genderText = get('Gender');
  const yearText = get('BirthYear');
  const club = cleanPersonName(get('Club'));
  if (!code && !name && !genderText && !yearText && !club) return null;

  let gender: Gender | null = null;
  if (genderText) {
    gender = lookup(GENDER_IMPORT_VALUES, genderText) ?? null;
    if (!gender) errors.push(`Giới tính ${slot} "${genderText}" không hợp lệ (Nam hoặc Nữ)`);
  }
  let birthYear: number | null = null;
  if (yearText) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR || year > currentYear) errors.push(`Năm sinh ${slot} "${yearText}" không hợp lệ`);
    else birthYear = year;
  }
  if (name.length > MAX_NAME) errors.push(`Họ tên VĐV ${slot} dài quá ${MAX_NAME} ký tự`);
  if (club.length > MAX_CLUB) errors.push(`CLB ${slot} dài quá ${MAX_CLUB} ký tự`);
  return { slot, code: code || null, fullName: name, gender, birthYear, club: club || null };
}

/** Structural validation of one spreadsheet row (everything that needs no player lookup). */
export function mapEntryRow(raw: EntryImportRawRow, subEvents: Map<string, SubEventInfo>, currentYear: number): ParsedRow {
  const errors: string[] = [];
  const codeText = (raw.subEventCode ?? '').trim();
  const subEvent = subEvents.get(codeText.toUpperCase()) ?? null;
  if (!codeText) errors.push('Thiếu mã nội dung');
  else if (!subEvent) errors.push(`Mã nội dung "${codeText}" không có trong giải này`);

  let stage: RowData['stage'] = 'MAIN';
  if (raw.stage) {
    const parsed = lookup(STAGE_IMPORT_VALUES, raw.stage);
    if (parsed) stage = parsed;
    else errors.push(`Vòng "${raw.stage}" không hợp lệ (Chính hoặc Loại)`);
  }
  if (stage === 'QUALIFYING' && subEvent && !subEvent.hasQualifying) errors.push(`Nội dung ${subEvent.code} không có vòng loại`);

  let quotaType: RowData['quotaType'] = 'DIRECT';
  if (raw.quotaType) {
    const parsed = lookup(QUOTA_IMPORT_VALUES, raw.quotaType);
    if (parsed) quotaType = parsed;
    else errors.push(`Suất "${raw.quotaType}" không hợp lệ (Thường, Đặc cách hoặc Từ vòng loại)`);
  }

  let seed: number | null = null;
  if (raw.seed) {
    const value = Number(raw.seed);
    if (!Number.isInteger(value) || value < 1) errors.push(`Hạt giống "${raw.seed}" phải là số nguyên từ 1`);
    else seed = value;
  }
  const notes = (raw.notes ?? '').trim();
  if (notes.length > MAX_NOTES) errors.push(`Ghi chú dài quá ${MAX_NOTES} ký tự`);

  const slots = [parseSlot(raw, 1, currentYear, errors), parseSlot(raw, 2, currentYear, errors)].filter((slot): slot is ParsedSlot => slot !== null);
  if (!slots.some((slot) => slot.slot === 1)) errors.push('Thiếu VĐV 1');
  if (subEvent?.competitorKind === 'SINGLES' && slots.some((slot) => slot.slot === 2)) errors.push('Nội dung đơn không có VĐV 2');
  if (subEvent?.competitorKind === 'DOUBLES' && slots.length < 2) errors.push('Nội dung đôi cần đủ VĐV 1 và VĐV 2');

  return { subEvent, header: { subEventCode: codeText, stage, quotaType, stageGiven: !!raw.stage, quotaTypeGiven: !!raw.quotaType, seed, notes: notes || null }, slots, errors };
}
