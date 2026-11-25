import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, type SchedulingFixture } from './support/scheduling-fixtures.js';

const PROGRESS = (eventId: string) => `${API}/events/${eventId}/progress`;

describe('admin event progress (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let emptyEventId: string;
  let sf: SchedulingFixture;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
    const created = await kit
      .write('post', `${API}/events`, adminCookie, { name: `Progress ${randomUUID().slice(0, 6)}`, eventTypeId: eventType.id, startDate: '2099-06-01', endDate: '2099-06-02' })
      .expect(201);
    emptyEventId = created.body.data.id;
    sf = await createSchedulingFixture(kit, adminCookie);
  });

  afterAll(async () => {
    await sf?.cleanup();
    await kit.prisma.auditLog.deleteMany({ where: { entityId: emptyEventId } });
    await kit.prisma.event.deleteMany({ where: { id: emptyEventId } });
    await kit.close();
  });

  it('reports zeros for an empty event', async () => {
    const res = await kit.get(PROGRESS(emptyEventId), adminCookie).expect(200);
    expect(res.body.data).toEqual({
      subEvents: 0,
      entries: { confirmed: 0, subEventsReady: 0 },
      draws: { subEventsDone: 0, subEventsStarted: 0, total: 0 },
      matches: { total: 0, scheduled: 0, official: 0 },
    });
  });

  it('counts entries, draws and unscheduled matches, and follows later changes', async () => {
    const first = (await kit.get(PROGRESS(sf.fx.eventId), adminCookie).expect(200)).body.data;
    expect(first).toMatchObject({
      subEvents: 2,
      entries: { confirmed: 12, subEventsReady: 2 },
      draws: { subEventsDone: 0, subEventsStarted: 2, total: 2 },
    });
    // 8-player singles (7 matches) + 4-pair doubles (3 matches); the fixtures enable qualifying, so no draw is complete yet.
    expect(first.matches).toEqual({ total: 10, scheduled: 0, official: 0 });

    await kit.prisma.subEvent.update({ where: { id: sf.fx.subEvents.MS! }, data: { hasQualifying: false } });
    const session = await kit.prisma.eventSession.create({
      data: { eventId: sf.fx.eventId, venueId: sf.venueId, date: new Date('2099-05-01'), code: 'S01', startTime: new Date('1970-01-01T01:00:00Z') },
    });
    await kit.prisma.match.update({ where: { id: sf.singles[0]!.id }, data: { sessionId: session.id } });
    await kit.prisma.match.update({ where: { id: sf.singles[1]!.id }, data: { status: 'OFFICIAL' } });

    const second = (await kit.get(PROGRESS(sf.fx.eventId), adminCookie).expect(200)).body.data;
    expect(second.draws).toEqual({ subEventsDone: 1, subEventsStarted: 2, total: 2 });
    expect(second.matches).toEqual({ total: 10, scheduled: 2, official: 1 });
  });

  it('excludes byes and walkovers from the match totals', async () => {
    await kit.prisma.match.update({ where: { id: sf.singles[2]!.id }, data: { resultType: 'BYE' } });
    await kit.prisma.match.update({ where: { id: sf.singles[3]!.id }, data: { resultType: 'WALKOVER' } });
    const res = (await kit.get(PROGRESS(sf.fx.eventId), adminCookie).expect(200)).body.data;
    expect(res.matches.total).toBe(8);
  });

  it('lets an operator read it, 404s unknown events and rejects anonymous callers', async () => {
    await kit.get(PROGRESS(sf.fx.eventId), operatorCookie).expect(200);
    await kit.get(PROGRESS(randomUUID()), adminCookie).expect(404);
    await kit.get(PROGRESS('not-a-uuid'), adminCookie).expect(404);
    await kit.get(PROGRESS(sf.fx.eventId), '').expect(401);
  });
});
