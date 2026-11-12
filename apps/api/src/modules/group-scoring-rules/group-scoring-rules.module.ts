import { Module } from '@nestjs/common';
import { AdminGroupScoringRulesController } from './admin-group-scoring-rules.controller.js';
import { GroupScoringRulesService } from './group-scoring-rules.service.js';

@Module({
  controllers: [AdminGroupScoringRulesController],
  providers: [GroupScoringRulesService],
})
export class GroupScoringRulesModule {}
