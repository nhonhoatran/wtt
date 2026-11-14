import { Inject, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@kamito/db';
import type { PaginatedResult, PaginationQueryShape } from '@kamito/shared';
import { PrismaService } from '../../modules/prisma/prisma.service.js';
import { RevalidationEnqueueService } from '../../modules/revalidation/revalidation-enqueue.service.js';
import { AuditService } from '../audit/audit.service.js';
import { fieldError } from '../validation/parse-body.js';
import { lockDefault } from './default-flag.js';
import { assertNotInUse, defaultChangedConflict, isDefaultIndexViolation, isUniqueViolation, rethrowForeignKeyAsInUse } from './delete-guard.js';
import { type ListDelegate, type ListSpec, prismaListQuery } from './prisma-list-query.js';

export type Tx = Prisma.TransactionClient;

/* eslint-disable @typescript-eslint/no-explicit-any -- structural slice of a Prisma model delegate; each concrete service passes its own typed model */
export interface CrudDelegate<Row> extends ListDelegate<Row> {
  findUnique(args: any): PromiseLike<Row | null>;
  create(args: any): PromiseLike<Row>;
  update(args: any): PromiseLike<Row>;
  delete(args: any): PromiseLike<Row>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface CatalogConfig {
  /** Prisma model name, also the audit `entity`. */
  entity: string;
  /** Audit actions become `<auditPrefix>.create|update|delete`. */
  auditPrefix: string;
  notFoundCode: string;
  listSpec: ListSpec;
  /** Field whose unique violation (P2002) is reported as a 422 field error. */
  uniqueField?: string;
  include?: unknown;
  /** Set for catalogs with a single default row: update and delete take this advisory lock before reading. */
  defaultLockName?: string;
}

export function notFound(code: string, message = 'Không tìm thấy dữ liệu'): NotFoundException {
  return new NotFoundException({ code, message });
}

export async function assertExists(
  count: PromiseLike<number>,
  field: string,
  message: string,
): Promise<void> {
  if ((await count) === 0) throw fieldError(field, message);
}

export type UsageChecks = Record<string, () => PromiseLike<number>>;

/** Shared create / update / delete / list flow for the admin catalogs; subclasses plug in validation and usage checks. */
export abstract class CatalogCrudService<Row extends { id: string }> {
  protected abstract readonly config: CatalogConfig;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditService,
  ) {}

  // Property injection keeps every subclass constructor unchanged; the revalidation module is global.
  @Inject(RevalidationEnqueueService) private readonly revalidation!: RevalidationEnqueueService;

  protected abstract delegate(db: Tx): CrudDelegate<Row>;

  /** Public cache tags a committed write invalidates; the default is none. `before` is null on create, `after` null on delete. */
  protected publicTags(_op: 'create' | 'update' | 'delete', _before: Row | null, _after: Row | null): Promise<string[]> | string[] {
    return [];
  }

  /** Validates cross-field rules and returns the Prisma data to write. `existing` is null on create. */
  protected prepare(_tx: Tx, input: object, _existing: Row | null): Promise<Record<string, unknown>> | Record<string, unknown> {
    return { ...input };
  }

  /** Row counts that block deletion, keyed by the name shown to the UI. */
  protected usage(_tx: Tx, _row: Row): UsageChecks {
    return {};
  }

  protected assertDeletable(_row: Row): void {}

  protected toView(row: Row): unknown {
    return row;
  }

  async list(query: PaginationQueryShape): Promise<PaginatedResult<unknown>> {
    const page = await prismaListQuery(this.prisma, this.delegate(this.prisma), query, this.config.listSpec, {
      include: this.config.include,
    });
    return { ...page, data: page.data.map((row) => this.toView(row)) };
  }

  async get(id: string): Promise<unknown> {
    const row = await this.delegate(this.prisma).findUnique({ where: { id }, include: this.config.include });
    if (!row) throw notFound(this.config.notFoundCode);
    return this.toView(row);
  }

  async create(input: object): Promise<unknown> {
    return this.withUniqueCheck(() =>
      this.prisma.$transaction(async (tx) => {
        const data = await this.prepare(tx, input, null);
        const row = await this.delegate(tx).create({ data, include: this.config.include });
        const view = this.toView(row);
        await this.audit.record({ action: `${this.config.auditPrefix}.create`, entity: this.config.entity, entityId: row.id, after: view }, tx);
        return view;
      }),
    );
  }

  async update(id: string, input: object): Promise<unknown> {
    return this.withUniqueCheck(() =>
      this.prisma.$transaction(async (tx) => {
        if (this.config.defaultLockName) await lockDefault(tx, this.config.defaultLockName);
        const existing = await this.delegate(tx).findUnique({ where: { id } });
        if (!existing) throw notFound(this.config.notFoundCode);
        const data = await this.prepare(tx, input, existing);
        const row = await this.delegate(tx).update({ where: { id }, data, include: this.config.include });
        const view = this.toView(row);
        await this.audit.record(
          { action: `${this.config.auditPrefix}.update`, entity: this.config.entity, entityId: id, before: this.toView(existing), after: view },
          tx,
        );
        return view;
      }),
    );
  }

  async remove(id: string): Promise<{ id: string }> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (this.config.defaultLockName) await lockDefault(tx, this.config.defaultLockName);
        const existing = await this.delegate(tx).findUnique({ where: { id } });
        if (!existing) throw notFound(this.config.notFoundCode);
        this.assertDeletable(existing);
        await assertNotInUse(this.usage(tx, existing));
        await this.delegate(tx).delete({ where: { id } });
        await this.audit.record(
          { action: `${this.config.auditPrefix}.delete`, entity: this.config.entity, entityId: id, before: this.toView(existing) },
          tx,
        );
      });
    } catch (error) {
      rethrowForeignKeyAsInUse(error);
    }
    return { id };
  }

  createRefreshed(input: object) {
    return this.refreshed('create', null, () => this.create(input));
  }

  updateRefreshed(id: string, input: object) {
    return this.refreshed('update', id, () => this.update(id, input));
  }

  removeRefreshed(id: string) {
    return this.refreshed('delete', id, () => this.remove(id));
  }

  /** Runs the write, then queues the cache tags of `publicTags`; a queue failure becomes a response warning, never an error. */
  private async refreshed<T>(op: 'create' | 'update' | 'delete', id: string | null, run: () => Promise<T>): Promise<{ data: T; warnings?: string[] }> {
    const before = id ? await this.delegate(this.prisma).findUnique({ where: { id } }) : null;
    const data = await run();
    const afterId = id ?? (data as { id?: string }).id;
    const after = op === 'delete' || !afterId ? null : await this.delegate(this.prisma).findUnique({ where: { id: afterId } });
    const warnings = await this.revalidation.enqueue(async () => this.publicTags(op, before, after));
    return { data, ...(warnings.length > 0 && { warnings }) };
  }

  private async withUniqueCheck<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (isDefaultIndexViolation(error)) throw defaultChangedConflict();
      if (this.config.uniqueField && isUniqueViolation(error)) {
        throw fieldError(this.config.uniqueField, 'Mã này đã tồn tại', 'DUPLICATE');
      }
      throw error;
    }
  }
}
