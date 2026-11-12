import { Injectable } from '@nestjs/common';
import type { MatchFormat } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx } from '../../common/crud/catalog-crud.js';
import { resolveDefaultFlag } from '../../common/crud/default-flag.js';
import { defaultRowConflict } from '../../common/crud/delete-guard.js';
import { booleanFilter } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const MATCH_FORMAT_LIST_SPEC = {
  sortable: ['name', 'bestOf', 'pointsPerGame', 'estimatedMinutes', 'isDefault', 'createdAt'],
  defaultSort: { field: 'name', direction: 'asc' },
  searchFields: ['name', 'nameEn'],
  filters: { isActive: booleanFilter('isActive'), isDefault: booleanFilter('isDefault') },
} as const;

@Injectable()
export class MatchFormatsService extends CatalogCrudService<MatchFormat> {
  protected readonly config: CatalogConfig = {
    entity: 'MatchFormat',
    auditPrefix: 'matchFormat',
    notFoundCode: 'MATCH_FORMAT_NOT_FOUND',
    defaultLockName: 'MatchFormat.default',
    listSpec: MATCH_FORMAT_LIST_SPEC,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<MatchFormat> {
    return db.matchFormat;
  }

  protected override async prepare(tx: Tx, input: { isDefault?: boolean; isActive?: boolean }, existing: MatchFormat | null) {
    const isDefault = await resolveDefaultFlag(tx, 'MatchFormat.default', tx.matchFormat, input, existing);
    return { ...input, ...(isDefault !== undefined && { isDefault }) };
  }

  protected override assertDeletable(row: MatchFormat): void {
    if (row.isDefault) throw defaultRowConflict();
  }

  protected override usage(tx: Tx, row: MatchFormat): UsageChecks {
    return { subEvents: () => tx.subEvent.count({ where: { matchFormatId: row.id } }) };
  }
}
