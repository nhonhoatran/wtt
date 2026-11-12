import { Module } from '@nestjs/common';
import { HealthLiveController } from './health-live.controller.js';
import { HealthReadyController } from './health-ready.controller.js';
import { ReadinessChecksService } from './readiness-checks.service.js';

@Module({
  controllers: [HealthLiveController, HealthReadyController],
  providers: [ReadinessChecksService],
})
export class HealthModule {}
