import { Module } from '@nestjs/common';
import { SsrInternalGuard } from '../../common/guards/ssr-internal.guard.js';
import { PublicBracketQuery } from './public-bracket.query.js';
import { PublicCompetitionController } from './public-competition.controller.js';

@Module({
  controllers: [PublicCompetitionController],
  providers: [PublicBracketQuery, SsrInternalGuard],
})
export class PublicCompetitionModule {}
