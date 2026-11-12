import { CompetitorKind, GenderRule } from '@kamito/db';
import { z } from 'zod';
import { codeField, nameField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

export const createDisciplineBody = z.object({
  code: codeField,
  name: nameField,
  nameEn: optionalText(120),
  competitorKind: z.enum(CompetitorKind, { message: 'Chọn đơn hoặc đôi' }),
  genderRule: z.enum(GenderRule, { message: 'Chọn quy định giới tính' }),
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateDisciplineBody = createDisciplineBody.partial();
