import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createTierBody, updateTierBody } from './tier-dtos.js';
import { TIER_LIST_SPEC, TiersService } from './tiers.service.js';

@Controller('admin/tiers')
export class AdminTiersController {
  constructor(
    private readonly tiers: TiersService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.tiers.list(parsePaginationQuery(raw, listRules(TIER_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.tiers.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return this.tiers.createRefreshed(parseBody(createTierBody, body));
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.tiers.updateRefreshed(id, parseBody(updateTierBody, body));
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return this.tiers.removeRefreshed(id);
  }
}
