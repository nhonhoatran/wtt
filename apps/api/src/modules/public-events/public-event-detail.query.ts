import { Inject, Injectable } from '@nestjs/common';
import type { PublicDrawKind, PublicEventDetail, PublicEventInfo } from '@kamito/shared';
import { sanitizeRichHtmlOrNull } from '../../common/html/sanitize-rich-html.js';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { mediaPublicBaseUrl } from '../media/media-dtos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_SIDE_SELECT } from '../public-competition/public-bracket.query.js';
import { subEventNames, toSide } from '../public-competition/public-bracket.serializer.js';
import { publicScope } from '../public-scope/public-scope.js';
import { PUBLIC_EVENT_CARD_SELECT, toPublicEventCard } from './public-event.serializer.js';

const NAMED = { select: { name: true, nameEn: true } } as const;
const KNOCKOUT_ORDER: PublicDrawKind[] = ['MAIN', 'QUALIFYING'];

@Injectable()
export class PublicEventDetailQuery {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  /** Event header data shared by every tab: sub-events, which tabs have content, stats and champions. */
  async detail(slug: string): Promise<PublicEventDetail | null> {
    const event = await this.prisma.event.findFirst({
      where: publicScope.event(slug),
      select: {
        id: true,
        ...PUBLIC_EVENT_CARD_SELECT,
        summary: true,
        summaryEn: true,
        presentedBy: true,
        ticketUrl: true,
        showTicket: true,
        showInfoTab: true,
        infoBody: true,
        infoBodyEn: true,
        subEvents: {
          orderBy: [{ order: 'asc' }, { code: 'asc' }],
          select: {
            code: true,
            name: true,
            nameEn: true,
            format: true,
            discipline: NAMED,
            category: NAMED,
            draws: { where: publicScope.draw, select: { kind: true } },
            _count: { select: { entries: { where: publicScope.entry } } },
          },
        },
      },
    });
    if (!event) return null;

    const playedWhere = { ...publicScope.match(slug), status: 'OFFICIAL' as const, isVoided: false };
    const [realMatches, playedMatches, finals, players] = await Promise.all([
      this.prisma.match.count({ where: publicScope.match(slug) }),
      this.prisma.match.count({ where: playedWhere }),
      this.prisma.match.findMany({
        where: { ...playedWhere, draw: { ...publicScope.draw, kind: 'MAIN' }, round: { code: 'F' }, winnerSide: { in: [1, 2] } },
        select: { winnerSide: true, subEvent: { select: { code: true } }, side1Entry: PUBLIC_SIDE_SELECT, side2Entry: PUBLIC_SIDE_SELECT },
      }),
      this.countPlayers(event.id),
    ]);

    const subEvents = event.subEvents.map((s) => ({
      code: s.code,
      ...subEventNames(s),
      format: s.format,
      drawKinds: KNOCKOUT_ORDER.filter((kind) => s.draws.some((d) => d.kind === kind)),
      hasGroups: s.draws.some((d) => d.kind === 'GROUP'),
      entryCount: s._count.entries,
    }));
    const order = new Map(subEvents.map((s, index) => [s.code, index]));
    const champions = finals
      .map((f) => ({ subEventCode: f.subEvent.code, side: toSide(f.winnerSide === 1 ? f.side1Entry : f.side2Entry) }))
      .filter((c): c is PublicEventDetail['champions'][number] => c.side !== null)
      .sort((a, b) => (order.get(a.subEventCode) ?? 0) - (order.get(b.subEventCode) ?? 0));

    return {
      ...toPublicEventCard(event, mediaPublicBaseUrl(this.env), null),
      summary: event.summary,
      summaryEn: event.summaryEn,
      presentedBy: event.presentedBy,
      ticketUrl: event.showTicket ? event.ticketUrl : null,
      subEvents,
      tabs: {
        matches: realMatches > 0,
        draws: subEvents.some((s) => s.drawKinds.length > 0),
        groups: subEvents.some((s) => s.hasGroups),
        players: subEvents.some((s) => s.entryCount > 0),
        info: event.showInfoTab && Boolean(sanitizeRichHtmlOrNull(event.infoBody) || sanitizeRichHtmlOrNull(event.infoBodyEn)),
      },
      stats: { players, playedMatches },
      champions,
    };
  }

  /** Distinct players over confirmed entries (a pair counts both players); mirrors publicScope.entry. */
  private async countPlayers(eventId: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT p.id)::int AS count
      FROM "Entry" e
      JOIN "SubEvent" s ON s.id = e."subEventId"
      JOIN "Competitor" c ON c.id = e."competitorId"
      LEFT JOIN "Pair" pr ON pr.id = c."pairId"
      JOIN "Player" p ON p.id IN (c."playerId", pr."playerAId", pr."playerBId")
      WHERE s."eventId" = ${eventId} AND e.status = 'CONFIRMED'`;
    return row?.count ?? 0;
  }

  /** Stored HTML was sanitized on save; it is sanitized again here so the client renders it as is. */
  async info(slug: string): Promise<PublicEventInfo | null> {
    const event = await this.prisma.event.findFirst({
      where: { ...publicScope.event(slug), showInfoTab: true },
      select: { infoBody: true, infoBodyEn: true },
    });
    if (!event) return null;
    const info = { infoBody: sanitizeRichHtmlOrNull(event.infoBody), infoBodyEn: sanitizeRichHtmlOrNull(event.infoBodyEn) };
    return info.infoBody || info.infoBodyEn ? info : null;
  }
}
