import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createRankingListBody, updateRankingListBody } from './ranking-list-dtos.js';
import { RANKING_LIST_SPEC, RankingListsService } from './ranking-lists.service.js';

@Controller('admin/ranking-lists')
export class AdminRankingListsController {
  constructor(
    private readonly lists: RankingListsService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('rankings', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.lists.list(parsePaginationQuery(raw, listRules(RANKING_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('rankings', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.lists.get(id) };
  }

  @Post()
  @RequirePermission('rankings', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.lists.create(parseBody(createRankingListBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('rankings', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.lists.updateAndEnqueue(id, parseBody(updateRankingListBody, body));
  }

  @Delete(':id')
  @RequirePermission('rankings', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.lists.remove(id) };
  }
}
