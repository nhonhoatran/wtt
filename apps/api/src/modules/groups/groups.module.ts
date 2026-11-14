import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminGroupsController } from './admin-groups.controller.js';
import { GroupAdminService } from './group-admin.service.js';
import { GroupStandingsService } from './group-standings.service.js';
import { GroupViewService } from './group-view.service.js';

@Module({
  imports: [MatchesModule, RankingJobsModule],
  controllers: [AdminGroupsController],
  providers: [GroupStandingsService, GroupViewService, GroupAdminService],
  exports: [GroupStandingsService, GroupViewService],
})
export class GroupsModule {}
