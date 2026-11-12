import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import type { PaginationQueryShape } from '@kamito/shared';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery, toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RULES = { sortable: ['createdAt'], filterable: ['actorId', 'entity', 'action', 'from', 'to'] } as const;

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException({ code: 'INVALID_QUERY', message: `Invalid ${field}` });
  return date;
}

function buildWhere({ filter }: PaginationQueryShape): Prisma.AuditLogWhereInput {
  const from = parseDate(filter.from, 'from');
  const to = parseDate(filter.to, 'to');
  return {
    ...(filter.actorId && { actorId: filter.actorId }),
    ...(filter.entity && { entity: filter.entity }),
    ...(filter.action && { action: { startsWith: filter.action } }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  };
}

/** Read-only: audit rows are written by AuditService, never edited through the API. */
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('audit-logs', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    const query = parsePaginationQuery(raw, RULES, await this.pagination.limits());
    const where = buildWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: query.sort?.direction ?? 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(rows.map((row) => row.actorId))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
    const names = new Map(actors.map((actor) => [actor.id, actor.name]));
    const data = rows.map((row) => ({ ...row, actorName: names.get(row.actorId) ?? null }));
    return toPaginatedResult(data, total, query);
  }
}
