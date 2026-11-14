import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminMatchResultsController } from './admin-match-results.controller.js';
import { MatchResultService } from './match-result.service.js';

@Module({
  imports: [MatchesModule, GroupsModule, RankingJobsModule],
  controllers: [AdminMatchResultsController],
  providers: [MatchResultService],
})
export class MatchResultsModule {}
