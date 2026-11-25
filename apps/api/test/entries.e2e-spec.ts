import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { playerSettings } from '@kamito/shared';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API, cleanupFixtures, createEventFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';

describe('admin entries (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let fx: Fixtures;
  let capacityEventSubEventId: string;
  let category: { id: string };

  const entriesUrl = (code: string) => `${API}/sub-events/${fx.subEvents[code]}/entries`;
  const man = (label: string, extra = {}) => createPlayer(kit, adminCookie, fx, { fullName: `Nam ${label} ${fx.tag}`, gender: 'MALE', ...extra });
  const woman = (label: string, extra = {}) => createPlayer(kit, adminCookie, fx, { fullName: `Nữ ${label} ${fx.tag}`, gender: 'FEMALE', ...extra });
  const add = (code: string, body: object, cookie = adminCookie) => kit.write('post', entriesUrl(code), cookie, body);
  const audits = (entityId: string, action: string) => kit.prisma.auditLog.findMany({ where: { entityId, action }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fx = await createEventFixtures(kit, adminCookie);
    category = await kit.prisma.category.create({ data: { kind: 'OPEN', code: `E${fx.tag}`, name: `Entries ${fx.tag}` } });
    const ms = await kit.prisma.discipline.findFirstOrThrow({ where: { code: 'MS' } });
    const cap = await kit
      .write('post', `${API}/events/${fx.eventId}/sub-events`, adminCookie, { disciplineId: ms.id, categoryId: category.id, format: 'KNOCKOUT', maxEntries: 2 })
      .expect(201);
    capacityEventSubEventId = cap.body.data.id;
  });

  afterAll(async () => {
    await cleanupFixtures(kit, fx);
    await kit.prisma.category.deleteMany({ where: { id: category.id } });
    await kit.close();
  });

  it('adds a singles entry in two steps (create player, add) with defaults', async () => {
    const player = await man('Đơn');
    const res = await add('MS', { playerIds: [player.id] }).expect(201);
    expect(res.body.warnings).toEqual([]);
    expect(res.body.data).toMatchObject({
      status: 'CONFIRMED',
      stage: 'MAIN',
      quotaType: 'DIRECT',
      seed: null,
      eligibilityOverrideReason: null,
      competitor: { type: 'PLAYER', displayName: `Nam Đơn ${fx.tag}` },
    });
    expect(res.body.data.competitor.players).toEqual([expect.objectContaining({ id: player.id, code: player.code, gender: 'MALE' })]);
    const created = await audits(res.body.data.id, 'entry.create');
    expect(created).toHaveLength(1);
  });

  it('rejects the same player twice with ALREADY_ENTERED naming the player', async () => {
    const player = await man('Trùng');
    await add('MS', { playerIds: [player.id] }).expect(201);
    const res = await add('MS', { playerIds: [player.id] }).expect(409);
    expect(res.body.error.code).toBe('ALREADY_ENTERED');
    expect(res.body.error.message).toContain(`Nam Trùng ${fx.tag}`);
  });

  it('refuses a wrong gender with issues, and a wrong player count with no way to override', async () => {
    const lady = await woman('Sai nội dung');
    const res = await add('MS', { playerIds: [lady.id] }).expect(422);
    expect(res.body.error).toMatchObject({ code: 'ENTRY_INELIGIBLE' });
    expect(res.body.error.message).toBe(res.body.error.issues[0].message);
    expect(res.body.error.issues[0]).toMatchObject({ code: 'GENDER', playerId: lady.id, overridable: true });

    const a = await man('Đếm A');
    const b = await man('Đếm B');
    const count = await add('MS', { playerIds: [a.id, b.id], overrideReason: 'Ghi đè thử' }).expect(422);
    expect(count.body.error.issues[0]).toMatchObject({ code: 'PLAYER_COUNT', overridable: false });
    await add('MS', { playerIds: [randomUUID()] }).expect(422);
    await add('MS', { playerIds: [] }).expect(422);
  });

  it('lets ADMIN override with a reason (min 5) and audits it', async () => {
    const lady = await woman('Ghi đè');
    const short = await add('MS', { playerIds: [lady.id], overrideReason: 'ok' }).expect(422);
    expect(short.body.error.fields).toHaveProperty('overrideReason');

    const res = await add('MS', { playerIds: [lady.id], overrideReason: 'BTC đồng ý bằng văn bản' }).expect(201);
    expect(res.body.data.eligibilityOverrideReason).toBe('BTC đồng ý bằng văn bản');
    const [override] = await audits(res.body.data.id, 'entry.override');
    expect(override).toMatchObject({ reason: 'BTC đồng ý bằng văn bản' });
    expect(JSON.stringify(override!.after)).toContain('GENDER');
  });

  it('RESULTS_OPERATOR cannot add, override or edit', async () => {
    const player = await man('Quyền');
    await add('MS', { playerIds: [player.id] }, operatorCookie).expect(403);
    await add('MS', { playerIds: [player.id], overrideReason: 'Muốn ghi đè' }, operatorCookie).expect(403);
    const entry = (await add('MS', { playerIds: [player.id] }).expect(201)).body.data;
    await kit.write('patch', `${API}/entries/${entry.id}`, operatorCookie, { seed: 3 }).expect(403);
    await kit.write('post', `${API}/entries/bulk`, operatorCookie, { ids: [entry.id], action: 'withdraw' }).expect(403);
    await kit.get(entriesUrl('MS'), operatorCookie).expect(200);
  });

  it('enforces maxEntries, which only an ADMIN override can exceed', async () => {
    const url = `${API}/sub-events/${capacityEventSubEventId}/entries`;
    const [a, b, c] = [await man('Cap A'), await man('Cap B'), await man('Cap C')];
    await kit.write('post', url, adminCookie, { playerIds: [a!.id] }).expect(201);
    await kit.write('post', url, adminCookie, { playerIds: [b!.id] }).expect(201);
    const full = await kit.write('post', url, adminCookie, { playerIds: [c!.id] }).expect(422);
    expect(full.body.error.issues).toEqual([expect.objectContaining({ code: 'CAPACITY', overridable: true })]);
    const forced = await kit.write('post', url, adminCookie, { playerIds: [c!.id], overrideReason: 'Thêm suất theo BTC' }).expect(201);
    expect(forced.body.data.eligibilityOverrideReason).toBe('Thêm suất theo BTC');
  });

  it('rejects a duplicate seed in the same stage (DB unique) and allows it in another stage', async () => {
    const [a, b, c] = [await man('Seed A'), await man('Seed B'), await man('Seed C')];
    await add('MS', { playerIds: [a!.id], seed: 1 }).expect(201);
    const clash = await add('MS', { playerIds: [b!.id], seed: 1 }).expect(409);
    expect(clash.body.error).toMatchObject({ code: 'SEED_TAKEN', message: 'Hạt giống 1 đã có trong vòng này' });
    await add('MS', { playerIds: [b!.id], seed: 1, stage: 'QUALIFYING' }).expect(201);
    const second = (await add('MS', { playerIds: [c!.id] }).expect(201)).body.data;
    const patchClash = await kit.write('patch', `${API}/entries/${second.id}`, adminCookie, { seed: 1 }).expect(409);
    expect(patchClash.body.error.code).toBe('SEED_TAKEN');
    await add('MS', { playerIds: [(await man('Seed 0')).id], seed: 0 }).expect(422);
  });

  it('clears the seed on withdraw (single and bulk), audits the old seed and frees the number', async () => {
    const [a, b, c] = [await man('Rút hạt giống A'), await man('Rút hạt giống B'), await man('Rút hạt giống C')];
    const first = (await add('MS', { playerIds: [a!.id], seed: 7, stage: 'QUALIFYING' }).expect(201)).body.data;
    const second = (await add('MS', { playerIds: [b!.id], seed: 8, stage: 'QUALIFYING' }).expect(201)).body.data;
    const out = await kit.write('patch', `${API}/entries/${first.id}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
    expect(out.body.data).toMatchObject({ status: 'WITHDRAWN', seed: null });
    const [row] = await audits(first.id, 'entry.update');
    expect(row!.before).toMatchObject({ status: 'CONFIRMED', seed: 7 });
    await add('MS', { playerIds: [c!.id], seed: 7, stage: 'QUALIFYING' }).expect(201);
    await kit.write('post', `${API}/entries/bulk`, adminCookie, { ids: [second.id], action: 'withdraw' }).expect(200);
    expect((await kit.prisma.entry.findUniqueOrThrow({ where: { id: second.id } })).seed).toBeNull();
    const [bulkRow] = await audits(second.id, 'entry.update');
    expect(bulkRow!.before).toMatchObject({ seed: 8 });
    const back = await kit.write('patch', `${API}/entries/${first.id}`, adminCookie, { status: 'CONFIRMED' }).expect(200);
    expect(back.body.data.seed).toBeNull();
  });

  it('refuses a seed change on a withdrawn entry unless it is reinstated in the same call', async () => {
    const player = await man('Seed rút');
    const entry = (await add('MS', { playerIds: [player.id] }).expect(201)).body.data;
    await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
    const res = await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { seed: 31 }).expect(422);
    expect(res.body.error).toMatchObject({ code: 'ENTRY_WITHDRAWN', message: 'Khôi phục entry trước khi đổi hạt giống' });
    const back = await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { status: 'CONFIRMED', seed: 31 }).expect(200);
    expect(back.body.data).toMatchObject({ status: 'CONFIRMED', seed: 31 });
  });

  it('caps bulk size by the entry.maxBulkItems setting', async () => {
    const key = `/api/v1/admin/settings/${playerSettings.maxBulkEntries.key}`;
    await kit.write('put', key, adminCookie, { value: 2 }).expect(200);
    try {
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      const res = await kit.write('post', `${API}/entries/bulk`, adminCookie, { ids, action: 'withdraw' }).expect(422);
      expect(res.body.error.fields.ids).toBe('Tối đa 2 entry mỗi lần');
    } finally {
      await kit.write('delete', key, adminCookie);
    }
  });

  it('only allows the qualifying stage on sub-events that have one', async () => {
    const player = await man('Vòng loại');
    const res = await kit.write('post', `${API}/sub-events/${capacityEventSubEventId}/entries`, adminCookie, { playerIds: [player.id], stage: 'QUALIFYING' }).expect(422);
    expect(res.body.error.fields).toHaveProperty('stage');
  });

  it('handles doubles: pair competitor, one player in two pairs refused, mixed needs M+F', async () => {
    const [a, b, c] = [await man('Đôi A'), await man('Đôi B'), await man('Đôi C')];
    const res = await add('MD', { playerIds: [a!.id, b!.id] }).expect(201);
    expect(res.body.data.competitor.type).toBe('PAIR');
    expect(res.body.data.competitor.players.map((row: { id: string }) => row.id).sort()).toEqual([a!.id, b!.id].sort());
    expect(res.body.data.competitor.displayName).toContain(`Nam Đôi A ${fx.tag}`);
    expect(res.body.data.competitor.displayName).toContain(' / ');

    const other = await add('MD', { playerIds: [a!.id, c!.id] }).expect(409);
    expect(other.body.error.code).toBe('ALREADY_ENTERED');
    await add('MD', { playerIds: [b!.id, a!.id] }).expect(409);
    const same = await add('MD', { playerIds: [c!.id, c!.id] }).expect(422);
    expect(same.body.error.issues[0].code).toBe('SAME_PLAYER');
    await add('MD', { playerIds: [c!.id] }).expect(422);

    const lady = await woman('Đôi nữ');
    await add('XD', { playerIds: [c!.id, lady.id] }).expect(201);
    const twoMen = await add('XD', { playerIds: [(await man('XD1')).id, (await man('XD2')).id] }).expect(422);
    expect(twoMen.body.error.issues[0].code).toBe('MIXED_PAIR');
    await kit.get(`${API}/pairs?q=${encodeURIComponent(`nam doi a ${fx.tag}`)}`, adminCookie).expect(200).expect((r) => {
      expect(r.body.data).toHaveLength(1);
      expect(r.body.data[0]).toMatchObject({ entryCount: 1, competitorId: res.body.data.competitor.id });
    });
  });

  it('withdraws, re-adds by reactivating the same entry, and reinstates through PATCH', async () => {
    const player = await man('Rút');
    const created = (await add('MS', { playerIds: [player.id] }).expect(201)).body.data;
    const withdrawn = await kit.write('patch', `${API}/entries/${created.id}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
    expect(withdrawn.body.data.status).toBe('WITHDRAWN');
    expect(withdrawn.body.warnings).toEqual([]);

    const readded = await add('MS', { playerIds: [player.id], quotaType: 'WILDCARD' }).expect(201);
    expect(readded.body.data).toMatchObject({ id: created.id, status: 'CONFIRMED', quotaType: 'WILDCARD' });
    expect(await kit.prisma.entry.count({ where: { competitor: { playerId: player.id } } })).toBe(1);

    await kit.write('patch', `${API}/entries/${created.id}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
    const back = await kit.write('patch', `${API}/entries/${created.id}`, adminCookie, { status: 'CONFIRMED' }).expect(200);
    expect(back.body.data.status).toBe('CONFIRMED');
    await kit.write('patch', `${API}/entries/${randomUUID()}`, adminCookie, { seed: 1 }).expect(404);
  });

  it('refuses to reinstate into a full sub-event unless ADMIN overrides', async () => {
    const url = `${API}/sub-events/${capacityEventSubEventId}/entries`;
    const player = await man('Chờ lại');
    const confirmed = await kit.prisma.entry.count({ where: { subEventId: capacityEventSubEventId, status: 'CONFIRMED' } });
    expect(confirmed).toBeGreaterThanOrEqual(2);
    const entry = (await kit.write('post', url, adminCookie, { playerIds: [player.id], overrideReason: 'Suất thêm' }).expect(201)).body.data;
    await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { status: 'WITHDRAWN' }).expect(200);
    const full = await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { status: 'CONFIRMED' }).expect(422);
    expect(full.body.error.issues[0].code).toBe('CAPACITY');
    await kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, { status: 'CONFIRMED', overrideReason: 'Cho phép quay lại' }).expect(200);
  });

  it('audits every change of seed, stage, quotaType and status with only the changed fields', async () => {
    const player = await man('Audit');
    const entry = (await add('MS', { playerIds: [player.id] }).expect(201)).body.data;
    const patch = (body: object) => kit.write('patch', `${API}/entries/${entry.id}`, adminCookie, body).expect(200);
    await patch({ seed: 9 });
    await patch({ stage: 'QUALIFYING' });
    await patch({ quotaType: 'QUALIFIER' });
    await patch({ status: 'WITHDRAWN' });
    await patch({ quotaType: 'QUALIFIER' });

    const rows = await audits(entry.id, 'entry.update');
    expect(rows.map((row) => row.before)).toEqual([{ seed: null }, { stage: 'MAIN' }, { quotaType: 'DIRECT' }, { status: 'CONFIRMED', seed: 9 }]);
    expect(rows.map((row) => row.after)).toEqual([{ seed: 9 }, { stage: 'QUALIFYING' }, { quotaType: 'QUALIFIER' }, { status: 'WITHDRAWN', seed: null }]);
  });

  it('applies bulk setStage, setQuota and withdraw in one transaction with audit rows', async () => {
    const players = [await woman('Bulk 1'), await woman('Bulk 2'), await woman('Bulk 3')];
    const ids: string[] = [];
    for (const player of players) ids.push((await add('WS', { playerIds: [player.id] }).expect(201)).body.data.id);
    const bulk = (body: object, status = 200) => kit.write('post', `${API}/entries/bulk`, adminCookie, body).expect(status);

    expect((await bulk({ ids, action: 'setStage', stage: 'QUALIFYING' })).body.data).toEqual({ updated: 3 });
    expect((await bulk({ ids, action: 'setStage', stage: 'QUALIFYING' })).body.data).toEqual({ updated: 0 });
    expect(await kit.prisma.entry.count({ where: { id: { in: ids }, stage: 'QUALIFYING' } })).toBe(3);
    expect((await bulk({ ids, action: 'setQuota', quotaType: 'WILDCARD' })).body.data).toEqual({ updated: 3 });
    const stageAudit = await kit.prisma.auditLog.count({ where: { entityId: { in: ids }, action: 'entry.update' } });
    expect(stageAudit).toBe(6);

    const [first, ...rest] = ids;
    expect((await bulk({ ids: [first], action: 'withdraw' })).body.data).toEqual({ updated: 1 });
    expect((await bulk({ ids, action: 'withdraw' })).body.data).toEqual({ updated: 2 });
    expect(rest).toHaveLength(2);
    expect(await kit.prisma.entry.count({ where: { id: { in: ids }, status: 'WITHDRAWN' } })).toBe(3);

    const mixed = (await add('MS', { playerIds: [(await man('Bulk khác')).id] }).expect(201)).body.data.id;
    const cross = await bulk({ ids: [first, mixed], action: 'setQuota', quotaType: 'DIRECT' }, 422);
    expect(cross.body.error.fields).toHaveProperty('ids');
    await bulk({ ids: [randomUUID()], action: 'withdraw' }, 404);
    await bulk({ ids: [], action: 'withdraw' }, 422);
    await bulk({ ids, action: 'setStage' }, 422);
  });

  it('rejects bulk setStage to qualifying where the sub-event has none', async () => {
    const player = await man('Bulk vòng loại');
    const entry = (await kit.write('post', `${API}/sub-events/${capacityEventSubEventId}/entries`, adminCookie, { playerIds: [player.id], overrideReason: 'Suất thêm' }).expect(201)).body.data;
    await kit.write('post', `${API}/entries/bulk`, adminCookie, { ids: [entry.id], action: 'setStage', stage: 'QUALIFYING' }).expect(422);
  });

  it('searches entries by member club and player code as well as name', async () => {
    const club = `CLB Tim ${fx.tag}`;
    const player = await man('Tim CLB', { club });
    await add('MS', { playerIds: [player.id] }).expect(201);
    const byClub = await kit.get(`${entriesUrl('MS')}?q=${encodeURIComponent(club.toLowerCase())}`, adminCookie).expect(200);
    expect(byClub.body.data.map((row: { competitor: { displayName: string } }) => row.competitor.displayName)).toEqual([`Nam Tim CLB ${fx.tag}`]);
    const byCode = await kit.get(`${entriesUrl('MS')}?q=${encodeURIComponent(player.code)}`, adminCookie).expect(200);
    expect(byCode.body.data.map((row: { competitor: { displayName: string } }) => row.competitor.displayName)).toEqual([`Nam Tim CLB ${fx.tag}`]);
  });

  it('lists with server-side search, filter, sort and paging; counts per sub-event', async () => {
    const list = await kit.get(`${entriesUrl('MS')}?q=${encodeURIComponent(`nam don ${fx.tag}`)}`, adminCookie).expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1 });
    expect(list.body.data[0].competitor.displayName).toBe(`Nam Đơn ${fx.tag}`);

    const confirmed = await kit.get(`${entriesUrl('MS')}?filter[status]=CONFIRMED&sort=displayName:asc&pageSize=2&page=1`, adminCookie).expect(200);
    expect(confirmed.body.data).toHaveLength(2);
    expect(confirmed.body.total).toBeGreaterThan(2);
    const names = confirmed.body.data.map((row: { competitor: { displayName: string } }) => row.competitor.displayName);
    expect([...names].sort((x, y) => x.localeCompare(y))).toEqual(names);

    const seeded = await kit.get(`${entriesUrl('MS')}?sort=seed:asc&filter[stage]=MAIN&filter[quotaType]=DIRECT,WILDCARD`, adminCookie).expect(200);
    expect(seeded.body.data[0].seed).not.toBeNull();
    await kit.get(`${entriesUrl('MS')}?filter[status]=NOPE`, adminCookie).expect(400);
    await kit.get(`${API}/sub-events/${randomUUID()}/entries`, adminCookie).expect(404);

    const counts = (await kit.get(`${API}/events/${fx.eventId}/entry-counts`, adminCookie).expect(200)).body.data as { subEventId: string; confirmed: number; withdrawn: number; seeded: number }[];
    const actual = async (subEventId: string, status: 'CONFIRMED' | 'WITHDRAWN') => kit.prisma.entry.count({ where: { subEventId, status } });
    expect(counts.map((row) => row.subEventId).sort()).toEqual([...Object.values(fx.subEvents), capacityEventSubEventId].sort());
    for (const row of counts) {
      expect(row.confirmed).toBe(await actual(row.subEventId, 'CONFIRMED'));
      expect(row.withdrawn).toBe(await actual(row.subEventId, 'WITHDRAWN'));
      expect(row.seeded).toBe(await kit.prisma.entry.count({ where: { subEventId: row.subEventId, status: 'CONFIRMED', seed: { not: null } } }));
    }
    expect(counts.find((row) => row.subEventId === fx.subEvents.MS)!.seeded).toBeGreaterThan(0);
    expect(counts.find((row) => row.subEventId === fx.subEvents.WS)).toMatchObject({ confirmed: 0, withdrawn: 3 });
    await kit.get(`${API}/events/${randomUUID()}/entry-counts`, adminCookie).expect(404);
  });

  it('refuses to delete a sub-event that has entries', async () => {
    const res = await kit.write('delete', `${API}/events/${fx.eventId}/sub-events/${fx.subEvents.MS}`, adminCookie).expect(409);
    expect(res.body.error.code).toBe('SUB_EVENT_HAS_ENTRIES');
    expect(await kit.prisma.subEvent.count({ where: { id: fx.subEvents.MS } })).toBe(1);
  });
});
