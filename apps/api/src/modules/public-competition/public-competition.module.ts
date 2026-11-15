import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicBracketQuery } from './public-bracket.query.js';
import { PublicCompetitionController } from './public-competition.controller.js';
import { PublicEntriesQuery } from './public-entries.query.js';
import { PublicGroupsQuery } from './public-groups.query.js';
import { PublicMatchesQuery } from './public-matches.query.js';
import { PublicResultsStripQuery } from './public-results-strip.query.js';
import { PublicScheduleQuery } from './public-schedule.query.js';

@Module({
  controllers: [PublicCompetitionController],
  providers: [PublicBracketQuery, PublicMatchesQuery, PublicGroupsQuery, PublicEntriesQuery, PublicResultsStripQuery, PublicScheduleQuery, SsrInternalGuard],
})
export class PublicCompetitionModule {}
