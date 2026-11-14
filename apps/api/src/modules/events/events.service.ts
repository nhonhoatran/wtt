import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { isValidSlug, slugifyVietnamese, tournamentSettings } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { markEventRankingDirty } from '../ranking-jobs/ranking-event-dirty-marker.js';
import { CACHE_TAGS, type CacheTagMutation } from '../revalidation/cache-tags.js';
import { RevalidationEnqueueService } from '../revalidation/revalidation-enqueue.service.js';
import { loadEventMatchNos, loadSubEventCodes } from '../revalidation/public-tag-context.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { formatDateOnly } from './date-only.js';
import type { CreateEventBody, UpdateEventBody } from './event-dtos.js';
import { assertEventReferences } from './event-reference-checks.js';
import { isSlugTaken, suggestSlug } from './event-slug.js';
import { EVENT_RELATIONS, toEventView } from './event-view.js';
import { diffEventFields, toEventFields } from './event-write-data.js';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly ranking: RankingEnqueueService,
    private readonly revalidation: RevalidationEnqueueService,
  ) {}

  async create(body: CreateEventBody) {
    await assertEventReferences(this.prisma, body);
    const slug = await this.resolveNewSlug(body);
    const timezone = body.timezone ?? (await this.settings.get(tournamentSettings.defaultTimezone));
    const data = { ...toEventFields(body), slug, timezone } as Prisma.EventUncheckedCreateInput;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.event.create({ data, include: EVENT_RELATIONS });
        await this.audit.record({ action: 'event.create', entity: 'Event', entityId: row.id, after: auditSnapshot(row) }, tx);
        return row;
      });
      const warnings = await this.refreshPublic('event.create', created.id, [created.slug]);
      return { data: toEventView(created), ...(warnings.length > 0 && { warnings }) };
    } catch (error) {
      if (isUniqueViolation(error)) throw await this.slugTaken(slug);
      throw error;
    }
  }

  async update(id: string, body: UpdateEventBody) {
    const current = await this.findOrThrow(id);
    const startDate = body.startDate ?? formatDateOnly(current.startDate);
    const endDate = body.endDate ?? formatDateOnly(current.endDate);
    if (endDate < startDate) throw fieldError('endDate', 'Ngày kết thúc phải từ ngày bắt đầu trở đi');

    await assertEventReferences(this.prisma, {
      eventTypeId: body.eventTypeId !== current.eventTypeId ? body.eventTypeId : undefined,
      venueId: body.venueId !== current.venueId ? body.venueId : undefined,
      bannerMediaId: body.bannerMediaId !== current.bannerMediaId ? body.bannerMediaId : undefined,
    });
    const newSlug = body.slug && body.slug !== current.slug ? body.slug : undefined;
    if (newSlug && current.publishStatus === 'PUBLISHED') {
      throw fieldError('slug', 'Bỏ công bố trước khi đổi đường dẫn', 'SLUG_LOCKED');
    }
    if (newSlug && (await isSlugTaken(this.prisma, newSlug, id))) throw await this.slugTaken(newSlug, id);

    const fields = toEventFields(body);
    const diff = diffEventFields(current, fields);
    if (!diff) return { data: toEventView(current) };
    const data = Object.fromEntries(Object.entries(fields).filter(([key]) => key in diff.after));
    try {
      let dirty: string[] = [];
      const updated = await this.prisma.$transaction(async (tx) => {
        const row = await tx.event.update({ where: { id }, data, include: EVENT_RELATIONS });
        await this.audit.record({ action: 'event.update', entity: 'Event', entityId: id, ...diff }, tx);
        if ('endDate' in diff.after || 'eventTypeId' in diff.after) dirty = await markEventRankingDirty(tx, id);
        return row;
      });
      return this.withRanking(toEventView(updated), dirty, 'event.update', [...new Set([current.slug, updated.slug])]);
    } catch (error) {
      if (isUniqueViolation(error) && body.slug) throw await this.slugTaken(body.slug, id);
      throw error;
    }
  }

  publish(id: string) {
    return this.change(id, 'event.publish', { publishStatus: 'PUBLISHED', publishedAt: new Date() }, (row) => row.publishStatus === 'PUBLISHED');
  }

  unpublish(id: string) {
    return this.change(id, 'event.unpublish', { publishStatus: 'DRAFT', publishedAt: null }, (row) => row.publishStatus === 'DRAFT');
  }

  cancel(id: string) {
    return this.change(id, 'event.cancel', { isCancelled: true }, (row) => row.isCancelled);
  }

  uncancel(id: string) {
    return this.change(id, 'event.uncancel', { isCancelled: false }, (row) => !row.isCancelled);
  }

  async remove(id: string) {
    const current = await this.findOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.event.deleteMany({ where: { id, publishStatus: 'DRAFT', subEvents: { none: {} } } });
      if (count === 0) {
        throw new ConflictException({
          code: 'IN_USE',
          message:
            current.publishStatus === 'PUBLISHED'
              ? 'Giải đã công bố, hãy hủy công bố trước khi xóa'
              : 'Giải đã có nội dung thi đấu nên không xóa được',
          dependants: { subEvents: current._count.subEvents },
        });
      }
      await this.audit.record({ action: 'event.delete', entity: 'Event', entityId: id, before: auditSnapshot(current) }, tx);
    });
    const warnings = await this.refreshPublic('event.delete', id, [current.slug]);
    return { data: { id }, ...(warnings.length > 0 && { warnings }) };
  }

  /** Idempotent state flip; a no-op writes nothing and audits nothing. */
  private async change(id: string, action: EventMutation, data: Prisma.EventUncheckedUpdateInput, isNoop: (row: EventRow) => boolean) {
    const current = await this.findOrThrow(id);
    if (isNoop(current)) return { data: toEventView(current) };
    let dirty: string[] = [];
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.event.update({ where: { id }, data, include: EVENT_RELATIONS });
      await this.audit.record({ action, entity: 'Event', entityId: id, before: statusSnapshot(current), after: statusSnapshot(row) }, tx);
      if (row.isCancelled !== current.isCancelled) dirty = await markEventRankingDirty(tx, id);
      return row;
    });
    return this.withRanking(toEventView(updated), dirty, action, [updated.slug]);
  }

  private async withRanking(view: ReturnType<typeof toEventView>, dirty: string[], mutation: EventMutation, slugs: string[]) {
    const warnings = [...(await this.ranking.enqueueRecompute(dirty)), ...(await this.refreshPublic(mutation, view.id, slugs))];
    return { data: view, ...(warnings.length > 0 && { warnings }) };
  }

  private refreshPublic(mutation: EventMutation, eventId: string, eventSlugs: string[]) {
    return this.revalidation.enqueue(async () =>
      CACHE_TAGS[mutation]({
        eventSlugs,
        subEventCodes: await loadSubEventCodes(this.prisma, eventId),
        ...(VISIBILITY_MUTATIONS.has(mutation) && { matchNos: await loadEventMatchNos(this.prisma, eventId) }),
      }),
    );
  }

  private async findOrThrow(id: string) {
    const row = await this.prisma.event.findUnique({ where: { id }, include: EVENT_RELATIONS });
    if (!row) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    return row;
  }

  private async resolveNewSlug(body: CreateEventBody): Promise<string> {
    const slug = body.slug ?? slugifyVietnamese(body.name);
    if (!isValidSlug(slug)) throw fieldError('slug', 'Không tạo được slug từ tên giải, hãy nhập slug');
    if (await isSlugTaken(this.prisma, slug)) throw await this.slugTaken(slug);
    return slug;
  }

  private async slugTaken(slug: string, excludeId?: string) {
    const suggestion = await suggestSlug(this.prisma, slug, excludeId);
    return new UnprocessableEntityException({
      code: 'SLUG_TAKEN',
      message: 'Slug đã được dùng',
      suggestion,
      fields: { slug: `Slug đã được dùng. Gợi ý: ${suggestion}` },
    });
  }
}

const VISIBILITY_MUTATIONS = new Set<string>(['event.publish', 'event.unpublish', 'event.cancel', 'event.uncancel']);

type EventMutation = Extract<CacheTagMutation, `event.${string}`>;

type EventRow = Prisma.EventGetPayload<{ include: typeof EVENT_RELATIONS }>;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const statusSnapshot = (row: EventRow) => ({
  publishStatus: row.publishStatus,
  publishedAt: row.publishedAt,
  isCancelled: row.isCancelled,
});

const SNAPSHOT_SKIP = new Set(['infoBody', 'infoBodyEn', 'eventType', 'venue', 'bannerMedia', '_count']);

/** Audit rows skip the rich-text bodies and relations to stay small. */
function auditSnapshot(row: EventRow) {
  const scalars = Object.fromEntries(Object.entries(row).filter(([key]) => !SNAPSHOT_SKIP.has(key)));
  return { ...scalars, startDate: formatDateOnly(row.startDate), endDate: formatDateOnly(row.endDate) };
}
