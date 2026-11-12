import { Module } from '@nestjs/common';
import { AuditModule } from './common/audit/audit.module.js';
import { AppConfigModule } from './common/config/app-config.module.js';
import { LoggerModule } from './common/logger/logger.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { AppSettingsModule } from './modules/settings/app-settings.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SubEventsModule } from './modules/sub-events/sub-events.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { DisciplinesModule } from './modules/disciplines/disciplines.module.js';
import { EventTypesModule } from './modules/event-types/event-types.module.js';
import { GroupScoringRulesModule } from './modules/group-scoring-rules/group-scoring-rules.module.js';
import { MatchFormatsModule } from './modules/match-formats/match-formats.module.js';
import { TiersModule } from './modules/tiers/tiers.module.js';
import { VenuesModule } from './modules/venues/venues.module.js';

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
    MediaModule,
    EventsModule,
    SubEventsModule,
    TiersModule,
    EventTypesModule,
    CategoriesModule,
    DisciplinesModule,
    MatchFormatsModule,
    GroupScoringRulesModule,
    VenuesModule,
  ],
})
export class AppModule {}
