import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createGroupScoringRuleBody, updateGroupScoringRuleBody } from './group-scoring-rule-dtos.js';
import { GROUP_SCORING_RULE_LIST_SPEC, GroupScoringRulesService } from './group-scoring-rules.service.js';

@Controller('admin/group-scoring-rules')
export class AdminGroupScoringRulesController {
  constructor(
    private readonly items: GroupScoringRulesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.items.list(parsePaginationQuery(raw, listRules(GROUP_SCORING_RULE_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.items.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.items.create(parseBody(createGroupScoringRuleBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.items.update(id, parseBody(updateGroupScoringRuleBody, body)) };
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.items.remove(id) };
  }
}
