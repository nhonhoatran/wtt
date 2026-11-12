import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit, type TestUser } from './support/auth-test-kit.js';
import {
  deleteMedia,
  loadWorkerProcessors,
  mediaQueue,
  noisyJpeg,
  useTempUploadDir,
  type WorkerMediaModules,
} from './support/media-test-kit.js';

const MEDIA = '/api/v1/admin/media';

describe('media upload pipeline (local driver, real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let upload: Awaited<ReturnType<typeof useTempUploadDir>>;
  let storage: LocalObjectStorage;
  let worker: WorkerMediaModules;
  let workerDeps: unknown;
  let admin: TestUser;
  let cookie: string;
  const queue = mediaQueue();
  const mediaIds: string[] = [];

  const intent = async (body: object = { purpose: 'tier-logo', contentType: 'image/jpeg', size: 100_000 }, as = cookie) => {
    const res = await kit.write('post', `${MEDIA}/intents`, as, body);
    if (res.status === 201) mediaIds.push(res.body.data.mediaId);
    return res;
  };
  const put = (id: string, body: Buffer | string, type = 'image/jpeg', as = cookie) =>
    kit.http.put(`${MEDIA}/${id}/content`).set('Origin', kit.origin).set('Cookie', as).set('Content-Type', type).send(body);
  const runWorker = async (id: string) => {
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
    return worker.processImage(workerDeps, asset.id);
  };

  beforeAll(async () => {
    upload = await useTempUploadDir();
    kit = await AuthTestKit.start();
    storage = new LocalObjectStorage(upload.dir);
    worker = await loadWorkerProcessors();
    workerDeps = {
      prisma: kit.prisma,
      storage,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      variantWidths: [320, 640, 1280],
      maxBytes: async () => 5 * 1024 * 1024,
    };
    admin = await kit.createUser({ role: 'ADMIN' });
    cookie = await kit.signIn(admin);
  });

  afterAll(async () => {
    for (const id of mediaIds) await (await queue.getJob(`media-${id}`))?.remove().catch(() => undefined);
    await queue.close();
    await deleteMedia(kit.prisma, mediaIds);
    await kit.close();
    await upload.cleanup();
  });

  it('takes a ~3 MB jpeg from intent to READY with 3 webp variants and no original left', async () => {
    const jpeg = await noisyJpeg(2600, 1950);
    const created = await intent({ purpose: 'tier-logo', contentType: 'image/jpeg', size: jpeg.length });
    expect(created.status).toBe(201);
    const { mediaId, uploadUrl, maxBytes } = created.body.data;
    expect(uploadUrl).toBe(`${MEDIA}/${mediaId}/content`);
    expect(maxBytes).toBeGreaterThanOrEqual(jpeg.length);

    await put(mediaId, jpeg).expect(200);
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    expect((await storage.stat(asset.incomingKey))?.size).toBe(jpeg.length);

    const done = await kit.write('post', `${MEDIA}/${mediaId}/complete`, cookie).expect(200);
    expect(done.body.data.status).toBe('PROCESSING');
    const job = await queue.getJob(`media-${mediaId}`);
    expect(job?.name).toBe('process-image');
    expect(job?.data).toEqual({ mediaId });
    expect(job?.opts).toMatchObject({ attempts: 3, backoff: { type: 'exponential', delay: 5000 } });

    const started = Date.now();
    expect(await runWorker(mediaId)).toBe('ready');
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(await storage.stat(asset.incomingKey)).toBeNull();

    const view = (await kit.get(`${MEDIA}/${mediaId}`, cookie).expect(200)).body.data;
    expect(view).toMatchObject({ status: 'READY', failureReason: null });
    expect(view.variants.map((variant: { width: number }) => variant.width)).toEqual([320, 640, 1280]);
    expect(view.url).toBe(view.variants[2].url);

    const file = await kit.http.get(view.variants[0].url).expect(200);
    expect(file.headers).toMatchObject({ 'content-type': 'image/webp', 'x-content-type-options': 'nosniff' });
    expect(file.headers['cache-control']).toContain('immutable');

    const saved = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    expect(saved.publicKey).toMatch(/^public\/tier-logo\/\d{4}\/.+-1280\.webp$/);
    const actions = await kit.prisma.auditLog.findMany({ where: { entityId: mediaId }, select: { action: true, actorId: true } });
    expect(actions).toEqual(expect.arrayContaining([{ action: 'media.create', actorId: admin.id }, { action: 'media.complete', actorId: admin.id }]));
  });

  it('cuts an oversize upload with 413 and keeps nothing', async () => {
    const { mediaId } = (await intent({ purpose: 'event-banner', contentType: 'image/jpeg', size: 1000 })).body.data;
    await put(mediaId, Buffer.alloc(50_000, 1)).expect(413);
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
    expect(asset.status).toBe('AWAITING_UPLOAD');
  });

  it('rejects a body whose Content-Type differs from the declared one', async () => {
    const { mediaId } = (await intent()).body.data;
    const res = await put(mediaId, Buffer.alloc(10), 'image/png');
    expect([415, 422]).toContain(res.status);
  });

  it('validates the intent: type allowlist, size ceiling, purpose, permission', async () => {
    expect((await intent({ purpose: 'tier-logo', contentType: 'image/gif', size: 100 })).status).toBe(422);
    expect((await intent({ purpose: 'tier-logo', contentType: 'image/jpeg', size: 6 * 1024 * 1024 })).status).toBe(422);
    expect((await intent({ purpose: 'avatar', contentType: 'image/jpeg', size: 100 })).status).toBe(422);
    await kit.write('post', `${MEDIA}/intents`, undefined, { purpose: 'tier-logo', contentType: 'image/jpeg', size: 1 }).expect(401);
    const operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    expect((await intent(undefined, operator)).status).toBe(403);
  });

  it('answers 404 to complete/upload for an unknown id or another user, and 409 without content', async () => {
    const { mediaId } = (await intent()).body.data;
    const other = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    await kit.write('post', `${MEDIA}/${mediaId}/complete`, other).expect(404);
    await put(mediaId, Buffer.alloc(10), 'image/jpeg', other).expect(404);
    await kit.write('post', `${MEDIA}/${crypto.randomUUID()}/complete`, cookie).expect(404);
    await kit.write('post', `${MEDIA}/${mediaId}/complete`, cookie).expect(409);
  });

  it('fails a text file renamed .jpg and still removes the upload', async () => {
    const text = Buffer.from('not an image, just text pretending to be a jpeg');
    const { mediaId } = (await intent({ purpose: 'tier-background', contentType: 'image/jpeg', size: text.length })).body.data;
    await put(mediaId, text).expect(200);
    await kit.write('post', `${MEDIA}/${mediaId}/complete`, cookie).expect(200);
    expect(await runWorker(mediaId)).toBe('failed');
    const view = (await kit.get(`${MEDIA}/${mediaId}`, cookie).expect(200)).body.data;
    expect(view).toMatchObject({ status: 'FAILED', failureReason: 'NOT_AN_IMAGE', variants: [], url: null });
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
  });

  it('expires abandoned intents: upload refused, cleanup job marks them FAILED', async () => {
    const { mediaId } = (await intent()).body.data;
    await kit.prisma.mediaAsset.update({ where: { id: mediaId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await put(mediaId, Buffer.alloc(10)).expect(409);
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    await storage.put(asset.incomingKey, Buffer.from('leftover'));
    expect(await worker.cleanupExpiredIntents(workerDeps)).toBeGreaterThanOrEqual(1);
    expect(await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } })).toMatchObject({ status: 'FAILED', failureReason: 'INTENT_EXPIRED' });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
  });

  it('updates alt text', async () => {
    const { mediaId } = (await intent()).body.data;
    const res = await kit.write('patch', `${MEDIA}/${mediaId}`, cookie, { altText: 'Logo', altTextEn: 'Logo EN' }).expect(200);
    expect(res.body.data).toMatchObject({ altText: 'Logo', altTextEn: 'Logo EN' });
    await kit.write('patch', `${MEDIA}/${mediaId}`, cookie, {}).expect(422);
  });

  it('public route serves only the worker file shape: traversal and incoming/ are 404', async () => {
    const { mediaId } = (await intent()).body.data;
    const asset = await kit.prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
    await storage.put(asset.incomingKey, Buffer.from('secret original'));
    const base = '/api/v1/media/public';
    const attempts = [
      `${base}/..%2F..%2Fincoming%2Ftier-logo%2Fx`,
      `${base}/../incoming/tier-logo/x`,
      `${base}/%2e%2e/%2e%2e/etc/passwd`,
      `${base}/${asset.incomingKey}`,
      `${base}/tier-logo/2026/${crypto.randomUUID()}-320.webp`,
      `${base}/tier-logo/2026/x.jpg`,
    ];
    for (const url of attempts) expect({ url, status: (await kit.http.get(url)).status }).toEqual({ url, status: 404 });
    await storage.delete(asset.incomingKey);
  });
});
