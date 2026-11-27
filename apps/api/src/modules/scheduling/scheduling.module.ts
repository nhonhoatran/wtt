import { Module } from '@nestjs/common';
import { AdminAutoSchedulingController } from './admin-auto-scheduling.controller.js';
import { AutoScheduleService } from './auto-schedule.service.js';
import { AdminMatchSheetsController } from './admin-match-sheets.controller.js';
import { AdminSchedulingController } from './admin-scheduling.controller.js';
import { MatchSheetsService } from './match-sheets.service.js';
import { ScheduleConflictService } from './schedule-conflict.service.js';
import { SchedulingService } from './scheduling.service.js';

@Module({
  controllers: [AdminSchedulingController, AdminMatchSheetsController, AdminAutoSchedulingController],
  providers: [SchedulingService, ScheduleConflictService, MatchSheetsService, AutoScheduleService],
  exports: [ScheduleConflictService],
})
export class SchedulingModule {}
