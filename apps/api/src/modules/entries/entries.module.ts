import { Module } from '@nestjs/common';
import { AdminEntriesController } from './admin-entries.controller.js';
import { EntryBulkActionsService } from './entry-bulk-actions.service.js';
import { EntryEligibilityService } from './entry-eligibility.service.js';
import { EntriesQueryService } from './entries-query.service.js';
import { EntriesService } from './entries.service.js';

@Module({
  controllers: [AdminEntriesController],
  providers: [EntriesService, EntryBulkActionsService, EntryEligibilityService, EntriesQueryService],
  exports: [EntriesService, EntryEligibilityService],
})
export class EntriesModule {}
