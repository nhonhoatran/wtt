import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { confirmMatchBody, versionedMatchBody } from './match-result-dtos.js';
import { MatchResultService } from './match-result.service.js';

@Controller('admin/matches')
export class AdminMatchResultsController {
  constructor(private readonly results: MatchResultService) {}

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermission('matches', 'update')
  start(@Param('id') id: string, @Body() body: unknown) {
    return this.results.start(id, parseBody(versionedMatchBody, body).expectedVersion);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission('matches', 'confirm')
  confirm(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.results.confirm(id, parseBody(confirmMatchBody, body), requireAuthContext(req).user.id);
  }
}
