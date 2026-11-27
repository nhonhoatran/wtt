import { randomUUID } from 'node:crypto';
import { Prisma } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API } from './support/entries-fixtures.js';
import { createSchedulingFixture, SESSION_DATE, type SchedulingFixture } from './support/scheduling-fixtures.js';

describe('automatic schedule preview and atomic apply (real Postgres)', () => {
  let kit: AuthTestKit;
  let admin: string;
  let operator: string;
  let sf: SchedulingFixture;
  let bounded: string;
  let unbounded: string;
  const url = () => `${API}/events/${sf.fx.eventId}/auto-schedule`;
  const preview = (ids = [bounded], cookie = admin) => kit.write('post', `${url()}/preview`, cookie, { sessionIds: ids });
  const rows = () => kit.prisma.match.findMany({ where: { eventId: sf.fx.eventId }, orderBy: { id: 'asc' } });
  const apply = (fingerprint: string, ids = [bounded]) => kit.write('post', `${url()}/apply`, admin, { sessionIds: ids, expectedFingerprint: fingerprint });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    sf = await createSchedulingFixture(kit, admin);
    const create = (body: object) => kit.write('post', `${API}/events/${sf.fx.eventId}/sessions`, admin, { date: SESSION_DATE, startTime: '08:00', venueId: sf.venueId, tableIds: sf.tableIds, ...body });
    bounded = (await create({ code: 'AUTO', endTime: '18:00' }).expect(201)).body.data.id;
    unbounded = (await create({ code: 'OPEN' }).expect(201)).body.data.id;
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await sf?.cleanup();
    await kit.close();
  }, 60_000);

  it('requires tournament update permission, bounded own sessions and validated preview/apply requests', async () => {
    await preview([bounded], operator).expect(403);
    await kit.write('post', `${url()}/preview`, '', { sessionIds: [bounded] }).expect(401);
    await preview([]).expect(422);
    await preview([bounded, bounded]).expect(422);
    await preview([randomUUID()]).expect(422);
    await preview([unbounded]).expect(422);
    await apply('bad').expect(422);
    const foreign = (await kit.prisma.eventSession.findFirst({ where: { id: bounded } }))!;
    await kit.write('post', `${API}/events/${randomUUID()}/auto-schedule/preview`, admin, { sessionIds: [foreign.id] }).expect(404);
  });

  it('previews deterministically without writing, even when an existing match already has a slot', async () => {
    const match = sf.singles[0]!;
    const existing = await kit.prisma.match.findUniqueOrThrow({ where: { id: match.id } });
    await kit.write('patch', `${API}/matches/${match.id}/schedule`, admin, { sessionId: bounded, tableId: sf.tableIds[0], expectedScheduleVersion: existing.scheduleVersion }).expect(200);
    const before = await rows();
    const auditBefore = await kit.prisma.auditLog.count({ where: { entityId: { in: before.map((m) => m.id) } } });
    const first = (await preview().expect(200)).body.data;
    expect(first.assignments.length).toBeGreaterThan(0);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.timeZone).toBe((await kit.prisma.event.findUniqueOrThrow({ where: { id: sf.fx.eventId } })).timezone);
    expect(first.assignments.some((a: { matchId: string }) => a.matchId === match.id)).toBe(false);
    expect((await preview().expect(200)).body.data).toEqual(first);
    expect(await rows()).toEqual(before);
    expect(await kit.prisma.auditLog.count({ where: { entityId: { in: before.map((m) => m.id) } } })).toBe(auditBefore);
  });

  it('rejects stale result version, schedule version, participant/source, duration and session changes without partial writes', async () => {
    const selected = sf.singles[1]!.id;
    const mutate = async (change: () => Promise<unknown>) => {
      const proposal = (await preview().expect(200)).body.data;
      await change();
      const before = await rows();
      const stale = await apply(proposal.fingerprint).expect(409);
      expect(stale.body.error.code).toBe('AUTO_SCHEDULE_STALE');
      expect(await rows()).toEqual(before);
    };
    await mutate(() => kit.prisma.match.update({ where: { id: selected }, data: { version: { increment: 1 } } }));
    await mutate(() => kit.prisma.match.update({ where: { id: selected }, data: { scheduleVersion: { increment: 1 } } }));
    const original = await kit.prisma.match.findUniqueOrThrow({ where: { id: selected } });
    await mutate(() => kit.prisma.match.update({ where: { id: selected }, data: { side1Source: { type: 'QUALIFIER', index: 99 } } }));
    await kit.prisma.match.update({ where: { id: selected }, data: { side1Source: original.side1Source ?? Prisma.DbNull } });
    const other = await kit.prisma.match.findUniqueOrThrow({ where: { id: sf.singles[2]!.id } });
    try { await mutate(() => kit.prisma.match.update({ where: { id: selected }, data: { side1EntryId: other.side1EntryId } })); }
    finally { await kit.prisma.match.update({ where: { id: selected }, data: { side1EntryId: original.side1EntryId } }); }
    await mutate(() => kit.prisma.draw.update({ where: { id: original.drawId }, data: { version: { increment: 1 } } }));
    const format = (await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: sf.fx.subEvents.MS }, include: { matchFormat: true } })).matchFormat;
    try {
      await mutate(() => kit.prisma.matchFormat.update({ where: { id: format.id }, data: { estimatedMinutes: format.estimatedMinutes + 1 } }));
    } finally { await kit.prisma.matchFormat.update({ where: { id: format.id }, data: { estimatedMinutes: format.estimatedMinutes } }); }
    const key = tournamentSettings.scheduleMinRestMinutes.key;
    const setting = await kit.prisma.appSetting.findUnique({ where: { key } });
    try { await mutate(() => kit.prisma.appSetting.upsert({ where: { key }, create: { key, value: 21 }, update: { value: 21 } })); }
    finally {
      if (setting) await kit.prisma.appSetting.update({ where: { key }, data: { value: setting.value ?? Prisma.JsonNull } });
      else await kit.prisma.appSetting.deleteMany({ where: { key } });
    }
    await mutate(() => kit.prisma.eventSession.update({ where: { id: bounded }, data: { endTime: new Date('2099-05-01T10:59:00Z') } }));
    const proposal = (await preview().expect(200)).body.data;
    await kit.prisma.eventSession.update({ where: { id: bounded }, data: { endTime: null } });
    await apply(proposal.fingerprint).expect(409);
    await kit.prisma.eventSession.update({ where: { id: bounded }, data: { endTime: new Date('2099-05-01T11:00:00Z') } });
  });

  it('recomputes and atomically applies once; preserves old slots/status/result versions and audits each new reservation', async () => {
    const before = await rows();
    const proposal = (await preview().expect(200)).body.data;
    const results = await Promise.all([apply(proposal.fingerprint), apply(proposal.fingerprint)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const committed = results.find((r) => r.status === 200)!.body.data;
    expect(committed.assignments).toEqual(proposal.assignments);
    const after = await rows();
    for (const old of before) {
      const current = after.find((m) => m.id === old.id)!;
      const assignment = proposal.assignments.find((a: { matchId: string }) => a.matchId === old.id);
      expect(current.version).toBe(old.version);
      expect(current.status).toBe(old.status);
      if (!assignment) expect(current).toEqual(old);
      else {
        expect(current).toMatchObject({ sessionId: assignment.sessionId, tableId: assignment.tableId, orderInSession: assignment.orderInSession, scheduleVersion: old.scheduleVersion + 1 });
        expect(current.scheduledAt?.toISOString()).toBe(assignment.scheduledAt);
        expect(await kit.prisma.auditLog.count({ where: { entityId: old.id, action: 'match.schedule' } })).toBe(1);
      }
    }
    await apply(proposal.fingerprint).expect(409);
    expect(await rows()).toEqual(after);
  }, 30_000);
});
