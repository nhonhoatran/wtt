import { Injectable, NotFoundException } from '@nestjs/common';
import { tournamentSettings, type PaginationQueryShape } from '@kamito/shared';
import { buildListWhere, enumFilter, idFilter, invalidQuery, prismaListQuery, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { parseDateOnly } from './date-only.js';
import { confirmedEntryCounts, lifecycleCounts } from './event-list-counts.js';
import { lifecycleFilter } from './event-lifecycle-filter.js';
import { isSlugTaken, suggestSlug } from './event-slug.js';
import { EVENT_LIST_SELECT, EVENT_RELATIONS, toEventView } from './event-view.js';

type Where = Record<string, unknown>;

const YEAR = /^\d{4}$/;

function yearFilter(value: string): Where {
  if (!YEAR.test(value)) throw invalidQuery('year must be YYYY');
  const year = Number(value);
  return { startDate: { gte: parseDateOnly(`${value}-01-01`), lt: parseDateOnly(`${year + 1}-01-01`) } };
}

const SORTABLE = ['startDate', 'name', 'createdAt'] as const;

export const EVENT_LIST_RULES = {
  sortable: SORTABLE,
  filterable: ['eventTypeId', 'year', 'lifecycle', 'publishStatus'],
} as const;

/** The list filters minus lifecycle: the counts endpoint reports every lifecycle itself. */
export const EVENT_COUNT_RULES = { sortable: SORTABLE, filterable: ['eventTypeId', 'year', 'publishStatus'] } as const;

@Injectable()
export class EventsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  private listSpec(timezones: readonly string[]): ListSpec {
    return {
      sortable: SORTABLE,
      defaultSort: { field: 'startDate', direction: 'desc' },
      searchFields: ['name', 'nameEn', 'slug'],
      filters: {
        eventTypeId: idFilter('eventTypeId'),
        year: yearFilter,
        lifecycle: lifecycleFilter(timezones),
        publishStatus: enumFilter('publishStatus', ['DRAFT', 'PUBLISHED']),
      },
    };
  }

  async list(query: PaginationQueryShape) {
    const timezones = query.filter.lifecycle ? await this.distinctTimezones() : [];
    const page = await prismaListQuery(this.prisma, this.prisma.event, query, this.listSpec(timezones), { select: EVENT_LIST_SELECT });
    const now = new Date();
    const entryCounts = await confirmedEntryCounts(this.prisma, page.data.map((row) => row.id));
    return { ...page, data: page.data.map((row) => ({ ...toEventView(row, now), entryCount: entryCounts.get(row.id) ?? 0 })) };
  }

  /** Per-lifecycle totals for the same q / year / type / publish filters as the list (lifecycle itself is not filterable here). */
  async lifecycleCounts(query: PaginationQueryShape) {
    const timezones = await this.distinctTimezones();
    const spec = this.listSpec(timezones);
    const toWhere = lifecycleFilter(timezones);
    return lifecycleCounts(this.prisma, buildListWhere(query, spec), toWhere);
  }

  private async distinctTimezones(): Promise<string[]> {
    const rows = await this.prisma.event.findMany({ distinct: ['timezone'], select: { timezone: true } });
    return rows.map((row) => row.timezone);
  }

  async get(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: EVENT_RELATIONS });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    return toEventView(event);
  }

  async slugAvailable(slug: string, excludeId?: string) {
    const taken = await isSlugTaken(this.prisma, slug, excludeId);
    return { available: !taken, suggestion: taken ? await suggestSlug(this.prisma, slug, excludeId) : slug };
  }

  /** Form pre-fill: default timezone, duration and the event type this user picked last. */
  async defaults(userId: string) {
    const timezone = await this.settings.get(tournamentSettings.defaultTimezone);
    const lastCreate = await this.prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'event.create', entity: 'Event' },
      orderBy: { createdAt: 'desc' },
      select: { entityId: true },
    });
    const lastEvent = lastCreate
      ? await this.prisma.event.findUnique({ where: { id: lastCreate.entityId }, select: { eventTypeId: true } })
      : null;
    const defaultDurationDays = await this.settings.get(tournamentSettings.defaultDurationDays);
    return { timezone, defaultDurationDays, lastEventTypeId: lastEvent?.eventTypeId ?? null };
  }
}
