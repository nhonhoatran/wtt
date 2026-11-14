import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminEntriesController } from './admin-entries.controller.js';
import { EntryBulkActionsService } from './entry-bulk-actions.service.js';
import { EntryEligibilityService } from './entry-eligibility.service.js';
import { EntriesQueryService } from './entries-query.service.js';
import { EntriesService } from './entries.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminEntriesController],
  providers: [EntriesService, EntryBulkActionsService, EntryEligibilityService, EntriesQueryService],
  exports: [EntriesService, EntryEligibilityService],
})
export class EntriesModule {}
