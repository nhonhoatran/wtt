import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { EntryBulkActionsService } from './entry-bulk-actions.service.js';
import { bulkEntriesBody, createEntryBody, updateEntryBody } from './entry-dtos.js';
import { ENTRY_LIST_SPEC, EntriesQueryService } from './entries-query.service.js';
import { EntriesService } from './entries.service.js';

@Controller('admin')
export class AdminEntriesController {
  constructor(
    private readonly entries: EntriesService,
    private readonly bulk: EntryBulkActionsService,
    private readonly query: EntriesQueryService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get('events/:eventId/entry-counts')
  @RequirePermission('tournaments', 'list')
  async counts(@Param('eventId') eventId: string) {
    return { data: await this.query.countsByEvent(eventId) };
  }

  @Get('sub-events/:id/entries')
  @RequirePermission('tournaments', 'list')
  async list(@Param('id') id: string, @Query() raw: Record<string, unknown>) {
    return this.query.list(id, parsePaginationQuery(raw, listRules(ENTRY_LIST_SPEC), await this.pagination.limits()));
  }

  @Post('sub-events/:id/entries')
  @RequirePermission('tournaments', 'create')
  create(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.entries.create(id, parseBody(createEntryBody, body), requireAuthContext(req).user.role);
  }

  @Post('entries/bulk')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  applyBulk(@Body() body: unknown) {
    return this.bulk.apply(parseBody(bulkEntriesBody, body));
  }

  @Patch('entries/:id')
  @RequirePermission('tournaments', 'update')
  update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.entries.update(id, parseBody(updateEntryBody, body), requireAuthContext(req).user.role);
  }
}
