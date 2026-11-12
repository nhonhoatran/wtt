import { Module } from '@nestjs/common';
import { AdminMatchFormatsController } from './admin-match-formats.controller.js';
import { MatchFormatsService } from './match-formats.service.js';

@Module({
  controllers: [AdminMatchFormatsController],
  providers: [MatchFormatsService],
})
export class MatchFormatsModule {}
