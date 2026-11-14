import { randomUUID } from 'node:crypto';
import { Queue, type Job } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';

describe('catalog, media and ranking-list writes refresh the public pages that show them (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let adminId: string;
  const tag = randomUUID().slice(0, 6).toUpperCase();
  const lower = tag.toLowerCase();
  const queue = new Queue('revalidate', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
  const ids: Record<string, string> = {};
  let slug: string;

  const pause = () => new Promise((resolve) => setTimeout(resolve, 5));
  const queuedSince = async (since: number) => {
    const jobs: Job[] = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    return new Set(jobs.filter((job) => job.timestamp >= since).flatMap((job) => job.data.tags as string[]));
  };
  // Jobs of other runs may share the queue: assert what must be there, and that nothing of another event of ours slipped in.
  const expectTags = (tags: Set<string>, expected: string[]) => {
    for (const tag of expected) expect(tags.has(tag), tag).toBe(true);
  };
  const write = async (method: 'post' | 'patch' | 'delete', path: string, body: object = {}, status = 200) => {
    const since = await pause().then(() => Date.now());
    const res = await kit.write(method, `${API}${path}`, admin, body);
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    expect(res.body.warnings).toBeUndefined();
    return { res, tags: await queuedSince(since) };
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const user = await kit.createUser({ role: 'ADMIN' });
    adminId = user.id;
    admin = await kit.signIn(user);
    const tier = await write('post', '/tiers', { code: `T${tag}`, name: `Tier ${tag}`, colorHex: '#112233' }, 201);
    expect(tier.tags.has('events')).toBe(true);
    ids.tier = tier.res.body.data.id;
    const type = await write('post', '/event-types', { tierId: ids.tier, code: `ET${tag}`, name: `Type ${tag}` }, 201);
    expect(type.tags.has('events')).toBe(true);
    ids.type = type.res.body.data.id;
    ids.venue = (await kit.prisma.venue.create({ data: { name: `Venue ${tag}` } })).id;
    ids.media = (
      await kit.prisma.mediaAsset.create({
        data: { purpose: 'event-banner', incomingKey: `in-${tag}`, declaredMime: 'image/webp', declaredSize: 10, status: 'READY', createdById: adminId, expiresAt: new Date(Date.now() + 3_600_000) },
      })
    ).id;
    const discipline = await write('post', '/disciplines', { code: `D${tag}`, name: `Disc ${tag}`, competitorKind: 'SINGLES', genderRule: 'MEN' }, 201);
    ids.discipline = discipline.res.body.data.id;
    const category = await write('post', '/categories', { kind: 'AGE', code: `C${tag}`, name: `Cat ${tag}` }, 201);
    ids.category = category.res.body.data.id;
    const event = await kit.write('post', `${API}/events`, admin, {
      name: `Catalog ${tag}`,
      eventTypeId: ids.type,
      venueId: ids.venue,
      bannerMediaId: ids.media,
      startDate: '2099-05-01',
      endDate: '2099-05-02',
    });
    expect(event.status, JSON.stringify(event.body)).toBe(201);
    ids.event = event.body.data.id;
    slug = event.body.data.slug;
    const sub = await kit.write('post', `${API}/events/${ids.event}/sub-events`, admin, {
      disciplineId: ids.discipline,
      categoryId: ids.category,
      format: 'KNOCKOUT',
    });
    expect(sub.status, JSON.stringify(sub.body)).toBe(201);
    ids.subEvent = sub.body.data.id;
    ids.subEventCode = sub.body.data.code;
  }, 60_000);

  afterAll(async () => {
    if (kit) {
      // Prisma treats an undefined filter as "match all": delete only what this run really created.
      const del = async (run: (id: string) => Promise<unknown>, id: string | undefined) => {
        if (id) await run(id);
      };
      const sub = ids.event ? await kit.prisma.subEvent.findMany({ where: { eventId: ids.event }, select: { id: true } }) : [];
      await del((id) => kit.prisma.subEvent.deleteMany({ where: { eventId: id } }), ids.event);
      await del((id) => kit.prisma.event.deleteMany({ where: { id } }), ids.event);
      await kit.prisma.rankingList.deleteMany({ where: { code: { in: [`R${tag}`, `R${tag}X`] } } });
      await del((id) => kit.prisma.eventType.deleteMany({ where: { id } }), ids.type);
      await del((id) => kit.prisma.tier.deleteMany({ where: { id } }), ids.tier);
      await del((id) => kit.prisma.discipline.deleteMany({ where: { id } }), ids.discipline);
      await del((id) => kit.prisma.category.deleteMany({ where: { id } }), ids.category);
      await del((id) => kit.prisma.venue.deleteMany({ where: { id } }), ids.venue);
      await del((id) => kit.prisma.mediaAsset.deleteMany({ where: { id } }), ids.media);
      const entityIds = [ids.event, ids.tier, ids.type, ids.venue, ids.discipline, ids.category, ids.media, ...sub.map((s) => s.id)].filter((id): id is string => Boolean(id));
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
      await kit.close();
    }
    const jobs: Job[] = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
    await Promise.all(jobs.filter((job) => (job.data.tags as string[]).some((t) => t.toLowerCase().includes(lower))).map((job) => job.remove().catch(() => undefined)));
    await queue.close();
  }, 60_000);

  it('refreshes the events that use a renamed venue, tier or event type', async () => {
    const venue = await write('patch', `/venues/${ids.venue}`, { name: `Venue ${tag} 2` });
    expectTags(venue.tags, ['events', `event-${slug}`]);
    const tier = await write('patch', `/tiers/${ids.tier}`, { name: `Tier ${tag} 2` });
    expectTags(tier.tags, ['events', `event-${slug}`]);
    const type = await write('patch', `/event-types/${ids.type}`, { name: `Type ${tag} 2` });
    expectTags(type.tags, ['events', `event-${slug}`]);
  });

  it('refreshes the event, draw, groups and schedule pages of sub-events that show a renamed discipline or category', async () => {
    for (const [path, id] of [['/disciplines', ids.discipline], ['/categories', ids.category]] as const) {
      const { tags } = await write('patch', `${path}/${id}`, { name: `Renamed ${tag}` });
      for (const expected of ['events', `event-${slug}`, `schedule-${slug}`, `draw-${slug}-${ids.subEventCode}`, `groups-${slug}-${ids.subEventCode}`]) {
        expect(tags.has(expected), `${path} ${expected}`).toBe(true);
      }
    }
  });

  it('refreshes the banner events when the image alt text changes', async () => {
    const { tags } = await write('patch', `/media/${ids.media}`, { altText: `Alt ${tag}` });
    expectTags(tags, ['events', `event-${slug}`]);
  });

  it('refreshes rankings and the old and new list code, on create, update and delete', async () => {
    const code = `R${tag}`;
    const created = await write('post', '/ranking-lists', { code, name: `List ${tag}`, competitorKind: 'SINGLES', genderRule: 'MEN' }, 201);
    expectTags(created.tags, ['rankings', `ranking-${code}`]);
    const id = created.res.body.data.id as string;
    const renamed = await write('patch', `/ranking-lists/${id}`, { code: `${code}X`, name: `List ${tag} 2` });
    expectTags(renamed.tags, ['rankings', `ranking-${code}`, `ranking-${code}X`]);
    const removed = await write('delete', `/ranking-lists/${id}`);
    expectTags(removed.tags, ['rankings', `ranking-${code}X`]);
  });

  it('does not queue anything for a catalog row nobody can see yet', async () => {
    const { tags } = await write('post', '/disciplines', { code: `E${tag}`, name: `Spare ${tag}`, competitorKind: 'SINGLES', genderRule: 'MEN' }, 201);
    expect([...tags].filter((t) => t.toLowerCase().includes(lower))).toEqual([]);
    const spare = await kit.prisma.discipline.findFirstOrThrow({ where: { code: `E${tag}` } });
    await kit.prisma.discipline.delete({ where: { id: spare.id } });
  });
});
