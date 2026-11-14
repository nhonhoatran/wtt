import { Module } from '@nestjs/common';
import { RankingJobsModule } from '../ranking-jobs/ranking-jobs.module.js';
import { AdminPlayersController } from './admin-players.controller.js';
import { PlayerMergeService } from './player-merge.service.js';
import { PlayersService } from './players.service.js';

@Module({
  imports: [RankingJobsModule],
  controllers: [AdminPlayersController],
  providers: [PlayersService, PlayerMergeService],
})
export class PlayersModule {}
