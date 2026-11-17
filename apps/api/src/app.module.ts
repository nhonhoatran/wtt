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
import { EntriesModule } from './modules/entries/entries.module.js';
import { PairsModule } from './modules/pairs/pairs.module.js';
import { PlayersModule } from './modules/players/players.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { DrawsModule } from './modules/draws/draws.module.js';
import { GroupsModule } from './modules/groups/groups.module.js';
import { MatchesModule } from './modules/matches/matches.module.js';
import { MatchResultsModule } from './modules/match-results/match-results.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { RevalidationModule } from './modules/revalidation/revalidation.module.js';
import { RankingJobsModule } from './modules/ranking-jobs/ranking-jobs.module.js';
import { RankingListsModule } from './modules/ranking-lists/ranking-lists.module.js';
import { RankingPointsModule } from './modules/ranking-points/ranking-points.module.js';
import { RankingRulesModule } from './modules/ranking-rules/ranking-rules.module.js';
import { RankingSnapshotsModule } from './modules/ranking-snapshots/ranking-snapshots.module.js';
import { PublicCompetitionModule } from './modules/public-competition/public-competition.module.js';
import { PublicEventsModule } from './modules/public-events/public-events.module.js';
import { PublicRankingsModule } from './modules/public-rankings/public-rankings.module.js';
import { PublicPlayersModule } from './modules/public-players/public-players.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    QueueModule,
    RevalidationModule,
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
    PlayersModule,
    PairsModule,
    EntriesModule,
    ImportsModule,
    ExportsModule,
    MatchesModule,
    SessionsModule,
    SchedulingModule,
    DrawsModule,
    GroupsModule,
    MatchResultsModule,
    PublicCompetitionModule,
    PublicEventsModule,
    PublicRankingsModule,
    PublicPlayersModule,
    RankingJobsModule,
    RankingListsModule,
    RankingRulesModule,
    RankingPointsModule,
    RankingSnapshotsModule,
  ],
})
export class AppModule {}
