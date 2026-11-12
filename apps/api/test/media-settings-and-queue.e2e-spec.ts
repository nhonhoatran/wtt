import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { deleteMedia, mediaQueue, noisyJpeg, useTempUploadDir } from './support/media-test-kit.js';

const MEDIA = '/api/v1/admin/media';
const SETTINGS = '/api/v1/admin/settings';

describe('media settings, config and queue retry (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let upload: Awaited<ReturnType<typeof useTempUploadDir>>;
  let cookie: string;
  let operatorCookie: string;
  const queue = mediaQueue();
  const mediaIds: string[] = [];
  const touchedSettings = new Set<string>();

  const putSetting = (key: string, value: unknown) => {
    touchedSettings.add(key);
    return kit.write('put', `${SETTINGS}/${key}`, cookie, { value });
  };

  beforeAll(async () => {
    upload = await useTempUploadDir();
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
  });

  afterAll(async () => {
    for (const key of touchedSettings) await kit.write('delete', `${SETTINGS}/${key}`, cookie);
    for (const id of mediaIds) await (await queue.getJob(`media-${id}`))?.remove().catch(() => undefined);
    await queue.close();
    await deleteMedia(kit.prisma, mediaIds);
    await kit.close();
    await upload.cleanup();
  });

  it('serves upload config to media readers only', async () => {
    const res = await kit.get(`${MEDIA}/config`, cookie).expect(200);
    expect(res.body.data.allowedTypes).toContain('image/jpeg');
    expect(res.body.data.maxBytes).toBeGreaterThan(0);
    await kit.get(`${MEDIA}/config`, operatorCookie).expect(403);
  });

  it('rejects a size setting above the server ceiling and applies a lower one', async () => {
    const ceilingMb = Math.floor(Number(process.env.UPLOAD_MAX_IMAGE_BYTES) / 1024 / 1024);
    const over = await putSetting('media.maxImageMegabytes', ceilingMb + 1).expect(422);
    expect(over.body.error.fields.value).toContain(`${ceilingMb} MB`);
    await putSetting('media.maxImageMegabytes', 1).expect(200);
    expect((await kit.get(`${MEDIA}/config`, cookie).expect(200)).body.data.maxBytes).toBe(1024 * 1024);
  });

  it('reads the intent lifetime from the setting', async () => {
    await putSetting('media.intentTtlMinutes', 3).expect(200);
    const before = Date.now();
    const res = await kit.write('post', `${MEDIA}/intents`, cookie, { purpose: 'tier-logo', contentType: 'image/jpeg', size: 1000 }).expect(201);
    mediaIds.push(res.body.data.mediaId);
    const lifetimeMs = new Date(res.body.data.expiresAt).getTime() - before;
    expect(lifetimeMs).toBeGreaterThan(2.9 * 60_000);
    expect(lifetimeMs).toBeLessThan(3.1 * 60_000);
  });

  it('replaces a stale queue job so a retried complete can enqueue again', async () => {
    await putSetting('media.maxImageMegabytes', 5).expect(200);
    const created = await kit.write('post', `${MEDIA}/intents`, cookie, { purpose: 'tier-logo', contentType: 'image/jpeg', size: 20_000 }).expect(201);
    const id = created.body.data.mediaId as string;
    mediaIds.push(id);
    const jpeg = await noisyJpeg(64, 64);
    await kit.http.put(`${MEDIA}/${id}/content`).set('Origin', kit.origin).set('Cookie', cookie).set('Content-Type', 'image/jpeg').send(jpeg).expect(200);

    await kit.write('post', `${MEDIA}/${id}/complete`, cookie).expect(200);
    const first = await queue.getJob(`media-${id}`);
    expect(first).toBeTruthy();

    // Simulates the API reverting after an enqueue timeout while the job already sits in Redis.
    await kit.prisma.mediaAsset.update({ where: { id }, data: { status: 'AWAITING_UPLOAD' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await kit.write('post', `${MEDIA}/${id}/complete`, cookie).expect(200);
    const second = await queue.getJob(`media-${id}`);
    expect(second!.timestamp).toBeGreaterThan(first!.timestamp);
  });
});
