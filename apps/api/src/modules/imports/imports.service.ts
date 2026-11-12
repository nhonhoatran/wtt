import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ImportStatus, type ImportJob } from '@kamito/db';
import { BYTES_PER_MEGABYTE, effectiveLimit, importSettings, type PaginationQueryShape, type UserRoleName } from '@kamito/shared';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service.js';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { enumFilter, idFilter, listRules, prismaListQuery, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { OBJECT_STORAGE } from '../storage/object-storage.provider.js';
import { type CommitBody, type CreateImportBody, toImportView, XLSX_MIME } from './import-dtos.js';
import { ImportQueue } from './import-queue.js';
import { receiveWorkbook } from './import-upload-stream.js';

const EVENT_SUMMARY = { select: { id: true, name: true, slug: true } } as const;

const LIST_SPEC: ListSpec = {
  sortable: ['createdAt'],
  defaultSort: { field: 'createdAt', direction: 'desc' },
  filters: { eventId: idFilter('eventId'), status: enumFilter('status', Object.values(ImportStatus)) },
};
export const IMPORT_LIST_RULES = listRules(LIST_SPEC);

export interface Actor {
  id: string;
  role: UserRoleName;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly queue: ImportQueue,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private async maxBytes(): Promise<number> {
    const megabytes = await this.settings.get(importSettings.maxFileMegabytes);
    return effectiveLimit(megabytes, this.env.IMPORT_MAX_FILE_BYTES, BYTES_PER_MEGABYTE);
  }

  async create(actor: Actor, body: CreateImportBody) {
    const event = await this.prisma.event.findUnique({ where: { id: body.eventId }, select: { id: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy giải đấu' });
    const maxBytes = await this.maxBytes();
    if (body.fileSize > maxBytes) throw fieldError('fileSize', `File tối đa ${Math.floor(maxBytes / BYTES_PER_MEGABYTE) || 1} MB`, 'FILE_TOO_LARGE');
    const id = randomUUID();
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.importJob.create({
        data: { id, eventId: body.eventId, fileKey: `private/imports/${id}.xlsx`, fileName: body.fileName, fileSize: body.fileSize, createdById: actor.id },
      });
      await this.audit.record({ action: 'import.create', entity: 'ImportJob', entityId: id, after: { eventId: body.eventId, fileName: body.fileName }, actorUserId: actor.id }, tx);
      return created;
    });
    return { id: job.id, status: job.status, maxBytes };
  }

  private async findForActor(actor: Actor, id: string): Promise<ImportJob> {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: 'Không tìm thấy lượt import' });
    if (job.createdById !== actor.id && actor.role !== 'ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Chỉ người tạo hoặc ADMIN được thao tác' });
    return job;
  }

  async receiveFile(actor: Actor, id: string, req: Request, res: Response) {
    const job = await this.findForActor(actor, id);
    if (job.status !== ImportStatus.AWAITING_UPLOAD) throw new ConflictException({ code: 'NOT_AWAITING_UPLOAD', message: 'Lượt import này đã tải file' });
    const limit = Math.min(job.fileSize ?? Infinity, await this.maxBytes());
    const fileSize = await receiveWorkbook(req, res, this.storage, { key: job.fileKey, mime: XLSX_MIME, maxBytes: limit });
    const current = await this.prisma.importJob.findUniqueOrThrow({ where: { id }, select: { fileDeletedAt: true } });
    if (current.fileDeletedAt) {
      await this.storage.delete(job.fileKey);
      throw new ConflictException({ code: 'UPLOAD_EXPIRED', message: 'Lượt import đã hết hạn tải file, hãy tạo lượt mới' });
    }
    await this.prisma.importJob.update({ where: { id }, data: { fileSize } });
    return { id, status: job.status, fileSize };
  }

  async markUploaded(actor: Actor, id: string) {
    const job = await this.findForActor(actor, id);
    if (job.status !== ImportStatus.AWAITING_UPLOAD) throw new ConflictException({ code: 'NOT_AWAITING_UPLOAD', message: 'Lượt import này đã được xử lý' });
    if (!(await this.storage.stat(job.fileKey))) throw new ConflictException({ code: 'UPLOAD_MISSING', message: 'Chưa nhận được file' });
    const moved = await this.prisma.importJob.updateMany({
      where: { id, status: ImportStatus.AWAITING_UPLOAD },
      data: { status: ImportStatus.VALIDATING, attemptNo: { increment: 1 }, failureReason: null },
    });
    if (moved.count === 0) throw new ConflictException({ code: 'NOT_AWAITING_UPLOAD', message: 'Lượt import này đã được xử lý' });
    const current = await this.prisma.importJob.findUniqueOrThrow({ where: { id }, select: { attemptNo: true } });
    await this.enqueueOrRevert(id, { from: ImportStatus.VALIDATING, to: ImportStatus.AWAITING_UPLOAD, attemptNo: current.attemptNo }, () => this.queue.enqueueValidate(id, current.attemptNo));
    return this.get(id);
  }

  async commit(actor: Actor, id: string, body: CommitBody) {
    const job = await this.findForActor(actor, id);
    if (body.overrideReason && actor.role !== 'ADMIN') throw new ForbiddenException({ code: 'OVERRIDE_ADMIN_ONLY', message: 'Chỉ ADMIN được nhập vượt kiểm tra' });
    // A FAILED job that reached VALIDATED keeps its rows, so it can be committed again (also with nothing committed yet).
    const retry = job.status === ImportStatus.FAILED && job.fileSha256 !== null && (await this.prisma.importRow.count({ where: { importJobId: id } })) > 0;
    if (job.status !== ImportStatus.VALIDATED && !retry) throw new ConflictException({ code: 'NOT_COMMITTABLE', message: 'Lượt import chưa sẵn sàng để nhập' });
    if (job.fileDeletedAt) throw new ConflictException({ code: 'FILE_DELETED', message: 'File import đã bị xóa do quá hạn lưu, hãy tải lên lại' });
    if (!retry && !job.validRows && !body.overrideReason) throw new ConflictException({ code: 'NOTHING_TO_COMMIT', message: 'Không có dòng hợp lệ để nhập' });

    const moved = await this.prisma.importJob.updateMany({
      where: { id, status: job.status },
      data: { status: ImportStatus.COMMITTING, attemptNo: { increment: 1 }, overrideReason: body.overrideReason ?? null, failureReason: null, finishedAt: null },
    });
    if (moved.count === 0) throw new ConflictException({ code: 'NOT_COMMITTABLE', message: 'Lượt import vừa được xử lý ở nơi khác' });
    const current = await this.prisma.importJob.findUniqueOrThrow({ where: { id }, select: { attemptNo: true } });
    await this.audit.record({ action: 'import.commit.request', entity: 'ImportJob', entityId: id, reason: body.overrideReason, actorUserId: actor.id });
    await this.enqueueOrRevert(id, { from: ImportStatus.COMMITTING, to: job.status, attemptNo: current.attemptNo }, () => this.queue.enqueueCommit(id, current.attemptNo));
    return this.get(id);
  }

  async revalidate(actor: Actor, id: string) {
    const job = await this.findForActor(actor, id);
    if (job.status !== ImportStatus.FAILED && job.status !== ImportStatus.VALIDATED) throw new ConflictException({ code: 'NOT_REVALIDATABLE', message: 'Chỉ kiểm tra lại được lượt import đã kiểm tra xong hoặc bị lỗi' });
    if (job.fileDeletedAt || !(await this.storage.stat(job.fileKey))) throw new ConflictException({ code: 'FILE_DELETED', message: 'File import đã bị xóa, hãy tải lên lại' });
    if ((await this.prisma.importRow.count({ where: { importJobId: id, status: 'COMMITTED' } })) > 0) {
      throw new ConflictException({ code: 'HAS_COMMITTED_ROWS', message: 'Đã có dòng được nhập, không kiểm tra lại được' });
    }
    const moved = await this.prisma.importJob.updateMany({
      where: { id, status: job.status },
      data: { status: ImportStatus.VALIDATING, attemptNo: { increment: 1 }, failureReason: null, finishedAt: null, fileSha256: null, totalRows: null },
    });
    if (moved.count === 0) throw new ConflictException({ code: 'NOT_REVALIDATABLE', message: 'Lượt import vừa được xử lý ở nơi khác' });
    const current = await this.prisma.importJob.findUniqueOrThrow({ where: { id }, select: { attemptNo: true } });
    await this.audit.record({ action: 'import.revalidate', entity: 'ImportJob', entityId: id, actorUserId: actor.id });
    await this.enqueueOrRevert(id, { from: ImportStatus.VALIDATING, to: job.status, attemptNo: current.attemptNo }, () => this.queue.enqueueValidate(id, current.attemptNo));
    return this.get(id);
  }

  /** Undoes this request's status change only while the job is still in the state and attempt it created. */
  private async enqueueOrRevert(id: string, change: { from: ImportStatus; to: ImportStatus; attemptNo: number }, enqueue: () => Promise<void>): Promise<void> {
    try {
      await enqueue();
    } catch {
      await this.prisma.importJob.updateMany({ where: { id, status: change.from, attemptNo: change.attemptNo }, data: { status: change.to } });
      throw new ServiceUnavailableException({ code: 'QUEUE_UNAVAILABLE', message: 'Hàng đợi xử lý chưa sẵn sàng, thử lại sau' });
    }
  }

  list(query: PaginationQueryShape) {
    return prismaListQuery(this.prisma, this.prisma.importJob, query, LIST_SPEC, { include: { event: EVENT_SUMMARY } }).then((page) => ({
      ...page,
      data: page.data.map((job) => toImportView(job as Parameters<typeof toImportView>[0])),
    }));
  }

  async get(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id }, include: { event: EVENT_SUMMARY } });
    if (!job) throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: 'Không tìm thấy lượt import' });
    const groups = await this.prisma.importRow.groupBy({ by: ['status'], where: { importJobId: id }, _count: true });
    const countsByStatus = { VALID: 0, ERROR: 0, NEEDS_CONFIRM: 0, COMMITTED: 0 };
    for (const group of groups) countsByStatus[group.status] = group._count;
    return { ...toImportView(job), countsByStatus };
  }
}
