import { Injectable } from '@nestjs/common';
import { type GroupScoringRule, UnfinishedMatchScoring } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx } from '../../common/crud/catalog-crud.js';
import { resolveDefaultFlag } from '../../common/crud/default-flag.js';
import { defaultRowConflict } from '../../common/crud/delete-guard.js';
import { booleanFilter } from '../../common/crud/prisma-list-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const GROUP_SCORING_RULE_LIST_SPEC = {
  sortable: ['name', 'pointsWin', 'isDefault', 'createdAt'],
  defaultSort: { field: 'name', direction: 'asc' },
  searchFields: ['name', 'nameEn'],
  filters: { isActive: booleanFilter('isActive'), isDefault: booleanFilter('isDefault') },
} as const;

interface RuleInput {
  isDefault?: boolean;
  isActive?: boolean;
  unfinishedMatchScoring?: UnfinishedMatchScoring;
  awardedGamePoints?: number | null;
}

@Injectable()
export class GroupScoringRulesService extends CatalogCrudService<GroupScoringRule> {
  protected readonly config: CatalogConfig = {
    entity: 'GroupScoringRule',
    auditPrefix: 'groupScoringRule',
    notFoundCode: 'GROUP_SCORING_RULE_NOT_FOUND',
    defaultLockName: 'GroupScoringRule.default',
    listSpec: GROUP_SCORING_RULE_LIST_SPEC,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<GroupScoringRule> {
    return db.groupScoringRule;
  }

  protected override async prepare(tx: Tx, input: RuleInput, existing: GroupScoringRule | null) {
    const mode = input.unfinishedMatchScoring ?? existing?.unfinishedMatchScoring;
    const awarded = input.awardedGamePoints !== undefined ? input.awardedGamePoints : (existing?.awardedGamePoints ?? null);
    if (mode === UnfinishedMatchScoring.AWARD_REMAINING_TO_WINNER && awarded === null) {
      throw fieldError('awardedGamePoints', 'Nhập số ván cộng cho người thắng');
    }
    const isDefault = await resolveDefaultFlag(tx, 'GroupScoringRule.default', tx.groupScoringRule, input, existing);
    return {
      ...input,
      ...(mode === UnfinishedMatchScoring.COUNT_PLAYED_ONLY && { awardedGamePoints: null }),
      ...(isDefault !== undefined && { isDefault }),
    };
  }

  protected override assertDeletable(row: GroupScoringRule): void {
    if (row.isDefault) throw defaultRowConflict();
  }

  protected override usage(tx: Tx, row: GroupScoringRule): UsageChecks {
    return { subEvents: () => tx.subEvent.count({ where: { groupScoringRuleId: row.id } }) };
  }

  protected override toView(row: GroupScoringRule) {
    return { ...row, withdrawalPolicyMissing: row.withdrawalPolicy === null };
  }
}
