import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicEventRankingPointsQuery } from './public-event-ranking-points.query.js';
import { PublicRankingsController } from './public-rankings.controller.js';
import { PublicRankingsQuery } from './public-rankings.query.js';

@Module({ controllers: [PublicRankingsController], providers: [PublicRankingsQuery, PublicEventRankingPointsQuery, SsrInternalGuard] })
export class PublicRankingsModule {}
