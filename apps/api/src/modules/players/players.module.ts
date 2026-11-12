import { Module } from '@nestjs/common';
import { AdminPlayersController } from './admin-players.controller.js';
import { PlayerMergeService } from './player-merge.service.js';
import { PlayersService } from './players.service.js';

@Module({
  controllers: [AdminPlayersController],
  providers: [PlayersService, PlayerMergeService],
})
export class PlayersModule {}
