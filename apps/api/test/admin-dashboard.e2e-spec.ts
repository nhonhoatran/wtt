import { todayInTimezone } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, type SchedulingFixture } from './support/scheduling-fixtures.js';

const SUMMARY = `${API}/dashboard/summary`;
const PENDING = `${API}/dashboard/pending-matches`;
const TIMEZONE = 'Asia/Ho_Chi_Minh';
const HOUR = 3_600_000;
const day = (offset: number) => new Date(new Date(`${todayInTimezone(TIMEZONE)}T00:00:00Z`).getTime() + offset * 24 * HOUR);

describe('admin dashboard (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let sf: SchedulingFixture;
  let before: { liveEvents: number; pendingToday: number; overdueToday: number; finishedToday: number; activePlayers: number };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    sf = await createSchedulingFixture(kit, adminCookie);
    before = (await kit.get(SUMMARY, adminCookie).expect(200)).body.data;
  });

  afterAll(async () => {
    await sf?.cleanup();
    await kit.close();
  });

  it('ignores events that are not ongoing today', async () => {
    const { body } = await kit.get(SUMMARY, adminCookie).expect(200);
    expect(body.data.events.some((event: { id: string }) => event.id === sf.fx.eventId)).toBe(false);
  });

  describe('with an ongoing event', () => {
    beforeAll(async () => {
      const eventId = sf.fx.eventId;
      await kit.prisma.event.update({ where: { id: eventId }, data: { timezone: TIMEZONE, startDate: day(-1), endDate: day(1) } });
      const session = await kit.prisma.eventSession.create({
        data: { eventId, venueId: sf.venueId, date: day(0), code: 'S01', startTime: new Date('1970-01-01T01:00:00Z') },
      });
      const now = Date.now();
      const place = (id: string, data: object) => kit.prisma.match.update({ where: { id }, data: { sessionId: session.id, tableId: sf.tableIds[0], ...data } });
      await place(sf.singles[0]!.id, { scheduledAt: new Date(now - 2 * HOUR) });
      await place(sf.singles[3]!.id, { scheduledAt: new Date(now - HOUR), status: 'LIVE' });
      await place(sf.singles[1]!.id, { scheduledAt: new Date(now + 3 * HOUR) });
      await place(sf.singles[2]!.id, { scheduledAt: new Date(now - 4 * HOUR), status: 'OFFICIAL' });
      await place(sf.doubles[0]!.id, { resultType: 'BYE' });
      await place(sf.doubles[1]!.id, { isVoided: true });
    });

    it('counts today by status from the database and lists the event with its progress', async () => {
      const { data } = (await kit.get(SUMMARY, adminCookie).expect(200)).body;
      expect(data.liveEvents).toBe(before.liveEvents + 1);
      expect(data.recentActivityLimit).toEqual(expect.any(Number));
      expect(data.pendingToday).toBe(before.pendingToday + 3);
      expect(data.overdueToday).toBe(before.overdueToday + 1);
      expect(data.finishedToday).toBe(before.finishedToday + 1);
      expect(data.activePlayers).toBe(before.activePlayers + 15);
      const mine = data.events.find((event: { id: string }) => event.id === sf.fx.eventId);
      expect(mine).toMatchObject({ startDate: day(-1).toISOString().slice(0, 10), matches: { total: 8, official: 1 } });
      expect(mine.eventType).toEqual({ name: expect.any(String), colorHex: null, tier: { name: expect.any(String), colorHex: expect.any(String) } });
      expect(JSON.stringify(data)).not.toMatch(/email|ipAddress/i);
    });

    it('caps the event cards with dashboard.liveEventLimit while the KPI keeps counting all', async () => {
      const key = 'dashboard.liveEventLimit';
      try {
        await kit.write('put', `${API}/settings/${key}`, adminCookie, { value: 1 }).expect(200);
        const { data } = (await kit.get(SUMMARY, adminCookie).expect(200)).body;
        expect(data.events).toHaveLength(1);
        expect(data.liveEvents).toBeGreaterThanOrEqual(1);
      } finally {
        await kit.write('delete', `${API}/settings/${key}`, adminCookie).expect(200);
      }
    });

    it('lists open matches of today, earliest first, without byes, voided or finished ones', async () => {
      const all = (await kit.get(`${PENDING}?pageSize=100`, adminCookie).expect(200)).body;
      const mine = all.data.filter((row: { eventId: string }) => row.eventId === sf.fx.eventId);
      expect(mine.map((row: { id: string }) => row.id)).toEqual([sf.singles[0]!.id, sf.singles[3]!.id, sf.singles[1]!.id]);
      expect(mine.map((row: { status: string }) => row.status)).toEqual(['SCHEDULED', 'LIVE', 'SCHEDULED']);
      expect(mine[0]).toMatchObject({
        eventName: expect.any(String),
        timezone: TIMEZONE,
        table: { code: 'T1' },
        subEvent: { code: 'MS' },
        round: { code: expect.any(String) },
        side1: { displayName: expect.any(String), players: expect.any(Array) },
      });
      expect(all.total).toBeGreaterThanOrEqual(3);
    });

    it('pages on the server', async () => {
      const first = (await kit.get(`${PENDING}?page=1&pageSize=1`, adminCookie).expect(200)).body;
      const second = (await kit.get(`${PENDING}?page=2&pageSize=1`, adminCookie).expect(200)).body;
      expect(first.data).toHaveLength(1);
      expect(second.data).toHaveLength(1);
      expect(second.data[0].id).not.toBe(first.data[0].id);
      expect(second).toMatchObject({ page: 2, pageSize: 1, total: first.total });
    });
  });

  it('rejects bad paging, anonymous callers; an operator can read both', async () => {
    await kit.get(`${PENDING}?pageSize=0`, adminCookie).expect(400);
    await kit.get(`${PENDING}?sort=scheduledAt:asc`, adminCookie).expect(400);
    await kit.get(`${PENDING}?filter[x]=1`, adminCookie).expect(400);
    await kit.get(SUMMARY, '').expect(401);
    await kit.get(PENDING, '').expect(401);
    await kit.get(SUMMARY, operatorCookie).expect(200);
    await kit.get(PENDING, operatorCookie).expect(200);
  });
});
