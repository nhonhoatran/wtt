import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { can } from '@kamito/shared';
import { getAuthContext } from '../auth/auth-context.js';
import { parseBody } from '../../common/validation/parse-body.js';
import { RequirePermission } from '../access-control/access-decorators.js';
import { generateDrawBody, previewDrawBody, replaceEntryBody, roundFormatBody, suggestSeedsBody, swapBody, unpublishBody, versionedBody, withdrawEntryBody } from './draw-dtos.js';
import { DrawEditService } from './draw-edit.service.js';
import { DrawGenerationService } from './draw-generation.service.js';
import { DrawPostPublishService } from './draw-post-publish.service.js';
import { DrawPublishService } from './draw-publish.service.js';
import { DrawReadService } from './draw-read.service.js';
import { DrawSeedSuggestionService } from './draw-seed-suggestion.service.js';
import { GroupQualifierService } from './group-qualifier.service.js';
import { RoundFormatService } from './round-format.service.js';

const canSeeSeed = (req: Request) => {
  const role = getAuthContext(req)?.user.role;
  return role !== undefined && can(role, 'tournaments', 'update');
};

@Controller('admin')
export class AdminDrawsController {
  constructor(
    private readonly generation: DrawGenerationService,
    private readonly read: DrawReadService,
    private readonly edit: DrawEditService,
    private readonly publication: DrawPublishService,
    private readonly rounds: RoundFormatService,
    private readonly postPublish: DrawPostPublishService,
    private readonly groupQualifiers: GroupQualifierService,
    private readonly seedSuggestion: DrawSeedSuggestionService,
  ) {}

  @Get('events/:eventId/draws')
  @RequirePermission('tournaments', 'list')
  eventSummary(@Param('eventId') eventId: string) {
    return this.read.eventSummary(eventId);
  }

  @Post('sub-events/:id/draws/preview')
  @HttpCode(200)
  @RequirePermission('tournaments', 'create')
  preview(@Param('id') id: string, @Body() body: unknown) {
    return this.generation.preview(id, parseBody(previewDrawBody, body));
  }

  @Post('sub-events/:id/draws')
  @RequirePermission('tournaments', 'create')
  generate(@Param('id') id: string, @Body() body: unknown) {
    return this.generation.generate(id, parseBody(generateDrawBody, body));
  }

  @Get('draws/:id/bracket')
  @RequirePermission('tournaments', 'read')
  bracket(@Param('id') id: string, @Req() req: Request) {
    return this.read.bracket(id, canSeeSeed(req));
  }

  @Get('draws/:id/groups')
  @RequirePermission('tournaments', 'read')
  groups(@Param('id') id: string, @Req() req: Request) {
    return this.read.groups(id, canSeeSeed(req));
  }

  @Post('draws/:id/swap')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  swap(@Param('id') id: string, @Body() body: unknown) {
    return this.edit.swap(id, parseBody(swapBody, body));
  }

  @Post('draws/:id/place-qualifiers')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  placeQualifiers(@Param('id') id: string, @Body() body: unknown) {
    return this.edit.placeQualifiers(id, parseBody(versionedBody, body).expectedVersion);
  }

  @Post('draws/:id/place-group-qualifiers')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  placeGroupQualifiers(@Param('id') id: string, @Body() body: unknown) {
    return this.groupQualifiers.place(id, parseBody(versionedBody, body).expectedVersion);
  }

  @Post('draws/:id/unpublish')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  unpublish(@Param('id') id: string, @Body() body: unknown) {
    return this.postPublish.unpublish(id, parseBody(unpublishBody, body));
  }

  @Post('draws/:id/replace-entry')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  replaceEntry(@Param('id') id: string, @Body() body: unknown) {
    return this.postPublish.replaceEntry(id, parseBody(replaceEntryBody, body));
  }

  @Post('draws/:id/withdraw-entry')
  @HttpCode(200)
  @RequirePermission('tournaments', 'update')
  withdrawEntry(@Param('id') id: string, @Body() body: unknown) {
    return this.postPublish.withdrawEntry(id, parseBody(withdrawEntryBody, body));
  }

  @Post('sub-events/:id/entries/suggest-seeds')
  @HttpCode(200)
  @RequirePermission('tournaments', 'create')
  suggestSeeds(@Param('id') id: string, @Body() body: unknown) {
    return this.seedSuggestion.suggest(id, parseBody(suggestSeedsBody, body ?? {}).apply === true);
  }

  @Post('draws/:id/publish')
  @HttpCode(200)
  @RequirePermission('tournaments', 'publish')
  publish(@Param('id') id: string, @Body() body: unknown) {
    return this.publication.publish(id, parseBody(versionedBody, body).expectedVersion);
  }

  @Delete('draws/:id')
  @RequirePermission('tournaments', 'delete')
  remove(@Param('id') id: string, @Query('expectedVersion') expectedVersion?: string) {
    const parsed = parseBody(versionedBody, { expectedVersion: expectedVersion === undefined ? undefined : Number(expectedVersion) });
    return this.publication.remove(id, parsed.expectedVersion);
  }

  @Patch('rounds/:id')
  @RequirePermission('tournaments', 'update')
  setRoundFormat(@Param('id') id: string, @Body() body: unknown) {
    return this.rounds.setFormat(id, parseBody(roundFormatBody, body));
  }
}
