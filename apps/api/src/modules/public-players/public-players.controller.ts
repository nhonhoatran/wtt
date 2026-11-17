import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PUBLIC_API_SEGMENT } from '@kamito/shared';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { Public } from '../access-control/access-decorators.js';
import { PublicPlayerProfileQuery } from './public-player-profile.query.js';
import { PublicPlayerResultsQuery } from './public-player-results.query.js';
import { PublicPlayersQuery, type PublicPlayerParams } from './public-players.query.js';

/** Null content intentionally uses 200 so the Next cache replaces a previously public profile. */
@Public()
@UseGuards(SsrInternalGuard)
@Controller(`${PUBLIC_API_SEGMENT}/players`)
export class PublicPlayersController {
  constructor(private readonly players: PublicPlayersQuery, private readonly profiles: PublicPlayerProfileQuery, private readonly matches: PublicPlayerResultsQuery) {}

  @Get()
  async list(@Query() query: PublicPlayerParams) { return { data: await this.players.list(query) }; }

  @Get(':slug')
  async profile(@Param('slug') slug: string) { return { data: await this.profiles.profile(slug) }; }

  @Get(':slug/results')
  async results(@Param('slug') slug: string, @Query('page') page?: unknown) { return { data: await this.matches.results(slug, page) }; }
}
