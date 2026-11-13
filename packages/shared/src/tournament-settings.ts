import { z } from 'zod';
import { defineAppSetting, defineNumberSetting } from './app-setting-definition.js';

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Defaults are examples from the plan; admins change them on /settings. */
export const tournamentSettings = {
  defaultTimezone: defineAppSetting({
    key: 'event.defaultTimezone',
    group: 'event',
    label: 'Múi giờ mặc định của giải mới',
    description: 'Điền sẵn khi tạo giải; từng giải vẫn đổi được.',
    schema: z.string().min(1).max(64).refine(isValidTimezone, 'Múi giờ không hợp lệ'),
    defaultValue: 'Asia/Ho_Chi_Minh',
    editor: { kind: 'timezone' },
  }),
  defaultDurationDays: defineNumberSetting({
    key: 'event.defaultDurationDays',
    group: 'event',
    label: 'Số ngày thêm cho ngày kết thúc',
    description: 'Khi tạo giải, ngày kết thúc điền sẵn = ngày bắt đầu + số ngày này (0 = trong ngày).',
    unit: 'ngày',
    min: 0,
    max: 30,
    defaultValue: 2,
  }),
  tablePrefix: defineAppSetting({
    key: 'venue.tablePrefix',
    group: 'event',
    label: 'Tiền tố mã bàn',
    description: 'Dùng khi tạo nhanh nhiều bàn, vd tiền tố "T" cho ra T01, T02…',
    schema: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9-]+$/, 'Chỉ chữ, số và dấu gạch ngang'),
    defaultValue: 'T',
    editor: { kind: 'text', maxLength: 8 },
  }),
  resultsStripEnabled: defineAppSetting({
    key: 'header.resultsStrip.enabled',
    group: 'display',
    label: 'Hiện dải kết quả trên đầu trang',
    description: 'Dải kết quả mới nhất chạy ngang dưới thanh menu của site công khai.',
    schema: z.boolean(),
    defaultValue: false,
    editor: { kind: 'boolean' },
  }),
  featuredEventId: defineAppSetting({
    key: 'home.featuredEventId',
    group: 'display',
    label: 'Giải nổi bật trên trang chủ',
    description: 'Để trống thì trang chủ tự lấy giải sắp diễn ra gần nhất.',
    schema: z.string().uuid().nullable(),
    defaultValue: null,
    editor: { kind: 'event' },
  }),
  maxImageMegabytes: defineNumberSetting({
    key: 'media.maxImageMegabytes',
    group: 'media',
    label: 'Dung lượng ảnh tối đa',
    description: 'Ảnh lớn hơn bị từ chối khi tải lên. Không vượt được trần UPLOAD_MAX_IMAGE_BYTES của máy chủ.',
    unit: 'MB',
    min: 1,
    max: 50,
    defaultValue: 5,
  }),
  intentTtlMinutes: defineNumberSetting({
    key: 'media.intentTtlMinutes',
    group: 'media',
    label: 'Thời gian chờ tải ảnh',
    description: 'Phiên tải ảnh quá thời gian này mà chưa hoàn tất thì bị hủy và file tạm bị xóa.',
    unit: 'phút',
    min: 1,
    max: 240,
    defaultValue: 15,
  }),
  processingTimeoutMinutes: defineNumberSetting({
    key: 'media.processingTimeoutMinutes',
    group: 'media',
    label: 'Thời gian tối đa xử lý ảnh',
    description: 'Ảnh đang xử lý quá thời gian này bị coi là lỗi để người dùng tải lại.',
    unit: 'phút',
    min: 1,
    max: 240,
    defaultValue: 10,
  }),
  defaultSeedPercent: defineNumberSetting({
    key: 'draw.defaultSeedPercent',
    group: 'draw',
    label: 'Tỷ lệ hạt giống so với kích thước nhánh',
    description: 'Số hạt giống điền sẵn = tỷ lệ này × kích thước nhánh (vd 25 % × 64 = 16). Từng nội dung vẫn sửa được.',
    unit: '%',
    min: 5,
    max: 50,
    defaultValue: 25,
  }),
  defaultGroupSize: defineNumberSetting({
    key: 'draw.defaultGroupSize',
    group: 'draw',
    label: 'Số VĐV mỗi bảng (mặc định)',
    description: 'Điền sẵn khi chia bảng; số bảng = số VĐV chia cho giá trị này, làm tròn lên.',
    unit: 'VĐV',
    min: 3,
    max: 16,
    defaultValue: 4,
  }),
  defaultAdvancePerGroup: defineNumberSetting({
    key: 'draw.defaultAdvancePerGroup',
    group: 'draw',
    label: 'Số VĐV đi tiếp mỗi bảng (mặc định)',
    description: 'Chỉ hỗ trợ 1 (nhất bảng) hoặc 2 (nhất và nhì bảng).',
    unit: 'VĐV',
    min: 1,
    max: 2,
    defaultValue: 2,
  }),
  defaultQualifierCount: defineNumberSetting({
    key: 'draw.defaultQualifierCount',
    group: 'draw',
    label: 'Số suất vào nhánh chính từ vòng loại (mặc định)',
    description: 'Điền sẵn khi bốc vòng loại: mỗi nhánh con của vòng loại cho ra một suất. Từng nội dung vẫn sửa được.',
    unit: 'suất',
    min: 1,
    max: 64,
    defaultValue: 4,
  }),
} as const;
