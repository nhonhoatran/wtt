import { z } from 'zod';
import { defineAppSetting } from './app-setting-definition.js';
import { httpsUrlSchema } from './https-url.js';

export const SITE_NAV_KEYS = ['news', 'videos', 'players', 'events', 'calendar', 'rankings', 'contact'] as const;
export const SITE_SOCIAL_PLATFORMS = ['facebook', 'youtube', 'tiktok', 'instagram', 'zalo'] as const;

export type SiteNavKey = (typeof SITE_NAV_KEYS)[number];
export type SiteSocialPlatform = (typeof SITE_SOCIAL_PLATFORMS)[number];

const label = z.string().trim().max(60).optional();

const navItemsSchema = z
  .array(z.object({ key: z.enum(SITE_NAV_KEYS), labelVi: label, labelEn: label }).strict())
  .min(1)
  .max(10)
  .refine((items) => new Set(items.map((item) => item.key)).size === items.length, 'Mỗi mục menu chỉ xuất hiện một lần');

const socialLinksSchema = z
  .array(z.object({ platform: z.enum(SITE_SOCIAL_PLATFORMS), url: httpsUrlSchema }).strict())
  .max(8);

const taglineSchema = z.object({ vi: z.string().trim().max(300), en: z.string().trim().max(300) }).strict().nullable();

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
    editor: { kind: 'json' },
  }),
  socialLinks: defineAppSetting({
    key: 'site.socialLinks',
    group: 'display',
    label: 'Liên kết mạng xã hội',
    description: 'Biểu tượng mạng xã hội ở chân trang. Để trống thì ẩn.',
    schema: socialLinksSchema,
    defaultValue: [] as z.infer<typeof socialLinksSchema>,
    editor: { kind: 'json' },
  }),
  tagline: defineAppSetting({
    key: 'site.tagline',
    group: 'display',
    label: 'Giới thiệu ngắn ở chân trang',
    description: 'Đoạn giới thiệu hai ngôn ngữ ở chân trang. Để null thì ẩn.',
    schema: taglineSchema,
    defaultValue: null as z.infer<typeof taglineSchema>,
    editor: { kind: 'json' },
  }),
  registrationUrl: defineAppSetting({
    key: 'site.registrationUrl',
    group: 'display',
    label: 'Đường dẫn đăng ký thi đấu',
    description: 'Đường dẫn https cho nút "Đăng ký thi đấu". Để trống thì ẩn nút.',
    schema: registrationUrlSchema,
    defaultValue: '',
    editor: { kind: 'text', maxLength: 2048 },
  }),
} as const;
