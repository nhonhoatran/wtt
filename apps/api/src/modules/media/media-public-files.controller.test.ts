import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyApiSecurityHeaders } from '../../common/security/api-security-headers.js';
import { OBJECT_STORAGE } from '../storage/object-storage.provider.js';
import { MediaPublicFilesController } from './media-public-files.controller.js';

const PUBLIC_IMAGE_PATH = 'event-banner/2026/12345678-1234-1234-1234-123456789012-640.webp';

describe('public media response headers (local filesystem)', () => {
  let app: INestApplication;
  let storageDir: string;

  beforeAll(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'kamito-public-media-'));
    const storage = new LocalObjectStorage(storageDir);
    await storage.put(`public/${PUBLIC_IMAGE_PATH}`, Buffer.from('public image fixture'));
    const module = await Test.createTestingModule({
      controllers: [MediaPublicFilesController],
      providers: [{ provide: OBJECT_STORAGE, useValue: storage }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    applyApiSecurityHeaders(app.getHttpAdapter().getInstance());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (storageDir) await rm(storageDir, { recursive: true, force: true });
  });

  it('allows a public image to be embedded across origins while retaining content-type protection', async () => {
    const response = await request(app.getHttpServer()).get(`/api/v1/media/public/${PUBLIC_IMAGE_PATH}`).expect(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
