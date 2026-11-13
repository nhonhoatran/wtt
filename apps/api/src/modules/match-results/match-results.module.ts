import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminMatchResultsController } from './admin-match-results.controller.js';
import { MatchResultService } from './match-result.service.js';

@Module({
  imports: [MatchesModule, GroupsModule],
  controllers: [AdminMatchResultsController],
  providers: [MatchResultService],
})
export class MatchResultsModule {}
