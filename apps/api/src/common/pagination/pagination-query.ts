import { BadRequestException } from '@nestjs/common';
import type { PaginatedResult, PaginationQueryShape } from '@kamito/shared';
import { z } from 'zod';

export interface PaginationLimits {
  defaultPageSize: number;
  maxPageSize: number;
  maxQueryLength: number;
}

export interface PaginationRules {
  /** Whitelisted sort fields for the resource. */
  sortable: readonly string[];
  /** Whitelisted filter keys for the resource. */
  filterable?: readonly string[];
}

const FILTER_KEY = /^filter\[([A-Za-z0-9_.]+)\]$/;

export function parsePaginationQuery(
  raw: Record<string, unknown>,
  rules: PaginationRules,
  limits: PaginationLimits,
): PaginationQueryShape {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(limits.maxPageSize).default(limits.defaultPageSize),
    sort: z
      .string()
      .regex(/^[A-Za-z0-9_.]+:(asc|desc)$/)
      .refine((value) => rules.sortable.includes(value.split(':')[0] ?? ''), 'sort field not allowed')
      .optional(),
    q: z.string().trim().max(limits.maxQueryLength).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
    throw new BadRequestException({ code: 'INVALID_QUERY', message: 'Invalid pagination query', fields });
  }

  const filter: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const match = FILTER_KEY.exec(key);
    if (!match?.[1] || typeof value !== 'string') continue;
    if (!rules.filterable?.includes(match[1])) {
      throw new BadRequestException({ code: 'INVALID_QUERY', message: `Filter not allowed: ${match[1]}` });
    }
    filter[match[1]] = value.slice(0, limits.maxQueryLength);
  }

  const { page, pageSize, q } = parsed.data;
  const [field, direction] = parsed.data.sort?.split(':') ?? [];
  const sort = field && direction ? { field, direction: direction as 'asc' | 'desc' } : undefined;
  return { page, pageSize, sort, q: q || undefined, filter };
}

export function toPaginatedResult<T>(data: T[], total: number, query: PaginationQueryShape): PaginatedResult<T> {
  return { data, total, page: query.page, pageSize: query.pageSize };
}
