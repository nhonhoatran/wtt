import { z } from 'zod';

/** Fits a Postgres int; the real ceiling is the `schedule.sessionMatchCap` setting, checked by the service. */
const MAX_ORDER_COLUMN = 1_000_000;

export const scheduleMatchBody = z
  .object({
    sessionId: z.string().uuid('Buổi thi đấu không hợp lệ').nullable(),
    tableId: z.string().uuid('Bàn không hợp lệ').optional(),
    orderInSession: z.number().int('Phải là số nguyên').min(1, 'Tối thiểu 1').max(MAX_ORDER_COLUMN).optional(),
    expectedScheduleVersion: z.number().int().min(0),
    /** Match the caller saw in the target slot (null = empty); a different occupant at commit time is a 409. */
    expectedOccupantId: z.string().uuid().nullable().optional(),
  })
  .refine((body) => body.sessionId === null || body.tableId !== undefined, { path: ['tableId'], message: 'Chọn bàn' });
export type ScheduleMatchBody = z.infer<typeof scheduleMatchBody>;
