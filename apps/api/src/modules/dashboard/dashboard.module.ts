import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { DashboardPendingMatchesService } from './dashboard-pending-matches.service.js';
import { DashboardSummaryService } from './dashboard-summary.service.js';

@Module({
  controllers: [AdminDashboardController],
  providers: [DashboardSummaryService, DashboardPendingMatchesService],
})
export class DashboardModule {}
