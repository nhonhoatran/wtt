import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { bulkVenueTablesBody, createVenueTableBody, updateVenueTableBody } from './venue-dtos.js';
import { VENUE_TABLE_LIST_SPEC, VenueTablesService } from './venue-tables.service.js';

@Controller('admin/venues/:id/tables')
export class AdminVenueTablesController {
  constructor(
    private readonly tables: VenueTablesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Param('id') id: string, @Query() raw: Record<string, unknown>) {
    return this.tables.list(id, parsePaginationQuery(raw, listRules(VENUE_TABLE_LIST_SPEC), await this.pagination.limits()));
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.tables.create(id, parseBody(createVenueTableBody, body)) };
  }

  @Post('bulk')
  @RequirePermission('tournaments', 'create')
  async bulk(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.tables.bulkCreate(id, parseBody(bulkVenueTablesBody, body)) };
  }

  @Patch(':tableId')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Param('tableId') tableId: string, @Body() body: unknown) {
    return { data: await this.tables.update(id, tableId, parseBody(updateVenueTableBody, body)) };
  }

  @Delete(':tableId')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string, @Param('tableId') tableId: string) {
    return { data: await this.tables.remove(id, tableId) };
  }
}
