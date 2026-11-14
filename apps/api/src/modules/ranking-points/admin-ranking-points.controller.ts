import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { RequireStepUp } from '../auth/auth-decorators.js';
import { createManualPointsBody, deleteManualPointsBody } from './ranking-points-dtos.js';
import { RANKING_POINTS_SPEC, RankingPointsQueryService } from './ranking-points-query.service.js';
import { RankingPointsManualService } from './ranking-points-manual.service.js';

@Controller('admin/ranking-points')
export class AdminRankingPointsController {
  constructor(
    private readonly queries: RankingPointsQueryService,
    private readonly manual: RankingPointsManualService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('rankings', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.queries.list(parsePaginationQuery(raw, listRules(RANKING_POINTS_SPEC), await this.pagination.limits()));
  }

  @Post()
  @RequirePermission('rankings', 'create')
  @RequireStepUp()
  async create(@Body() body: unknown, @Req() req: Request) {
    return { data: await this.manual.create(parseBody(createManualPointsBody, body), requireAuthContext(req).user.id) };
  }

  @Delete(':id')
  @RequirePermission('rankings', 'delete')
  @RequireStepUp()
  async remove(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.manual.remove(id, parseBody(deleteManualPointsBody, body).reason) };
  }
}
