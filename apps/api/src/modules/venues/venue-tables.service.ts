import { Injectable } from '@nestjs/common';
import type { VenueTable } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { type Tx, notFound } from '../../common/crud/catalog-crud.js';
import { isUniqueViolation, rethrowForeignKeyAsInUse } from '../../common/crud/delete-guard.js';
import { booleanFilter, prismaListQuery } from '../../common/crud/prisma-list-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationQueryShape } from '@kamito/shared';

export const VENUE_TABLE_LIST_SPEC = {
  sortable: ['order', 'code', 'createdAt'],
  defaultSort: { field: 'order', direction: 'asc' },
  searchFields: ['code', 'displayName'],
  filters: { isActive: booleanFilter('isActive') },
} as const;

// Codes read T01..T99, then T100; the width is a display convention, not a limit.
const NUMBER_PAD = 2;

export interface BulkTablesInput {
  count: number;
  prefix?: string;
  startAt?: number;
}

@Injectable()
export class VenueTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
  ) {}

  async list(venueId: string, query: PaginationQueryShape) {
    await this.requireVenue(this.prisma, venueId);
    return prismaListQuery(this.prisma, this.prisma.venueTable, query, VENUE_TABLE_LIST_SPEC, { baseWhere: { venueId } });
  }

  async create(venueId: string, input: { code: string; displayName?: string | null; order?: number; isActive?: boolean }) {
    return this.withDuplicateCheck(() =>
      this.prisma.$transaction(async (tx) => {
        await this.requireVenue(tx, venueId);
        const order = input.order ?? (await this.nextOrder(tx, venueId));
        const row = await tx.venueTable.create({ data: { ...input, order, venueId } });
        await this.audit.record({ action: 'venueTable.create', entity: 'VenueTable', entityId: row.id, after: row }, tx);
        return row;
      }),
    );
  }

  async update(venueId: string, tableId: string, input: object) {
    return this.withDuplicateCheck(() =>
      this.prisma.$transaction(async (tx) => {
        const before = await this.requireTable(tx, venueId, tableId);
        const row = await tx.venueTable.update({ where: { id: tableId }, data: { ...input } });
        await this.audit.record({ action: 'venueTable.update', entity: 'VenueTable', entityId: tableId, before, after: row }, tx);
        return row;
      }),
    );
  }

  async remove(venueId: string, tableId: string): Promise<{ id: string }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await this.requireTable(tx, venueId, tableId);
        await tx.venueTable.delete({ where: { id: tableId } });
        await this.audit.record({ action: 'venueTable.delete', entity: 'VenueTable', entityId: tableId, before }, tx);
      });
    } catch (error) {
      rethrowForeignKeyAsInUse(error);
    }
    return { id: tableId };
  }

  /** Creates T01..Tnn style tables; codes that already exist are skipped. Returns only the new rows. */
  async bulkCreate(venueId: string, input: BulkTablesInput): Promise<VenueTable[]> {
    const prefix = input.prefix ?? (await this.settings.get(tournamentSettings.tablePrefix)).toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      await this.requireVenue(tx, venueId);
      const existing = await tx.venueTable.findMany({ where: { venueId }, select: { code: true } });
      const taken = new Set(existing.map((row) => row.code));
      const startAt = input.startAt ?? nextNumber(taken, prefix);
      const codes = Array.from({ length: input.count }, (_, index) => `${prefix}${String(startAt + index).padStart(NUMBER_PAD, '0')}`);
      const fresh = codes.filter((code) => !taken.has(code));
      const firstOrder = await this.nextOrder(tx, venueId);
      const rows = await tx.venueTable.createManyAndReturn({
        data: fresh.map((code, index) => ({ venueId, code, order: firstOrder + index })),
        skipDuplicates: true,
      });
      await this.audit.record(
        { action: 'venueTable.bulkCreate', entity: 'Venue', entityId: venueId, after: { prefix, requested: input.count, created: rows.map((row) => row.code) } },
        tx,
      );
      return rows;
    });
  }

  private async requireVenue(db: Tx | PrismaService, venueId: string): Promise<void> {
    if ((await db.venue.count({ where: { id: venueId } })) === 0) throw notFound('VENUE_NOT_FOUND');
  }

  private async requireTable(tx: Tx, venueId: string, tableId: string): Promise<VenueTable> {
    const row = await tx.venueTable.findFirst({ where: { id: tableId, venueId } });
    if (!row) throw notFound('VENUE_TABLE_NOT_FOUND');
    return row;
  }

  private async nextOrder(tx: Tx, venueId: string): Promise<number> {
    const { _max } = await tx.venueTable.aggregate({ where: { venueId }, _max: { order: true } });
    return (_max.order ?? -1) + 1;
  }

  private async withDuplicateCheck<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isUniqueViolation(error)) throw fieldError('code', 'Mã bàn này đã tồn tại ở địa điểm này', 'DUPLICATE');
      throw error;
    }
  }
}

function nextNumber(codes: Set<string>, prefix: string): number {
  let highest = 0;
  for (const code of codes) {
    const suffix = code.startsWith(prefix) ? code.slice(prefix.length) : '';
    if (/^\d+$/.test(suffix)) highest = Math.max(highest, Number(suffix));
  }
  return highest + 1;
}
