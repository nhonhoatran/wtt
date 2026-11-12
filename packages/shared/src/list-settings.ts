import { defineNumberSetting } from './app-setting-definition.js';

export const listSettings = {
  defaultPageSize: defineNumberSetting({
    key: 'list.defaultPageSize',
    group: 'list',
    label: 'Số dòng mỗi trang',
    description: 'Số dòng hiển thị mặc định trên các bảng danh sách trong trang quản trị.',
    unit: 'dòng',
    min: 5,
    max: 100,
    defaultValue: 20,
  }),
} as const;
