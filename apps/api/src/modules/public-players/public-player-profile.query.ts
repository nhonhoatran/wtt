import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { ageOnEvent, playerSettings, publicPlayerIdFromSlug, publicPlayerSlug, resolveAppSetting, todayInTimezone, tournamentSettings, type PublicPlayerEvent, type PublicPlayerProfile, type PublicPlayerRedirect } from '@kamito/shared';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { mediaPublicBaseUrl } from '../media/media-dtos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { publicPlayerOutcomeWhere } from './public-player-results-where.js';
import { publicPlayerRanks } from './public-player-ranks.query.js';
import { toPublicPlayer, type PublicPlayerRow } from './public-player.serializer.js';

interface ProfileRow extends PublicPlayerRow {
  noindex: boolean;
  countryCode: string;
  handedness: 'LEFT' | 'RIGHT' | null;
  birthDate: Date | null;
  birthYear: number | null;
  bio: string | null;
  bioEn: string | null;
  showAgeValue: Prisma.JsonValue | null;
  timezoneValue: Prisma.JsonValue | null;
}

@Injectable()
export class PublicPlayerProfileQuery {
  constructor(private readonly prisma: PrismaService, @Inject(API_ENV) private readonly env: ApiEnv) {}

  /** Resolved safe profile + settings, then current ranks, public events entered and the win-loss record. */
  async profile(slug: string): Promise<PublicPlayerProfile | PublicPlayerRedirect | null> {
    const id = publicPlayerIdFromSlug(slug);
    const identity = id ? Prisma.sql`p.id = ${id}` : Prisma.sql`p.slug = ${slug}`;
    const [player] = await this.prisma.$queryRaw<ProfileRow[]>(Prisma.sql`
      WITH RECURSIVE chain AS (
        SELECT p.id, p."mergedIntoId", ARRAY[p.id] AS path FROM "Player" p WHERE ${identity}
        UNION ALL
        SELECT p.id, p."mergedIntoId", c.path || p.id
        FROM chain c JOIN "Player" p ON p.id = c."mergedIntoId"
        WHERE NOT p.id = ANY(c.path)
      )
      SELECT p.id, p."fullName", p."fullNameEn", p."publicDisplayName", p.club, p.gender,
        p."isActive", p."isPublicProfile", p."mergedIntoId", p.noindex, p."countryCode", p.handedness,
        p."birthDate", p."birthYear", p.bio, p."bioEn",
        CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
          'status', m.status, 'variants', m.variants, 'altText', m."altText", 'altTextEn', m."altTextEn"
        ) END AS "photoMedia",
        (SELECT value FROM "AppSetting" WHERE key = ${playerSettings.showAge.key}) AS "showAgeValue",
        (SELECT value FROM "AppSetting" WHERE key = ${tournamentSettings.defaultTimezone.key}) AS "timezoneValue"
      FROM chain c JOIN "Player" p ON p.id = c.id
      LEFT JOIN "MediaAsset" m ON m.id = p."photoMediaId"
      WHERE p."mergedIntoId" IS NULL AND p."isActive" = true AND p."isPublicProfile" = true
    `);
    if (!player) return null;
    const publicSlug = publicPlayerSlug(player.id);
    if (publicSlug !== slug) return { redirectTo: publicSlug };
    const [ranks, events, wins, losses] = await Promise.all([
      publicPlayerRanks(this.prisma, [player.id]),
      this.events(player.id),
      this.prisma.match.count({ where: publicPlayerOutcomeWhere(player.id, 'win') }),
      this.prisma.match.count({ where: publicPlayerOutcomeWhere(player.id, 'loss') }),
    ]);
    const showAge = resolveAppSetting(playerSettings.showAge, player.showAgeValue);
    const timezone = resolveAppSetting(tournamentSettings.defaultTimezone, player.timezoneValue);
    const age = showAge ? ageOnEvent(player, todayInTimezone(timezone), 'EVENT_START_DATE') : null;
    return {
      ...toPublicPlayer(player, mediaPublicBaseUrl(this.env)),
      slug: publicSlug,
      gender: player.gender,
      ranks: ranks.get(player.id) ?? [],
      noindex: player.noindex,
      countryCode: player.countryCode,
      handedness: player.handedness,
      age: age !== null && age >= 0 ? age : null,
      bio: player.bio,
      bioEn: player.bioEn,
      events,
      record: { wins, losses },
    };
  }

  private async events(playerId: string): Promise<PublicPlayerEvent[]> {
    return this.prisma.$queryRaw<PublicPlayerEvent[]>(Prisma.sql`
      SELECT ev.slug, ev.name, ev."nameEn", ev."startDate"::text AS "startDate", ev."endDate"::text AS "endDate"
      FROM "Event" ev
      WHERE ev."publishStatus" = ${publicScope.events.publishStatus}::"PublishStatus" AND ev."isCancelled" = false
        AND EXISTS (
          SELECT 1 FROM "SubEvent" se JOIN "Entry" e ON e."subEventId" = se.id
          JOIN "Competitor" c ON c.id = e."competitorId"
          LEFT JOIN "Pair" pair ON pair.id = c."pairId"
          WHERE se."eventId" = ev.id AND e.status = ${publicScope.entry.status}::"EntryStatus"
            AND ${playerId} IN (c."playerId", pair."playerAId", pair."playerBId")
        )
      ORDER BY ev."endDate" DESC, ev.slug ASC
    `);
  }
}
