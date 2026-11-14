import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { GroupsModule } from '../groups/groups.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { AdminDrawsController } from './admin-draws.controller.js';
import { DrawEditService } from './draw-edit.service.js';
import { DrawGenerationService } from './draw-generation.service.js';
import { DrawParamsService } from './draw-params.service.js';
import { DrawPersistenceService } from './draw-persistence.service.js';
import { DrawPostPublishService } from './draw-post-publish.service.js';
import { DrawPublishService } from './draw-publish.service.js';
import { DrawReadService } from './draw-read.service.js';
import { DrawSeedSuggestionService } from './draw-seed-suggestion.service.js';
import { GroupQualifierService } from './group-qualifier.service.js';
import { GroupWithdrawalService } from './group-withdrawal.service.js';
import { RoundFormatService } from './round-format.service.js';

@Module({
  imports: [MatchesModule, GroupsModule, RankingJobsModule],
  controllers: [AdminDrawsController],
  providers: [
    DrawParamsService,
    DrawPersistenceService,
    DrawGenerationService,
    DrawReadService,
    DrawEditService,
    DrawPublishService,
    RoundFormatService,
    DrawPostPublishService,
    GroupWithdrawalService,
    GroupQualifierService,
    DrawSeedSuggestionService,
  ],
  exports: [DrawParamsService, DrawPersistenceService],
})
export class DrawsModule {}
