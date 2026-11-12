import type { Prisma } from '@kamito/db';
import { fieldError } from '../../common/validation/parse-body.js';
import { subEventCode } from './sub-event-format.js';

type CatalogReader = Pick<Prisma.TransactionClient, 'discipline' | 'category'>;

export interface SubEventItemInput {
  disciplineId: string;
  categoryId?: string | null;
}

export interface ResolvedItem {
  code: string;
  disciplineId: string;
  categoryId: string | null;
}

export const SUB_EVENT_INCLUDE = {
  discipline: { select: { id: true, code: true, name: true, nameEn: true } },
  category: { select: { id: true, code: true, name: true, nameEn: true } },
  matchFormat: { select: { id: true, name: true, nameEn: true } },
  groupScoringRule: { select: { id: true, name: true, nameEn: true } },
} as const;

/**
 * Looks up discipline/category rows (must exist and be active) and derives each code.
 * `bulk` only changes the error field path: `items.N.disciplineId` vs `disciplineId`.
 */
export async function resolveItems(db: CatalogReader, items: SubEventItemInput[], bulk: boolean): Promise<ResolvedItem[]> {
  const disciplineIds = [...new Set(items.map((item) => item.disciplineId))];
  const categoryIds = [...new Set(items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))];
  const [disciplines, categories] = await Promise.all([
    db.discipline.findMany({ where: { id: { in: disciplineIds }, isActive: true }, select: { id: true, code: true } }),
    categoryIds.length
      ? db.category.findMany({ where: { id: { in: categoryIds }, isActive: true }, select: { id: true, code: true } })
      : Promise.resolve([]),
  ]);
  const disciplineById = new Map(disciplines.map((row) => [row.id, row]));
  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const path = (index: number, name: string) => (bulk ? `items.${index}.${name}` : name);

  return items.map((item, index) => {
    const discipline = disciplineById.get(item.disciplineId);
    if (!discipline) throw fieldError(path(index, 'disciplineId'), 'Nội dung thi đấu không tồn tại hoặc đã ngừng dùng');
    const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
    if (item.categoryId && !category) throw fieldError(path(index, 'categoryId'), 'Hạng mục không tồn tại hoặc đã ngừng dùng');
    return {
      code: subEventCode(discipline.code, category?.code),
      disciplineId: discipline.id,
      categoryId: category?.id ?? null,
    };
  });
}
