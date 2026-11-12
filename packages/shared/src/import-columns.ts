/** Column order of the ENTRIES sheet; the template, the validator and the export all use it. */
export const ENTRY_IMPORT_COLUMNS = [
  { key: 'subEventCode', header: 'Mã nội dung', width: 14 },
  { key: 'player1Code', header: 'Mã VĐV 1', width: 12 },
  { key: 'player1Name', header: 'Họ tên VĐV 1', width: 26 },
  { key: 'player1Gender', header: 'Giới tính 1', width: 10 },
  { key: 'player1BirthYear', header: 'Năm sinh 1', width: 10 },
  { key: 'player1Club', header: 'CLB 1', width: 20 },
  { key: 'player2Code', header: 'Mã VĐV 2', width: 12 },
  { key: 'player2Name', header: 'Họ tên VĐV 2', width: 26 },
  { key: 'player2Gender', header: 'Giới tính 2', width: 10 },
  { key: 'player2BirthYear', header: 'Năm sinh 2', width: 10 },
  { key: 'player2Club', header: 'CLB 2', width: 20 },
  { key: 'stage', header: 'Vòng (Chính/Loại)', width: 16 },
  { key: 'quotaType', header: 'Suất (Thường/Đặc cách/Từ vòng loại)', width: 22 },
  { key: 'seed', header: 'Hạt giống', width: 10 },
  { key: 'notes', header: 'Ghi chú', width: 30 },
] as const;

export type EntryImportColumnKey = (typeof ENTRY_IMPORT_COLUMNS)[number]['key'];
export type EntryImportRawRow = Partial<Record<EntryImportColumnKey, string>>;

/** Spreadsheet labels → enum values; matched after trimming and lowercasing without diacritics. */
export const GENDER_IMPORT_VALUES: Record<string, 'MALE' | 'FEMALE'> = { nam: 'MALE', nu: 'FEMALE', m: 'MALE', f: 'FEMALE' };
export const STAGE_IMPORT_VALUES: Record<string, 'MAIN' | 'QUALIFYING'> = { chinh: 'MAIN', 'vong chinh': 'MAIN', loai: 'QUALIFYING', 'vong loai': 'QUALIFYING' };
export const QUOTA_IMPORT_VALUES: Record<string, 'DIRECT' | 'WILDCARD' | 'QUALIFIER'> = {
  thuong: 'DIRECT',
  'dac cach': 'WILDCARD',
  'tu vong loai': 'QUALIFIER',
  // Older files used the bare stage word for this quota.
  'vong loai': 'QUALIFIER',
};

export const GENDER_EXPORT_LABELS = { MALE: 'Nam', FEMALE: 'Nữ' } as const;
export const STAGE_EXPORT_LABELS = { MAIN: 'Chính', QUALIFYING: 'Loại' } as const;
export const QUOTA_EXPORT_LABELS = { DIRECT: 'Thường', WILDCARD: 'Đặc cách', QUALIFIER: 'Từ vòng loại' } as const;
