import { z } from 'zod';
import { optionalHttpsUrlSchema, httpsUrlSchema } from '@kamito/shared';
import { parseVideoUrl } from '../videos/video-url-parser.js';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
export const contentStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
const immediateStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);

export const articleBody = z.object({
  slug, title: z.string().trim().min(1).max(200), titleEn: nullableText(200),
  summary: nullableText(500), summaryEn: nullableText(500), body: z.string().max(200_000), bodyEn: nullableText(200_000),
  coverMediaId: z.string().uuid().nullable().optional(), category: nullableText(40), authorName: nullableText(120),
  isFeatured: z.boolean().default(false), status: contentStatusSchema.default('DRAFT'),
  publishAt: z.string().datetime().nullable().optional(), eventIds: z.array(z.string().uuid()).max(20).default([]).transform((ids) => [...new Set(ids)]),
}).superRefine((value, ctx) => {
  if (value.status === 'SCHEDULED' && !value.publishAt) ctx.addIssue({ code: 'custom', path: ['publishAt'], message: 'Chọn thời điểm đăng bài' });
  if (value.status === 'SCHEDULED' && value.publishAt && new Date(value.publishAt) <= new Date()) ctx.addIssue({ code: 'custom', path: ['publishAt'], message: 'Thời điểm đăng phải ở tương lai' });
});

export const videoBody = z.object({
  slug, title: z.string().trim().min(1).max(200), titleEn: nullableText(200), url: httpsUrlSchema,
  eventId: z.string().uuid().nullable().optional(), isFeatured: z.boolean().default(false), status: immediateStatusSchema.default('DRAFT'),
  publishedAt: z.string().datetime().nullable().optional(), durationText: nullableText(30),
}).superRefine((value, ctx) => {
  if (!parseVideoUrl(value.url)) ctx.addIssue({ code: 'custom', path: ['url'], message: 'URL video không được hỗ trợ' });
});

const sponsorFields = z.object({
  name: z.string().trim().min(1).max(160), logoMediaId: z.string().uuid().nullable().optional(), logoDarkMediaId: z.string().uuid().nullable().optional(),
  url: optionalHttpsUrlSchema, roleLabel: nullableText(120), roleLabelEn: nullableText(120), eventId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0).max(10_000), isActive: z.boolean(),
});
export const sponsorBody = sponsorFields.extend({ order: sponsorFields.shape.order.default(0), isActive: sponsorFields.shape.isActive.default(true) });
export const updateSponsorBody = sponsorFields.partial().refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const staticPageBody = z.object({
  slug, title: z.string().trim().min(1).max(200), titleEn: nullableText(200), body: z.string().max(200_000), bodyEn: nullableText(200_000),
  status: immediateStatusSchema.default('DRAFT'), footerGroup: nullableText(60), footerOrder: z.number().int().min(0).max(10_000).nullable().optional(),
});

export const contactStatusBody = z.object({ status: z.enum(['NEW', 'READ', 'ARCHIVED']) });
