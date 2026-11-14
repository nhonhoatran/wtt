import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { RequireStepUp } from '../auth/auth-decorators.js';
import { RankingSnapshotDraftsService } from './ranking-snapshot-drafts.service.js';
import { createDraftsBody } from './ranking-snapshot-dtos.js';
import { RankingSnapshotPublishService } from './ranking-snapshot-publish.service.js';
import { RANKING_ROWS_RULES, RANKING_SNAPSHOT_SPEC, RankingSnapshotsQueryService } from './ranking-snapshots-query.service.js';

@Controller('admin/ranking-snapshots')
export class AdminRankingSnapshotsController {
  constructor(
    private readonly queries: RankingSnapshotsQueryService,
    private readonly drafts: RankingSnapshotDraftsService,
    private readonly publisher: RankingSnapshotPublishService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('rankings', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.queries.list(parsePaginationQuery(raw, listRules(RANKING_SNAPSHOT_SPEC), await this.pagination.limits()));
  }

  @Post('drafts')
  @HttpCode(202)
  @RequirePermission('rankings', 'create')
  async createDrafts(@Body() body: unknown) {
    return this.drafts.create(parseBody(createDraftsBody, body));
  }

  @Get(':id')
  @RequirePermission('rankings', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.queries.get(id) };
  }

  @Get(':id/rows')
  @RequirePermission('rankings', 'read')
  async rows(@Param('id') id: string, @Query() raw: Record<string, unknown>) {
    return this.queries.rows(id, parsePaginationQuery(raw, RANKING_ROWS_RULES, await this.pagination.limits()));
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission('rankings', 'publish')
  @RequireStepUp()
  async publish(@Param('id') id: string, @Req() req: Request) {
    return this.publisher.publish(id, requireAuthContext(req).user.id);
  }

  @Delete(':id')
  @RequirePermission('rankings', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.publisher.remove(id) };
  }
}
