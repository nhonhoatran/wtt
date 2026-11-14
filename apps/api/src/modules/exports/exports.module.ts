import { Module } from '@nestjs/common';
import { AdminExportsController } from './admin-exports.controller.js';
import { EntriesExportService } from './entries-export.service.js';
import { ResultsExportService } from './results-export.service.js';
import { ScheduleExportService } from './schedule-export.service.js';

@Module({
  controllers: [AdminExportsController],
  providers: [EntriesExportService, ScheduleExportService, ResultsExportService],
})
export class ExportsModule {}
