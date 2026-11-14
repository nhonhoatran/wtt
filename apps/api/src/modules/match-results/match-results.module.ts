import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminMatchResultsController } from './admin-match-results.controller.js';
import { MatchAmendService } from './match-amend.service.js';
import { MatchProgressService } from './match-progress.service.js';
import { MatchReopenService } from './match-reopen.service.js';
import { MatchResultService } from './match-result.service.js';
import { MatchWriteRunner } from './match-write-runner.js';

@Module({
  imports: [MatchesModule, GroupsModule, RankingJobsModule],
  controllers: [AdminMatchResultsController],
  providers: [MatchWriteRunner, MatchResultService, MatchProgressService, MatchAmendService, MatchReopenService],
})
export class MatchResultsModule {}
