import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import type { BulkSubEventsBody, CreateSubEventBody, UpdateSubEventBody } from './sub-event-dtos.js';
import { resolveFormat } from './sub-event-format.js';
import { resolveItems, SUB_EVENT_INCLUDE } from './sub-event-items.js';
import { assertRankingListFits } from './sub-event-ranking-list.js';

@Injectable()
export class SubEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  async list(eventId: string) {
    await this.requireEvent(eventId);
    const data = await this.prisma.subEvent.findMany({
      where: { eventId },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
      include: SUB_EVENT_INCLUDE,
    });
    return { data, total: data.length, page: 1, pageSize: data.length };
  }

  async create(eventId: string, body: CreateSubEventBody) {
    await this.requireEvent(eventId);
    const [item] = await resolveItems(this.prisma, [body], false);
    const format = await resolveFormat(this.prisma, body);
    await assertRankingListFits(this.prisma, body.rankingListId, [item!.disciplineId]);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = body.order ?? (await nextOrder(tx, eventId));
        const row = await tx.subEvent.create({
          data: {
            eventId,
            ...item!,
            ...format,
            format: body.format,
            name: body.name,
            nameEn: body.nameEn,
            hasQualifying: body.hasQualifying,
            maxEntries: body.maxEntries,
            rankingListId: body.rankingListId,
            order,
          },
          include: SUB_EVENT_INCLUDE,
        });
        await this.audit.record({ action: 'subEvent.create', entity: 'SubEvent', entityId: row.id, after: { eventId, code: row.code, format: row.format } }, tx);
        return row;
      });
    } catch (error) {
      throw mapDuplicate(error, [item!.code]);
    }
  }

  async bulkCreate(eventId: string, body: BulkSubEventsBody) {
    await this.requireEvent(eventId);
    const items = await resolveItems(this.prisma, body.items, true);
    const format = await resolveFormat(this.prisma, body.defaults);
    await assertRankingListFits(this.prisma, body.defaults.rankingListId, items.map((item) => item.disciplineId));
    const codes = items.map((item) => item.code);
    const existing = await this.prisma.subEvent.findMany({ where: { eventId, code: { in: codes } }, select: { code: true } });
    const seen = new Set<string>();
    const repeated = codes.filter((code) => seen.size === seen.add(code).size);
    const conflicts = [...new Set([...existing.map((row) => row.code), ...repeated])];
    if (conflicts.length) throw duplicateCodes(conflicts);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const start = await nextOrder(tx, eventId);
        const { hasQualifying, maxEntries, rankingListId } = body.defaults;
        const ids: string[] = [];
        for (const [index, item] of items.entries()) {
          const row = await tx.subEvent.create({
            data: { eventId, ...item, ...format, format: body.defaults.format, hasQualifying, maxEntries, rankingListId, order: start + index },
            select: { id: true },
          });
          ids.push(row.id);
        }
        await this.audit.record(
          { action: 'subEvent.bulkCreate', entity: 'Event', entityId: eventId, after: { codes, format: body.defaults.format, ...format } },
          tx,
        );
        const data = await tx.subEvent.findMany({ where: { id: { in: ids } }, orderBy: { order: 'asc' }, include: SUB_EVENT_INCLUDE });
        return { data, total: data.length, page: 1, pageSize: data.length };
      });
    } catch (error) {
      throw mapDuplicate(error, codes);
    }
  }

  async update(eventId: string, id: string, body: UpdateSubEventBody) {
    const current = await this.requireSubEvent(eventId, id);
    const nextFormat = body.format ?? current.format;
    const resolved = await resolveFormat(
      this.prisma,
      {
        format: nextFormat,
        matchFormatId: body.matchFormatId ?? current.matchFormatId,
        groupScoringRuleId: body.groupScoringRuleId ?? current.groupScoringRuleId,
      },
      { matchFormatId: current.matchFormatId, groupScoringRuleId: current.groupScoringRuleId ?? undefined },
    );
    const data = { ...body, ...resolved };
    const listChanged = body.rankingListId !== undefined && body.rankingListId !== current.rankingListId;
    if (listChanged) await assertRankingListFits(this.prisma, body.rankingListId, [current.disciplineId]);
    let dirty: string[] = [];
    const row = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subEvent.update({ where: { id }, data, include: SUB_EVENT_INCLUDE });
      if (listChanged) dirty = await markRankingDirty(tx, [id]);
      await this.audit.record(
        {
          action: 'subEvent.update',
          entity: 'SubEvent',
          entityId: id,
          before: { format: current.format, matchFormatId: current.matchFormatId, groupScoringRuleId: current.groupScoringRuleId, rankingListId: current.rankingListId },
          after: data,
        },
        tx,
      );
      return row;
    });
    const warnings = await this.ranking.enqueueRecompute(dirty);
    return { data: row, ...(warnings.length > 0 && { warnings }) };
  }

  // Phase 06+ will also refuse deletion once draws or matches exist.
  async remove(eventId: string, id: string): Promise<{ id: string }> {
    const current = await this.requireSubEvent(eventId, id);
    await this.prisma.$transaction(async (tx) => {
      if ((await tx.entry.count({ where: { subEventId: id } })) > 0) {
        throw new ConflictException({ code: 'SUB_EVENT_HAS_ENTRIES', message: 'Nội dung đã có đăng ký, không xóa được' });
      }
      const { count } = await tx.subEvent.deleteMany({ where: { id, event: { publishStatus: 'DRAFT' } } });
      if (count === 0) {
        throw new ConflictException({ code: 'EVENT_PUBLISHED', message: 'Giải đã công bố, hãy hủy công bố trước khi xóa nội dung thi đấu' });
      }
      await this.audit.record({ action: 'subEvent.delete', entity: 'SubEvent', entityId: id, before: { eventId, code: current.code } }, tx);
    });
    return { id };
  }

  private async requireEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
  }

  private async requireSubEvent(eventId: string, id: string) {
    const row = await this.prisma.subEvent.findFirst({ where: { id, eventId } });
    if (!row) throw new NotFoundException({ code: 'SUB_EVENT_NOT_FOUND', message: 'Sub-event not found' });
    return row;
  }
}

async function nextOrder(tx: Pick<Prisma.TransactionClient, 'subEvent'>, eventId: string): Promise<number> {
  const { _max } = await tx.subEvent.aggregate({ where: { eventId }, _max: { order: true } });
  return (_max.order ?? -1) + 1;
}

function duplicateCodes(codes: string[]) {
  const message = `Nội dung đã tồn tại hoặc bị trùng: ${codes.join(', ')}`;
  return new UnprocessableEntityException({ code: 'DUPLICATE_CODES', message, fields: { items: message } });
}

/** A concurrent insert can still hit @@unique([eventId, code]); report it like the pre-check does. */
function mapDuplicate(error: unknown, codes: string[]): unknown {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? duplicateCodes(codes) : error;
}

