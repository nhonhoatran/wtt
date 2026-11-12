import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createEventTypeBody, updateEventTypeBody } from './event-type-dtos.js';
import { EVENT_TYPE_LIST_SPEC, EventTypesService } from './event-types.service.js';

@Controller('admin/event-types')
export class AdminEventTypesController {
  constructor(
    private readonly items: EventTypesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.items.list(parsePaginationQuery(raw, listRules(EVENT_TYPE_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.items.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.items.create(parseBody(createEventTypeBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.items.update(id, parseBody(updateEventTypeBody, body)) };
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.items.remove(id) };
  }
}
