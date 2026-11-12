import { BadRequestException } from '@nestjs/common';
import type { PaginationQueryShape } from '@kamito/shared';
import { describe, expect, it, vi } from 'vitest';
import { booleanFilter, buildListWhere, enumFilter, idFilter, listRules, prismaListQuery, type ListSpec } from './prisma-list-query.js';

const spec: ListSpec = {
  sortable: ['name', 'order'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['name', 'code'],
  filters: { isActive: booleanFilter('isActive'), kind: enumFilter('kind', ['AGE', 'SKILL']), tierId: idFilter('tierId') },
};

const query = (over: Partial<PaginationQueryShape> = {}): PaginationQueryShape => ({ page: 2, pageSize: 10, filter: {}, ...over });

function fakePrisma(rows: unknown[], total: number) {
  const delegate = { findMany: vi.fn(async (_args: Record<string, unknown>) => rows), count: vi.fn(async (_args: unknown) => total) };
  const prisma = { $transaction: vi.fn(async (ops: PromiseLike<unknown>[]) => Promise.all(ops)) };
  return { delegate, prisma };
}

describe('prismaListQuery', () => {
  it('pages, sorts with a stable tiebreak and returns total from the same where', async () => {
    const { delegate, prisma } = fakePrisma([{ id: 'a' }], 31);
    const result = await prismaListQuery(prisma as never, delegate, query({ sort: { field: 'name', direction: 'desc' } }), spec, {
      baseWhere: { eventId: 'e1' },
    });
    expect(result).toEqual({ data: [{ id: 'a' }], total: 31, page: 2, pageSize: 10 });
    const args = delegate.findMany.mock.calls[0]![0];
    expect(args).toMatchObject({ skip: 10, take: 10, orderBy: [{ name: 'desc' }, { id: 'asc' }] });
    expect(delegate.count).toHaveBeenCalledWith({ where: args.where });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('falls back to the default sort', async () => {
    const { delegate, prisma } = fakePrisma([], 0);
    await prismaListQuery(prisma as never, delegate, query(), spec);
    expect(delegate.findMany.mock.calls[0]![0]).toMatchObject({ orderBy: [{ order: 'asc' }, { id: 'asc' }] });
  });

  it('rejects a sort field outside the whitelist', async () => {
    const { delegate, prisma } = fakePrisma([], 0);
    await expect(prismaListQuery(prisma as never, delegate, query({ sort: { field: 'secret', direction: 'asc' } }), spec)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('buildListWhere', () => {
  it('combines base where, search and converted filters', () => {
    const where = buildListWhere(query({ q: 'nam', filter: { isActive: 'false', kind: 'AGE,SKILL' } }), spec, { x: 1 });
    expect(where).toEqual({
      AND: [
        { x: 1 },
        { OR: [{ name: { contains: 'nam', mode: 'insensitive' } }, { code: { contains: 'nam', mode: 'insensitive' } }] },
        { isActive: false },
        { kind: { in: ['AGE', 'SKILL'] } },
      ],
    });
  });

  it.each([
    [{ isActive: 'yes' }],
    [{ kind: 'NOPE' }],
    [{ tierId: 'not-a-uuid' }],
    [{ unknown: '1' }],
  ])('throws 400 for %o', (filter) => {
    expect(() => buildListWhere(query({ filter }), spec)).toThrow(BadRequestException);
  });

  it('exposes whitelist rules for parsePaginationQuery', () => {
    expect(listRules(spec)).toEqual({ sortable: ['name', 'order'], filterable: ['isActive', 'kind', 'tierId'] });
  });
});
