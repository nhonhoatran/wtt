import { z } from 'zod';
import { isoDateField } from '../../common/validation/iso-date-field.js';

// Upper bound on lists per request: a typo guard, the catalog is small.
const MAX_LISTS = 200;

export const createDraftsBody = z
  .object({
    listIds: z.array(z.string().uuid()).min(1).max(MAX_LISTS).optional(),
    all: z.boolean().optional(),
    asOfDate: isoDateField.optional(),
  })
  .refine((body) => Number(Boolean(body.listIds)) + Number(body.all === true) === 1, 'Chọn các bảng xếp hạng hoặc tất cả bảng');
export type CreateDraftsBody = z.infer<typeof createDraftsBody>;
