import { z } from 'zod';
import { isRealDateOnly } from '../events/date-only.js';
import { isHhmm } from './session-time.js';

const MAX_NAME = 200;
const MAX_CODE = 16;
/** Sanity bound on one session's table list, not a business rule. */
const MAX_TABLES = 200;

const optionalName = z
  .string()
  .trim()
  .max(MAX_NAME, `Tối đa ${MAX_NAME} ký tự`)
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const time = z.string().refine(isHhmm, 'Giờ không hợp lệ (định dạng HH:mm)');

const fields = {
  date: z.string().refine(isRealDateOnly, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Nhập mã buổi')
    .max(MAX_CODE, `Tối đa ${MAX_CODE} ký tự`)
    .regex(/^[A-Z0-9-]+$/, 'Chỉ chữ, số và dấu gạch ngang'),
  name: optionalName,
  nameEn: optionalName,
  startTime: time,
  endTime: time.nullable().optional(),
  venueId: z.string().uuid('Địa điểm không hợp lệ').nullable().optional(),
  tableIds: z
    .array(z.string().uuid('Bàn không hợp lệ'))
    .max(MAX_TABLES)
    .refine((ids) => new Set(ids).size === ids.length, 'Bàn bị chọn trùng'),
};

export const createSessionBody = z.object(fields);
export type CreateSessionBody = z.infer<typeof createSessionBody>;

export const updateSessionBody = z.object(fields).partial();
export type UpdateSessionBody = z.infer<typeof updateSessionBody>;
