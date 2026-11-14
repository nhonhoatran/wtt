import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminRankingListsController } from './admin-ranking-lists.controller.js';
import { RankingListsService } from './ranking-lists.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminRankingListsController],
  providers: [RankingListsService],
  exports: [RankingListsService],
})
export class RankingListsModule {}
