import type { Prisma, SubEventFormat } from '@kamito/db';
import { fieldError } from '../../common/validation/parse-body.js';

type CatalogReader = Pick<Prisma.TransactionClient, 'matchFormat' | 'groupScoringRule'>;

export interface FormatInput {
  format: SubEventFormat;
  matchFormatId?: string | null;
  groupScoringRuleId?: string | null;
}

export interface ResolvedFormat {
  matchFormatId: string;
  groupScoringRuleId: string | null;
}

/**
 * Fills the default match format / scoring rule and rejects inactive ones.
 * Ids equal to `unchanged` skip the active check so editing other fields never fails on old data.
 */
export async function resolveFormat(
  db: CatalogReader,
  input: FormatInput,
  unchanged: Partial<ResolvedFormat> = {},
  fieldPrefix = '',
): Promise<ResolvedFormat> {
  const matchFormatId = input.matchFormatId ?? (await defaultId(db.matchFormat));
  if (!matchFormatId) throw fieldError(`${fieldPrefix}matchFormatId`, 'Chưa có thể thức trận mặc định, hãy chọn một thể thức');
  if (matchFormatId !== unchanged.matchFormatId) {
    const row = await db.matchFormat.findUnique({ where: { id: matchFormatId }, select: { isActive: true } });
    if (!row?.isActive) throw fieldError(`${fieldPrefix}matchFormatId`, 'Thể thức trận không tồn tại hoặc đã ngừng dùng');
  }
  if (input.format !== 'GROUP_KNOCKOUT') return { matchFormatId, groupScoringRuleId: null };

  const ruleId = input.groupScoringRuleId ?? (await defaultId(db.groupScoringRule));
  if (!ruleId) throw fieldError(`${fieldPrefix}groupScoringRuleId`, 'Thể thức vòng bảng cần chọn luật tính điểm bảng');
  if (ruleId !== unchanged.groupScoringRuleId) {
    const row = await db.groupScoringRule.findUnique({ where: { id: ruleId }, select: { isActive: true } });
    if (!row?.isActive) throw fieldError(`${fieldPrefix}groupScoringRuleId`, 'Luật tính điểm bảng không tồn tại hoặc đã ngừng dùng');
  }
  return { matchFormatId, groupScoringRuleId: ruleId };
}

async function defaultId(delegate: {
  findFirst(args: { where: { isDefault: true; isActive: true }; select: { id: true } }): PromiseLike<{ id: string } | null>;
}): Promise<string | null> {
  return (await delegate.findFirst({ where: { isDefault: true, isActive: true }, select: { id: true } }))?.id ?? null;
}

export const subEventCode = (disciplineCode: string, categoryCode?: string | null): string =>
  categoryCode ? `${disciplineCode}-${categoryCode}` : disciplineCode;
