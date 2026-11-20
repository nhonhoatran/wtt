import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appSettingRegistry, publicSiteSettings, SSR_SECRET_HEADER } from '@kamito/shared';
import { Prisma, type AppSetting } from '@kamito/db';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { PUBLIC, publicGet, sortedPaths } from './support/public-api-kit.js';

const SETTINGS = '/api/v1/admin/settings';
const MAX_REQUESTS_KEY = publicSiteSettings.rateLimitMaxRequests.key;
const SITE_SETTINGS = [appSettingRegistry.siteName, ...Object.values(publicSiteSettings)];
const SITE_SETTING_KEYS = SITE_SETTINGS.map((setting) => setting.key);

describe('public site config and sitemap API (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let secret: string;
  let savedSettings: AppSetting[] | undefined;
  const fixtures: Record<'published' | 'draft' | 'cancelled', Fixtures | undefined> = { published: undefined, draft: undefined, cancelled: undefined };
  const slugs: Record<string, string> = {};

  const site = () => publicGet(kit, secret, 'site');
  const sitemap = () => publicGet(kit, secret, 'sitemap');
  const sitemapSlugs = async () => (await sitemap().expect(200)).body.data.events.map((e: { slug: string }) => e.slug) as string[];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    // Isolate only this endpoint's settings; restore the original rows even when setup or an assertion fails.
    savedSettings = await kit.prisma.appSetting.findMany({ where: { key: { in: SITE_SETTING_KEYS } } });
    // site.name has no admin editor; the service reset also invalidates the in-process setting cache.
    for (const setting of SITE_SETTINGS) await kit.app.get(AppSettingsService).reset(setting);
    for (const key of ['published', 'draft', 'cancelled'] as const) {
      const fx = await createEventFixtures(kit, cookie, ['MS']);
      fixtures[key] = fx;
      slugs[key] = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId } })).slug;
    }
    await kit.prisma.event.update({ where: { id: fixtures.published!.eventId }, data: { publishStatus: 'PUBLISHED' } });
    await kit.prisma.event.update({ where: { id: fixtures.cancelled!.eventId }, data: { publishStatus: 'PUBLISHED', isCancelled: true } });
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    try {
      if (savedSettings) {
        const originals = savedSettings;
        await kit.prisma.$transaction(async (tx) => {
          await tx.appSetting.deleteMany({ where: { key: { in: SITE_SETTING_KEYS } } });
          for (const row of originals) await tx.appSetting.create({ data: { ...row, value: row.value === null ? Prisma.JsonNull : row.value } });
        });
      }
      for (const fx of Object.values(fixtures)) await cleanupFixtures(kit, fx);
    } finally { await kit.close(); }
  }, 60_000);

  it('serves the site name and rate limits with the whitelisted fields', async () => {
    const { data } = (await site().expect(200)).body;
    expect(sortedPaths(data)).toEqual([
      'contactRateLimit', 'contactRateLimit.maxRequests', 'contactRateLimit.windowSeconds',
      'rateLimit', 'rateLimit.maxRequests', 'rateLimit.maxTrackedIps', 'rateLimit.searchMaxRequests', 'rateLimit.windowSeconds', 'siteName', 'siteName.en', 'siteName.vi',
    ]);
  });

  it('returns the setting defaults when nothing is overridden', async () => {
    const { data } = (await site().expect(200)).body;
    expect(data.siteName).toEqual(appSettingRegistry.siteName.defaultValue);
    expect(data.rateLimit).toEqual({
      windowSeconds: publicSiteSettings.rateLimitWindowSeconds.defaultValue,
      maxRequests: publicSiteSettings.rateLimitMaxRequests.defaultValue,
      searchMaxRequests: publicSiteSettings.rateLimitSearchMaxRequests.defaultValue,
      maxTrackedIps: publicSiteSettings.rateLimitMaxTrackedIps.defaultValue,
    });
  });

  it('reflects a /settings change and falls back to the default after reset', async () => {
    const original = publicSiteSettings.rateLimitMaxRequests.defaultValue;
    await kit.write('put', `${SETTINGS}/${MAX_REQUESTS_KEY}`, cookie, { value: original + 1 }).expect(200);
    try {
      expect((await site().expect(200)).body.data.rateLimit.maxRequests).toBe(original + 1);
    } finally {
      await kit.write('delete', `${SETTINGS}/${MAX_REQUESTS_KEY}`, cookie).expect(200);
    }
    expect((await site().expect(200)).body.data.rateLimit.maxRequests).toBe(original);
  });

  it('lists only published, non-cancelled events in the sitemap, with ISO updatedAt', async () => {
    const { data } = (await sitemap().expect(200)).body;
    expect(Object.keys(data).sort()).toEqual(['articles', 'events', 'matches', 'pages', 'videos']);
    const listed = await sitemapSlugs();
    expect(listed).toContain(slugs.published);
    expect(listed).not.toContain(slugs.draft);
    expect(listed).not.toContain(slugs.cancelled);
    const entry = data.events.find((e: { slug: string }) => e.slug === slugs.published);
    expect(sortedPaths(entry)).toEqual([
      'slug', 'subEvents', 'subEvents[].code', 'subEvents[].drawKinds', 'subEvents[].entryCount', 'subEvents[].hasGroups',
      'tabs', 'tabs.info', 'tabs.matches', 'updatedAt',
    ]);
    expect(new Date(entry.updatedAt).toISOString()).toBe(entry.updatedAt);
  });

  it('follows publish status changes in the sitemap', async () => {
    const id = fixtures.draft!.eventId;
    await kit.prisma.event.update({ where: { id }, data: { publishStatus: 'PUBLISHED' } });
    expect(await sitemapSlugs()).toContain(slugs.draft);
    await kit.prisma.event.update({ where: { id }, data: { publishStatus: 'DRAFT' } });
    expect(await sitemapSlugs()).not.toContain(slugs.draft);
  });

  it.each(['site', 'sitemap'])('rejects /%s without or with a wrong SSR secret', async (path) => {
    for (const header of [null, 'wrong-secret', `${secret}x`]) {
      const req = kit.http.get(`${PUBLIC}/${path}`);
      const res = await (header === null ? req : req.set(SSR_SECRET_HEADER, header));
      expect({ header, status: res.status }).toEqual({ header, status: 403 });
      expect(res.body.error?.code ?? res.body.code).toBe('SSR_ONLY');
    }
  });
});
