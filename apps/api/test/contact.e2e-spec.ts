import { createHash } from 'node:crypto';
import { contentSettings, SSR_SECRET_HEADER } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomIp } from './support/auth-test-kit.js';
import { CMS_PUBLIC, CmsTestKit } from './support/cms-test-kit.js';

describe('CMS contact API (real Postgres + Redis)', () => {
  let cms: CmsTestKit;
  beforeAll(async () => { cms = await CmsTestKit.start(); }, 90_000);
  afterAll(async () => { if (cms) await cms.close(); }, 60_000);

  function message(label: string) {
    const email = `cms-${cms.tag}-${label}@example.test`;
    cms.contactEmails.add(email);
    return { name: 'Contact sender', email, organization: `CMS ${cms.tag}`, message: 'Please send tournament information.' };
  }

  it('accepts only SSR-authenticated calls with a verified IP and validates contact fields', async () => {
    const body = message('guard');
    await cms.kit.http.post(`${CMS_PUBLIC}/contact`).send(body).expect(403);
    await cms.kit.http.post(`${CMS_PUBLIC}/contact`).set(SSR_SECRET_HEADER, 'wrong-secret').send(body).expect(403);
    await cms.kit.http.post(`${CMS_PUBLIC}/contact`).set(SSR_SECRET_HEADER, process.env.SSR_INTERNAL_SECRET!).send(body).expect(422);
    await cms.contact(body, 'not-an-ip').expect(422);
    const invalid = await cms.contact({ ...body, email: 'not-an-email' }).expect(422);
    expect(invalid.body.error.fields).toHaveProperty('email');
    expect(await cms.kit.prisma.contactMessage.count({ where: { email: body.email } })).toBe(0);
  });

  it('silently drops a honeypot without storing a message', async () => {
    const body = message('honeypot');
    const response = await cms.contact({ ...body, website: 'spam.example.test' }).expect(202);
    expect(response.body).toEqual({ data: { accepted: true } });
    expect(await cms.kit.prisma.contactMessage.count({ where: { email: body.email } })).toBe(0);
  });

  it('stores only the salted IP hash and lets only administrators search/read/archive the inbox', async () => {
    const body = message('inbox');
    await cms.contact(body).expect(202);
    const stored = await cms.kit.prisma.contactMessage.findFirstOrThrow({ where: { email: body.email } });
    const expectedHash = createHash('sha256').update(process.env.IP_HASH_SALT!).update(':').update(cms.ip).digest('hex');
    expect(stored.ipHash).toBe(expectedHash);
    expect(JSON.stringify(stored)).not.toContain(cms.ip);
    const inbox = (await cms.get(`contact-messages?q=${encodeURIComponent(body.email)}&filter[status]=NEW`).expect(200)).body;
    expect(inbox.total).toBe(1);
    expect(inbox.data[0]).toMatchObject({ id: stored.id, email: body.email, status: 'NEW' });
    expect(inbox.data[0]).not.toHaveProperty('ipHash');
    await cms.get('contact-messages', cms.operator).expect(403);
    await cms.get(`contact-messages/${stored.id}`, cms.operator).expect(403);
    await cms.write('patch', `contact-messages/${stored.id}`, { status: 'READ' }, cms.operator).expect(403);
    await cms.write('patch', `contact-messages/${stored.id}`, { status: 'READ' }).expect(200);
    expect((await cms.get(`contact-messages/${stored.id}`).expect(200)).body.data.status).toBe('READ');
    await cms.write('patch', `contact-messages/${stored.id}`, { status: 'ARCHIVED' }).expect(200);
    expect((await cms.get(`contact-messages?q=${encodeURIComponent(body.email)}&filter[status]=ARCHIVED`).expect(200)).body.total).toBe(1);
  });

  it('applies the configurable per-IP request limit and does not save rejected messages', async () => {
    await cms.setting(contentSettings.contactRateWindowSeconds.key, 60);
    await cms.setting(contentSettings.contactRateMaxRequests.key, 3);
    const ip = randomIp();
    const body = message('rate');
    for (let attempt = 0; attempt < 3; attempt++) await cms.contact(body, ip).expect(202);
    const rejected = await cms.contact(body, ip).expect(429);
    expect(rejected.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(await cms.kit.prisma.contactMessage.count({ where: { email: body.email } })).toBe(3);
    await cms.contact(message('other-ip'), randomIp()).expect(202);
  });
});
