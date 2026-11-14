import { z } from 'zod';
import { MATCH_REASON_MAX_LENGTH, MATCH_REASON_MIN_LENGTH } from '@kamito/shared';

/** Sanity bound against typos; real limits come from the match format. */
const MAX_GAMES = 15;
const MAX_POINTS = 999;
/** Sanity bound on the preview echoed back by a forced reopen. */
const MAX_BLOCKING = 200;

const expectedVersion = z.number({ message: 'Thiếu phiên bản trận' }).int().min(0);
const points = z.number({ message: 'Nhập điểm' }).int('Điểm phải là số nguyên').min(0, 'Điểm không được âm').max(MAX_POINTS);
const games = z.array(z.object({ score1: points, score2: points })).max(MAX_GAMES);
const reason = z
  .string({ message: 'Nhập lý do' })
  .trim()
  .min(MATCH_REASON_MIN_LENGTH, `Lý do tối thiểu ${MATCH_REASON_MIN_LENGTH} ký tự`)
  .max(MATCH_REASON_MAX_LENGTH, `Lý do tối đa ${MATCH_REASON_MAX_LENGTH} ký tự`);

export const versionedMatchBody = z.object({ expectedVersion });

export const confirmMatchBody = z.object({
  expectedVersion,
  resultType: z.enum(['NORMAL', 'WALKOVER', 'RETIRED', 'DISQUALIFIED'], { message: 'Chọn loại kết quả' }),
  winnerSide: z.union([z.literal(1), z.literal(2)]).nullable().optional(),
  games,
});
export type ConfirmMatchBody = z.infer<typeof confirmMatchBody>;

export const saveProgressBody = z.object({ expectedVersion, games });
export type SaveProgressBody = z.infer<typeof saveProgressBody>;

export const amendScoresBody = z.object({ expectedVersion, games, reason });
export type AmendScoresBody = z.infer<typeof amendScoresBody>;

export const reopenMatchBody = z
  .object({ expectedVersion, reason, force: z.boolean().optional(), expectedBlockingIds: z.array(z.string()).max(MAX_BLOCKING).optional() })
  .refine((b) => !b.force || b.expectedBlockingIds !== undefined, { path: ['expectedBlockingIds'], message: 'Thiếu danh sách trận bị chặn đã xem trước' });
export type ReopenMatchBody = z.infer<typeof reopenMatchBody>;
