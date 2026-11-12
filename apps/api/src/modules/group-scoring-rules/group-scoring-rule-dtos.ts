import { GroupWithdrawalPolicy, UnfinishedMatchScoring } from '@kamito/db';
import { tiebreakersSchema } from '@kamito/shared';
import { z } from 'zod';
import { nameField, optionalText } from '../../common/crud/catalog-fields.js';

// Guard rails against typos, not business values.
const points = z.number().int().min(0).max(100);

export const createGroupScoringRuleBody = z.object({
  name: nameField,
  nameEn: optionalText(120),
  pointsWin: points,
  pointsLoss: points,
  pointsWalkoverLoss: points,
  pointsUnfinishedLoss: points,
  unfinishedMatchScoring: z.enum(UnfinishedMatchScoring, { message: 'Chọn cách tính trận dang dở' }),
  awardedGamePoints: z.number().int().min(0).max(50).nullable().optional(),
  withdrawalPolicy: z.enum(GroupWithdrawalPolicy).nullable().optional(),
  tiebreakers: tiebreakersSchema,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const updateGroupScoringRuleBody = createGroupScoringRuleBody.partial();
