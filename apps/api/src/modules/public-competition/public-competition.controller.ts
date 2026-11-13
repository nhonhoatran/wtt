import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PUBLIC_API_SEGMENT } from '@kamito/shared';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { Public } from '../access-control/access-decorators.js';
import { PublicBracketQuery } from './public-bracket.query.js';

/**
 * Missing or unpublished content answers 200 with `data: null`, never 404: Next.js only caches 200
 * responses, so a 404 would leave the last published page cached after the content is taken down.
 */
@Public()
@UseGuards(SsrInternalGuard)
@Controller(PUBLIC_API_SEGMENT)
export class PublicCompetitionController {
  constructor(private readonly brackets: PublicBracketQuery) {}

  @Get('events/:slug/draws/:subEventCode')
  async bracket(@Param('slug') slug: string, @Param('subEventCode') subEventCode: string, @Query('kind') kind?: unknown) {
    return { data: await this.brackets.bracket(slug, subEventCode, kind) };
  }
}
