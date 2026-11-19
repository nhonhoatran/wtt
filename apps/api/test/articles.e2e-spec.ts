import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contentSettings } from '@kamito/shared';
import { CmsTestKit } from './support/cms-test-kit.js';

describe('CMS articles (real Postgres + Redis)', () => {
  let cms: CmsTestKit;
  beforeAll(async () => { cms = await CmsTestKit.start(); }, 90_000);
  afterAll(async () => { if (cms) await cms.close(); }, 60_000);

  const body = (label: string) => ({ slug: `${label}-${cms.tag}`, title: `${label} ${cms.tag}`, body: '<p>Article body</p>' });

  it('creates a bilingual draft, sanitizes both bodies, and publishes without exposing draft event slugs', async () => {
    const publishedEvent = await cms.event();
    const draftEvent = await cms.event('DRAFT');
    const payload = { ...body('sanitized'), titleEn: 'English title', summary: 'Vietnamese summary', summaryEn: 'English summary',
      body: '<p>Safe <strong>news</strong></p><script>alert(1)</script><img src="https://cdn.example/news.webp" onerror="alert(1)">',
      bodyEn: '<p>English</p><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">link</a>', eventIds: [publishedEvent.id, draftEvent.id] };
    const article = await cms.create('articles', payload);
    const stored = await cms.kit.prisma.article.findUniqueOrThrow({ where: { id: article.id } });
    expect(stored.body).toContain('<strong>news</strong>');
    expect(stored.body + stored.bodyEn).not.toMatch(/script|onerror|iframe|javascript:/i);
    expect((await cms.publicGet(`articles/${payload.slug}`).expect(200)).body.data).toBeNull();
    const published = await cms.write('patch', `articles/${article.id}`, { ...payload, status: 'PUBLISHED' }).expect(200);
    expect(published.body.data.publishedAt).toBeTruthy();
    const detail = (await cms.publicGet(`articles/${payload.slug}`).expect(200)).body.data;
    expect(detail).toMatchObject({ titleEn: 'English title', summaryEn: 'English summary', eventSlugs: [publishedEvent.slug] });
    expect(detail).not.toHaveProperty('id');
    expect(detail).not.toHaveProperty('events');
    const firstPublication = published.body.data.publishedAt;
    const edited = await cms.write('patch', `articles/${article.id}`, { ...payload, status: 'PUBLISHED', title: 'Edited' }).expect(200);
    expect(edited.body.data.publishedAt).toBe(firstPublication);
    await cms.write('patch', `articles/${article.id}`, { ...payload, status: 'ARCHIVED' }).expect(200);
    expect((await cms.publicGet(`articles/${payload.slug}`).expect(200)).body.data).toBeNull();
  });

  it('filters and paginates in the server using dynamic categories and page size', async () => {
    const category = `category-${cms.tag}`;
    await cms.setting(contentSettings.newsCategories.key, [category]);
    await cms.setting(contentSettings.newsPageSize.key, 1);
    for (const label of ['page-a', 'page-b']) await cms.create('articles', { ...body(label), category, status: 'PUBLISHED' });
    await cms.create('articles', { ...body('draft'), category });
    const first = (await cms.publicGet(`articles?category=${category}&page=1`).expect(200)).body.data;
    const second = (await cms.publicGet(`articles?category=${category}&page=2`).expect(200)).body.data;
    expect(first).toMatchObject({ total: 2, page: 1, pageSize: 1, categories: [category] });
    expect(first.data).toHaveLength(1);
    expect(second.data).toHaveLength(1);
    expect(first.data[0].slug).not.toBe(second.data[0].slug);
    const rejected = await cms.write('post', 'articles', { ...body('bad-category'), category: 'not-configured' }).expect(400);
    expect(rejected.body.error.fields).toHaveProperty('category');
  });

  it('provides admin list/detail/update/delete and denies all content access to results operators', async () => {
    const payload = body('crud');
    const article = await cms.create('articles', payload);
    const list = await cms.get(`articles?q=${cms.tag}&sort=title:asc&pageSize=1&page=1`).expect(200);
    expect(list.body).toMatchObject({ pageSize: 1, page: 1 });
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    expect((await cms.get(`articles/${article.id}`).expect(200)).body.data.slug).toBe(payload.slug);
    await cms.get('articles', cms.operator).expect(403);
    await cms.get(`articles/${article.id}`, cms.operator).expect(403);
    await cms.write('post', 'articles', payload, cms.operator).expect(403);
    await cms.write('patch', `articles/${article.id}`, payload, cms.operator).expect(403);
    await cms.write('delete', `articles/${article.id}`, {}, cms.operator).expect(403);
    await cms.write('delete', `articles/${article.id}`).expect(200);
    expect(await cms.kit.prisma.article.count({ where: { id: article.id } })).toBe(0);
  });

  it('rejects a scheduled article without a future publish time and hides future publication dates', async () => {
    const missingTime = await cms.write('post', 'articles', { ...body('missing-time'), status: 'SCHEDULED' }).expect(422);
    expect(missingTime.body.error.fields).toHaveProperty('publishAt');
    await cms.write('post', 'articles', { ...body('past-time'), status: 'SCHEDULED', publishAt: '2000-01-01T00:00:00Z' }).expect(422);
    const future = await cms.create('articles', { ...body('future'), status: 'PUBLISHED' });
    await cms.kit.prisma.article.update({ where: { id: future.id }, data: { publishedAt: new Date(Date.now() + 3_600_000) } });
    expect((await cms.publicGet(`articles/${future.slug}`).expect(200)).body.data).toBeNull();
    const sitemap = (await cms.publicGet('sitemap').expect(200)).body.data;
    expect(sitemap.articles.some((row: { slug: string }) => row.slug === future.slug)).toBe(false);
  });
});
