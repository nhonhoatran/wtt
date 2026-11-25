import { Controller, Get, Query } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { DashboardPendingMatchesService } from './dashboard-pending-matches.service.js';
import { DashboardSummaryService } from './dashboard-summary.service.js';

const PENDING_RULES = { sortable: [], filterable: [] } as const;

/** Read-only home-page aggregates; every number is computed in the database. */
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(
    private readonly summary: DashboardSummaryService,
    private readonly pending: DashboardPendingMatchesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get('summary')
  @RequirePermission('tournaments', 'list')
  async getSummary() {
    return { data: await this.summary.get() };
  }

  @Get('pending-matches')
  @RequirePermission('matches', 'list')
  async listPendingMatches(@Query() raw: Record<string, unknown>) {
    return this.pending.list(parsePaginationQuery(raw, PENDING_RULES, await this.pagination.limits()));
  }
}
