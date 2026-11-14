import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { listRules } from '../../common/crud/prisma-list-query.js';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { parsePaginationQuery } from '../../common/pagination/pagination-query.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { RequireStepUp } from '../auth/auth-decorators.js';
import { createPlayerBody, lookupQuery, mergeBody, mergePreviewQuery, updatePlayerBody } from './player-dtos.js';
import { PlayerMergeService } from './player-merge.service.js';
import { PLAYER_LIST_SPEC, PlayersService } from './players.service.js';

@Controller('admin/players')
export class AdminPlayersController {
  constructor(
    private readonly players: PlayersService,
    private readonly merges: PlayerMergeService,
    private readonly pagination: PaginationLimitsService,
  ) {}

  @Get()
  @RequirePermission('players', 'list')
  async list(@Query() raw: Record<string, unknown>, @Req() req: Request) {
    const query = parsePaginationQuery(raw, listRules(PLAYER_LIST_SPEC), await this.pagination.limits());
    return this.players.list(query, requireAuthContext(req).user.role);
  }

  @Get('lookup')
  @RequirePermission('players', 'list')
  lookup(@Query() raw: Record<string, unknown>) {
    return this.players.lookup(parseBody(lookupQuery, raw));
  }

  @Get('merge/preview')
  @RequirePermission('players', 'manage')
  async mergePreview(@Query() raw: Record<string, unknown>) {
    const { targetId, sourceId } = parseBody(mergePreviewQuery, raw);
    return { data: await this.merges.preview(targetId, sourceId) };
  }

  @Post('merge')
  @HttpCode(200)
  @RequirePermission('players', 'manage')
  @RequireStepUp()
  async merge(@Body() body: unknown) {
    return this.merges.merge(parseBody(mergeBody, body));
  }

  @Get(':id')
  @RequirePermission('players', 'read')
  async get(@Param('id') id: string, @Req() req: Request) {
    return { data: await this.players.get(id, requireAuthContext(req).user.role) };
  }

  @Post()
  @RequirePermission('players', 'create')
  async create(@Body() body: unknown, @Req() req: Request) {
    return this.players.create(parseBody(createPlayerBody, body), requireAuthContext(req).user.role);
  }

  @Patch(':id')
  @RequirePermission('players', 'update')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.players.update(id, parseBody(updatePlayerBody, body), requireAuthContext(req).user.role);
  }
}
