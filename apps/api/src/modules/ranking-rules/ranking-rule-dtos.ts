import { RANKING_NOTE_MAX_LENGTH } from '@kamito/shared';
import { z } from 'zod';
import { isoDateField } from '../../common/validation/iso-date-field.js';

const kindField = z.enum(['SINGLES', 'DOUBLES']);
const drawKindField = z.enum(['MAIN', 'QUALIFYING', 'GROUP']);

/** W, F, SF, QF, R16.., QF-1.. (qualifying), GROUP, GROUP-2.. */
const stageCodeField = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{0,9}(-\d{1,2})?$/, 'Mã vòng không hợp lệ');

// Sanity bounds for a typo guard, not business limits.
const MAX_POINTS = 1_000_000;
const MAX_CELLS = 2_000;

export const matrixQuery = z.object({
  'filter[competitorKind]': kindField,
  'filter[drawKind]': drawKindField,
  'filter[asOf]': isoDateField.optional(),
});

export const impactQuery = z.object({
  competitorKind: kindField,
  effectiveFrom: isoDateField,
  eventTypeIds: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1).max(MAX_CELLS)),
});

export const saveMatrixBody = z.object({
  competitorKind: kindField,
  drawKind: drawKindField,
  effectiveFrom: isoDateField,
  note: z.string().trim().max(RANKING_NOTE_MAX_LENGTH).optional(),
  cells: z
    .array(
      z.object({
        eventTypeId: z.string().uuid(),
        stageCode: stageCodeField,
        points: z.number().int().min(0, 'Điểm không âm').max(MAX_POINTS, 'Điểm quá lớn'),
      }),
    )
    .min(1, 'Chưa có ô nào thay đổi')
    .max(MAX_CELLS),
});
export type SaveMatrixBody = z.infer<typeof saveMatrixBody>;
