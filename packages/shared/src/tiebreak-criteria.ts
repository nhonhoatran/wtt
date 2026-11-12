import { z } from 'zod';

/**
 * Vocabulary is fixed in code because each criterion is an algorithm (phase 06).
 * Which ones apply and in what order is configuration (GroupScoringRule.tiebreakers).
 */
export const TIEBREAK_CRITERIA = [
  'HEAD_TO_HEAD_POINTS',
  'HEAD_TO_HEAD_GAME_RATIO',
  'HEAD_TO_HEAD_POINT_RATIO',
  'GAME_RATIO',
  'POINT_RATIO',
  'GAMES_WON',
  'DRAW_OF_LOTS',
] as const;
export type TiebreakCriterion = (typeof TIEBREAK_CRITERIA)[number];

export const TIEBREAK_CRITERION_LABELS: Record<TiebreakCriterion, string> = {
  HEAD_TO_HEAD_POINTS: 'Điểm đối đầu giữa các VĐV bằng điểm',
  HEAD_TO_HEAD_GAME_RATIO: 'Tỷ lệ ván thắng/thua đối đầu',
  HEAD_TO_HEAD_POINT_RATIO: 'Tỷ lệ điểm thắng/thua đối đầu',
  GAME_RATIO: 'Tỷ lệ ván thắng/thua cả bảng',
  POINT_RATIO: 'Tỷ lệ điểm thắng/thua cả bảng',
  GAMES_WON: 'Tổng số ván thắng',
  DRAW_OF_LOTS: 'Bốc thăm',
};

export const tiebreakersSchema = z
  .array(z.enum(TIEBREAK_CRITERIA))
  .min(1, 'Chọn ít nhất một tiêu chí')
  .refine((list) => new Set(list).size === list.length, 'Mỗi tiêu chí chỉ chọn một lần');
