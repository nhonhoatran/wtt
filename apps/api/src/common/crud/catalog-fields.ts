import { z } from 'zod';

export const codeField = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Nhập mã')
  .max(40)
  .regex(/^[A-Z0-9_-]+$/, 'Chỉ dùng chữ in hoa, số, dấu gạch ngang và gạch dưới');

export const nameField = z.string().trim().min(1, 'Nhập tên').max(120);

/** Empty string clears the field; omitted keeps it on update. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const colorHexField = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Mã màu dạng #RRGGBB')
  .transform((value) => value.toUpperCase());

export const optionalColorHexField = z
  .union([z.literal('').transform(() => null), colorHexField, z.null()])
  .optional();

export const orderField = z.number().int().min(0).max(100_000);

export const mediaIdField = z.string().uuid('Ảnh không hợp lệ').nullable().optional();
