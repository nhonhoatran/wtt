import { Module } from '@nestjs/common';
import { AuditModule } from './common/audit/audit.module.js';
import { AppConfigModule } from './common/config/app-config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { StorageModule } from './modules/storage/storage.module.js';

@Module({
  imports: [AppConfigModule, LoggerModule, PrismaModule, QueueModule, StorageModule, AuditModule, HealthModule],
})
export class AppModule {}
