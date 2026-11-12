import { defineNumberSetting } from './app-setting-definition.js';

export const importOperationalSettings = {
  uploadTtlHours: defineNumberSetting({
    key: 'import.uploadTtlHours',
    group: 'imports',
    label: 'Thời gian chờ tải file import',
    description: 'Lượt import tạo ra nhưng chưa tải file xong sẽ hết hạn sau số giờ này.',
    unit: 'giờ',
    min: 1,
    max: 168,
    defaultValue: 24,
  }),
} as const;
