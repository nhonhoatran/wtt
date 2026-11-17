import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { PUBLIC_API_SEGMENT } from '@kamito/shared';
import type { Request, Response } from 'express';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { sendPublicJson } from '../../common/http/public-json-response.js';
import { Public } from '../access-control/access-decorators.js';
import { PublicEventRankingPointsQuery } from './public-event-ranking-points.query.js';
import { PublicRankingsQuery, type PublicRankingParams } from './public-rankings.query.js';

@Public()
@UseGuards(SsrInternalGuard)
@Controller(PUBLIC_API_SEGMENT)
export class PublicRankingsController {
  constructor(private readonly rankings: PublicRankingsQuery, private readonly eventPoints: PublicEventRankingPointsQuery) {}

  @Get('rankings')
  async overview(@Req() request: Request, @Res() response: Response) {
    await sendPublicJson(request, response, await this.rankings.overview());
  }

  @Get('rankings/:listCode')
  async list(@Param('listCode') code: string, @Query() query: PublicRankingParams, @Req() request: Request, @Res() response: Response) {
    await sendPublicJson(request, response, await this.rankings.list(code, query));
  }

  @Get('events/:slug/ranking-points')
  async event(@Param('slug') slug: string) { return { data: await this.eventPoints.points(slug) }; }
}
