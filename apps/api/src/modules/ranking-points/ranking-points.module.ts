import { Module } from '@nestjs/common';
import { AdminRankingPointsController } from './admin-ranking-points.controller.js';
import { RankingPointsManualService } from './ranking-points-manual.service.js';
import { RankingPointsQueryService } from './ranking-points-query.service.js';

@Module({
  controllers: [AdminRankingPointsController],
  providers: [RankingPointsQueryService, RankingPointsManualService],
})
export class RankingPointsModule {}
