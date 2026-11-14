import { z } from 'zod';
import { codeField, nameField, optionalText, orderField } from '../../common/crud/catalog-fields.js';

export const COMPETITOR_KINDS = ['SINGLES', 'DOUBLES'] as const;
export const GENDER_RULES = ['MEN', 'WOMEN', 'MIXED', 'OPEN'] as const;

export const createRankingListBody = z.object({
  code: codeField,
  name: nameField,
  nameEn: optionalText(120),
  competitorKind: z.enum(COMPETITOR_KINDS),
  genderRule: z.enum(GENDER_RULES),
  categoryId: z.string().uuid('Nhóm tuổi không hợp lệ').nullable().optional(),
  // Omitted on create: the service fills the `ranking.defaultValidityDays` setting.
  validityDays: z.number().int().min(1, 'Tối thiểu 1 ngày').max(3650, 'Tối đa 3650 ngày').optional(),
  groupStageByRank: z.boolean().optional(),
  order: orderField.optional(),
  isActive: z.boolean().optional(),
});
export const updateRankingListBody = createRankingListBody.partial();
