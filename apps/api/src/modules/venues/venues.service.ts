import { Injectable } from '@nestjs/common';
import type { Venue } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx, notFound } from '../../common/crud/catalog-crud.js';
import { booleanFilter } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_TAGS } from '../revalidation/cache-tags.js';
import { loadEventSlugs } from '../revalidation/catalog-tag-context.js';

export const VENUE_LIST_SPEC = {
  sortable: ['name', 'city', 'createdAt'],
  defaultSort: { field: 'name', direction: 'asc' },
  searchFields: ['name', 'nameEn', 'address', 'city'],
  filters: { isActive: booleanFilter('isActive') },
} as const;

const TABLE_COUNT = { _count: { select: { tables: true } } } as const;

type VenueRow = Venue & { _count?: { tables: number } };

@Injectable()
export class VenuesService extends CatalogCrudService<VenueRow> {
  protected readonly config: CatalogConfig = {
    entity: 'Venue',
    auditPrefix: 'venue',
    notFoundCode: 'VENUE_NOT_FOUND',
    listSpec: VENUE_LIST_SPEC,
    include: TABLE_COUNT,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<VenueRow> {
    return db.venue;
  }

  protected override toView(row: VenueRow) {
    const { _count, ...venue } = row;
    return { ...venue, tableCount: _count?.tables ?? 0 };
  }

  protected override async publicTags(op: 'create' | 'update' | 'delete', before: Venue | null, after: Venue | null): Promise<string[]> {
    if (op !== 'update') return [];
    return CACHE_TAGS['venue.write']({ eventSlugs: await loadEventSlugs(this.prisma, { OR: [{ venueId: after!.id }, { sessions: { some: { venueId: after!.id } } }] }) });
  }

  protected override usage(tx: Tx, row: VenueRow): UsageChecks {
    return { events: () => tx.event.count({ where: { venueId: row.id } }), sessions: () => tx.eventSession.count({ where: { venueId: row.id } }) };
  }

  override async get(id: string): Promise<unknown> {
    const row = await this.prisma.venue.findUnique({
      where: { id },
      include: { ...TABLE_COUNT, tables: { orderBy: [{ order: 'asc' }, { code: 'asc' }] } },
    });
    if (!row) throw notFound(this.config.notFoundCode);
    return { ...this.toView(row), tables: row.tables };
  }
}
