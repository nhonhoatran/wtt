import { Controller, Get, Param, Query } from '@nestjs/common';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { EVENT_MATCH_LIST_SPEC, MatchQueryService } from './match-query.service.js';

@Controller('admin')
export class AdminMatchesController {
  constructor(
    private readonly matches: MatchQueryService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get('events/:eventId/matches')
  @RequirePermission('matches', 'list')
  async list(@Param('eventId') eventId: string, @Query() raw: Record<string, unknown>) {
    const query = parsePaginationQuery(raw, listRules(EVENT_MATCH_LIST_SPEC), await this.pagination.limits());
    return this.matches.listForEvent(eventId, query, { includeConflicts: raw.include === 'conflicts' });
  }

  @Get('matches/:id')
  @RequirePermission('matches', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.matches.detail(id) };
  }
}
