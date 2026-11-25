import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PublicSchedule } from '@kamito/shared';
import { RevalidationEnqueueService } from '../src/modules/revalidation/revalidation-enqueue.service.js';
import { vi } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, MATCH_CARD_KEYS, MATCH_SOURCE_KEYS, MATCH_TABLE_KEYS, privateProfile, publicGet, type PublicWorld, setupPublicWorld, sortedPaths } from './support/public-api-kit.js';

describe('public schedule API (real Postgres)', () => {
  let kit: AuthTestKit;
  let world: PublicWorld;
  let secret: string;
  let venueId: string;
  let cookie: string;
  const get = (query = '') => publicGet(kit, secret, `events/${world.slug}/schedule${query}`);
  const read = async (query = '') => (await get(query).expect(200)).body.data as PublicSchedule;
  const matchNos = (data: PublicSchedule) => data.sessions.flatMap((s) => s.tables.flatMap((t) => t.matches.map((m) => m.matchNo)));

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    const venue = await kit.prisma.venue.create({ data: { name: `Schedule ${world.tag}`, nameEn: 'Schedule hall', tables: { create: [
      { code: 'T1', displayName: 'Table One' }, { code: 'T2', displayName: 'Table Two' }, { code: 'PRIVATE', displayName: 'Draft only table' }, { code: 'BYE', displayName: 'Bye only table' },
    ] } }, include: { tables: true } });
    venueId = venue.id;
    const table = (code: string) => venue.tables.find((t) => t.code === code)!.id;
    const sessions = [];
    for (const [code, time] of [['AM', '02'], ['PM', '07'], ['DRAFT', '09']] as const) {
      sessions.push(await kit.prisma.eventSession.create({ data: {
        eventId: world.fx.eventId, venueId, code, name: code === 'AM' ? 'Buổi sáng' : null, date: new Date('2099-05-01'),
        startTime: new Date(`2099-05-01T${time}:00:00Z`), endTime: new Date(`2099-05-01T${time}:30:00Z`),
        tables: { create: ['T2', 'T1', 'PRIVATE', 'BYE'].map((c, order) => ({ tableId: table(c), order })) },
      } }));
    }
    const matches = await kit.prisma.match.findMany({ where: { eventId: world.fx.eventId }, orderBy: { matchNo: 'asc' } });
    for (let index = 0; index < matches.length; index++) {
      const m = matches[index]!;
      if (m.subEventId === world.fx.subEvents.MD) continue;
      const draft = m.subEventId === world.fx.subEvents.WD;
      const session = draft ? sessions[2]! : m.subEventId === world.fx.subEvents.MS ? sessions[1]! : sessions[0]!;
      await kit.prisma.match.update({ where: { id: m.id }, data: {
        sessionId: session.id, tableId: table(draft ? 'PRIVATE' : m.resultType === 'BYE' ? 'BYE' : index % 2 === 0 ? 'T1' : 'T2'),
        scheduledAt: new Date(session.startTime.getTime() + index * 60_000), orderInSession: index,
      } });
    }
    await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { showInfoTab: false, infoBody: null, infoBodyEn: null } });
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await cleanupPublicWorld(kit, world);
    if (venueId) await kit.prisma.venue.delete({ where: { id: venueId } });
    await kit.close();
  }, 60_000);

  it('groups only real published scheduled matches into ordered sessions and tables', async () => {
    const data = await read();
    expect(data.sessions.map((s) => s.code)).toEqual(['AM', 'PM']);
    expect(data.sessions.every((s) => s.date === '2099-05-01')).toBe(true);
    expect(data.sessions[0]?.startsAt).toBe('2099-05-01T02:00:00.000Z');
    expect(data.sessions[0]?.venue).toEqual({ name: `Schedule ${world.tag}`, nameEn: 'Schedule hall' });
    expect(data.sessions.flatMap((s) => s.tables).every((t) => ['T1', 'T2'].includes(t.code))).toBe(true);
    const expected = await kit.prisma.match.findMany({ where: {
      eventId: world.fx.eventId, draw: { status: 'PUBLISHED' }, sessionId: { not: null }, tableId: { not: null }, scheduledAt: { not: null },
      OR: [{ resultType: null }, { resultType: { not: 'BYE' } }],
    }, select: { matchNo: true } });
    expect(matchNos(data).sort()).toEqual(expected.map((m) => m.matchNo).sort());
    expect(data.filters.sessions.map((s) => s.code)).toEqual(['AM', 'PM']);
    expect(data.filters.tables.map((t) => t.code).sort()).toEqual(['T1', 'T2']);
  });

  it('filters at the server by stable session/table codes and keeps the full filter choices', async () => {
    const data = await read('?session=AM&table=T1');
    expect(data.sessions.map((s) => s.code)).toEqual(['AM']);
    expect(data.sessions[0]?.tables.map((t) => t.code)).toEqual(['T1']);
    expect(data.filters.sessions.map((s) => s.code)).toEqual(['AM', 'PM']);
    expect((await read('?session=missing')).sessions).toEqual([]);
    expect(matchNos(await read('?session=AM&session=PM&table[]=T1'))).toEqual(matchNos(await read()));
  });

  it('whitelists schedule fields and match cards without exposing IDs or contact data', async () => {
    const data = await read();
    const { sessions, ...rest } = data;
    expect(sortedPaths(rest)).toEqual([
      'event', 'event.name', 'event.nameEn', 'event.slug', 'event.timezone', 'filters', 'filters.sessions',
      'filters.sessions[].code', 'filters.sessions[].date', 'filters.sessions[].name', 'filters.sessions[].nameEn',
      'filters.tables', 'filters.tables[].code', 'filters.tables[].displayName',
    ].sort());
    expect(sortedPaths(sessions.map(({ tables, ...s }) => ({ ...s, tables: tables.map(({ matches: _matches, ...t }) => t) })))).toEqual([
      '[].code', '[].date', '[].endsAt', '[].name', '[].nameEn', '[].startsAt', '[].venue', '[].venue.name', '[].venue.nameEn',
      '[].tables', '[].tables[].code', '[].tables[].displayName',
    ].sort());
    const cards = sessions.flatMap((s) => s.tables.flatMap((t) => t.matches));
    expect(sortedPaths(cards)).toEqual([...MATCH_CARD_KEYS, ...MATCH_TABLE_KEYS, ...MATCH_SOURCE_KEYS].map((k) => `[].${k}`).sort());
    const text = JSON.stringify(data);
    const { legalName, legalNameEn, email, phone } = privateProfile(world.tag);
    for (const value of [world.fx.eventId, venueId, legalName, legalNameEn, email, phone, 'Draft only table', 'Bye only table']) expect(text).not.toContain(value);
  });

  it('exposes the table on cards, the session on match detail, and days, venue and kind on event detail', async () => {
    const data = await read();
    const am = data.sessions.find((s) => s.code === 'AM')!;
    const card = am.tables[0]!.matches[0]!;
    expect(card.table).toEqual({ code: am.tables[0]!.code, displayName: am.tables[0]!.displayName });
    const matchDetail = (await publicGet(kit, secret, `events/${world.slug}/matches/${card.matchNo}`).expect(200)).body.data;
    expect(matchDetail.session).toEqual({ code: 'AM', name: 'Buổi sáng', nameEn: null });

    await kit.prisma.venue.update({ where: { id: venueId }, data: { address: '1 Test Street', mapUrl: 'https://maps.example.com/hall' } });
    await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { venueId } });
    const detail = (await publicGet(kit, secret, `events/${world.slug}`).expect(200)).body.data;
    expect(detail.venue).toEqual({ name: `Schedule ${world.tag}`, nameEn: 'Schedule hall', address: '1 Test Street', mapUrl: 'https://maps.example.com/hall' });
    expect(detail.days).toEqual([{ date: '2099-05-01', sessions: [
      { code: 'AM', name: 'Buổi sáng', nameEn: null }, { code: 'PM', name: null, nameEn: null },
    ] }]);
    expect(detail.subEvents.every((s: { competitorKind: string }) => s.competitorKind === 'SINGLES' || s.competitorKind === 'DOUBLES')).toBe(true);

    await kit.prisma.venue.update({ where: { id: venueId }, data: { mapUrl: 'javascript:alert(1)' } });
    expect((await publicGet(kit, secret, `events/${world.slug}`).expect(200)).body.data.venue.mapUrl).toBeNull();
    await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { venueId: null } });
  });

  it('keeps the info tab available with a public schedule and no rich text', async () => {
    const data = (await publicGet(kit, secret, `events/${world.slug}`).expect(200)).body.data;
    expect(data.tabs.info).toBe(true);
  });

  it('returns null for unknown, draft and cancelled events and restores visibility', async () => {
    expect((await publicGet(kit, secret, `events/missing-${world.tag}/schedule`).expect(200)).body).toEqual({ data: null });
    for (const update of [{ publishStatus: 'DRAFT' as const }, { publishStatus: 'PUBLISHED' as const, isCancelled: true }]) {
      await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: update });
      try { expect((await get().expect(200)).body).toEqual({ data: null }); }
      finally { await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { publishStatus: 'PUBLISHED', isCancelled: false } }); }
    }
    expect((await read()).sessions.length).toBeGreaterThan(0);
  });

  it('requires the internal SSR secret', async () => {
    await kit.http.get(`/api/v1/public/events/${world.slug}/schedule`).expect(403);
  });

  it('invalidates event and schedule data when table or session-only venue labels change', async () => {
    const queue = kit.app.get(RevalidationEnqueueService);
    const enqueue = vi.spyOn(queue, 'enqueue');
    try {
      const table = await kit.prisma.venueTable.findFirstOrThrow({ where: { venueId, code: 'T1' } });
      await kit.write('patch', `/api/v1/admin/venues/${venueId}/tables/${table.id}`, cookie, { displayName: 'Updated Table' }).expect(200);
      const tableTags = await enqueue.mock.calls.at(-1)![0]();
      expect(tableTags).toEqual(expect.arrayContaining([`event-${world.slug}`, `schedule-${world.slug}`]));
      expect(tableTags).toContain('results-strip');
      expect(tableTags.some((tag) => tag.startsWith(`draw-${world.slug}-`))).toBe(true);
      expect(tableTags.some((tag) => tag.startsWith(`match-${world.slug}-`))).toBe(true);
      expect((await read()).filters.tables.find((t) => t.code === 'T1')?.displayName).toBe('Updated Table');
      // The event's main venue is null: only EventSession points to this venue.
      await kit.write('patch', `/api/v1/admin/venues/${venueId}`, cookie, { name: 'Updated hall' }).expect(200);
      const venueTags = await enqueue.mock.calls.at(-1)![0]();
      expect(venueTags).toContain(`event-${world.slug}`);
      expect((await read()).sessions[0]?.venue?.name).toBe('Updated hall');
    } finally { enqueue.mockRestore(); }
  });
});
