import { Injectable } from '@nestjs/common';
import type { EventType } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import {
  type CatalogConfig,
  CatalogCrudService,
  type CrudDelegate,
  type UsageChecks,
  type Tx,
  assertExists,
} from '../../common/crud/catalog-crud.js';
import { booleanFilter, idFilter } from '../../common/crud/prisma-list-query.js';
import { assertReadyMedia } from '../../common/crud/ready-media.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const EVENT_TYPE_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: { tierId: idFilter('tierId'), isActive: booleanFilter('isActive') },
} as const;

interface EventTypeInput {
  tierId?: string;
  logoMediaId?: string | null;
  backgroundMediaId?: string | null;
}

@Injectable()
export class EventTypesService extends CatalogCrudService<EventType> {
  protected readonly config: CatalogConfig = {
    entity: 'EventType',
    auditPrefix: 'eventType',
    notFoundCode: 'EVENT_TYPE_NOT_FOUND',
    uniqueField: 'code',
    listSpec: EVENT_TYPE_LIST_SPEC,
    include: { tier: { select: { id: true, code: true, name: true, nameEn: true, colorHex: true } } },
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<EventType> {
    return db.eventType;
  }

  protected override async prepare(tx: Tx, input: EventTypeInput) {
    if (input.tierId) await assertExists(tx.tier.count({ where: { id: input.tierId } }), 'tierId', 'Không tìm thấy cấp giải');
    await assertReadyMedia(tx, { logoMediaId: input.logoMediaId, backgroundMediaId: input.backgroundMediaId });
    return { ...input };
  }

  protected override usage(tx: Tx, row: EventType): UsageChecks {
    return { events: () => tx.event.count({ where: { eventTypeId: row.id } }) };
  }
}
