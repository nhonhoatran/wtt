import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminSubEventsController } from './admin-sub-events.controller.js';
import { SubEventsService } from './sub-events.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminSubEventsController],
  providers: [SubEventsService],
})
export class SubEventsModule {}
