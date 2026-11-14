import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import {
  PUBLIC_EVENT_STATUSES,
  todayInTimezone,
  tournamentSettings,
  type PublicCalendarMonth,
  type PublicEventCalendar,
  type PublicEventFilters,
  type PublicEventList,
} from '@kamito/shared';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { mediaPublicBaseUrl } from '../media/media-dtos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { pageWindow, parsePublicChoice, parsePublicCode, parsePublicPage, parsePublicSearch, parsePublicYear } from '../public-scope/public-query-params.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_EVENT_CARD_SELECT, toPublicEventCard } from './public-event.serializer.js';

export interface PublicEventListQuery {
  q?: unknown;
  tier?: unknown;
  type?: unknown;
  year?: unknown;
  status?: unknown;
  page?: unknown;
}

const dayStart = (date: string) => new Date(`${date}T00:00:00Z`);
const yearRange = (year: number) => ({ gte: dayStart(`${year}-01-01`), lt: dayStart(`${year + 1}-01-01`) });

@Injectable()
export class PublicEventsListQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async list(query: PublicEventListQuery): Promise<PublicEventList> {
    const page = parsePublicPage(query.page);
    const pageSize = await this.settings.get(tournamentSettings.publicListPageSize);
    const where = await this.listWhere(query);
    // Upcoming reads soonest first; every other view reads newest first.
    const direction = parsePublicChoice(query.status, PUBLIC_EVENT_STATUSES) === 'UPCOMING' ? 'asc' : 'desc';
    const [total, rows, filters] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        select: PUBLIC_EVENT_CARD_SELECT,
        orderBy: [{ startDate: direction }, { slug: 'asc' }],
        ...pageWindow(page, pageSize),
      }),
      this.filters(),
    ]);
    const baseUrl = mediaPublicBaseUrl(this.env);
    return { items: rows.map((row) => toPublicEventCard(row, baseUrl)), page, pageSize, total, filters };
  }

  /** Whole year, oldest first; defaults to the current year in the default event time zone. */
  async calendar(query: { year?: unknown; tier?: unknown }): Promise<PublicEventCalendar> {
    const year = parsePublicYear(query.year) ?? Number((await this.today()).slice(0, 4));
    const tier = parsePublicCode(query.tier);
    const where: Prisma.EventWhereInput = {
      ...publicScope.events,
      startDate: yearRange(year),
      ...(tier ? { eventType: { tier: { code: tier } } } : {}),
    };
    const [rows, filters] = await Promise.all([
      this.prisma.event.findMany({ where, select: PUBLIC_EVENT_CARD_SELECT, orderBy: [{ startDate: 'asc' }, { slug: 'asc' }] }),
      this.filters(),
    ]);
    const baseUrl = mediaPublicBaseUrl(this.env);
    const months = new Map<string, PublicCalendarMonth>();
    for (const row of rows) {
      const card = toPublicEventCard(row, baseUrl);
      const month = card.startDate.slice(0, 7);
      const group = months.get(month) ?? { month, events: [] };
      group.events.push(card);
      months.set(month, group);
    }
    return { year, months: [...months.values()], filters };
  }

  private today(): Promise<string> {
    return this.settings.get(tournamentSettings.defaultTimezone).then((zone) => todayInTimezone(zone));
  }

  private async listWhere(query: PublicEventListQuery): Promise<Prisma.EventWhereInput> {
    const and: Prisma.EventWhereInput[] = [publicScope.events];
    const search = parsePublicSearch(query.q);
    if (search) {
      and.push({ OR: [{ name: { contains: search.text, mode: 'insensitive' } }, { nameEn: { contains: search.text, mode: 'insensitive' } }, { shortName: { contains: search.text, mode: 'insensitive' } }] });
    }
    const tier = parsePublicCode(query.tier);
    if (tier) and.push({ eventType: { tier: { code: tier } } });
    const type = parsePublicCode(query.type);
    if (type) and.push({ eventType: { code: type } });
    const year = parsePublicYear(query.year);
    if (year) and.push({ startDate: yearRange(year) });
    const status = parsePublicChoice(query.status, PUBLIC_EVENT_STATUSES);
    if (status) {
      const today = dayStart(await this.today());
      if (status === 'UPCOMING') and.push({ startDate: { gt: today } });
      if (status === 'ONGOING') and.push({ startDate: { lte: today }, endDate: { gte: today } });
      if (status === 'COMPLETED') and.push({ endDate: { lt: today } });
    }
    return { AND: and };
  }

  private async filters(): Promise<PublicEventFilters> {
    const [tiers, eventTypes, years] = await Promise.all([
      this.prisma.tier.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { code: 'asc' }], select: { code: true, name: true, nameEn: true, colorHex: true } }),
      this.prisma.eventType.findMany({
        where: { isActive: true, tier: { isActive: true } },
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
        select: { code: true, name: true, nameEn: true, tier: { select: { code: true } } },
      }),
      // Same condition as publicScope.events, which Prisma cannot express for an EXTRACT(YEAR) list.
      this.prisma.$queryRaw<{ year: number }[]>`
        SELECT DISTINCT EXTRACT(YEAR FROM "startDate")::int AS year FROM "Event"
        WHERE "publishStatus" = 'PUBLISHED' AND "isCancelled" = false ORDER BY year DESC`,
    ]);
    return {
      tiers,
      eventTypes: eventTypes.map(({ tier, ...type }) => ({ ...type, tierCode: tier.code })),
      years: years.map((row) => row.year),
    };
  }
}
