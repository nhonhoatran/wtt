import { z } from 'zod';
import { isRealDateOnly } from '../events/date-only.js';

const MAX_NAME = 120;
const MAX_SHORT = 200;
const MAX_BIO = 5000;
const MIN_BIRTH_YEAR = 1900;
const MAX_BIRTH_YEAR = 2100;

const uuid = (message: string) => z.string().uuid(message);

/** Blank input becomes null so clearing a field in the form really clears it. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

const birthDate = z
  .string()
  .refine(isRealDateOnly, 'Ngày sinh phải có dạng YYYY-MM-DD')
  .nullable()
  .optional();

const birthYear = z
  .number()
  .int('Năm sinh phải là số nguyên')
  .min(MIN_BIRTH_YEAR, `Năm sinh từ ${MIN_BIRTH_YEAR}`)
  .max(MAX_BIRTH_YEAR, `Năm sinh đến ${MAX_BIRTH_YEAR}`)
  .nullable()
  .optional();

const profileFields = {
  fullNameEn: optionalText(MAX_NAME),
  publicDisplayName: optionalText(MAX_NAME),
  birthDate,
  birthYear,
  club: optionalText(MAX_SHORT),
  city: optionalText(MAX_SHORT),
  handedness: z.enum(['LEFT', 'RIGHT'], { message: 'Chọn tay thuận' }).nullable().optional(),
  gripStyle: optionalText(MAX_SHORT),
  playStyle: optionalText(MAX_SHORT),
  photoMediaId: uuid('Ảnh không hợp lệ').nullable().optional(),
  bio: optionalText(MAX_BIO),
  bioEn: optionalText(MAX_BIO),
  phone: optionalText(40),
  email: z.string().trim().email('Email không hợp lệ').max(MAX_SHORT).nullable().optional().or(z.literal('').transform(() => null)),
  isPublicProfile: z.boolean().optional(),
  noindex: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

const fullName = z.string().trim().min(1, 'Nhập họ tên').max(MAX_NAME, `Tối đa ${MAX_NAME} ký tự`);
const gender = z.enum(['MALE', 'FEMALE'], { message: 'Chọn giới tính' });
const countryCode = z.string().trim().regex(/^[A-Z]{3}$/, 'Ba chữ in hoa, vd VIE');

export const createPlayerBody = z.object({ fullName, gender, countryCode: countryCode.optional(), ...profileFields });
export type CreatePlayerBody = z.infer<typeof createPlayerBody>;

export const updatePlayerBody = z.object({ fullName, gender, countryCode, ...profileFields }).partial();
export type UpdatePlayerBody = z.infer<typeof updatePlayerBody>;

export const lookupQuery = z.object({
  q: z.string().trim().max(100).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type LookupQuery = z.infer<typeof lookupQuery>;

export const mergePreviewQuery = z.object({
  targetId: uuid('Chọn hồ sơ giữ lại'),
  sourceId: uuid('Chọn hồ sơ cần gộp'),
});

export const mergeBody = mergePreviewQuery.extend({
  reason: z.string().trim().min(5, 'Nhập lý do (tối thiểu 5 ký tự)').max(500),
});
export type MergeBody = z.infer<typeof mergeBody>;
