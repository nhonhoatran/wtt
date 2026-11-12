import { BadRequestException } from '@nestjs/common';
import type { PaginatedResult, PaginationQueryShape } from '@kamito/shared';
import { toPaginatedResult, type PaginationRules } from '../pagination/pagination-query.js';

type Where = Record<string, unknown>;
/** Turns one raw `filter[key]` value into a Prisma where fragment; throws 400 on bad input. */
export type FilterConverter = (value: string) => Where;

export interface ListSpec {
  sortable: readonly string[];
  defaultSort: { field: string; direction: 'asc' | 'desc' };
  /** Case-insensitive `contains` on these fields when `q` is present. */
  searchFields?: readonly string[];
  filters?: Readonly<Record<string, FilterConverter>>;
}

/** Structural slice of a Prisma model delegate (findMany + count). */
/* eslint-disable @typescript-eslint/no-explicit-any -- each concrete model delegate types its own args */
export interface ListDelegate<T> {
  findMany(args: any): PromiseLike<T[]>;
  count(args: any): PromiseLike<number>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface TransactionRunner {
  $transaction<R extends readonly PromiseLike<unknown>[]>(ops: [...R]): Promise<{ [K in keyof R]: Awaited<R[K]> }>;
}

export function listRules(spec: ListSpec): PaginationRules {
  return { sortable: spec.sortable, filterable: Object.keys(spec.filters ?? {}) };
}

export function buildListWhere(query: PaginationQueryShape, spec: ListSpec, baseWhere: Where = {}): Where {
  const and: Where[] = [baseWhere];
  if (query.q && spec.searchFields?.length) {
    and.push({ OR: spec.searchFields.map((field) => ({ [field]: { contains: query.q, mode: 'insensitive' } })) });
  }
  for (const [key, value] of Object.entries(query.filter)) {
    const convert = spec.filters?.[key];
    if (!convert) throw invalidQuery(`Filter not allowed: ${key}`);
    and.push(convert(value));
  }
  return { AND: and };
}

/** findMany + count in one transaction so `total` matches the page; sort fields are already whitelisted. */
export async function prismaListQuery<T>(
  prisma: TransactionRunner,
  delegate: ListDelegate<T>,
  query: PaginationQueryShape,
  spec: ListSpec,
  options: { baseWhere?: Where; select?: unknown; include?: unknown } = {},
): Promise<PaginatedResult<T>> {
  const where = buildListWhere(query, spec, options.baseWhere);
  if (query.sort && !spec.sortable.includes(query.sort.field)) throw invalidQuery('sort field not allowed');
  const sort = query.sort ?? spec.defaultSort;
  const orderBy = [{ [sort.field]: sort.direction }, { id: 'asc' }];
  const [data, total] = await prisma.$transaction([
    delegate.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      ...(options.select ? { select: options.select } : {}),
      ...(options.include ? { include: options.include } : {}),
    }),
    delegate.count({ where }),
  ]);
  return toPaginatedResult(data, total, query);
}

export function invalidQuery(message: string): BadRequestException {
  return new BadRequestException({ code: 'INVALID_QUERY', message });
}

export const booleanFilter =
  (field: string): FilterConverter =>
  (value) => {
    if (value !== 'true' && value !== 'false') throw invalidQuery(`${field} must be true or false`);
    return { [field]: value === 'true' };
  };

/** Accepts one value or a comma-separated list. */
export const enumFilter =
  (field: string, allowed: readonly string[]): FilterConverter =>
  (value) => {
    const values = value.split(',');
    if (!values.every((item) => allowed.includes(item))) throw invalidQuery(`Unknown ${field}`);
    return { [field]: { in: values } };
  };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idFilter =
  (field: string): FilterConverter =>
  (value) => {
    const values = value.split(',');
    if (!values.every((item) => UUID.test(item))) throw invalidQuery(`${field} must be an id`);
    return { [field]: { in: values } };
  };

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
