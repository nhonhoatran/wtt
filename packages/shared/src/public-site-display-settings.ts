import { z } from 'zod';
import { defineAppSetting, defineNumberSetting } from './app-setting-definition.js';
import { httpsUrlSchema } from './https-url.js';

export const SITE_NAV_KEYS = ['news', 'videos', 'players', 'events', 'calendar', 'rankings', 'contact'] as const;
export const SITE_SOCIAL_PLATFORMS = ['facebook', 'youtube', 'tiktok', 'instagram', 'zalo'] as const;

export type SiteNavKey = (typeof SITE_NAV_KEYS)[number];
export type SiteSocialPlatform = (typeof SITE_SOCIAL_PLATFORMS)[number];

export const SITE_NAV_LABELS: Record<SiteNavKey, string> = {
  news: 'Tin tức',
  videos: 'Video',
  players: 'Vận động viên',
  events: 'Giải đấu',
  calendar: 'Lịch thi đấu',
  rankings: 'Xếp hạng',
  contact: 'Liên hệ',
};

export const SITE_SOCIAL_LABELS: Record<SiteSocialPlatform, string> = {
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  zalo: 'Zalo',
};

const NAV_MAX_ITEMS = 10;
const NAV_MAX_LABEL = 60;
const SOCIAL_MAX_ITEMS = 8;
const TAGLINE_MAX = 300;

const label = z.string().trim().max(NAV_MAX_LABEL).optional();

const navItemsSchema = z
  .array(z.object({ key: z.enum(SITE_NAV_KEYS), labelVi: label, labelEn: label }).strict())
  .min(1)
  .max(NAV_MAX_ITEMS)
  .refine((items) => new Set(items.map((item) => item.key)).size === items.length, 'Mỗi mục menu chỉ xuất hiện một lần');

const socialLinksSchema = z
  .array(z.object({ platform: z.enum(SITE_SOCIAL_PLATFORMS), url: httpsUrlSchema }).strict())
  .max(SOCIAL_MAX_ITEMS);

const taglineSchema = z
  .object({ vi: z.string().trim().max(TAGLINE_MAX), en: z.string().trim().max(TAGLINE_MAX) })
  .strict()
  .refine((value) => value.vi !== '' && value.en !== '', 'Nhập đủ cả tiếng Việt và tiếng Anh, hoặc để trống cả hai (null) để ẩn')
  .nullable();

const registrationUrlSchema = z.union([z.literal(''), httpsUrlSchema]);

/** Defaults are examples; admins change them on /settings. */
export const publicSiteDisplaySettings = {
  navItems: defineAppSetting({
    key: 'site.nav.items',
    group: 'display',
    label: 'Mục menu đầu trang',
    description: 'Thứ tự và nhãn các mục menu site công khai. Nhãn để trống thì dùng tên mặc định.',
    schema: navItemsSchema,
    defaultValue: [{ key: 'news' }, { key: 'videos' }, { key: 'players' }, { key: 'events' }, { key: 'rankings' }] as z.infer<typeof navItemsSchema>,
    editor: {
      kind: 'nav-items',
      options: SITE_NAV_KEYS.map((value) => ({ value, label: SITE_NAV_LABELS[value] })),
      maxItems: NAV_MAX_ITEMS,
      maxLabelLength: NAV_MAX_LABEL,
    },
  }),
  socialLinks: defineAppSetting({
    key: 'site.socialLinks',
    group: 'display',
    label: 'Liên kết mạng xã hội',
    description: 'Biểu tượng mạng xã hội ở chân trang. Để trống thì ẩn.',
    schema: socialLinksSchema,
    defaultValue: [] as z.infer<typeof socialLinksSchema>,
    editor: {
      kind: 'social-links',
      platforms: SITE_SOCIAL_PLATFORMS.map((value) => ({ value, label: SITE_SOCIAL_LABELS[value] })),
      maxItems: SOCIAL_MAX_ITEMS,
    },
  }),
  tagline: defineAppSetting({
    key: 'site.tagline',
    group: 'display',
    label: 'Giới thiệu ngắn ở chân trang',
    description: 'Đoạn giới thiệu hai ngôn ngữ ở chân trang. Để trống cả hai thì ẩn.',
    schema: taglineSchema,
    defaultValue: null as z.infer<typeof taglineSchema>,
    editor: { kind: 'bilingual-text', maxLength: TAGLINE_MAX, nullable: true },
  }),
  matchRelatedLimit: defineNumberSetting({
    key: 'public.matchRelatedLimit',
    group: 'display',
    label: 'Số trận liên quan ở trang chi tiết trận',
    description: 'Số trận cùng bảng hoặc cùng vòng hiện ở cột bên của trang chi tiết trận.',
    unit: 'trận',
    min: 1,
    max: 12,
    defaultValue: 4,
  }),
  registrationUrl: defineAppSetting({
    key: 'site.registrationUrl',
    group: 'display',
    label: 'Đường dẫn đăng ký thi đấu',
    description: 'Đường dẫn https cho nút "Đăng ký thi đấu". Để trống thì ẩn nút.',
    schema: registrationUrlSchema,
    defaultValue: '',
    editor: { kind: 'text', maxLength: 2048, optional: true },
  }),
} as const;
