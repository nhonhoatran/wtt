import { z } from 'zod';
import { defineAppSetting, defineNumberSetting } from './app-setting-definition.js';

export const contentSettings = {
  newsPageSize: defineNumberSetting({
    key: 'news.pageSize', group: 'content', label: 'Tin mỗi trang',
    description: 'Số bài tin mỗi trang công khai.', unit: 'bài', min: 1, max: 50, defaultValue: 12,
  }),
  contactRetentionDays: defineNumberSetting({
    key: 'contact.retentionDays', group: 'content', label: 'Thời hạn lưu liên hệ',
    description: 'Số ngày lưu thư liên hệ trước khi tự xóa.', unit: 'ngày', min: 1, max: 3650, defaultValue: 180,
  }),
  contactRateWindowSeconds: defineNumberSetting({
    key: 'contact.rateWindowSeconds', group: 'content', label: 'Cửa sổ giới hạn liên hệ',
    description: 'Khoảng thời gian giới hạn gửi biểu mẫu.', unit: 'giây', min: 10, max: 3600, defaultValue: 60,
  }),
  contactRateMaxRequests: defineNumberSetting({
    key: 'contact.rateMaxRequests', group: 'content', label: 'Số lần gửi liên hệ',
    description: 'Số lần gửi tối đa trong một cửa sổ.', unit: 'lần', min: 1, max: 20, defaultValue: 3,
  }),
  publishSweepIntervalMinutes: defineNumberSetting({
    key: 'publishing.sweepIntervalMinutes', group: 'content', label: 'Chu kỳ rà bài hẹn giờ',
    description: 'Tần suất kiểm tra lại bài đã tới giờ đăng.', unit: 'phút', min: 1, max: 60, defaultValue: 1,
  }),
  newsCategories: defineAppSetting({
    key: 'news.categories', group: 'content', label: 'Chuyên mục tin',
    description: 'Danh sách mã chuyên mục tin.',
    schema: z.array(z.string().trim().min(1).max(40)).max(50),
    defaultValue: [] as string[], editor: { kind: 'json' },
  }),
  newsCategoryLabelsEn: defineAppSetting({
    key: 'news.categoryLabelsEn', group: 'content', label: 'Tên chuyên mục tin tiếng Anh',
    description: 'Ánh xạ mã trong news.categories sang nhãn tiếng Anh; mã không có bản dịch giữ nguyên.',
    schema: z.record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(80)),
    defaultValue: {} as Record<string, string>, editor: { kind: 'json' },
  }),
  homeSections: defineAppSetting({
    key: 'home.sections', group: 'content', label: 'Khối trang chủ',
    description: 'Bật hoặc tắt các khối nội dung trang chủ.',
    schema: z.object({
      hero: z.boolean(), events: z.boolean(), news: z.boolean(),
      videos: z.boolean(), rankings: z.boolean(), sponsors: z.boolean(),
    }),
    defaultValue: { hero: true, events: true, news: true, videos: true, rankings: true, sponsors: true },
    editor: { kind: 'json' },
  }),
  homeItemsPerSection: defineNumberSetting({
    key: 'home.itemsPerSection', group: 'content', label: 'Mục mỗi khối trang chủ',
    description: 'Số thẻ hiển thị trong mỗi khối trang chủ.', unit: 'mục', min: 1, max: 20, defaultValue: 4,
  }),
} as const;
