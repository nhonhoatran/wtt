import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createVenueBody, updateVenueBody } from './venue-dtos.js';
import { VENUE_LIST_SPEC, VenuesService } from './venues.service.js';

@Controller('admin/venues')
export class AdminVenuesController {
  constructor(
    private readonly venues: VenuesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.venues.list(parsePaginationQuery(raw, listRules(VENUE_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.venues.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.venues.create(parseBody(createVenueBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.venues.update(id, parseBody(updateVenueBody, body)) };
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.venues.remove(id) };
  }
}
