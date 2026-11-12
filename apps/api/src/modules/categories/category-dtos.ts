import { CategoryKind } from '@kamito/db';
import { z } from 'zod';
import { codeField, nameField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

const ageField = z.number().int().min(0).max(120).nullable().optional();

export const createCategoryBody = z.object({
  kind: z.enum(CategoryKind, { message: 'Chọn loại hạng mục' }),
  code: codeField,
  name: nameField,
  nameEn: optionalText(120),
  minAge: ageField,
  maxAge: ageField,
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateCategoryBody = createCategoryBody.partial();
