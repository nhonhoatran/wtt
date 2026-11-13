import { z } from 'zod';

/** Sanity bound against typos; real limits come from the match format. */
const MAX_GAMES = 15;
const MAX_POINTS = 999;

const expectedVersion = z.number({ message: 'Thiếu phiên bản trận' }).int().min(0);
const points = z.number({ message: 'Nhập điểm' }).int('Điểm phải là số nguyên').min(0, 'Điểm không được âm').max(MAX_POINTS);

export const versionedMatchBody = z.object({ expectedVersion });

export const confirmMatchBody = z.object({
  expectedVersion,
  resultType: z.enum(['NORMAL', 'WALKOVER', 'RETIRED', 'DISQUALIFIED'], { message: 'Chọn loại kết quả' }),
  winnerSide: z.union([z.literal(1), z.literal(2)]).nullable().optional(),
  games: z.array(z.object({ score1: points, score2: points })).max(MAX_GAMES),
});
export type ConfirmMatchBody = z.infer<typeof confirmMatchBody>;
