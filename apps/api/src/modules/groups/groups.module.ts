import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminGroupsController } from './admin-groups.controller.js';
import { GroupAdminService } from './group-admin.service.js';
import { GroupStandingsService } from './group-standings.service.js';
import { GroupViewService } from './group-view.service.js';

@Module({
  imports: [MatchesModule],
  controllers: [AdminGroupsController],
  providers: [GroupStandingsService, GroupViewService, GroupAdminService],
  exports: [GroupStandingsService, GroupViewService],
})
export class GroupsModule {}
