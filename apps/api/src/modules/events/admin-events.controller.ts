import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { createEventBody, slugAvailableQuery, updateEventBody } from './event-dtos.js';
import { EVENT_LIST_RULES, EventsQueryService } from './events-query.service.js';
import { EventsService } from './events.service.js';

@Controller('admin/events')
export class AdminEventsController {
  constructor(
    private readonly events: EventsService,
    private readonly query: EventsQueryService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.query.list(parsePaginationQuery(raw, EVENT_LIST_RULES, await this.pagination.limits()));
  }

  @Get('slug-available')
  @RequirePermission('tournaments', 'read')
  async slugAvailable(@Query() raw: Record<string, unknown>) {
    const { slug, excludeId } = parseBody(slugAvailableQuery, raw);
    return { data: await this.query.slugAvailable(slug, excludeId) };
  }

  @Get('defaults')
  @RequirePermission('tournaments', 'read')
  async defaults(@Req() req: Request) {
    return { data: await this.query.defaults(requireAuthContext(req).user.id) };
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.query.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return this.events.create(parseBody(createEventBody, body));
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.events.update(id, parseBody(updateEventBody, body));
  }

  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermission('tournaments', 'publish')
  async publish(@Param('id') id: string) {
    return this.events.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @RequirePermission('tournaments', 'publish')
  async unpublish(@Param('id') id: string) {
    return this.events.unpublish(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  async cancel(@Param('id') id: string) {
    return this.events.cancel(id);
  }

  @Post(':id/uncancel')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  async uncancel(@Param('id') id: string) {
    return this.events.uncancel(id);
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return this.events.remove(id);
  }
}
