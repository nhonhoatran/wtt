import { z } from 'zod';

export const autoSchedulePreviewBody = z.object({ sessionIds: z.array(z.string().uuid()).min(1, 'Chọn buổi thi đấu').max(32, 'Chọn tối đa 32 buổi').refine((ids) => new Set(ids).size === ids.length, 'Không chọn trùng buổi') });
export const autoScheduleApplyBody = autoSchedulePreviewBody.extend({ expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/, 'Bản gợi ý không hợp lệ') });
export type AutoSchedulePreviewBody = z.infer<typeof autoSchedulePreviewBody>;
export type AutoScheduleApplyBody = z.infer<typeof autoScheduleApplyBody>;
