import { z } from 'zod';
import { defineAppSetting, defineNumberSetting } from './app-setting-definition.js';
import { AGE_CALCULATIONS, type AgeCalculation } from './age-on-event.js';

/** Defaults are examples from the plan; admins change them on /settings. */
export const playerSettings = {
  codePrefix: defineAppSetting({
    key: 'player.codePrefix',
    group: 'players',
    label: 'Tiền tố mã VĐV',
    description: 'Mã VĐV mới = tiền tố + số thứ tự, vd KMT00001. Đổi tiền tố không đổi mã đã cấp.',
    schema: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9-]+$/, 'Chỉ chữ, số và dấu gạch ngang'),
    defaultValue: 'KMT',
    editor: { kind: 'text', maxLength: 8 },
  }),
  codeDigits: defineNumberSetting({
    key: 'player.codeDigits',
    group: 'players',
    label: 'Số chữ số trong mã VĐV',
    description: 'Phần số được thêm 0 phía trước cho đủ độ dài, vd 5 → 00001.',
    unit: 'chữ số',
    min: 1,
    max: 10,
    defaultValue: 5,
  }),
  defaultCountryCode: defineAppSetting({
    key: 'player.defaultCountryCode',
    group: 'players',
    label: 'Mã quốc gia mặc định',
    description: 'Điền sẵn khi tạo VĐV (mã ISO 3166-1 alpha-3, vd VIE).',
    schema: z.string().trim().regex(/^[A-Z]{3}$/, 'Ba chữ in hoa, vd VIE'),
    defaultValue: 'VIE',
    editor: { kind: 'text', maxLength: 3 },
  }),
  showAge: defineAppSetting({
    key: 'player.showAge',
    group: 'players',
    label: 'Hiện năm sinh / tuổi trên site công khai',
    description: 'Tắt thì trang công khai không hiện năm sinh hay tuổi của VĐV.',
    schema: z.boolean(),
    defaultValue: false,
    editor: { kind: 'boolean' },
  }),
  maxBulkEntries: defineNumberSetting({
    key: 'entry.maxBulkItems',
    group: 'players',
    label: 'Số đăng ký tối đa mỗi lần thao tác hàng loạt',
    description: 'Số entry được chọn cùng lúc ở tab Đăng ký (rút, đổi vòng, đổi loại suất).',
    unit: 'entry',
    min: 1,
    max: 1000,
    defaultValue: 200,
  }),
  ageCalculation: defineAppSetting({
    key: 'category.ageCalculation',
    group: 'players',
    label: 'Cách tính tuổi cho nhóm tuổi',
    description: 'Theo năm sinh: năm diễn ra giải − năm sinh. Theo ngày khai mạc: tuổi tròn tại ngày bắt đầu giải.',
    schema: z.enum(AGE_CALCULATIONS),
    defaultValue: 'BIRTH_YEAR' as AgeCalculation,
    editor: {
      kind: 'choice',
      options: [
        { value: 'BIRTH_YEAR', label: 'Theo năm sinh' },
        { value: 'EVENT_START_DATE', label: 'Theo ngày khai mạc' },
      ],
    },
  }),
} as const;

/** Import limits; each is also capped by the server env ceiling (IMPORT_MAX_FILE_BYTES, IMPORT_MAX_ROWS). */
export const importSettings = {
  maxFileMegabytes: defineNumberSetting({
    key: 'import.maxFileMegabytes',
    group: 'imports',
    label: 'Dung lượng file import tối đa',
    description: 'File Excel lớn hơn bị từ chối. Không vượt được trần IMPORT_MAX_FILE_BYTES của máy chủ.',
    unit: 'MB',
    min: 1,
    max: 100,
    defaultValue: 5,
  }),
  maxRows: defineNumberSetting({
    key: 'import.maxRows',
    group: 'imports',
    label: 'Số dòng tối đa mỗi file import',
    description: 'File nhiều dòng hơn bị từ chối. Không vượt được trần IMPORT_MAX_ROWS của máy chủ.',
    unit: 'dòng',
    min: 1,
    max: 100_000,
    defaultValue: 5000,
  }),
  retentionDays: defineNumberSetting({
    key: 'import.retentionDays',
    group: 'imports',
    label: 'Thời gian giữ file import',
    description: 'File Excel đã tải lên bị xóa sau số ngày này; lịch sử và kết quả import vẫn giữ.',
    unit: 'ngày',
    min: 1,
    max: 365,
    defaultValue: 30,
  }),
} as const;

export const BYTES_PER_MEGABYTE = 1024 * 1024;

/** A /settings value bounded by its server env ceiling. */
export function effectiveLimit(settingValue: number, envCeiling: number, multiplier = 1): number {
  return Math.min(settingValue * multiplier, envCeiling);
}
