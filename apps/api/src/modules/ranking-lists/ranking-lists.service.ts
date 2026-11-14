import { Injectable } from '@nestjs/common';
import type { RankingList } from '@kamito/db';
import { findDirtySubEventIds } from '@kamito/db';
import { rankingSettings } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate, assertExists, type Tx, type UsageChecks } from '../../common/crud/catalog-crud.js';
import { booleanFilter, enumFilter } from '../../common/crud/prisma-list-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { COMPETITOR_KINDS, GENDER_RULES } from './ranking-list-dtos.js';

export const RANKING_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'validityDays', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: {
    isActive: booleanFilter('isActive'),
    competitorKind: enumFilter('competitorKind', COMPETITOR_KINDS),
    genderRule: enumFilter('genderRule', GENDER_RULES),
  },
} as const;

interface ListInput {
  competitorKind?: RankingList['competitorKind'];
  categoryId?: string | null;
  validityDays?: number;
  groupStageByRank?: boolean;
}

@Injectable()
export class RankingListsService extends CatalogCrudService<RankingList> {
  protected readonly config: CatalogConfig = {
    entity: 'RankingList',
    auditPrefix: 'ranking.list',
    notFoundCode: 'RANKING_LIST_NOT_FOUND',
    uniqueField: 'code',
    listSpec: RANKING_LIST_SPEC,
  };

  constructor(
    prisma: PrismaService,
    audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly enqueuer: RankingEnqueueService,
  ) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<RankingList> {
    return db.rankingList;
  }

  protected override async prepare(tx: Tx, input: ListInput, existing: RankingList | null) {
    if (input.categoryId) await assertExists(tx.category.count({ where: { id: input.categoryId } }), 'categoryId', 'Nhóm tuổi không tồn tại');
    if (!existing) return { ...input, validityDays: input.validityDays ?? (await this.settings.get(rankingSettings.defaultValidityDays)) };

    const kindChanged = input.competitorKind !== undefined && input.competitorKind !== existing.competitorKind;
    const rulesChanged =
      (input.validityDays !== undefined && input.validityDays !== existing.validityDays) ||
      (input.groupStageByRank !== undefined && input.groupStageByRank !== existing.groupStageByRank);
    if (!kindChanged && !rulesChanged) return { ...input };

    const assigned = await tx.subEvent.findMany({ where: { rankingListId: existing.id }, select: { id: true } });
    if (kindChanged && assigned.length) throw fieldError('competitorKind', 'Bảng đang gắn với nội dung thi đấu nên không đổi được Đơn/Đôi');
    if (rulesChanged) await markRankingDirty(tx, assigned.map((row) => row.id));
    return { ...input };
  }

  protected override async publicTags(op: 'create' | 'update' | 'delete', before: RankingList | null, after: RankingList | null): Promise<string[]> {
    return CACHE_TAGS['rankingList.write']({ codes: [...new Set([before?.code, after?.code].filter((code): code is string => Boolean(code)))] });
  }

  protected override usage(tx: Tx, row: RankingList): UsageChecks {
    return {
      subEvents: () => tx.subEvent.count({ where: { rankingListId: row.id } }),
      pointsEarned: () => tx.rankingPointsEarned.count({ where: { rankingListId: row.id } }),
      snapshots: () => tx.rankingSnapshot.count({ where: { rankingListId: row.id } }),
    };
  }

  /** Update, then queue a recompute for whatever the change left dirty (after commit). */
  async updateAndEnqueue(id: string, input: object) {
    const { data, warnings: refresh = [] } = await this.updateRefreshed(id, input);
    const warnings = [...refresh, ...(await this.enqueuer.enqueueRecompute(await findDirtySubEventIds(this.prisma, id)))];
    return { data, ...(warnings.length > 0 && { warnings }) };
  }
}
