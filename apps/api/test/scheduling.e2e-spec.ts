import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, SESSION_DATE, type SchedulingFixture } from './support/scheduling-fixtures.js';

describe('sessions and manual scheduling (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  let sf: SchedulingFixture;
  let minutes: number;
  let s1: { id: string; startsAt: string };

  const sessionsUrl = () => `${API}/events/${sf.fx.eventId}/sessions`;
  const createSession = (body: object) => kit.write('post', sessionsUrl(), admin, { date: SESSION_DATE, startTime: '08:00', venueId: sf.venueId, ...body });
  const schedule = (matchId: string, body: object, cookie = admin) => kit.write('patch', `${API}/matches/${matchId}/schedule`, cookie, body);
  const row = (id: string) => kit.prisma.match.findUniqueOrThrow({ where: { id } });
  const at = async (id: string) => (await row(id)).scheduledAt?.toISOString();
  const place = async (matchId: string, sessionId: string, tableId: string, orderInSession?: number, status = 200) => {
    const { scheduleVersion } = await row(matchId);
    return schedule(matchId, { sessionId, tableId, orderInSession, expectedScheduleVersion: scheduleVersion }).expect(status);
  };
  const plus = (iso: string, mins: number) => new Date(Date.parse(iso) + mins * 60_000).toISOString();

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    sf = await createSchedulingFixture(kit, admin);
    const format = await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: sf.fx.subEvents.MS }, select: { matchFormat: { select: { estimatedMinutes: true } } } });
    minutes = format.matchFormat.estimatedMinutes;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await sf?.cleanup();
    await kit.close();
  }, 60_000);

  describe('sessions', () => {
    it('creates a session with ordered tables and reads the time back in the event timezone', async () => {
      const [t1, t2] = sf.tableIds;
      const res = await createSession({ code: 's01', name: 'Sáng', endTime: '12:00', tableIds: [t2, t1] }).expect(201);
      s1 = res.body.data;
      expect(res.body.data).toMatchObject({ code: 'S01', date: SESSION_DATE, startTime: '08:00', endTime: '12:00', venueId: sf.venueId, matchCount: 0 });
      expect(res.body.data.startsAt).toBe('2099-05-01T01:00:00.000Z');
      expect(res.body.data.tables.map((t: { tableId: string }) => t.tableId)).toEqual([t2, t1]);
      expect(await kit.prisma.auditLog.count({ where: { entityId: s1.id, action: 'session.create' } })).toBe(1);

      await createSession({ code: 'S01', tableIds: [] }).expect(409);
      await createSession({ code: 'S09', startTime: '08:00', endTime: '07:00', tableIds: [] }).expect(422);
      await createSession({ code: 'S09', date: '2099-06-01', tableIds: [] }).expect(422);
      await createSession({ code: 'S09', tableIds: [t1, t1] }).expect(422);
      const foreign = await kit.prisma.venue.create({ data: { name: `Other ${sf.fx.tag}`, tables: { create: [{ code: 'X1' }] } }, include: { tables: true } });
      try {
        await createSession({ code: 'S09', tableIds: [foreign.tables[0]!.id] }).expect(422);
      } finally {
        await kit.prisma.venue.delete({ where: { id: foreign.id } });
      }
    });

    it('lists for the operator but only an admin may write', async () => {
      const list = await kit.get(sessionsUrl(), operator).expect(200);
      expect(list.body.data.map((s: { code: string }) => s.code)).toEqual(['S01']);
      await kit.write('post', sessionsUrl(), operator, { date: SESSION_DATE, code: 'S02', startTime: '09:00', tableIds: [] }).expect(403);
      await kit.write('patch', `${sessionsUrl()}/${s1.id}`, operator, { name: 'x' }).expect(403);
      await kit.write('delete', `${sessionsUrl()}/${s1.id}`, operator).expect(403);
    });

    it('updates fields and table order, and rejects removing a table that has matches', async () => {
      const [t1, t2] = sf.tableIds;
      const upd = await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { name: 'Sáng 1', tableIds: [t1, t2] }).expect(200);
      expect(upd.body.data.tables.map((t: { tableId: string }) => t.tableId)).toEqual([t1, t2]);
      expect(upd.body.data.name).toBe('Sáng 1');

      await place(sf.singles[0]!.id, s1.id, t1!, 1);
      const blocked = await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { tableIds: [t2] }).expect(409);
      expect(blocked.body.error.code).toBe('SESSION_TABLE_IN_USE');
      await kit.write('patch', `${sessionsUrl()}/${randomUUID()}`, admin, { name: 'x' }).expect(404);
    });

    it('shifts derived match times when the session start changes', async () => {
      await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { startTime: '09:30' }).expect(200);
      expect(await at(sf.singles[0]!.id)).toBe('2099-05-01T02:30:00.000Z');
      await kit.write('patch', `${sessionsUrl()}/${s1.id}`, admin, { startTime: '08:00' }).expect(200);
      expect(await at(sf.singles[0]!.id)).toBe(s1.startsAt);
    });

    it('refuses to delete a session that still has matches, then deletes once empty', async () => {
      const blocked = await kit.write('delete', `${sessionsUrl()}/${s1.id}`, admin).expect(409);
      expect(blocked.body.error).toMatchObject({ code: 'SESSION_HAS_MATCHES', dependants: { matches: 1 } });
      const m = sf.singles[0]!.id;
      await schedule(m, { sessionId: null, expectedScheduleVersion: (await row(m)).scheduleVersion }).expect(200);
      const spare = (await createSession({ code: 'S99', tableIds: [] }).expect(201)).body.data;
      await kit.write('delete', `${sessionsUrl()}/${spare.id}`, admin).expect(200);
      expect(await kit.prisma.eventSession.count({ where: { id: spare.id } })).toBe(0);
    });
  });

  describe('schedule, move, swap, unschedule', () => {
    it('places a match, derives its time and leaves Match.version alone', async () => {
      const [t1, t2] = sf.tableIds;
      const [a, b, c] = sf.singles;
      const before = await row(a!.id);
      const res = await place(a!.id, s1.id, t1!, 1);
      expect(res.body.data).toMatchObject({ sessionId: s1.id, tableId: t1, orderInSession: 1, scheduleVersion: before.scheduleVersion + 1, version: before.version, scheduledAt: s1.startsAt });
      expect(res.body.data.conflicts).toEqual([]);
      expect(res.body.swappedMatchId).toBeNull();

      await place(b!.id, s1.id, t1!, 2);
      expect(await at(b!.id)).toBe(plus(s1.startsAt, minutes));
      await place(c!.id, s1.id, t2!);
      expect((await row(c!.id)).orderInSession).toBe(1);
      expect(await kit.prisma.auditLog.count({ where: { entityId: a!.id, action: 'match.schedule' } })).toBeGreaterThanOrEqual(1);
    });

    it('moves a match out of a column and the matches behind it move up', async () => {
      const [t1, t2] = sf.tableIds;
      const [a, b] = sf.singles;
      expect(await at(b!.id)).toBe(plus(s1.startsAt, minutes));
      await place(a!.id, s1.id, t2!, 2);
      expect(await at(b!.id)).toBe(s1.startsAt);
      expect(await at(a!.id)).toBe(plus(s1.startsAt, minutes));
      await place(a!.id, s1.id, t1!, 1);
      expect(await at(a!.id)).toBe(s1.startsAt);
      expect(await at(b!.id)).toBe(plus(s1.startsAt, minutes));
    });

    it('swaps with a scheduled occupant and rejects an occupied slot for an unplaced match', async () => {
      const [t1, t2] = sf.tableIds;
      const [a, , c, d] = sf.singles;
      const res = await place(a!.id, s1.id, t2!, 1);
      expect(res.body.swappedMatchId).toBe(c!.id);
      expect(await row(c!.id)).toMatchObject({ tableId: t1, orderInSession: 1 });
      expect(await row(a!.id)).toMatchObject({ tableId: t2, orderInSession: 1 });

      const blocked = await place(d!.id, s1.id, t2!, 1, 409);
      expect(blocked.body.error.code).toBe('SCHEDULE_SLOT_OCCUPIED');
    });

    it('rejects a stale scheduleVersion, a foreign table and an unknown session', async () => {
      const [t1, t2, t3] = sf.tableIds;
      const [a] = sf.singles;
      const current = (await row(a!.id)).scheduleVersion;
      const stale = await schedule(a!.id, { sessionId: s1.id, tableId: t1, orderInSession: 5, expectedScheduleVersion: current - 1 }).expect(409);
      expect(stale.body.error).toMatchObject({ code: 'SCHEDULE_VERSION_CONFLICT', currentVersion: current });
      const wrongTable = await schedule(a!.id, { sessionId: s1.id, tableId: t3, orderInSession: 5, expectedScheduleVersion: current }).expect(422);
      expect(wrongTable.body.error.code).toBe('TABLE_NOT_IN_SESSION');
      await schedule(a!.id, { sessionId: randomUUID(), tableId: t2, expectedScheduleVersion: current }).expect(404);
      await schedule(a!.id, { sessionId: s1.id, expectedScheduleVersion: current }).expect(422);
    });

    it('lets two concurrent requests with the same scheduleVersion succeed once', async () => {
      const [t1, t2] = sf.tableIds;
      const m = sf.singles[3]!.id;
      const v = (await row(m)).scheduleVersion;
      const body = (tableId: string) => ({ sessionId: s1.id, tableId, orderInSession: 7, expectedScheduleVersion: v });
      const results = await Promise.all([schedule(m, body(t1!)), schedule(m, body(t2!))]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('only schedules matches that have not started, and RESULTS_OPERATOR cannot schedule', async () => {
      const [t1] = sf.tableIds;
      const m = sf.singles[1]!;
      await schedule(m.id, { sessionId: s1.id, tableId: t1, orderInSession: 9, expectedScheduleVersion: (await row(m.id)).scheduleVersion }, operator).expect(403);
      const started = await row(m.id);
      await kit.write('post', `${API}/matches/${m.id}/start`, operator, { expectedVersion: started.version }).expect(200);
      const res = await schedule(m.id, { sessionId: null, expectedScheduleVersion: started.scheduleVersion }).expect(409);
      expect(res.body.error.code).toBe('MATCH_NOT_SCHEDULABLE');
      const after = await row(m.id);
      expect(after.scheduleVersion).toBe(started.scheduleVersion);
      expect(after.version).toBe(started.version + 1);
    });
  });

  describe('conflicts and lists', () => {
    beforeAll(async () => {
      await kit.prisma.match.updateMany({ where: { eventId: sf.fx.eventId }, data: { sessionId: null, tableId: null, orderInSession: null, scheduledAt: null } });
    });

    it('flags a player through a pair and a table shared by overlapping sessions', async () => {
      const [t1, t2] = sf.tableIds;
      const [single] = sf.singles;
      const [pairMatch] = sf.doubles;
      await place(single!.id, s1.id, t1!, 1);
      const res = await place(pairMatch!.id, s1.id, t2!, 1);
      expect(res.body.data.conflicts).toEqual([
        expect.objectContaining({ kind: 'PLAYER_OVERLAP', playerId: sf.sharedPlayer.id, playerName: sf.sharedPlayer.fullName, withMatchId: single!.id }),
      ]);

      const s2 = (await createSession({ code: 'S02', startTime: '08:01', tableIds: [t1] }).expect(201)).body.data;
      const other = sf.doubles[1]!;
      const placed = await place(other.id, s2.id, t1!, 1);
      expect(placed.body.data.conflicts).toEqual([expect.objectContaining({ kind: 'TABLE_OVERLAP', tableId: t1, withMatchId: single!.id })]);

      const list = await kit.get(`${API}/events/${sf.fx.eventId}/matches?filter[sessionId]=${s1.id}`, admin).expect(200);
      const byId = new Map<string, { conflicts: { kind: string }[] }>(list.body.data.map((m: { id: string; conflicts: { kind: string }[] }) => [m.id, m]));
      expect(byId.get(single!.id)!.conflicts.map((c) => c.kind).sort()).toEqual(['PLAYER_OVERLAP', 'TABLE_OVERLAP']);
      expect(byId.get(pairMatch!.id)!.conflicts.map((c) => c.kind)).toEqual(['PLAYER_OVERLAP']);
    });

    it('lists a whole session unpaged and filters by table, unscheduled, status and search', async () => {
      const [t1] = sf.tableIds;
      const base = `${API}/events/${sf.fx.eventId}/matches`;
      const whole = await kit.get(`${base}?filter[sessionId]=${s1.id}&pageSize=1`, admin).expect(200);
      const placed = await kit.prisma.match.count({ where: { sessionId: s1.id } });
      expect(whole.body).toMatchObject({ total: placed, truncated: false });
      expect(whole.body.data).toHaveLength(placed);

      const onTable = await kit.get(`${base}?filter[sessionId]=${s1.id}&filter[tableId]=${t1}`, admin).expect(200);
      expect(onTable.body.data.every((m: { tableId: string }) => m.tableId === t1)).toBe(true);

      const free = await kit.get(`${base}?filter[unscheduled]=true&pageSize=50`, admin).expect(200);
      expect(free.body.data.every((m: { sessionId: string | null }) => m.sessionId === null)).toBe(true);
      expect(free.body.total + (await kit.prisma.match.count({ where: { eventId: sf.fx.eventId, sessionId: { not: null } } }))).toBeGreaterThan(placed);
      await kit.get(`${base}?filter[unscheduled]=maybe`, admin).expect(400);

      const byNo = await kit.get(`${base}?filter[sessionId]=${s1.id}&q=%23${sf.singles[0]!.matchNo}`, admin).expect(200);
      expect(byNo.body.data.map((m: { id: string }) => m.id)).toEqual([sf.singles[0]!.id]);
      const scheduled = await kit.get(`${base}?filter[status]=SCHEDULED&sort=scheduledAt:asc&pageSize=50`, operator).expect(200);
      expect(scheduled.body.data.length).toBeGreaterThan(0);
    });

    it('unschedules and clears slot and time', async () => {
      const m = sf.singles[0]!.id;
      const res = await schedule(m, { sessionId: null, expectedScheduleVersion: (await row(m)).scheduleVersion }).expect(200);
      expect(res.body.data).toMatchObject({ sessionId: null, tableId: null, orderInSession: null, scheduledAt: null });
    });
  });
});
