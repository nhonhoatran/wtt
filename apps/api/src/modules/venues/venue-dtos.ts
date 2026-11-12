import { optionalHttpsUrlSchema } from '@kamito/shared';
import { z } from 'zod';
import { codeField, nameField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

export const createVenueBody = z.object({
  name: nameField,
  nameEn: optionalText(120),
  address: optionalText(300),
  city: optionalText(120),
  mapUrl: optionalHttpsUrlSchema,
  isActive: z.boolean().optional(),
});
export const updateVenueBody = createVenueBody.partial();

export const createVenueTableBody = z.object({
  code: codeField,
  displayName: optionalText(60),
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateVenueTableBody = createVenueTableBody.partial();

// Guard rails: one request creates at most 100 tables (one transaction, no venue needs more); prefix follows the /settings rule for table prefixes.
export const bulkVenueTablesBody = z.object({
  count: z.number().int().min(1, 'Nhập số bàn từ 1 đến 100').max(100, 'Nhập số bàn từ 1 đến 100'),
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .regex(/^[A-Za-z0-9-]+$/, 'Chỉ chữ, số và dấu gạch ngang')
    .transform((value) => value.toUpperCase())
    .optional(),
  startAt: z.number().int().min(1).max(9999).optional(),
});
