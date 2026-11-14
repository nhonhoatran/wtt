import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminEventsController } from './admin-events.controller.js';
import { EventsQueryService } from './events-query.service.js';
import { EventsService } from './events.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminEventsController],
  providers: [EventsService, EventsQueryService],
})
export class EventsModule {}
