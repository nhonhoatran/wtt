import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicPlayerProfileQuery } from './public-player-profile.query.js';
import { PublicPlayerResultsQuery } from './public-player-results.query.js';
import { PublicPlayersController } from './public-players.controller.js';
import { PublicPlayersQuery } from './public-players.query.js';

@Module({ controllers: [PublicPlayersController], providers: [PublicPlayersQuery, PublicPlayerProfileQuery, PublicPlayerResultsQuery, SsrInternalGuard] })
export class PublicPlayersModule {}
