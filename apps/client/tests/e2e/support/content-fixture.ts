import { randomUUID } from 'node:crypto';
import { REVALIDATE_SECRET_HEADER, contentSettings, resolveAppSetting } from '@kamito/shared';
import type { Prisma, PrismaClient } from '../../../../../packages/db/dist/index.js';
import { test as base, expect } from './fixtures';

const CMS_TAGS = ['articles', 'videos', 'pages', 'sponsors', 'home', 'settings'];
const CONFIRMED_TARGET = 'localhost:5433/kamito_tt_dev';

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required for CMS browser fixtures');
  const url = new URL(raw);
  const target = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (target !== CONFIRMED_TARGET || process.env.MIGRATE_CONFIRM_TARGET !== target) {
    throw new Error(`CMS browser fixtures require explicit confirmation of ${CONFIRMED_TARGET}`);
  }
  return raw;
}

export class ContentWorld {
  readonly tag = `cms-${randomUUID()}`;
  readonly articleSlug = `${this.tag}-news`;
  readonly draftArticleSlug = `${this.tag}-draft`;
  readonly videoSlug = `${this.tag}-video`;
  readonly draftVideoSlug = `${this.tag}-draft-video`;
  readonly pageSlug = `${this.tag}-page`;
  readonly draftPageSlug = `${this.tag}-draft-page`;
  readonly title = `Tin CMS ${this.tag}`;
  readonly titleEn = `CMS news ${this.tag}`;
  readonly videoTitle = `Video CMS ${this.tag}`;
  readonly pageTitle = `Thông tin CMS ${this.tag}`;
  readonly pageTitleEn = `CMS information ${this.tag}`;
  readonly articleIds: string[] = [];
  readonly videoIds: string[] = [];
  readonly pageIds: string[] = [];
  private readonly emails = new Set<string>();

  private constructor(readonly db: PrismaClient) {}

  static async create(): Promise<ContentWorld> {
    // Importing or listing tests must never open a database connection.
    const connectionString = databaseUrl();
    const { createPrismaClient } = await import('../../../../../packages/db/dist/index.js');
    const world = new ContentWorld(createPrismaClient({ connectionString }));
    try {
      await world.seed();
      await world.refresh();
      return world;
    } catch (error) {
      await world.close();
      throw error;
    }
  }

  email(): string {
    const email = `${this.tag}-${randomUUID()}@test.kamito.local`;
    this.emails.add(email);
    return email;
  }

  async refresh(tags = CMS_TAGS): Promise<void> {
    const response = await fetch(`${process.env.E2E_SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { [REVALIDATE_SECRET_HEADER]: process.env.REVALIDATE_SECRET!, 'content-type': 'application/json' },
      body: JSON.stringify({ tags }),
    });
    expect(response.status, 'CMS fixture cache invalidation must succeed').toBe(200);
  }

  async pageSize(): Promise<number> {
    const row = await this.db.appSetting.findUnique({ where: { key: contentSettings.newsPageSize.key } });
    return resolveAppSetting(contentSettings.newsPageSize, row?.value);
  }

  async listingPage(kind: 'article' | 'video'): Promise<number> {
    const slug = kind === 'article' ? this.articleSlug : this.videoSlug;
    const row = kind === 'article'
      ? await this.db.article.findUniqueOrThrow({ where: { slug }, select: { id: true, publishedAt: true } })
      : await this.db.video.findUniqueOrThrow({ where: { slug }, select: { id: true, publishedAt: true } });
    const where = { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() }, OR: [
      { publishedAt: { gt: row.publishedAt! } }, { publishedAt: row.publishedAt!, id: { lt: row.id } },
    ] };
    const ahead = kind === 'article' ? await this.db.article.count({ where }) : await this.db.video.count({ where });
    return Math.floor(ahead / await this.pageSize()) + 1;
  }

  async addPagedArticles(): Promise<string> {
    const size = await this.pageSize();
    // Extra records belong to this fixture and fit the configured safety cap (at most 50).
    for (let index = 0; index <= size; index++) {
      const row = await this.db.article.create({ data: {
        slug: `${this.tag}-page-${index}`, title: `Trang ${index} ${this.tag}`, body: '<p>Pagination fixture</p>',
        status: 'PUBLISHED', publishedAt: new Date(Date.now() - index * 1000),
      } });
      this.articleIds.push(row.id);
    }
    await this.refresh(['articles']);
    return `${this.tag}-page-${size}`;
  }

  private async seed(): Promise<void> {
    for (const status of ['PUBLISHED', 'DRAFT'] as const) {
      const article = await this.db.article.create({ data: {
        slug: status === 'PUBLISHED' ? this.articleSlug : this.draftArticleSlug,
        title: this.title, titleEn: this.titleEn, summary: `Sapo ${this.tag}`, summaryEn: `Summary ${this.tag}`,
        body: `<h2>Nội dung ${this.tag}</h2><p>Văn bản an toàn</p><script>window.cmsXss=1</script><a href="javascript:alert(1)">Unsafe link</a>`,
        bodyEn: `<h2>Content ${this.tag}</h2><p>English body</p>`,
        status, isFeatured: true, publishedAt: status === 'PUBLISHED' ? new Date() : null,
      } });
      this.articleIds.push(article.id);
      const video = await this.db.video.create({ data: {
        slug: status === 'PUBLISHED' ? this.videoSlug : this.draftVideoSlug,
        title: this.videoTitle, titleEn: `CMS video ${this.tag}`,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', provider: 'youtube', embedId: 'dQw4w9WgXcQ',
        status, isFeatured: true, publishedAt: status === 'PUBLISHED' ? new Date() : null,
      } });
      this.videoIds.push(video.id);
      const page = await this.db.staticPage.create({ data: {
        slug: status === 'PUBLISHED' ? this.pageSlug : this.draftPageSlug,
        title: this.pageTitle, titleEn: this.pageTitleEn, body: `<p>Nội dung trang ${this.tag}</p><img src=x onerror=alert(1)>`,
        bodyEn: `<p>English page ${this.tag}</p>`, status, footerGroup: this.tag, footerOrder: 0,
      } });
      this.pageIds.push(page.id);
    }
  }

  async close(): Promise<void> {
    try {
      await this.db.contactMessage.deleteMany({ where: { email: { in: [...this.emails] } } });
      await this.db.article.deleteMany({ where: { id: { in: this.articleIds } } });
      await this.db.video.deleteMany({ where: { id: { in: this.videoIds } } });
      await this.db.staticPage.deleteMany({ where: { id: { in: this.pageIds } } });
      await this.refresh();
    } finally {
      await this.db.$disconnect();
    }
  }
}

export const test = base.extend<object, { cms: ContentWorld }>({
  cms: [async ({}, use) => {
    const world = await ContentWorld.create();
    try { await use(world); } finally { await world.close(); }
  }, { scope: 'worker' }],
});

export { expect };
export type SettingJson = Prisma.InputJsonValue;
