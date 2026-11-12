import { Module } from '@nestjs/common';
import { AdminExportsController } from './admin-exports.controller.js';
import { EntriesExportService } from './entries-export.service.js';

@Module({
  controllers: [AdminExportsController],
  providers: [EntriesExportService],
})
export class ExportsModule {}
