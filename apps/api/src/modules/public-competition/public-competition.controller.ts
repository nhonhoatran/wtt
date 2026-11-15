import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PUBLIC_API_SEGMENT } from '@kamito/shared';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { Public } from '../access-control/access-decorators.js';
import { PublicBracketQuery } from './public-bracket.query.js';
import { PublicEntriesQuery } from './public-entries.query.js';
import { PublicGroupsQuery } from './public-groups.query.js';
import { PublicMatchesQuery, type PublicMatchListQuery } from './public-matches.query.js';
import { PublicResultsStripQuery } from './public-results-strip.query.js';
import { PublicScheduleQuery, type PublicScheduleQueryParams } from './public-schedule.query.js';

/**
 * Missing or unpublished content answers 200 with `data: null`, never 404: Next.js only caches 200
 * responses, so a 404 would leave the last published page cached after the content is taken down.
 */
@Public()
@UseGuards(SsrInternalGuard)
@Controller(PUBLIC_API_SEGMENT)
export class PublicCompetitionController {
  constructor(
    private readonly brackets: PublicBracketQuery,
    private readonly matches: PublicMatchesQuery,
    private readonly groupsQuery: PublicGroupsQuery,
    private readonly entries: PublicEntriesQuery,
    private readonly resultsStrip: PublicResultsStripQuery,
    private readonly schedules: PublicScheduleQuery,
  ) {}

  @Get('events/:slug/draws/:subEventCode')
  async bracket(@Param('slug') slug: string, @Param('subEventCode') subEventCode: string, @Query('kind') kind?: unknown) {
    return { data: await this.brackets.bracket(slug, subEventCode, kind) };
  }

  @Get('events/:slug/matches')
  async matchList(@Param('slug') slug: string, @Query() query: PublicMatchListQuery) {
    return { data: await this.matches.list(slug, query) };
  }

  @Get('events/:slug/matches/:matchNo')
  async match(@Param('slug') slug: string, @Param('matchNo') matchNo: string) {
    return { data: await this.matches.detail(slug, matchNo) };
  }

  @Get('events/:slug/groups/:subEventCode')
  async groups(@Param('slug') slug: string, @Param('subEventCode') subEventCode: string) {
    return { data: await this.groupsQuery.groups(slug, subEventCode) };
  }

  @Get('events/:slug/entries/:subEventCode')
  async entryList(@Param('slug') slug: string, @Param('subEventCode') subEventCode: string, @Query() query: { stage?: unknown; page?: unknown }) {
    return { data: await this.entries.list(slug, subEventCode, query) };
  }

  @Get('results/strip')
  async strip() {
    return { data: await this.resultsStrip.strip() };
  }

  @Get('events/:slug/schedule')
  async schedule(@Param('slug') slug: string, @Query() query: PublicScheduleQueryParams) {
    return { data: await this.schedules.schedule(slug, query) };
  }
}
