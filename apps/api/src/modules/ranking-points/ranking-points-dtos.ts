import { z } from 'zod';
import { isoDateField } from '../../common/validation/iso-date-field.js';

const reasonField = z.string().trim().min(3, 'Nhập lý do (tối thiểu 3 ký tự)').max(500);

// Typo guard for manual adjustments, not a business limit.
const MAX_POINTS = 1_000_000;

export const createManualPointsBody = z
  .object({
    rankingListId: z.string().uuid(),
    playerId: z.string().uuid(),
    points: z
      .number()
      .int()
      .min(-MAX_POINTS)
      .max(MAX_POINTS)
      .refine((value) => value !== 0, 'Điểm phải khác 0'),
    earnedAt: isoDateField.optional(),
    // Omitted: earnedAt + the list's validityDays.
    expiresAt: isoDateField.optional(),
    reason: reasonField,
  })
  .refine((body) => !body.earnedAt || !body.expiresAt || body.expiresAt > body.earnedAt, {
    path: ['expiresAt'],
    message: 'Ngày hết hạn phải sau ngày ghi nhận',
  });
export type CreateManualPointsBody = z.infer<typeof createManualPointsBody>;

export const deleteManualPointsBody = z.object({ reason: reasonField });
