import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminRankingSnapshotsController } from './admin-ranking-snapshots.controller.js';
import { RankingSnapshotDraftsService } from './ranking-snapshot-drafts.service.js';
import { RankingSnapshotPublishService } from './ranking-snapshot-publish.service.js';
import { RankingSnapshotsQueryService } from './ranking-snapshots-query.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminRankingSnapshotsController],
  providers: [RankingSnapshotsQueryService, RankingSnapshotDraftsService, RankingSnapshotPublishService],
})
export class RankingSnapshotsModule {}
