import { z } from 'zod';
import { nameField, optionalText } from '../../common/crud/catalog-fields.js';

// Guard rails against typos, not business values.
const bestOf = z
  .number()
  .int()
  .min(1)
  .max(9)
  .refine((value) => value % 2 === 1, 'Số ván tối đa phải là số lẻ');

export const createMatchFormatBody = z.object({
  name: nameField,
  nameEn: optionalText(120),
  bestOf,
  pointsPerGame: z.number().int().min(5).max(50),
  winBy: z.number().int().min(1).max(5),
  estimatedMinutes: z.number().int().min(5).max(240),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const updateMatchFormatBody = createMatchFormatBody.partial();
