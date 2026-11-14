import { Module } from '@nestjs/common';
import { AdminRankingJobsController } from './admin-ranking-jobs.controller.js';
import { RankingEnqueueService } from './ranking-enqueue.service.js';
import { RankingRecomputeRequestService } from './ranking-recompute-request.service.js';

@Module({
  controllers: [AdminRankingJobsController],
  providers: [RankingEnqueueService, RankingRecomputeRequestService],
  exports: [RankingEnqueueService],
})
export class RankingJobsModule {}
