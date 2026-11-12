import type { BaseRecord, CrudFilter, DataProvider, HttpError } from '@refinedev/core';

const API = '/api';

function buildListQuery(pagination: { currentPage?: number; pageSize?: number } | undefined, sorters: { field: string; order: string }[] | undefined, filters: CrudFilter[] | undefined) {
  const p = new URLSearchParams();
  p.set('page', String(pagination?.currentPage ?? 1));
  p.set('pageSize', String(pagination?.pageSize ?? 10));
  if (sorters?.length) p.set('sort', sorters.map((s) => (s.order === 'desc' ? '-' : '') + s.field).join(','));
  for (const f of filters ?? []) {
    if (!('field' in f) || f.value == null || f.value === '' || (Array.isArray(f.value) && !f.value.length)) continue;
    if (f.field === 'q') p.set('q', String(f.value));
    else p.set(`filter[${f.field}]`, Array.isArray(f.value) ? f.value.join(',') : String(f.value));
  }
  return p.toString();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  } catch {
    throw { message: 'Network error', statusCode: 0 } satisfies HttpError;
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw { message: body.message ?? res.statusText, statusCode: res.status, errors: body.errors } satisfies HttpError;
  }
  return body as T;
}

export const dataProvider: DataProvider = {
  getApiUrl: () => API,
  getList: async <T extends BaseRecord>({ resource, pagination, sorters, filters }: Parameters<DataProvider['getList']>[0]) => {
    const { data, total } = await request<{ data: T[]; total: number }>(`${API}/${resource}?${buildListQuery(pagination, sorters, filters)}`);
    return { data, total } as { data: T[]; total: number };
  },
  getOne: async ({ resource, id }) => {
    const { data } = await request<{ data: never }>(`${API}/${resource}/${id}`);
    return { data };
  },
  create: async ({ resource, variables }) => {
    const { data } = await request<{ data: never }>(`${API}/${resource}`, { method: 'POST', body: JSON.stringify(variables) });
    return { data };
  },
  update: async ({ resource, id, variables }) => {
    const { data } = await request<{ data: never }>(`${API}/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(variables) });
    return { data };
  },
  deleteOne: async ({ resource, id }) => {
    const { data } = await request<{ data: never }>(`${API}/${resource}/${id}`, { method: 'DELETE' });
    return { data };
  },
};
