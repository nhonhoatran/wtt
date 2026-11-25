import { defineNumberSetting } from './app-setting-definition.js';

export const dashboardSettings = {
  liveEventLimit: defineNumberSetting({
    key: 'dashboard.liveEventLimit',
    group: 'dashboard',
    label: 'Số giải hiện trên Tổng quan',
    description: 'Số giải đang diễn ra tối đa hiển thị ở khối "Giải đang diễn ra" của trang Tổng quan.',
    unit: 'giải',
    min: 1,
    max: 20,
    defaultValue: 5,
  }),
  recentActivityLimit: defineNumberSetting({
    key: 'dashboard.recentActivityLimit',
    group: 'dashboard',
    label: 'Số dòng hoạt động gần đây',
    description: 'Số dòng ở khối "Hoạt động gần đây" của trang Tổng quan. Đặt 0 để ẩn khối này.',
    unit: 'dòng',
    min: 0,
    max: 20,
    defaultValue: 6,
  }),
} as const;
