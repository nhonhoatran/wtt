import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@kamito/db';
import { QueueName, SSR_SECRET_HEADER } from '@kamito/shared';
import { Queue } from 'bullmq';
import { AuthTestKit, randomIp } from './auth-test-kit.js';

type Resource = 'articles' | 'videos' | 'sponsors' | 'static-pages';
type StoredSetting = { value: Prisma.JsonValue; updatedById: string | null; updatedAt: Date } | null;
export const CMS_ADMIN = '/api/v1/admin';
export const CMS_PUBLIC = '/api/v1/public';

/** All database and queue activity starts explicitly in beforeAll, never during test discovery. */
export class CmsTestKit {
  readonly tag = randomUUID().slice(0, 8);
  readonly ip = randomIp();
  readonly ids: Record<Resource, string[]> = { articles: [], videos: [], sponsors: [], 'static-pages': [] };
  readonly contactEmails = new Set<string>();
  readonly contactIps = new Set<string>();
  readonly settings = new Map<string, StoredSetting>();
  readonly jobs = new Set<string>();
  readonly eventIds: string[] = [];
  private tierId?: string;
  private eventTypeId?: string;

  private constructor(readonly kit: AuthTestKit, readonly admin: string, readonly operator: string, readonly publishing: Queue) {}

  static async start(): Promise<CmsTestKit> {
    const kit = await AuthTestKit.start();
    const admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    const operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    const publishing = new Queue(QueueName.Publishing, { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
    return new CmsTestKit(kit, admin, operator, publishing);
  }

  write(method: 'post' | 'patch' | 'delete', resource: string, body: object = {}, cookie = this.admin) {
    return this.kit.write(method, `${CMS_ADMIN}/${resource}`, cookie, body);
  }

  get(resource: string, cookie = this.admin) { return this.kit.get(`${CMS_ADMIN}/${resource}`, cookie); }
  publicGet(path: string) { return this.kit.http.get(`${CMS_PUBLIC}/${path}`).set(SSR_SECRET_HEADER, process.env.SSR_INTERNAL_SECRET!); }

  async create(resource: Resource, body: object): Promise<Record<string, unknown> & { id: string }> {
    const res = await this.write('post', resource, body).expect(201);
    const row = res.body.data as Record<string, unknown> & { id: string };
    this.ids[resource].push(row.id);
    return row;
  }

  async setting(key: string, value: Prisma.InputJsonValue): Promise<void> {
    if (!this.settings.has(key)) this.settings.set(key, await this.kit.prisma.appSetting.findUnique({ where: { key }, select: { value: true, updatedById: true, updatedAt: true } }));
    await this.kit.write('put', `${CMS_ADMIN}/settings/${encodeURIComponent(key)}`, this.admin, { value }).expect(200);
  }

  contact(body: object, ip = this.ip) {
    this.contactIps.add(ip);
    return this.kit.http.post(`${CMS_PUBLIC}/contact`).set(SSR_SECRET_HEADER, process.env.SSR_INTERNAL_SECRET!).set('x-verified-client-ip', ip).send(body);
  }

  async event(publishStatus: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED') {
    const { prisma } = this.kit;
    if (!this.tierId) {
      this.tierId = (await prisma.tier.create({ data: { code: `CMS-${this.tag}`, name: `CMS tier ${this.tag}`, colorHex: '#123456' } })).id;
      this.eventTypeId = (await prisma.eventType.create({ data: { code: `CMS-${this.tag}`, name: `CMS type ${this.tag}`, tierId: this.tierId } })).id;
    }
    const event = await prisma.event.create({ data: {
      slug: `cms-${this.tag}-${this.eventIds.length}`, name: `CMS event ${this.tag}`,
      eventTypeId: this.eventTypeId!, startDate: new Date('2099-05-01'), endDate: new Date('2099-05-02'),
      timezone: 'Asia/Ho_Chi_Minh', publishStatus,
    } });
    this.eventIds.push(event.id);
    return event;
  }

  async close(): Promise<void> {
    const { prisma } = this.kit;
    for (const jobId of this.jobs) await this.publishing.remove(jobId);
    await this.publishing.close();
    const contactIds = (await prisma.contactMessage.findMany({ where: { email: { in: [...this.contactEmails] } }, select: { id: true } })).map(({ id }) => id);
    await prisma.contactMessage.deleteMany({ where: { id: { in: contactIds } } });
    await prisma.article.deleteMany({ where: { id: { in: this.ids.articles } } });
    await prisma.video.deleteMany({ where: { id: { in: this.ids.videos } } });
    await prisma.sponsor.deleteMany({ where: { id: { in: this.ids.sponsors } } });
    await prisma.staticPage.deleteMany({ where: { id: { in: this.ids['static-pages'] } } });
    await prisma.event.deleteMany({ where: { id: { in: this.eventIds } } });
    if (this.eventTypeId) await prisma.eventType.delete({ where: { id: this.eventTypeId } });
    if (this.tierId) await prisma.tier.delete({ where: { id: this.tierId } });
    for (const [key, before] of this.settings) {
      if (!before) await prisma.appSetting.deleteMany({ where: { key } });
      else await prisma.appSetting.upsert({ where: { key }, create: { key, ...before, value: before.value as Prisma.InputJsonValue }, update: { ...before, value: before.value as Prisma.InputJsonValue } });
    }
    const ownEntities = [...Object.values(this.ids).flat(), ...this.eventIds, ...contactIds, this.tierId, this.eventTypeId].filter((id): id is string => Boolean(id));
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ownEntities } } });
    const { REDIS_CONNECTION } = await import('../../src/modules/queue/redis-connection.provider.js');
    const redis = this.kit.app.get<import('ioredis').Redis>(REDIS_CONNECTION);
    for (const ip of this.contactIps) {
      const ipHash = createHash('sha256').update(process.env.IP_HASH_SALT!).update(':').update(ip).digest('hex');
      const keys = await redis.keys(`${process.env.QUEUE_PREFIX}:contact:${ipHash}:*`);
      if (keys.length) await redis.del(...keys);
    }
    await this.kit.close();
  }
}
