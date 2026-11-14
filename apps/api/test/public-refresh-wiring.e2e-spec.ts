import { randomUUID } from 'node:crypto';
import { Queue, type Job } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API, cleanupFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';

describe('public cache refresh is queued after admin writes (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let fx: Fixtures;
  let eventSlug: string;
  const tag = randomUUID().slice(0, 6);
  const startedAt = Date.now();
  const queue = new Queue('revalidate', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });

  const tagsOf = (job: Job) => job.data.tags as string[];
  // Only jobs queued by this run and carrying a slug that embeds this run's tag are ours.
  const mine = (job: Job) => job.timestamp >= startedAt && tagsOf(job).some((value) => value.toLowerCase().includes(tag.toLowerCase()));
  const ownJobs = async () => (await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed'])).filter(mine);
  const queuedTags = async (since = startedAt) => new Set((await ownJobs()).filter((job) => job.timestamp >= since).flatMap(tagsOf));
  const expectQueued = async (since: number, ...tags: string[]) => {
    const queued = await queuedTags(since);
    for (const value of tags) expect(queued.has(value), `no revalidate job with tag ${value}`).toBe(true);
  };
  const nextTick = () => new Promise((resolve) => setTimeout(resolve, 5));
  const mark = async () => {
    await nextTick();
    return Date.now();
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
  });

  afterAll(async () => {
    await Promise.all((await ownJobs()).map((job) => job.remove().catch(() => undefined)));
    await queue.close();
    await cleanupFixtures(kit, fx);
    await kit.close();
  });

  it('queues event, schedule and draw tags for event and sub-event creation without a warning', async () => {
    const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
    const created = await kit
      .write('post', `${API}/events`, admin, { name: `Wiring ${tag}`, eventTypeId: eventType.id, startDate: '2099-05-01', endDate: '2099-05-02' })
      .expect(201);
    expect(created.body.warnings).toBeUndefined();
    const eventId = created.body.data.id as string;
    eventSlug = created.body.data.slug as string;
    fx = { eventId, subEvents: {}, playerIds: [], tag };

    const disciplines = await kit.prisma.discipline.findMany({ where: { code: { in: ['MS', 'WS'] } }, select: { id: true, code: true } });
    const bulk = await kit
      .write('post', `${API}/events/${eventId}/sub-events/bulk`, admin, {
        items: disciplines.map((row) => ({ disciplineId: row.id })),
        defaults: { format: 'KNOCKOUT', hasQualifying: true },
      })
      .expect(201);
    expect(bulk.body.warnings).toBeUndefined();
    fx.subEvents = Object.fromEntries((bulk.body.data as { id: string; code: string }[]).map((row) => [row.code, row.id]));

    const jobs = await ownJobs();
    expect(jobs.some((job) => tagsOf(job).includes('events') && tagsOf(job).includes(`event-${eventSlug}`) && tagsOf(job).includes(`schedule-${eventSlug}`))).toBe(true);
    await expectQueued(startedAt, `draw-${eventSlug}-MS`, `groups-${eventSlug}-MS`, `draw-${eventSlug}-WS`);
  });

  it('queues the sub-event tags for a sub-event edit and delete', async () => {
    const since = await mark();
    const edited = await kit.write('patch', `${API}/events/${fx.eventId}/sub-events/${fx.subEvents.WS}`, admin, { name: `Nu ${tag}` }).expect(200);
    expect(edited.body.warnings).toBeUndefined();
    await expectQueued(since, `event-${eventSlug}`, `schedule-${eventSlug}`, `draw-${eventSlug}-WS`);

    const afterEdit = await mark();
    const removed = await kit.write('delete', `${API}/events/${fx.eventId}/sub-events/${fx.subEvents.WS}`, admin).expect(200);
    expect(removed.body.warnings).toBeUndefined();
    await expectQueued(afterEdit, `groups-${eventSlug}-WS`);
    delete fx.subEvents.WS;
  });

  it('queues the player, event and draw tags for entry writes and a player rename', async () => {
    const player = await createPlayer(kit, admin, fx, { fullName: `Lam Moi ${tag}`, gender: 'MALE' });
    await expectQueued(startedAt, 'players', `player-${player.slug}`);

    const entry = await kit.write('post', `${API}/sub-events/${fx.subEvents.MS}/entries`, admin, { playerIds: [player.id] }).expect(201);
    expect(entry.body.warnings ?? []).toEqual([]);
    await expectQueued(startedAt, `event-${eventSlug}`, `draw-${eventSlug}-MS`);

    const since = await mark();
    const renamed = await kit.write('patch', `${API}/players/${player.id}`, admin, { fullName: `Lam Doi Ten ${tag}` }).expect(200);
    expect(renamed.body.warnings).toBeUndefined();
    await expectQueued(since, `event-${eventSlug}`, `draw-${eventSlug}-MS`, `groups-${eventSlug}-MS`, `schedule-${eventSlug}`, `player-${player.slug}`);
  });

  it('refreshes event pages when the club or the public display name changes, but not for a private field', async () => {
    const player = await createPlayer(kit, admin, fx, { fullName: `Cau Lac Bo ${tag}`, gender: 'MALE' });
    await kit.write('post', `${API}/sub-events/${fx.subEvents.MS}/entries`, admin, { playerIds: [player.id] }).expect(201);

    const club = await mark();
    await kit.write('patch', `${API}/players/${player.id}`, admin, { club: `CLB ${tag}` }).expect(200);
    await expectQueued(club, `draw-${eventSlug}-MS`, `schedule-${eventSlug}`, `player-${player.slug}`);

    const display = await mark();
    await kit.write('patch', `${API}/players/${player.id}`, admin, { publicDisplayName: `An Danh ${tag}` }).expect(200);
    await expectQueued(display, `draw-${eventSlug}-MS`, `schedule-${eventSlug}`);

    const privateField = await mark();
    await kit.write('patch', `${API}/players/${player.id}`, admin, { phone: '0901234567' }).expect(200);
    const queued = await queuedTags(privateField);
    expect(queued.has(`player-${player.slug}`)).toBe(true);
    expect(queued.has(`draw-${eventSlug}-MS`)).toBe(false);
  });

  it('queues players, both profiles and the entered events after a merge', async () => {
    const target = await createPlayer(kit, admin, fx, { fullName: `Gop Dich ${tag}`, gender: 'MALE' });
    const source = await createPlayer(kit, admin, fx, { fullName: `Gop Nguon ${tag}`, gender: 'MALE' });
    await kit.write('post', `${API}/sub-events/${fx.subEvents.MS}/entries`, admin, { playerIds: [source.id] }).expect(201);
    const user = await kit.createUser({ role: 'ADMIN' });
    const cookie = await kit.signIn(user);
    await kit.write('post', '/api/v1/auth/step-up', cookie, { password: user.password }).expect(200);

    const since = await mark();
    const merged = await kit.write('post', `${API}/players/merge`, cookie, { targetId: target.id, sourceId: source.id, reason: 'Trùng hồ sơ kiểm thử' }).expect(200);
    expect(merged.body.warnings ?? []).not.toContain('PUBLIC_REFRESH_DELAYED');
    await expectQueued(since, 'players', `player-${target.slug}`, `player-${source.slug}`, `event-${eventSlug}`, `draw-${eventSlug}-MS`, `schedule-${eventSlug}`);
  });

  it('invalidates the results strip when an event is published and unpublished', async () => {
    const since = await mark();
    const published = await kit.write('post', `${API}/events/${fx.eventId}/publish`, admin).expect(200);
    expect(published.body.warnings).toBeUndefined();
    await expectQueued(since, 'results-strip', `event-${eventSlug}`);
    const afterPublish = await mark();
    await kit.write('post', `${API}/events/${fx.eventId}/unpublish`, admin).expect(200);
    await expectQueued(afterPublish, 'results-strip');
  });

  it('invalidates both the old and the new slug when a draft event is renamed', async () => {
    const newSlug = `${eventSlug}-moi`;
    const since = await mark();
    const res = await kit.write('patch', `${API}/events/${fx.eventId}`, admin, { slug: newSlug }).expect(200);
    expect(res.body.warnings).toBeUndefined();
    await expectQueued(since, `event-${eventSlug}`, `event-${newSlug}`, `schedule-${newSlug}`, `draw-${newSlug}-MS`);
  });
});
