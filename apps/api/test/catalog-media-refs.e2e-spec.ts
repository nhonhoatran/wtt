import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { deleteMedia } from './support/media-test-kit.js';

const API = '/api/v1/admin';

describe('catalog image references (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let adminId: string;
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  const mediaIds: string[] = [];
  const tierIds: string[] = [];

  const asset = async (status: 'READY' | 'AWAITING_UPLOAD' | 'FAILED') => {
    const row = await kit.prisma.mediaAsset.create({
      data: {
        purpose: 'tier-logo',
        incomingKey: `incoming/tier-logo/${randomUUID()}`,
        declaredMime: 'image/jpeg',
        declaredSize: 1000,
        status,
        createdById: adminId,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    mediaIds.push(row.id);
    return row.id;
  };
  const tierBody = (extra: object) => ({ code: `MR${suffix}${tierIds.length}`, name: `Tier ${suffix}`, colorHex: '#112233', ...extra });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    adminId = admin.id;
    cookie = await kit.signIn(admin);
  });

  afterAll(async () => {
    await kit.prisma.tier.deleteMany({ where: { id: { in: tierIds } } });
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: tierIds } } });
    await deleteMedia(kit.prisma, mediaIds);
    await kit.close();
  });

  it('accepts only READY media for tier logos and backgrounds', async () => {
    for (const status of ['AWAITING_UPLOAD', 'FAILED'] as const) {
      const res = await kit.write('post', `${API}/tiers`, cookie, tierBody({ logoMediaId: await asset(status) })).expect(422);
      expect(res.body.error.fields).toHaveProperty('logoMediaId');
    }
    const bg = await kit.write('post', `${API}/tiers`, cookie, tierBody({ backgroundMediaId: await asset('AWAITING_UPLOAD') })).expect(422);
    expect(bg.body.error.fields).toHaveProperty('backgroundMediaId');

    const ok = await kit.write('post', `${API}/tiers`, cookie, tierBody({ logoMediaId: await asset('READY') })).expect(201);
    tierIds.push(ok.body.data.id);
  });

  it('rejects an unknown media id on event types too', async () => {
    const tier = tierIds[0]!;
    const res = await kit
      .write('post', `${API}/event-types`, cookie, { code: `ET${suffix}`, name: `Loại ${suffix}`, tierId: tier, logoMediaId: await asset('FAILED') })
      .expect(422);
    expect(res.body.error.fields).toHaveProperty('logoMediaId');
  });
});
