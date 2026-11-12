import { Global, Module } from '@nestjs/common';
import { PaginationLimitsService } from '../../common/pagination/pagination-limits.js';
import { AdminSettingsController } from './admin-settings.controller.js';
import { AppSettingsService } from './app-settings.service.js';

@Global()
@Module({
  controllers: [AdminSettingsController],
  providers: [AppSettingsService, PaginationLimitsService],
  exports: [AppSettingsService, PaginationLimitsService],
})
export class AppSettingsModule {}
