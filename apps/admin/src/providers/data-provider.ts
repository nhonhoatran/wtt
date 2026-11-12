import type { BaseRecord, CrudFilter, CrudSort, DataProvider, Pagination } from '@refinedev/core';
import { apiFetch } from '../api/http-client';

// Refine resource names map 1:1 onto /api/v1/admin/<resource>.
const resourcePath = (resource: string) => `/admin/${resource}`;

function listQuery(pagination?: Pagination, sorters?: CrudSort[], filters?: CrudFilter[]): string {
  const params = new URLSearchParams();
  params.set('page', String(pagination?.currentPage ?? 1));
  if (pagination?.pageSize) params.set('pageSize', String(pagination.pageSize));
  const sort = sorters?.[0];
  if (sort) params.set('sort', `${sort.field}:${sort.order}`);
  for (const filter of filters ?? []) {
    if (!('field' in filter)) continue;
    const value = filter.value as unknown;
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const text = Array.isArray(value) ? value.join(',') : String(value);
    params.set(filter.field === 'q' ? 'q' : `filter[${filter.field}]`, text);
  }
  return params.toString();
}

export const dataProvider: DataProvider = {
  getApiUrl: () => '/api/v1/admin',
  getList: async <T extends BaseRecord>({ resource, pagination, sorters, filters }: Parameters<DataProvider['getList']>[0]) => {
    const { data, total } = await apiFetch<{ data: T[]; total: number }>(
      `${resourcePath(resource)}?${listQuery(pagination, sorters, filters)}`,
    );
    return { data, total };
  },
  getOne: async ({ resource, id }) => apiFetch(`${resourcePath(resource)}/${encodeURIComponent(String(id))}`),
  create: async ({ resource, variables }) => apiFetch(resourcePath(resource), { method: 'POST', body: variables }),
  update: async ({ resource, id, variables }) =>
    apiFetch(`${resourcePath(resource)}/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: variables }),
  deleteOne: async ({ resource, id }) =>
    apiFetch(`${resourcePath(resource)}/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),
};
