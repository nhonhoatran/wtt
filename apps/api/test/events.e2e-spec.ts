import { randomUUID } from 'node:crypto';
import { todayInTimezone } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatDateOnly, parseDateOnly } from '../src/modules/events/date-only.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupFixtures, createEventFixtures, createPlayer } from './support/entries-fixtures.js';

const EVENTS = '/api/v1/admin/events';
const TZ = 'Asia/Ho_Chi_Minh';

const addDays = (day: string, days: number) => formatDateOnly(new Date(parseDateOnly(day).getTime() + days * 86_400_000));

describe('admin events (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let adminId: string;
  let eventTypeId: string;
  const tag = `E2E${randomUUID().slice(0, 6)}`;
  const createdIds: string[] = [];

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: `Giải ${tag} ${randomUUID().slice(0, 4)}`,
    eventTypeId,
    startDate: '2099-03-01',
    endDate: '2099-03-03',
    timezone: TZ,
    ...overrides,
  });

  async function createEvent(overrides: Record<string, unknown> = {}) {
    const res = await kit.write('post', EVENTS, adminCookie, body(overrides)).expect(201);
    createdIds.push(res.body.data.id);
    return res.body.data as { id: string; slug: string; [key: string]: string };
  }

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    adminId = admin.id;
    adminCookie = await kit.signIn(admin);
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    eventTypeId = (await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } })).id;
  });

  afterAll(async () => {
    await kit.prisma.auditLog.deleteMany({ where: { entity: 'Event', entityId: { in: createdIds } } });
    await kit.prisma.event.deleteMany({ where: { id: { in: createdIds } } });
    await kit.close();
  });

  it('creates with an auto slug, then rejects a duplicate slug with a suggestion', async () => {
    const name = `Giải Đơn Nam ${tag}`;
    const first = await createEvent({ name });
    expect(first).toMatchObject({ slug: `giai-don-nam-${tag.toLowerCase()}`, startDate: '2099-03-01', endDate: '2099-03-03', lifecycle: 'UPCOMING' });

    const dup = await kit.write('post', EVENTS, adminCookie, body({ name })).expect(422);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');
    expect(dup.body.error.fields.slug).toContain(`${first.slug}-2`);

    const probe = await kit.get(`${EVENTS}/slug-available?slug=${first.slug}`, adminCookie).expect(200);
    expect(probe.body.data).toEqual({ available: false, suggestion: `${first.slug}-2` });
    const own = await kit.get(`${EVENTS}/slug-available?slug=${first.slug}&excludeId=${first.id}`, adminCookie).expect(200);
    expect(own.body.data.available).toBe(true);
    await kit.get(`${EVENTS}/slug-available?slug=Bad Slug`, adminCookie).expect(422);
  });

  it('rejects unsafe ticket URLs, reversed dates and unusable references', async () => {
    for (const ticketUrl of ['javascript:alert(1)', 'http://x.test']) {
      const res = await kit.write('post', EVENTS, adminCookie, body({ ticketUrl })).expect(422);
      expect(res.body.error.fields).toHaveProperty('ticketUrl');
    }
    const dates = await kit.write('post', EVENTS, adminCookie, body({ startDate: '2099-03-05', endDate: '2099-03-01' })).expect(422);
    expect(dates.body.error.fields).toHaveProperty('endDate');
    const badType = await kit.write('post', EVENTS, adminCookie, body({ eventTypeId: randomUUID() })).expect(422);
    expect(badType.body.error.fields).toHaveProperty('eventTypeId');
    const badBanner = await kit.write('post', EVENTS, adminCookie, body({ bannerMediaId: randomUUID() })).expect(422);
    expect(badBanner.body.error.fields).toHaveProperty('bannerMediaId');
    const badTz = await kit.write('post', EVENTS, adminCookie, body({ timezone: 'Mars/Base' })).expect(422);
    expect(badTz.body.error.fields).toHaveProperty('timezone');
  });

  it('stores sanitized rich text and patches fields', async () => {
    const event = await createEvent({ infoBody: '<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>' });
    expect(event.infoBody).toBe('<p>Hi</p>');
    const res = await kit
      .write('patch', `${EVENTS}/${event.id}`, adminCookie, { city: ' Hà Nội ', ticketUrl: 'https://tickets.test/e', infoBodyEn: '<iframe src="https://e.test"></iframe>' })
      .expect(200);
    expect(res.body.data).toMatchObject({ city: 'Hà Nội', ticketUrl: 'https://tickets.test/e', infoBodyEn: null });
    await kit.write('patch', `${EVENTS}/${event.id}`, adminCookie, { endDate: '2099-02-01' }).expect(422);
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: event.id, action: 'event.update' } });
    expect(audit).toMatchObject({ actorId: adminId, after: { city: 'Hà Nội' } });
  });

  it('lists with lifecycle, year and type filters, search, sort whitelist and total', async () => {
    const today = todayInTimezone(TZ);
    const ongoing = await createEvent({ name: `Dang dien ra ${tag}`, startDate: addDays(today, -1), endDate: addDays(today, 1) });
    const completed = await createEvent({ name: `Da xong ${tag}`, startDate: '2000-01-10', endDate: '2000-01-12' });
    const cancelled = await createEvent({ name: `Da huy ${tag}`, startDate: '2099-06-01', endDate: '2099-06-02' });
    await kit.write('post', `${EVENTS}/${cancelled.id}/cancel`, adminCookie).expect(200);

    const list = async (query: string) => (await kit.get(`${EVENTS}?q=${tag}&pageSize=100&${query}`, adminCookie).expect(200)).body;
    const ids = (res: { data: { id: string }[] }) => res.data.map((row) => row.id);

    expect(ids(await list('filter[lifecycle]=ONGOING'))).toEqual([ongoing.id]);
    expect(ids(await list('filter[lifecycle]=COMPLETED'))).toEqual([completed.id]);
    expect(ids(await list('filter[lifecycle]=CANCELLED'))).toEqual([cancelled.id]);
    const upcoming = await list('filter[lifecycle]=UPCOMING');
    expect(upcoming.data.every((row: { lifecycle: string }) => row.lifecycle === 'UPCOMING')).toBe(true);
    expect(ids(upcoming)).not.toContain(cancelled.id);
    expect(ids(await list('filter[year]=2000'))).toEqual([completed.id]);
    expect((await list(`filter[eventTypeId]=${eventTypeId}`)).total).toBe(createdIds.length);
    expect((await list(`filter[eventTypeId]=${randomUUID()}`)).total).toBe(0);
    expect((await list('sort=name:asc')).data[0]).not.toHaveProperty('infoBody');

    const byDate = (await list('')).data.map((row: { startDate: string }) => row.startDate);
    expect(byDate).toEqual([...byDate].sort().reverse());
    await kit.get(`${EVENTS}?sort=infoBody:asc`, adminCookie).expect(400);
    await kit.get(`${EVENTS}?filter[lifecycle]=SOON`, adminCookie).expect(400);
    await kit.get(`${EVENTS}?filter[bogus]=1`, adminCookie).expect(400);
  });

  it('counts events per lifecycle with the list filters, and adds a confirmed entry count to list rows', async () => {
    const today = todayInTimezone(TZ);
    const ongoing = await createEvent({ name: `${tag} cnt dang dien ra`, startDate: addDays(today, -1), endDate: addDays(today, 1) });
    const done = await createEvent({ name: `${tag} cnt da xong`, startDate: '2001-01-10', endDate: '2001-01-12' });
    const cancelled = await createEvent({ name: `${tag} cnt da huy`, startDate: '2099-07-01', endDate: '2099-07-02' });
    await kit.write('post', `${EVENTS}/${cancelled.id}/cancel`, adminCookie).expect(200);
    await kit.write('post', `${EVENTS}/${ongoing.id}/publish`, adminCookie).expect(200);

    const counts = async (query = '') => (await kit.get(`${EVENTS}/lifecycle-counts?q=${tag} cnt${query}`, adminCookie).expect(200)).body.data;
    const all = await counts();
    expect(all.ALL).toBe(3);
    expect(all.UPCOMING + all.ONGOING + all.COMPLETED + all.CANCELLED).toBe(all.ALL);
    expect(all).toMatchObject({ ONGOING: 1, COMPLETED: 1, CANCELLED: 1 });
    expect(await counts('&filter[year]=2001')).toEqual({ ALL: 1, UPCOMING: 0, ONGOING: 0, COMPLETED: 1, CANCELLED: 0 });
    expect((await counts('&filter[publishStatus]=PUBLISHED')).ALL).toBe(1);
    const list = (await kit.get(`${EVENTS}?q=${tag} cnt&pageSize=100&filter[lifecycle]=ONGOING`, adminCookie).expect(200)).body;
    expect(list.total).toBe(all.ONGOING);

    await kit.get(`${EVENTS}/lifecycle-counts?filter[lifecycle]=ONGOING`, adminCookie).expect(400);
    await kit.get(`${EVENTS}/lifecycle-counts?filter[year]=20x1`, adminCookie).expect(400);
    await kit.get(`${EVENTS}/lifecycle-counts`, operatorCookie).expect(200);

    const row = (await kit.get(`${EVENTS}?q=${tag} cnt&pageSize=100`, adminCookie).expect(200)).body.data.find((item: { id: string }) => item.id === done.id);
    expect(row.entryCount).toBe(0);
  });

  it('counts only CONFIRMED entries across all sub-events in entryCount', async () => {
    const fx = await createEventFixtures(kit, adminCookie, ['MS', 'WS']);
    try {
      const entryIds: string[] = [];
      for (const [label, code] of [['a', 'MS'], ['b', 'MS'], ['c', 'WS']] as const) {
        const player = await createPlayer(kit, adminCookie, fx, { fullName: `Cnt ${label} ${fx.tag}`, gender: code === 'MS' ? 'MALE' : 'FEMALE' });
        const competitor = await kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
        entryIds.push((await kit.prisma.entry.create({ data: { subEventId: fx.subEvents[code]!, competitorId: competitor.id } })).id);
      }
      const countFor = async () => {
        const res = await kit.get(`${EVENTS}?q=Entries ${fx.tag}&pageSize=100`, adminCookie).expect(200);
        return res.body.data.find((row: { id: string }) => row.id === fx.eventId).entryCount;
      };
      expect(await countFor()).toBe(3);
      await kit.prisma.entry.update({ where: { id: entryIds[1]! }, data: { status: 'WITHDRAWN' } });
      expect(await countFor()).toBe(2);
    } finally {
      await cleanupFixtures(kit, fx);
    }
  });

  it('publishes, cancels and guards deletion', async () => {
    const event = await createEvent();
    const published = await kit.write('post', `${EVENTS}/${event.id}/publish`, adminCookie).expect(200);
    expect(published.body.data).toMatchObject({ publishStatus: 'PUBLISHED' });
    expect(published.body.data.publishedAt).toBeTruthy();
    await kit.write('delete', `${EVENTS}/${event.id}`, adminCookie).expect(409);

    const unpublished = await kit.write('post', `${EVENTS}/${event.id}/unpublish`, adminCookie).expect(200);
    expect(unpublished.body.data).toMatchObject({ publishStatus: 'DRAFT', publishedAt: null });
    const cancelled = await kit.write('post', `${EVENTS}/${event.id}/cancel`, adminCookie).expect(200);
    expect(cancelled.body.data).toMatchObject({ isCancelled: true, lifecycle: 'CANCELLED' });
    expect((await kit.write('post', `${EVENTS}/${event.id}/uncancel`, adminCookie).expect(200)).body.data.lifecycle).toBe('UPCOMING');
    expect((await kit.get(`${EVENTS}/${event.id}`, adminCookie).expect(200)).body.data._count.subEvents).toBe(0);

    const discipline = await kit.prisma.discipline.findFirstOrThrow({ where: { isActive: true } });
    const matchFormat = await kit.prisma.matchFormat.findFirstOrThrow({ where: { isDefault: true } });
    await kit.prisma.subEvent.create({
      data: { eventId: event.id, disciplineId: discipline.id, code: discipline.code, format: 'KNOCKOUT', matchFormatId: matchFormat.id },
    });
    const inUse = await kit.write('delete', `${EVENTS}/${event.id}`, adminCookie).expect(409);
    expect(inUse.body.error).toMatchObject({ code: 'IN_USE', dependants: { subEvents: 1 } });

    const fresh = await createEvent();
    await kit.write('delete', `${EVENTS}/${fresh.id}`, adminCookie).expect(200);
    await kit.get(`${EVENTS}/${fresh.id}`, adminCookie).expect(404);
    await kit.get(`${EVENTS}/not-a-uuid`, adminCookie).expect(404);
  });

  it('serves form defaults: timezone setting and the last event type created by the user', async () => {
    await createEvent();
    const res = await kit.get(`${EVENTS}/defaults`, adminCookie).expect(200);
    expect(res.body.data).toEqual({ timezone: expect.any(String), defaultDurationDays: expect.any(Number), lastEventTypeId: eventTypeId });
  });

  it('lets RESULTS_OPERATOR read but not write', async () => {
    await kit.get(EVENTS, operatorCookie).expect(200);
    await kit.get(`${EVENTS}/${createdIds[0]}`, operatorCookie).expect(200);
    await kit.write('post', EVENTS, operatorCookie, body()).expect(403);
    await kit.write('patch', `${EVENTS}/${createdIds[0]}`, operatorCookie, { city: 'x' }).expect(403);
    await kit.write('post', `${EVENTS}/${createdIds[0]}/publish`, operatorCookie).expect(403);
    await kit.write('delete', `${EVENTS}/${createdIds[0]}`, operatorCookie).expect(403);
  });
});
