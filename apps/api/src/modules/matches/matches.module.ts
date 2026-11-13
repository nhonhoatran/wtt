import { Module } from '@nestjs/common';
import { AdminMatchesController } from './admin-matches.controller.js';
import { MatchQueryService } from './match-query.service.js';

@Module({
  controllers: [AdminMatchesController],
  providers: [MatchQueryService],
  exports: [MatchQueryService],
})
export class MatchesModule {}
