import { Injectable } from '@nestjs/common';
import { type Category, CategoryKind } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { type CatalogConfig, CatalogCrudService, type CrudDelegate,
  type UsageChecks, type Tx } from '../../common/crud/catalog-crud.js';
import { booleanFilter, enumFilter } from '../../common/crud/prisma-list-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CATEGORY_LIST_SPEC = {
  sortable: ['order', 'name', 'code', 'kind', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'name', 'nameEn'],
  filters: { kind: enumFilter('kind', Object.values(CategoryKind)), isActive: booleanFilter('isActive') },
} as const;

@Injectable()
export class CategoriesService extends CatalogCrudService<Category> {
  protected readonly config: CatalogConfig = {
    entity: 'Category',
    auditPrefix: 'category',
    notFoundCode: 'CATEGORY_NOT_FOUND',
    uniqueField: 'code',
    listSpec: CATEGORY_LIST_SPEC,
  };

  constructor(prisma: PrismaService, audit: AuditService) {
    super(prisma, audit);
  }

  protected delegate(db: Tx): CrudDelegate<Category> {
    return db.category;
  }

  protected override prepare(_tx: Tx, input: { minAge?: number | null; maxAge?: number | null }, existing: Category | null) {
    const minAge = input.minAge !== undefined ? input.minAge : (existing?.minAge ?? null);
    const maxAge = input.maxAge !== undefined ? input.maxAge : (existing?.maxAge ?? null);
    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      throw fieldError('maxAge', 'Tuổi tối đa phải lớn hơn hoặc bằng tuổi tối thiểu');
    }
    return { ...input };
  }

  protected override usage(tx: Tx, row: Category): UsageChecks {
    return { subEvents: () => tx.subEvent.count({ where: { categoryId: row.id } }) };
  }
}
