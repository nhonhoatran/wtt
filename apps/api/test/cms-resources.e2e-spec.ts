import { contentSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CmsTestKit } from './support/cms-test-kit.js';

describe('CMS video, sponsors, and static pages (real Postgres + Redis)', () => {
  let cms: CmsTestKit;
  beforeAll(async () => { cms = await CmsTestKit.start(); }, 90_000);
  afterAll(async () => { if (cms) await cms.close(); }, 60_000);

  it('extracts a video provider on create, exposes published detail, and archives it', async () => {
    const payload = { slug: `video-${cms.tag}`, title: `Video ${cms.tag}`, titleEn: 'English video', url: 'https://youtu.be/Abcdef_1234', status: 'PUBLISHED' };
    const video = await cms.create('videos', payload);
    expect(video).toMatchObject({ provider: 'youtube', embedId: 'Abcdef_1234', url: 'https://www.youtube.com/watch?v=Abcdef_1234' });
    const detail = (await cms.publicGet(`videos/${payload.slug}`).expect(200)).body.data;
    expect(detail).toMatchObject({ slug: payload.slug, titleEn: 'English video', provider: 'youtube', embedId: 'Abcdef_1234' });
    expect(detail).not.toHaveProperty('id');
    expect((await cms.get(`videos/${video.id}`).expect(200)).body.data.id).toBe(video.id);
    await cms.write('patch', `videos/${video.id}`, { ...payload, status: 'ARCHIVED' }).expect(200);
    expect((await cms.publicGet(`videos/${payload.slug}`).expect(200)).body.data).toBeNull();
    await cms.write('delete', `videos/${video.id}`).expect(200);
  });

  it('rejects unsafe video URLs and a scheduling status without a video scheduler', async () => {
    const payload = { slug: `unsafe-video-${cms.tag}`, title: 'Invalid video' };
    for (const url of ['http://youtu.be/Abcdef_1234', 'https://youtube.com.evil.test/watch?v=Abcdef_1234', 'https://example.test/video']) {
      const invalid = await cms.write('post', 'videos', { ...payload, url }).expect(422);
      expect(invalid.body.error.fields).toHaveProperty('url');
    }
    await cms.write('post', 'videos', { ...payload, url: 'https://youtu.be/Abcdef_1234', status: 'SCHEDULED' }).expect(422);
  });

  it('reorders a sponsor with a partial PATCH and limits event-specific public sponsors to published events', async () => {
    const publishedEvent = await cms.event();
    const draftEvent = await cms.event('DRAFT');
    const site = await cms.create('sponsors', { name: `Site sponsor ${cms.tag}`, roleLabel: 'Site partner', url: 'https://example.test', order: 2 });
    const linked = await cms.create('sponsors', { name: `Event sponsor ${cms.tag}`, eventId: publishedEvent.id, roleLabel: 'Event partner', order: 7 });
    const hidden = await cms.create('sponsors', { name: `Draft sponsor ${cms.tag}`, eventId: draftEvent.id });
    const reordered = await cms.write('patch', `sponsors/${linked.id}`, { order: 1 }).expect(200);
    expect(reordered.body.data).toMatchObject({ order: 1, name: linked.name, eventId: publishedEvent.id, isActive: true });
    expect((await cms.get(`sponsors/${site.id}`).expect(200)).body.data.url).toBe('https://example.test');
    const publicList = (await cms.publicGet(`sponsors?eventSlug=${publishedEvent.slug}`).expect(200)).body.data;
    expect(publicList.map((row: { name: string }) => row.name)).toEqual(expect.arrayContaining([site.name, linked.name]));
    expect((await cms.publicGet(`sponsors?eventSlug=${draftEvent.slug}`).expect(200)).body.data.map((row: { name: string }) => row.name)).not.toContain(hidden.name);
    await cms.write('patch', `sponsors/${linked.id}`, { isActive: false }).expect(200);
    expect((await cms.publicGet(`sponsors?eventSlug=${publishedEvent.slug}`).expect(200)).body.data.map((row: { name: string }) => row.name)).not.toContain(linked.name);
    await cms.write('post', 'sponsors', { name: 'Bad sponsor', url: 'javascript:alert(1)' }).expect(422);
  });

  it('sanitizes static pages, accepts the admin footer sort, and returns only published footer pages', async () => {
    const payload = { slug: `page-${cms.tag}`, title: `Page ${cms.tag}`, titleEn: 'English page', body: '<p>About us</p><script>alert(1)</script>', bodyEn: '<p>English</p><img src="javascript:x" onerror="alert(1)">', footerGroup: `Group ${cms.tag}`, footerOrder: 3 };
    const page = await cms.create('static-pages', payload);
    expect(page.body + String(page.bodyEn)).not.toMatch(/script|onerror|javascript:/i);
    expect((await cms.publicGet(`pages/${payload.slug}`).expect(200)).body.data).toBeNull();
    await cms.write('patch', `static-pages/${page.id}`, { ...payload, status: 'PUBLISHED' }).expect(200);
    const adminList = await cms.get(`static-pages?q=${cms.tag}&sort=footerOrder:asc&pageSize=1`).expect(200);
    expect(adminList.body.data[0]).toMatchObject({ footerOrder: 3, slug: payload.slug });
    expect((await cms.get(`static-pages/${page.id}`).expect(200)).body.data.id).toBe(page.id);
    expect((await cms.publicGet(`pages/${payload.slug}`).expect(200)).body.data).toMatchObject({ titleEn: 'English page', body: '<p>About us</p>' });
    const footer = (await cms.publicGet('footer').expect(200)).body.data.pages;
    expect(footer).toContainEqual(expect.objectContaining({ slug: payload.slug, group: payload.footerGroup, order: 3 }));
    await cms.write('post', 'static-pages', { ...payload, slug: `scheduled-${cms.tag}`, status: 'SCHEDULED' }).expect(422);
    await cms.write('delete', `static-pages/${page.id}`).expect(200);
    expect((await cms.publicGet(`pages/${payload.slug}`).expect(200)).body.data).toBeNull();
  });

  it('returns 404 for missing records and forbids results operators from every CMS resource', async () => {
    for (const resource of ['articles', 'videos', 'sponsors', 'static-pages', 'contact-messages']) {
      await cms.get(`${resource}/00000000-0000-4000-8000-000000000000`).expect(404);
      await cms.get(resource, cms.operator).expect(403);
    }
    await cms.write('post', 'sponsors', { name: 'Forbidden' }, cms.operator).expect(403);
    await cms.write('post', 'videos', { slug: 'forbidden', title: 'Forbidden', url: 'https://youtu.be/Abcdef_1234' }, cms.operator).expect(403);
    await cms.write('post', 'static-pages', { slug: 'forbidden', title: 'Forbidden', body: '<p>Hidden</p>' }, cms.operator).expect(403);
  });

  it('uses the configured home section switches and guards every public content read', async () => {
    const sections = { hero: false, events: false, news: false, videos: false, rankings: false, sponsors: false };
    await cms.setting(contentSettings.homeSections.key, sections);
    const home = (await cms.publicGet('home').expect(200)).body.data;
    expect(home).toMatchObject({ sections, featuredEvents: [], upcomingEvents: [], featuredArticles: [], latestVideos: [], sponsors: [], topRankings: [] });
    for (const path of ['articles', 'videos', 'sponsors', 'footer', 'home', `pages/no-page-${cms.tag}`]) {
      await cms.kit.http.get(`/api/v1/public/${path}`).expect(403);
    }
  });
});
