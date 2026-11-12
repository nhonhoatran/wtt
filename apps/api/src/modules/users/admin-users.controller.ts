import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { createUserBody, updateUserBody } from './user-dtos.js';
import { USER_LIST_RULES, UsersQueryService } from './users-query.service.js';
import { UsersService } from './users.service.js';

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly query: UsersQueryService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('users', 'list')
  async list(@Query() raw: Record<string, unknown>) {
    return this.query.list(parsePaginationQuery(raw, USER_LIST_RULES, await this.pagination.limits()));
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  async get(@Param('id') id: string) {
    return { data: await this.query.get(id) };
  }

  @Post()
  @RequirePermission('users', 'create')
  async create(@Body() body: unknown) {
    return { data: await this.users.create(parseBody(createUserBody, body)) };
  }

  @Patch(':id')
  @RequirePermission('users', 'update')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const actorId = requireAuthContext(req).user.id;
    return { data: await this.users.update(actorId, id, parseBody(updateUserBody, body)) };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermission('users', 'update')
  async resetPassword(@Param('id') id: string, @Req() req: Request) {
    return { data: await this.users.resetPassword(requireAuthContext(req).user.id, id) };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  @RequirePermission('users', 'update')
  async revokeSessions(@Param('id') id: string) {
    return { data: await this.users.revokeSessions(id) };
  }
}
