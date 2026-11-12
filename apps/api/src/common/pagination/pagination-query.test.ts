import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parsePaginationQuery } from './pagination-query.js';

const limits = { defaultPageSize: 20, maxPageSize: 100, maxQueryLength: 10 };
const rules = { sortable: ['name', 'createdAt'], filterable: ['status'] };

describe('parsePaginationQuery', () => {
  it('applies defaults', () => {
    expect(parsePaginationQuery({}, rules, limits)).toEqual({ page: 1, pageSize: 20, sort: undefined, q: undefined, filter: {} });
  });

  it('parses sort, q and whitelisted filters', () => {
    const parsed = parsePaginationQuery({ page: '2', pageSize: '50', sort: 'name:desc', q: ' an ', 'filter[status]': 'OPEN' }, rules, limits);
    expect(parsed).toEqual({ page: 2, pageSize: 50, sort: { field: 'name', direction: 'desc' }, q: 'an', filter: { status: 'OPEN' } });
  });

  it.each([
    [{ pageSize: '101' }],
    [{ page: '0' }],
    [{ sort: 'password:asc' }],
    [{ sort: 'name' }],
    [{ q: 'x'.repeat(11) }],
    [{ 'filter[secret]': '1' }],
  ])('rejects %j', (raw) => {
    expect(() => parsePaginationQuery(raw, rules, limits)).toThrow(BadRequestException);
  });
});
