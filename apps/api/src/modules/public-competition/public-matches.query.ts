import { Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import { PUBLIC_MATCH_STATES, tournamentSettings, type PublicMatchDetail, type PublicMatchList, type PublicMatchState } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { pageWindow, parsePublicCode, parsePublicDate, parsePublicPage, parsePublicSearch, zonedDayRange } from '../public-scope/public-query-params.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_MATCH_CARD_SELECT, toPublicMatchCard } from './public-match.serializer.js';

export interface PublicMatchListQuery {
  state?: unknown;
  sub?: unknown;
  date?: unknown;
  q?: unknown;
  page?: unknown;
}

const STATUS: Record<PublicMatchState, 'LIVE' | 'OFFICIAL' | 'SCHEDULED'> = { live: 'LIVE', completed: 'OFFICIAL', upcoming: 'SCHEDULED' };

const ORDER: Record<PublicMatchState, Prisma.MatchOrderByWithRelationInput[]> = {
  live: [{ startedAt: 'asc' }, { matchNo: 'asc' }],
  completed: [{ officialAt: { sort: 'desc', nulls: 'last' } }, { matchNo: 'desc' }],
  upcoming: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { matchNo: 'asc' }],
};

type Search = { text: string; normalized: string };

/** A display name hides the legal name, so the legal name must not find that player either. */
const playerNamed = ({ normalized }: Search): Prisma.PlayerWhereInput => ({ normalizedPublicName: { contains: normalized } });

/** Any player of a side (single or either pair member) whose public name contains the search. */
export function sideNamed(search: Search): Prisma.EntryWhereInput {
  const player = playerNamed(search);
  return { competitor: { OR: [{ player }, { pair: { playerA: player } }, { pair: { playerB: player } }] } };
}

@Injectable()
export class PublicMatchesQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Null when the event is not public. One count + one page query; BYEs never appear (publicScope.match). */
  async list(slug: string, query: PublicMatchListQuery): Promise<PublicMatchList | null> {
    const event = await this.prisma.event.findFirst({ where: publicScope.event(slug), select: { timezone: true } });
    if (!event) return null;
    const raw = typeof query.state === 'string' ? query.state : undefined;
    const state: PublicMatchState = raw && (PUBLIC_MATCH_STATES as readonly string[]).includes(raw) ? (raw as PublicMatchState) : 'completed';
    const page = parsePublicPage(query.page);
    const pageSize = await this.settings.get(tournamentSettings.publicListPageSize);

    const and: Prisma.MatchWhereInput[] = [publicScope.match(slug), { status: STATUS[state] }];
    const sub = parsePublicCode(query.sub);
    if (sub) and.push({ subEvent: { code: sub } });
    const date = parsePublicDate(query.date);
    if (date) and.push({ scheduledAt: zonedDayRange(date, event.timezone) });
    const search = parsePublicSearch(query.q);
    if (search) and.push({ OR: [{ side1Entry: sideNamed(search) }, { side2Entry: sideNamed(search) }] });
    const where = { AND: and };

    const [total, rows] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({ where, select: PUBLIC_MATCH_CARD_SELECT, orderBy: ORDER[state], ...pageWindow(page, pageSize) }),
    ]);
    return { state, items: rows.map(toPublicMatchCard), page, pageSize, total };
  }

  async detail(slug: string, matchNoParam: string): Promise<PublicMatchDetail | null> {
    const matchNo = Number(matchNoParam);
    if (!/^\d{1,9}$/.test(matchNoParam) || !Number.isSafeInteger(matchNo)) return null;
    const row = await this.prisma.match.findFirst({
      where: { ...publicScope.match(slug), matchNo },
      select: {
        ...PUBLIC_MATCH_CARD_SELECT,
        startedAt: true,
        officialAt: true,
        event: { select: { slug: true, name: true, nameEn: true, timezone: true } },
      },
    });
    if (!row) return null;
    return {
      ...toPublicMatchCard(row),
      event: { slug: row.event.slug, name: row.event.name, nameEn: row.event.nameEn, timezone: row.event.timezone },
      startedAt: row.startedAt?.toISOString() ?? null,
      officialAt: row.officialAt?.toISOString() ?? null,
    };
  }
}
