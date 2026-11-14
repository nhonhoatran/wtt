import { defineNumberSetting } from './app-setting-definition.js';

const group = 'publicAccess' as const;

/** Per-IP limits applied by the public site (Next proxy). A venue shares one IP, so keep them generous. */
export const publicSiteSettings = {
  rateLimitWindowSeconds: defineNumberSetting({
    key: 'public.rateLimit.windowSeconds',
    group,
    label: 'Khoảng tính lượt truy cập theo IP',
    description: 'Cửa sổ thời gian để đếm số trang một IP mở trên site công khai.',
    unit: 'giây',
    min: 10,
    max: 3600,
    defaultValue: 60,
  }),
  rateLimitMaxRequests: defineNumberSetting({
    key: 'public.rateLimit.maxRequests',
    group,
    label: 'Số trang tối đa mỗi IP',
    description: 'Vượt ngưỡng trong khoảng thời gian trên thì IP đó nhận lỗi 429 tới hết khoảng. Khán giả tại sân dùng chung một IP nên đừng đặt quá thấp.',
    unit: 'trang',
    min: 30,
    max: 100_000,
    defaultValue: 600,
  }),
  rateLimitSearchMaxRequests: defineNumberSetting({
    key: 'public.rateLimit.searchMaxRequests',
    group,
    label: 'Số lần tìm kiếm tối đa mỗi IP',
    description: 'Trang có ô tìm kiếm không dùng bộ nhớ đệm nên giới hạn chặt hơn; tính trong cùng khoảng thời gian.',
    unit: 'lần',
    min: 5,
    max: 10_000,
    defaultValue: 60,
  }),
  rateLimitMaxTrackedIps: defineNumberSetting({
    key: 'public.rateLimit.maxTrackedIps',
    group,
    label: 'Số IP tối đa được theo dõi cùng lúc',
    description: 'Giới hạn bộ nhớ của bộ đếm. Vượt số này thì IP mới không bị giới hạn tới khi các khoảng cũ hết hạn.',
    unit: 'IP',
    min: 1000,
    max: 1_000_000,
    defaultValue: 100_000,
  }),
};
