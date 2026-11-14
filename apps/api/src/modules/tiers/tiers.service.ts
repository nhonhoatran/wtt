import { Injectable } from '@nestjs/common';
import type { Tier } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx } from '../../common/crud/catalog-crud.js';
import { booleanFilter } from '../../common/crud/prisma-list-query.js';
import { assertReadyMedia } from '../../common/crud/ready-media.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { loadEventSlugs } from '../revalidation/catalog-tag-context.js';

export const TIER_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: { isActive: booleanFilter('isActive') },
} as const;

@Injectable()
export class TiersService extends CatalogCrudService<Tier> {
  protected readonly config: CatalogConfig = {
    entity: 'Tier',
    auditPrefix: 'tier',
    notFoundCode: 'TIER_NOT_FOUND',
    uniqueField: 'code',
    listSpec: TIER_LIST_SPEC,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<Tier> {
    return db.tier;
  }

  protected override async prepare(tx: Tx, input: { logoMediaId?: string | null; backgroundMediaId?: string | null }) {
    await assertReadyMedia(tx, { logoMediaId: input.logoMediaId, backgroundMediaId: input.backgroundMediaId });
    return { ...input };
  }

  protected override async publicTags(op: 'create' | 'update' | 'delete', before: Tier | null, after: Tier | null): Promise<string[]> {
    const id = (after ?? before)!.id;
    return CACHE_TAGS['tier.write']({ eventSlugs: op === 'update' ? await loadEventSlugs(this.prisma, { eventType: { tierId: id } }) : [] });
  }

  protected override usage(tx: Tx, row: Tier): UsageChecks {
    return { eventTypes: () => tx.eventType.count({ where: { tierId: row.id } }) };
  }
}
