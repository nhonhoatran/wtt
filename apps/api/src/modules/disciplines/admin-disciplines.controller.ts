import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { createDisciplineBody, updateDisciplineBody } from './discipline-dtos.js';
import { DISCIPLINE_LIST_SPEC, DisciplinesService } from './disciplines.service.js';

@Controller('admin/disciplines')
export class AdminDisciplinesController {
  constructor(
    private readonly items: DisciplinesService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('tournaments', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.items.list(parsePaginationQuery(raw, listRules(DISCIPLINE_LIST_SPEC), await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('tournaments', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.items.get(id) };
  }

  @Post()
  @RequirePermission('tournaments', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.items.create(parseBody(createDisciplineBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('tournaments', 'update')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.items.updateRefreshed(id, parseBody(updateDisciplineBody, body));
  }

  @Delete(':id')
  @RequirePermission('tournaments', 'delete')
  async remove(@Param('id') id: string) {
    return { data: await this.items.remove(id) };
  }
}
