import { Module } from '@nestjs/common';
import { MatchQueryService } from './match-query.service.js';

@Module({
  providers: [MatchQueryService],
  exports: [MatchQueryService],
})
export class MatchesModule {}
