import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PUBLIC_API_SEGMENT } from '@kamito/shared';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { Public } from '../access-control/access-decorators.js';
import { PublicEventDetailQuery } from './public-event-detail.query.js';
import { PublicEventsListQuery, type PublicEventListQuery } from './public-events-list.query.js';
import { PublicSiteQuery } from './public-site.query.js';

/** Missing or unpublished content answers 200 `{data: null}` (see PublicCompetitionController). */
@Public()
@UseGuards(SsrInternalGuard)
@Controller(PUBLIC_API_SEGMENT)
export class PublicEventsController {
  constructor(
    private readonly lists: PublicEventsListQuery,
    private readonly events: PublicEventDetailQuery,
    private readonly site: PublicSiteQuery,
  ) {}

  @Get('site')
  async siteConfig() {
    return { data: await this.site.config() };
  }

  @Get('sitemap')
  async sitemap() {
    return { data: await this.site.sitemap() };
  }

  @Get('events')
  async list(@Query() query: PublicEventListQuery) {
    return { data: await this.lists.list(query) };
  }

  // Declared before `events/:slug` so the literal path wins.
  @Get('events/calendar')
  async calendar(@Query() query: { year?: unknown; tier?: unknown }) {
    return { data: await this.lists.calendar(query) };
  }

  @Get('events/:slug')
  async detail(@Param('slug') slug: string) {
    return { data: await this.events.detail(slug) };
  }

  @Get('events/:slug/info')
  async info(@Param('slug') slug: string) {
    return { data: await this.events.info(slug) };
  }
}
