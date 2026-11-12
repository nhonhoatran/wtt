import { Module } from '@nestjs/common';
import { AdminImportsController } from './admin-imports.controller.js';
import { ImportQueue } from './import-queue.js';
import { ImportRowsService } from './import-rows.service.js';
import { ImportTemplateService } from './import-template.service.js';
import { ImportsService } from './imports.service.js';

@Module({
  controllers: [AdminImportsController],
  providers: [ImportsService, ImportRowsService, ImportTemplateService, ImportQueue],
})
export class ImportsModule {}
