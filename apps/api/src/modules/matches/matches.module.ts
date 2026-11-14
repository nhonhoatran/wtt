import { Module } from '@nestjs/common';
import { AdminMatchesController } from './admin-matches.controller.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { MatchQueryService } from './match-query.service.js';

@Module({
  imports: [SchedulingModule],
  controllers: [AdminMatchesController],
  providers: [MatchQueryService],
  exports: [MatchQueryService],
})
export class MatchesModule {}
