import { createHash, randomInt } from 'node:crypto';
import { SSR_SECRET_HEADER, type PublicSiteConfig } from '@kamito/shared';
import type { Page } from '@playwright/test';
import { test, expect } from './support/content-fixture';
import { withContentAdmin } from './support/content-admin';

const clientIp = () => `198.18.${randomInt(1, 255)}.${randomInt(1, 255)}`;

async function fillContact(page: Page, email: string, name: string) {
  await page.getByLabel('Họ tên', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Số điện thoại (tùy chọn)', { exact: true }).fill('0900000000');
  await page.getByLabel('Đơn vị (tùy chọn)', { exact: true }).fill('CMS browser fixture');
  await page.getByLabel('Nội dung', { exact: true }).fill('Lời nhắn kiểm thử gửi từ biểu mẫu công khai.');
}

async function submitContact(page: Page) {
  const response = page.waitForResponse((candidate) => candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/vi/contact');
  await page.getByRole('button', { name: 'Gửi liên hệ', exact: true }).click();
  return response;
}

test.describe('public CMS contact form', () => {
  test('sends through the Server Action and appears in the authenticated admin inbox with an IP hash', async ({ page, request, cms }) => {
    const ip = clientIp();
    const email = cms.email();
    const name = `Liên hệ ${cms.tag}`;
    await page.setExtraHTTPHeaders({ 'x-real-ip': ip });
    await page.goto('/vi/contact');
    await fillContact(page, email, name);
    expect((await submitContact(page)).status()).toBe(200);
    await expect(page.getByRole('status')).toHaveText('Cảm ơn bạn. Lời nhắn đã được gửi.');
    const stored = await cms.db.contactMessage.findFirstOrThrow({ where: { email } });
    expect(stored.status).toBe('NEW');
    expect(stored.name).toBe(name);
    expect(stored.ipHash).toBe(createHash('sha256').update(process.env.IP_HASH_SALT!).update(':').update(ip).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(ip);
    await withContentAdmin(cms, request, async (cookie) => {
      const api = process.env.API_INTERNAL_URL!.replace(/\/+$/, '');
      const inbox = await request.get(`${api}/api/v1/admin/contact-messages?${new URLSearchParams({ q: email })}`, { headers: { Cookie: cookie } });
      expect(inbox.status()).toBe(200);
      const body = await inbox.json() as { data: Array<{ id: string; email: string; status: string }>; total: number };
      expect(body.total).toBe(1);
      expect(body.data[0]).toMatchObject({ id: stored.id, email, status: 'NEW' });
      expect(JSON.stringify(body)).not.toContain(stored.ipHash);
    });
  });

  test('silently accepts the honeypot without storing a message', async ({ page, cms }) => {
    const email = cms.email();
    await page.setExtraHTTPHeaders({ 'x-real-ip': clientIp() });
    await page.goto('/vi/contact');
    await fillContact(page, email, `Honeypot ${cms.tag}`);
    await page.locator('input[name="website"]').evaluate((element) => { (element as HTMLInputElement).value = 'spam.example'; });
    expect((await submitContact(page)).status()).toBe(200);
    await expect(page.getByRole('status')).toHaveText('Cảm ơn bạn. Lời nhắn đã được gửi.');
    expect(await cms.db.contactMessage.count({ where: { email } })).toBe(0);
  });

  test('returns uncached HTTP 429 for submissions above the configured real-IP limit', async ({ page, request, cms }) => {
    const api = process.env.API_INTERNAL_URL!.replace(/\/+$/, '');
    const configResponse = await request.get(`${api}/api/v1/public/site`, { headers: { [SSR_SECRET_HEADER]: process.env.SSR_INTERNAL_SECRET! } });
    expect(configResponse.status()).toBe(200);
    const { contactRateLimit } = ((await configResponse.json()) as { data: PublicSiteConfig }).data;
    const ip = clientIp();
    const email = cms.email();
    await page.setExtraHTTPHeaders({ 'x-real-ip': ip });
    await page.goto('/vi/contact');
    const started = Date.now();
    for (let index = 0; index < contactRateLimit.maxRequests; index++) {
      await fillContact(page, email, `Giới hạn ${cms.tag}`);
      expect((await submitContact(page)).status(), `admitted submission ${index + 1}`).toBe(200);
      await expect(page.getByRole('status')).toBeVisible();
    }
    expect(Date.now() - started, 'The probe must stay in one configured window').toBeLessThan(contactRateLimit.windowSeconds * 1000);
    const blocked = await request.post('/vi/contact', { headers: { 'x-real-ip': ip }, form: { email, message: 'Rate limit probe' } });
    expect(blocked.status()).toBe(429);
    expect(blocked.headers()['cache-control']).toBe('no-store');
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
    expect(Number(blocked.headers()['retry-after'])).toBeLessThanOrEqual(contactRateLimit.windowSeconds);
    expect(await cms.db.contactMessage.count({ where: { email } })).toBe(contactRateLimit.maxRequests);
  });
});
