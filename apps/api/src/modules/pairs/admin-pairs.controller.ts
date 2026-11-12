import { Controller, Get, Query } from '@nestjs/common';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { PAIR_LIST_SPEC, PairsService } from './pairs.service.js';

@Controller('admin/pairs')
export class AdminPairsController {
  constructor(
    private readonly pairs: PairsService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('players', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.pairs.list(parsePaginationQuery(raw, listRules(PAIR_LIST_SPEC), await this.pagination.limits()));
  }
}
