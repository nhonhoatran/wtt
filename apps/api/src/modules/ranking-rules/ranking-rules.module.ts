import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminRankingRulesController } from './admin-ranking-rules.controller.js';
import { RankingRulesQueryService } from './ranking-rules-query.service.js';
import { RankingRulesSaveService } from './ranking-rules-save.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminRankingRulesController],
  providers: [RankingRulesQueryService, RankingRulesSaveService],
})
export class RankingRulesModule {}
