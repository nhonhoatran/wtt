import { Module } from '@nestjs/common';
import { AuditModule } from './common/audit/audit.module.js';
import { AppConfigModule } from './common/config/app-config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { AppSettingsModule } from './modules/settings/app-settings.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    QueueModule,
    StorageModule,
    AuditModule,
    AppSettingsModule,
    AuthModule,
    HealthModule,
    UsersModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
