import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { RequireStepUp } from '../auth/auth-decorators.js';
import { requireAuthContext } from '../auth/auth-context.js';
import { MatchAmendService } from './match-amend.service.js';
import { MatchProgressService } from './match-progress.service.js';
import { MatchReopenService } from './match-reopen.service.js';
import { MatchResultService } from './match-result.service.js';
import { amendScoresBody, confirmMatchBody, reopenMatchBody, saveProgressBody, versionedMatchBody } from './match-result-dtos.js';

@Controller('admin/matches')
export class AdminMatchResultsController {
  constructor(
    private readonly results: MatchResultService,
    private readonly progress: MatchProgressService,
    private readonly amendments: MatchAmendService,
    private readonly reopens: MatchReopenService,
  ) {}

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermission('matches', 'update')
  start(@Param('id') id: string, @Body() body: unknown) {
    return this.results.start(id, parseBody(versionedMatchBody, body).expectedVersion);
  }

  @Post(':id/un-start')
  @HttpCode(200)
  @RequirePermission('matches', 'update')
  unStart(@Param('id') id: string, @Body() body: unknown) {
    return this.progress.unStart(id, parseBody(versionedMatchBody, body).expectedVersion);
  }

  @Post(':id/save-progress')
  @HttpCode(200)
  @RequirePermission('matches', 'update')
  saveProgress(@Param('id') id: string, @Body() body: unknown) {
    return this.progress.saveProgress(id, parseBody(saveProgressBody, body));
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermission('matches', 'confirm')
  confirm(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.results.confirm(id, parseBody(confirmMatchBody, body), requireAuthContext(req).user.id);
  }

  @Post(':id/amend-scores')
  @HttpCode(200)
  @RequirePermission('matches', 'amend')
  amendScores(@Param('id') id: string, @Body() body: unknown) {
    return this.amendments.amend(id, parseBody(amendScoresBody, body));
  }

  @Get(':id/reopen-preview')
  @RequirePermission('matches', 'reopen')
  reopenPreview(@Param('id') id: string) {
    return this.reopens.preview(id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermission('matches', 'reopen')
  @RequireStepUp()
  reopen(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.reopens.reopen(id, parseBody(reopenMatchBody, body), requireAuthContext(req).user);
  }
}
