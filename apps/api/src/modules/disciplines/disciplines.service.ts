import { Injectable } from '@nestjs/common';
import { CompetitorKind, type Discipline, GenderRule } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx } from '../../common/crud/catalog-crud.js';
import { booleanFilter, enumFilter } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { loadSubEventUsage } from '../revalidation/catalog-tag-context.js';

export const DISCIPLINE_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: {
    competitorKind: enumFilter('competitorKind', Object.values(CompetitorKind)),
    genderRule: enumFilter('genderRule', Object.values(GenderRule)),
    isActive: booleanFilter('isActive'),
  },
} as const;

@Injectable()
export class DisciplinesService extends CatalogCrudService<Discipline> {
  protected readonly config: CatalogConfig = {
    entity: 'Discipline',
    auditPrefix: 'discipline',
    notFoundCode: 'DISCIPLINE_NOT_FOUND',
    uniqueField: 'code',
    listSpec: DISCIPLINE_LIST_SPEC,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<Discipline> {
    return db.discipline;
  }

  protected override async publicTags(op: 'create' | 'update' | 'delete', before: Discipline | null, after: Discipline | null): Promise<string[]> {
    if (op !== 'update') return [];
    return CACHE_TAGS['discipline.write'](await loadSubEventUsage(this.prisma, { disciplineId: after!.id }));
  }

  protected override usage(tx: Tx, row: Discipline): UsageChecks {
    return { subEvents: () => tx.subEvent.count({ where: { disciplineId: row.id } }) };
  }
}
