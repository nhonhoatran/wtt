import { isValidSlug, isValidTimezone, optionalHttpsUrlSchema } from '@kamito/shared';
import { z } from 'zod';
import { isRealDateOnly } from './date-only.js';

const MAX_NAME = 200;
const MAX_SHORT_NAME = 60;
const MAX_CITY = 120;
const MAX_SUMMARY = 1000;
export const MAX_INFO_BODY = 100_000;

/** Blank input clears the field (null); omitted leaves it unchanged. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const optionalRichText = z
  .string()
  .max(MAX_INFO_BODY, `Tối đa ${MAX_INFO_BODY} ký tự`)
  .nullable()
  .optional();

const dateOnly = z.string().refine(isRealDateOnly, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)');
const uuid = (message: string) => z.string().uuid(message);

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang');

const requiredFields = {
  name: z.string().trim().min(1, 'Nhập tên giải').max(MAX_NAME),
  eventTypeId: uuid('Chọn loại giải'),
  startDate: dateOnly,
  endDate: dateOnly,
};

const optionalFields = {
  nameEn: optionalText(MAX_NAME),
  shortName: optionalText(MAX_SHORT_NAME),
  slug: z.preprocess((value) => (value === '' || value === null ? undefined : value), slugField.optional()),
  venueId: uuid('Địa điểm không hợp lệ').nullable().optional(),
  city: optionalText(MAX_CITY),
  timezone: z.string().trim().refine(isValidTimezone, 'Múi giờ không hợp lệ').optional(),
  isFeatured: z.boolean().optional(),
  ticketUrl: optionalHttpsUrlSchema,
  showTicket: z.boolean().optional(),
  presentedBy: optionalText(MAX_NAME),
  bannerMediaId: uuid('Ảnh bìa không hợp lệ').nullable().optional(),
  summary: optionalText(MAX_SUMMARY),
  summaryEn: optionalText(MAX_SUMMARY),
  infoBody: optionalRichText,
  infoBodyEn: optionalRichText,
  showInfoTab: z.boolean().optional(),
};

const endNotBeforeStart = (value: { startDate?: string; endDate?: string }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;
const END_BEFORE_START = { path: ['endDate'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' };

export const createEventBody = z
  .object({ ...requiredFields, ...optionalFields })
  .refine(endNotBeforeStart, END_BEFORE_START);
export type CreateEventBody = z.infer<typeof createEventBody>;

export const updateEventBody = z
  .object({ ...requiredFields, ...optionalFields })
  .partial()
  .refine(endNotBeforeStart, END_BEFORE_START);
export type UpdateEventBody = z.infer<typeof updateEventBody>;

export const slugAvailableQuery = z.object({
  slug: slugField,
  excludeId: z.string().uuid().optional(),
});
