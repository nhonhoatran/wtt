import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, SESSION_DATE, type SchedulingFixture } from './support/scheduling-fixtures.js';
import { openRevalidateQueue, removeOwn, tagsSince } from './support/revalidate-queue-probe.js';

describe('scheduling edge cases: swaps, caps, retiming, timezone, hidden matches (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let sf: SchedulingFixture;
  let minutes: number;
  let s1: { id: string; startsAt: string };
  let s2: { id: string };
  const tables = () => sf.tableIds;
  const sessionsUrl = () => `${API}/events/${sf.fx.eventId}/sessions`;
  const createSession = (body: object) => kit.write('post', sessionsUrl(), admin, { date: SESSION_DATE, startTime: '08:00', venueId: sf.venueId, ...body });
  const row = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const at = async (id: string) => (await row(id)).scheduledAt?.toISOString();
  const plus = (iso: string, mins: number) => new Date(Date.parse(iso) + mins * 60_000).toISOString();
  const patch = (id: string, body: object) => {
    const sent = row(id).then((m) => kit.write('patch', `${API}/matches/${id}/schedule`, admin, { expectedScheduleVersion: m.scheduleVersion, ...body }));
    return Object.assign(sent, {
      expect: async (status: number) => {
        const res = await sent;
        expect(res.status, JSON.stringify(res.body)).toBe(status);
        return res;
      },
    });
  };
  const place = (id: string, sessionId: string, tableId: string, orderInSession?: number, extra: object = {}) => patch(id, { sessionId, tableId, orderInSession, ...extra });
  const clearSchedule = () =>
    kit.prisma.match.updateMany({ where: { eventId: sf.fx.eventId }, data: { sessionId: null, tableId: null, orderInSession: null, scheduledAt: null, status: 'SCHEDULED', resultType: null, winnerSide: null, isVoided: false } });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    sf = await createSchedulingFixture(kit, admin);
    const [a, b, c] = tables();
    s1 = (await createSession({ code: 'S01', tableIds: [a, b] }).expect(201)).body.data;
    s2 = (await createSession({ code: 'S02', startTime: '14:00', tableIds: [a, c] }).expect(201)).body.data;
    const format = await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: sf.fx.subEvents.MS }, select: { matchFormat: { select: { estimatedMinutes: true } } } });
    minutes = format.matchFormat.estimatedMinutes;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await sf?.cleanup();
    await kit.close();
  }, 60_000);

  it('swaps two matches that sit in different sessions', async () => {
    const [a] = tables();
    const [x, y] = sf.singles;
    await place(x!.id, s1.id, a!, 1).expect(200);
    await place(y!.id, s2.id, a!, 1).expect(200);
    const res = await place(x!.id, s2.id, a!, 1).expect(200);
    expect(res.body.swappedMatchId).toBe(y!.id);
    expect(await row(x!.id)).toMatchObject({ sessionId: s2.id, orderInSession: 1 });
    expect(await row(y!.id)).toMatchObject({ sessionId: s1.id, orderInSession: 1 });
    expect(await at(y!.id)).toBe(s1.startsAt);
  });

  it('rejects a swap when the caller saw a different occupant, and accepts the right one', async () => {
    const [a] = tables();
    const [x, y, z] = sf.singles;
    await place(z!.id, s1.id, a!, 2).expect(200);
    const occupantNow = (await row(z!.id)).id;
    const wrong = await place(x!.id, s1.id, a!, 2, { expectedOccupantId: y!.id }).expect(409);
    expect(wrong.body.error.code).toBe('SCHEDULE_SLOT_OCCUPIED');
    const empty = await place(x!.id, s1.id, a!, 2, { expectedOccupantId: null }).expect(409);
    expect(empty.body.error.code).toBe('SCHEDULE_SLOT_OCCUPIED');
    const ok = await place(x!.id, s1.id, a!, 2, { expectedOccupantId: occupantNow }).expect(200);
    expect(ok.body.swappedMatchId).toBe(z!.id);
  });

  it('refuses an order beyond the session cap', async () => {
    const [a] = tables();
    await place(sf.singles[3]!.id, s1.id, a!, 9999).expect(422);
  });

  it('answers SESSION_FULL when the session is at its cap, but still swaps inside it', async () => {
    const [, , c] = tables();
    await kit.write('put', `${API}/settings/schedule.sessionMatchCap`, admin, { value: 50 }).expect(200);
    try {
      const full = (await createSession({ code: 'S03', tableIds: [c, tables()[0]] }).expect(201)).body.data;
      const template = await kit.prisma.match.findFirstOrThrow({ where: { eventId: sf.fx.eventId, subEventId: sf.fx.subEvents.MS } });
      await kit.prisma.match.createMany({
        data: Array.from({ length: 50 }, (_, i) => ({
          eventId: template.eventId,
          subEventId: template.subEventId,
          drawId: template.drawId,
          roundId: template.roundId,
          orderInRound: 500 + i,
          matchNo: 900_000 + i,
          sessionId: full.id,
          tableId: c,
          orderInSession: i + 1,
        })),
      });
      const blocked = await place(sf.singles[3]!.id, full.id, tables()[0]!, 1).expect(409);
      expect(blocked.body.error.code).toBe('SESSION_FULL');
      const [x] = sf.singles;
      await place(x!.id, s1.id, tables()[0]!, 1).expect(200);
      const swapped = await place(x!.id, full.id, c!, 1).expect(200);
      expect(swapped.body.swappedMatchId).not.toBeNull();
      expect(await row(x!.id)).toMatchObject({ sessionId: full.id, orderInSession: 1 });
    } finally {
      await kit.write('delete', `${API}/settings/schedule.sessionMatchCap`, admin).expect(200);
      await kit.prisma.match.deleteMany({ where: { eventId: sf.fx.eventId, matchNo: { gte: 900_000 } } });
    }
  });

  it('moves derived times when the session date changes', async () => {
    await clearSchedule();
    const [a] = tables();
    await place(sf.singles[0]!.id, s1.id, a!, 1).expect(200);
    const res = await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { date: '2099-05-02' }).expect(200);
    expect(res.body.data.startsAt).toBe('2099-05-02T01:00:00.000Z');
    expect(await at(sf.singles[0]!.id)).toBe('2099-05-02T01:00:00.000Z');
    await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { date: SESSION_DATE }).expect(200);
    expect(await at(sf.singles[0]!.id)).toBe(s1.startsAt);
  });

  it('keeps played matches at their real time, counts a settled walkover as zero minutes', async () => {
    await clearSchedule();
    const [a] = tables();
    const [x, y, z] = sf.singles;
    await place(x!.id, s1.id, a!, 1).expect(200);
    await place(y!.id, s1.id, a!, 2).expect(200);
    await place(z!.id, s1.id, a!, 3).expect(200);
    await kit.prisma.match.update({ where: { id: x!.id }, data: { status: 'OFFICIAL', resultType: 'WALKOVER', winnerSide: 1 } });
    await kit.prisma.match.update({ where: { id: y!.id }, data: { status: 'LIVE', scheduledAt: new Date(Date.parse(s1.startsAt) + 5 * 60_000) } });
    await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { startTime: '08:30' }).expect(200);
    expect(await at(x!.id)).toBe(s1.startsAt);
    expect(await at(y!.id)).toBe(plus(s1.startsAt, 5));
    expect(await at(z!.id)).toBe(plus(s1.startsAt, 5 + minutes));
    await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { startTime: '08:00' }).expect(200);
  });

  it('lets a voided match be unscheduled and clears slots when a draw is unpublished', async () => {
    await clearSchedule();
    const [a, b] = tables();
    const [x, y] = sf.singles;
    await place(x!.id, s1.id, a!, 1).expect(200);
    await place(y!.id, s1.id, a!, 2).expect(200);
    await kit.prisma.match.update({ where: { id: x!.id }, data: { isVoided: true } });
    await place(y!.id, s1.id, b!, 1).expect(200);
    await place(y!.id, s1.id, a!, 2).expect(200);
    await patch(x!.id, { sessionId: null }).expect(200);
    expect(await row(x!.id)).toMatchObject({ sessionId: null, orderInSession: null });
    await kit.prisma.match.update({ where: { id: x!.id }, data: { isVoided: false } });

    const [d1, d2] = sf.doubles;
    await place(d1!.id, s1.id, b!, 1).expect(200);
    await place(d2!.id, s1.id, b!, 2).expect(200);
    const draw = await kit.prisma.draw.findFirstOrThrow({ where: { subEventId: sf.fx.subEvents.MD } });
    await kit.write('post', `${API}/draws/${draw.id}/unpublish`, admin, { expectedVersion: draw.version, reason: 'schedule slot release test' }).expect(200);
    expect(await row(d1!.id)).toMatchObject({ sessionId: null, tableId: null, scheduledAt: null });
    expect(await row(d2!.id)).toMatchObject({ sessionId: null });
    const listed = await kit.get(`${sessionsUrl()}`, admin).expect(200);
    expect(listed.body.data.find((s: { id: string }) => s.id === s1.id).matchCount).toBe(1);
  });

  it('keeps wall-clock session times when the event timezone changes and refreshes the re-timed match pages', async () => {
    await clearSchedule();
    const [a] = tables();
    await place(sf.singles[0]!.id, s1.id, a!, 1).expect(200);
    const since = Date.now();
    await kit.write('patch', `${API}/events/${sf.fx.eventId}`, admin, { timezone: 'Asia/Tokyo' }).expect(200);
    const queue = openRevalidateQueue();
    try {
      const slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: sf.fx.eventId }, select: { slug: true } })).slug;
      const tags = await tagsSince(queue, since, sf.fx.tag);
      expect(tags.has(`match-${slug}-${sf.singles[0]!.matchNo}`)).toBe(true);
    } finally {
      await removeOwn(queue, since, sf.fx.tag);
      await queue.close();
    }
    const list = await kit.get(sessionsUrl(), admin).expect(200);
    const first = list.body.data.find((s: { id: string }) => s.id === s1.id);
    expect(first).toMatchObject({ startTime: '08:00', endTime: null, startsAt: '2099-04-30T23:00:00.000Z' });
    expect(await at(sf.singles[0]!.id)).toBe('2099-04-30T23:00:00.000Z');
    await kit.write('patch', `${API}/events/${sf.fx.eventId}`, admin, { timezone: 'Asia/Ho_Chi_Minh' }).expect(200);
    expect(await at(sf.singles[0]!.id)).toBe(s1.startsAt);
  });
});
