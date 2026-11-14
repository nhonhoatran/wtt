import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { MediaStatus, type MediaAsset } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { effectiveMaxImageBytes, incomingKeyFor } from '@kamito/shared/media';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { API_GLOBAL_PREFIX } from '../../bootstrap-app.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { API_ENV } from '../../common/config/app-config.module.js';
import type { ApiEnv } from '../../common/config/env-schema.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { OBJECT_STORAGE } from '../storage/object-storage.provider.js';
import { type CreateIntentBody, mediaPublicBaseUrl, toMediaView, type UpdateMediaBody } from './media-dtos.js';
import { MediaQueue } from './media-queue.js';
import { receiveUpload } from './media-upload-stream.js';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: AppSettingsService,
    private readonly queue: MediaQueue,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  private async maxBytes(): Promise<number> {
    const megabytes = await this.settings.get(tournamentSettings.maxImageMegabytes);
    return effectiveMaxImageBytes(megabytes, this.env.UPLOAD_MAX_IMAGE_BYTES);
  }

  private publicBaseUrl(): string {
    return mediaPublicBaseUrl(this.env);
  }

  private async findOwned(actorId: string, id: string): Promise<MediaAsset> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, createdById: actorId } });
    if (!asset) throw new NotFoundException();
    return asset;
  }

  async uploadConfig() {
    return { allowedTypes: this.env.UPLOAD_ALLOWED_IMAGE_TYPES, maxBytes: await this.maxBytes() };
  }

  async createIntent(actorId: string, body: CreateIntentBody) {
    const contentType = body.contentType.toLowerCase();
    if (!this.env.UPLOAD_ALLOWED_IMAGE_TYPES.includes(contentType)) {
      throw fieldError('contentType', `Chỉ nhận ảnh: ${this.env.UPLOAD_ALLOWED_IMAGE_TYPES.join(', ')}`, 'UNSUPPORTED_IMAGE_TYPE');
    }
    const maxBytes = await this.maxBytes();
    if (body.size > maxBytes) {
      throw fieldError('size', `Ảnh tối đa ${Math.floor(maxBytes / 1024 / 1024)} MB`, 'IMAGE_TOO_LARGE');
    }
    const id = randomUUID();
    const ttlMinutes = await this.settings.get(tournamentSettings.intentTtlMinutes);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const asset = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          id,
          purpose: body.purpose,
          incomingKey: incomingKeyFor(body.purpose, randomUUID()),
          declaredMime: contentType,
          declaredSize: body.size,
          createdById: actorId,
          expiresAt,
        },
      });
      await this.audit.record(
        { action: 'media.create', entity: 'MediaAsset', entityId: id, after: { purpose: body.purpose, contentType, size: body.size } },
        tx,
      );
      return created;
    });
    return { mediaId: asset.id, uploadUrl: `/${API_GLOBAL_PREFIX}/admin/media/${asset.id}/content`, maxBytes, expiresAt };
  }

  async receiveContent(actorId: string, id: string, req: Request, res: Response) {
    const asset = await this.findOwned(actorId, id);
    if (asset.status !== MediaStatus.AWAITING_UPLOAD) throw new ConflictException({ code: 'NOT_AWAITING_UPLOAD', message: 'Ảnh đã được tải lên' });
    if (asset.expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'INTENT_EXPIRED', message: 'Phiên tải ảnh đã hết hạn' });
    const limit = Math.min(asset.declaredSize, await this.maxBytes());
    const size = await receiveUpload(req, res, this.storage, { key: asset.incomingKey, declaredMime: asset.declaredMime, maxBytes: limit });
    return { received: size };
  }

  async complete(actorId: string, id: string) {
    const asset = await this.findOwned(actorId, id);
    if (asset.expiresAt.getTime() <= Date.now() && asset.status === MediaStatus.AWAITING_UPLOAD) {
      throw new ConflictException({ code: 'INTENT_EXPIRED', message: 'Phiên tải ảnh đã hết hạn' });
    }
    if (!(await this.storage.stat(asset.incomingKey))) {
      throw new ConflictException({ code: 'UPLOAD_MISSING', message: 'Chưa nhận được nội dung ảnh' });
    }
    const moved = await this.prisma.mediaAsset.updateMany({
      where: { id, status: MediaStatus.AWAITING_UPLOAD },
      data: { status: MediaStatus.PROCESSING },
    });
    if (moved.count === 0) throw new ConflictException({ code: 'NOT_AWAITING_UPLOAD', message: 'Ảnh đã được xử lý' });
    try {
      await this.queue.enqueueProcessing(id);
    } catch {
      await this.prisma.mediaAsset.updateMany({ where: { id, status: MediaStatus.PROCESSING }, data: { status: MediaStatus.AWAITING_UPLOAD } });
      throw new ServiceUnavailableException({ code: 'QUEUE_UNAVAILABLE', message: 'Hàng đợi xử lý ảnh chưa sẵn sàng, thử lại sau' });
    }
    await this.audit.record({ action: 'media.complete', entity: 'MediaAsset', entityId: id, actorUserId: actorId });
    return toMediaView({ ...asset, status: MediaStatus.PROCESSING }, this.publicBaseUrl());
  }

  async get(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException();
    return toMediaView(asset, this.publicBaseUrl());
  }

  async update(actorId: string, id: string, body: UpdateMediaBody) {
    const before = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const asset = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mediaAsset.update({ where: { id }, data: body });
      await this.audit.record(
        {
          action: 'media.update',
          entity: 'MediaAsset',
          entityId: id,
          before: { altText: before.altText, altTextEn: before.altTextEn },
          after: { altText: updated.altText, altTextEn: updated.altTextEn },
          actorUserId: actorId,
        },
        tx,
      );
      return updated;
    });
    return toMediaView(asset, this.publicBaseUrl());
  }
}
