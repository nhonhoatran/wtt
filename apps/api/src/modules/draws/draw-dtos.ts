import { z } from 'zod';
import { MIN_GROUP_SIZE } from '@kamito/competition-engine';
import { DRAW_REASON_MAX_LENGTH, DRAW_REASON_MIN_LENGTH } from '@kamito/shared';

const kind = z.enum(['MAIN', 'QUALIFYING', 'GROUP'], { message: 'Chọn loại nhánh' });
const expectedVersion = z.number({ message: 'Thiếu phiên bản nhánh' }).int().min(0);

const paramFields = {
  kind,
  seedCount: z.number().int('Phải là số nguyên').min(0, 'Không được âm').optional(),
  qualifierCount: z.number().int('Phải là số nguyên').min(0, 'Không được âm').optional(),
  groupCount: z.number().int('Phải là số nguyên').min(1, 'Tối thiểu 1 bảng').optional(),
  groupSize: z.number().int('Phải là số nguyên').min(MIN_GROUP_SIZE, `Tối thiểu ${MIN_GROUP_SIZE} VĐV`).optional(),
  advancePerGroup: z.number().int('Phải là số nguyên').min(1).max(2, 'Chỉ hỗ trợ 1 hoặc 2 VĐV đi tiếp').optional(),
};

export const previewDrawBody = z.object(paramFields);
export type DrawParamsBody = z.infer<typeof previewDrawBody>;

export const generateDrawBody = z.object({ ...paramFields, expectedVersion: expectedVersion.optional() });
export type GenerateDrawBody = z.infer<typeof generateDrawBody>;

export const suggestSeedsBody = z.object({ apply: z.boolean().optional() });

export const versionedBody = z.object({ expectedVersion });

export const swapBody = z.object({
  positionA: z.string().uuid('Vị trí không hợp lệ'),
  positionB: z.string().uuid('Vị trí không hợp lệ'),
  expectedVersion,
});
export type SwapBody = z.infer<typeof swapBody>;

export const swapGroupMembersBody = z.object({
  entryA: z.string().uuid('VĐV không hợp lệ'),
  entryB: z.string().uuid('VĐV không hợp lệ'),
  expectedVersion,
});
export type SwapGroupMembersBody = z.infer<typeof swapGroupMembersBody>;

export const roundFormatBody = z.object({
  matchFormatId: z.string().uuid('Thể thức không hợp lệ').nullable(),
  expectedVersion,
});
export type RoundFormatBody = z.infer<typeof roundFormatBody>;

const reason = z.string({ message: 'Nhập lý do' }).trim().min(DRAW_REASON_MIN_LENGTH, `Lý do tối thiểu ${DRAW_REASON_MIN_LENGTH} ký tự`).max(DRAW_REASON_MAX_LENGTH, `Lý do tối đa ${DRAW_REASON_MAX_LENGTH} ký tự`);
const optionalReason = reason.optional();
const needsReason = (body: { reason?: string; dryRun?: boolean }) => body.dryRun === true || body.reason !== undefined;
const reasonRequired = { message: 'Nhập lý do', path: ['reason'] };
const dryRun = z.boolean({ message: 'dryRun phải là true hoặc false' }).optional();

export const unpublishBody = z.object({ reason: optionalReason, expectedVersion, dryRun }).refine(needsReason, reasonRequired);
export type UnpublishBody = z.infer<typeof unpublishBody>;

export const replaceEntryBody = z.object({
  positionId: z.string().uuid('Vị trí không hợp lệ'),
  newEntryId: z.string().uuid('VĐV không hợp lệ'),
  reason: optionalReason,
  expectedVersion,
  dryRun,
}).refine(needsReason, reasonRequired);
export type ReplaceEntryBody = z.infer<typeof replaceEntryBody>;

export const withdrawEntryBody = z.object({ entryId: z.string().uuid('VĐV không hợp lệ'), reason: optionalReason, expectedVersion, dryRun }).refine(needsReason, reasonRequired);
export type WithdrawEntryBody = z.infer<typeof withdrawEntryBody>;

export const manualRanksBody = z.object({
  ranks: z.record(z.string().uuid('VĐV không hợp lệ'), z.number().int('Phải là số nguyên').min(1, 'Hạng tối thiểu là 1')),
  reason,
  expectedVersion,
});
export type ManualRanksBody = z.infer<typeof manualRanksBody>;
