import { z } from 'zod';

const stage = z.enum(['MAIN', 'QUALIFYING'], { message: 'Chọn vòng thi đấu' });
const quotaType = z.enum(['DIRECT', 'WILDCARD', 'QUALIFIER'], { message: 'Chọn loại suất' });
const seed = z.number().int('Hạt giống phải là số nguyên').min(1, 'Hạt giống tối thiểu là 1');
const notes = z
  .string()
  .trim()
  .max(1000, 'Tối đa 1000 ký tự')
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));
const overrideReason = z.string().trim().min(5, 'Lý do ghi đè tối thiểu 5 ký tự').max(500).optional();

export const createEntryBody = z.object({
  playerIds: z.array(z.string().uuid('VĐV không hợp lệ')).min(1, 'Chọn VĐV').max(2, 'Tối đa 2 VĐV'),
  stage: stage.optional(),
  quotaType: quotaType.optional(),
  seed: seed.nullable().optional(),
  notes,
  overrideReason,
});
export type CreateEntryBody = z.infer<typeof createEntryBody>;

export const updateEntryBody = z.object({
  stage: stage.optional(),
  quotaType: quotaType.optional(),
  seed: seed.nullable().optional(),
  status: z.enum(['CONFIRMED', 'WITHDRAWN'], { message: 'Trạng thái không hợp lệ' }).optional(),
  notes,
  overrideReason,
});
export type UpdateEntryBody = z.infer<typeof updateEntryBody>;

export const bulkEntriesBody = z
  .object({
    ids: z.array(z.string().uuid('Entry không hợp lệ')).min(1, 'Chọn ít nhất một entry'),
    action: z.enum(['withdraw', 'setStage', 'setQuota'], { message: 'Thao tác không hợp lệ' }),
    stage: stage.optional(),
    quotaType: quotaType.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'setStage' && !value.stage) ctx.addIssue({ code: 'custom', path: ['stage'], message: 'Chọn vòng thi đấu' });
    if (value.action === 'setQuota' && !value.quotaType) ctx.addIssue({ code: 'custom', path: ['quotaType'], message: 'Chọn loại suất' });
  });
export type BulkEntriesBody = z.infer<typeof bulkEntriesBody>;
