import { Module } from '@nestjs/common';
import { AdminMatchSheetsController } from './admin-match-sheets.controller.js';
import { AdminSchedulingController } from './admin-scheduling.controller.js';
import { MatchSheetsService } from './match-sheets.service.js';
import { ScheduleConflictService } from './schedule-conflict.service.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  controllers: [AdminSchedulingController, AdminMatchSheetsController],
  providers: [SchedulingService, ScheduleConflictService, MatchSheetsService],
  exports: [ScheduleConflictService],
})
export class SchedulingModule {}
