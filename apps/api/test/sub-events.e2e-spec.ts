import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';

const EVENTS = '/api/v1/admin/events';

describe('admin sub-events (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let operatorCookie: string;
  let eventId: string;
  let defaultFormatId: string;
  let defaultRuleId: string;
  let category: { id: string; code: string };
  let disciplines: { id: string; code: string }[];
  const tag = `S${randomUUID().slice(0, 6)}`;
  const rankingListIds: string[] = [];
  const base = () => `${EVENTS}/${eventId}/sub-events`;
  const items = (...codes: string[]) => codes.map((code) => ({ disciplineId: disciplines.find((row) => row.code === code)!.id }));

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    adminCookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operatorCookie = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
    eventId = (
      await kit
        .write('post', EVENTS, adminCookie, { name: `Sub ${tag}`, eventTypeId: eventType.id, startDate: '2099-05-01', endDate: '2099-05-02' })
        .expect(201)
    ).body.data.id;
    defaultFormatId = (await kit.prisma.matchFormat.findFirstOrThrow({ where: { isDefault: true } })).id;
    defaultRuleId = (await kit.prisma.groupScoringRule.findFirstOrThrow({ where: { isDefault: true } })).id;
    category = await kit.prisma.category.create({ data: { kind: 'OPEN', code: `T${tag}`, name: `Test ${tag}` } });
    disciplines = await kit.prisma.discipline.findMany({ where: { isActive: true }, select: { id: true, code: true } });
  });

  afterAll(async () => {
    const subEvents = await kit.prisma.subEvent.findMany({ where: { eventId }, select: { id: true } });
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: [eventId, ...subEvents.map((row) => row.id)] } } });
    await kit.prisma.event.deleteMany({ where: { id: eventId } });
    await kit.prisma.rankingList.deleteMany({ where: { id: { in: rankingListIds } } });
    await kit.prisma.category.deleteMany({ where: { id: category.id } });
    await kit.close();
  });

  it('rejects a bulk call with a duplicate code and creates nothing', async () => {
    const repeated = await kit.write('post', `${base()}/bulk`, adminCookie, { items: items('MS', 'WS', 'MS'), defaults: { format: 'KNOCKOUT' } }).expect(422);
    expect(repeated.body.error).toMatchObject({ code: 'DUPLICATE_CODES' });
    expect(repeated.body.error.message).toContain('MS');
    expect(await kit.prisma.subEvent.count({ where: { eventId } })).toBe(0);
  });

  it('creates MS/WS/MD/WD/XD in one call with default format and scoring rule', async () => {
    const res = await kit
      .write('post', `${base()}/bulk`, adminCookie, { items: items('MS', 'WS', 'MD', 'WD', 'XD'), defaults: { format: 'GROUP_KNOCKOUT', hasQualifying: true, maxEntries: 32 } })
      .expect(201);
    expect(res.body.data.map((row: { code: string }) => row.code)).toEqual(['MS', 'WS', 'MD', 'WD', 'XD']);
    const ms = await kit.prisma.discipline.findUniqueOrThrow({ where: { id: items('MS')[0]!.disciplineId } });
    expect(res.body.data[0]).toMatchObject({
      format: 'GROUP_KNOCKOUT',
      hasQualifying: true,
      maxEntries: 32,
      matchFormatId: defaultFormatId,
      groupScoringRuleId: defaultRuleId,
      discipline: { code: 'MS', competitorKind: ms.competitorKind, genderRule: ms.genderRule },
      rankingList: null,
    });
    expect(res.body.data.map((row: { order: number }) => row.order)).toEqual([0, 1, 2, 3, 4]);
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: eventId, action: 'subEvent.bulkCreate' } });
    expect(audit.after).toMatchObject({ codes: ['MS', 'WS', 'MD', 'WD', 'XD'] });
  });

  it('rejects a bulk call that overlaps existing codes without creating the rest', async () => {
    const mixed = [...items('MS'), { disciplineId: items('MS')[0]!.disciplineId, categoryId: category.id }];
    const res = await kit.write('post', `${base()}/bulk`, adminCookie, { items: mixed, defaults: { format: 'KNOCKOUT' } }).expect(422);
    expect(res.body.error.code).toBe('DUPLICATE_CODES');
    expect(await kit.prisma.subEvent.count({ where: { eventId } })).toBe(5);
  });

  it('links a ranking list and returns it with the discipline rules on sub-event reads, then unlinks it', async () => {
    const ms = await kit.prisma.discipline.findUniqueOrThrow({ where: { id: items('MS')[0]!.disciplineId } });
    const list = await kit.prisma.rankingList.create({
      data: { code: `RL-${tag}`, name: `Ranking ${tag}`, competitorKind: ms.competitorKind, genderRule: ms.genderRule, validityDays: 365 },
    });
    rankingListIds.push(list.id);
    const sub = await kit.prisma.subEvent.findFirstOrThrow({ where: { eventId, disciplineId: ms.id } });
    const linked = { id: list.id, code: list.code, name: list.name };

    expect((await kit.write('patch', `${base()}/${sub.id}`, adminCookie, { rankingListId: list.id }).expect(200)).body.data.rankingList).toEqual(linked);
    const rows = (await kit.get(base(), adminCookie).expect(200)).body.data as { id: string }[];
    expect(rows.find((row) => row.id === sub.id)).toMatchObject({ rankingList: linked, discipline: { competitorKind: ms.competitorKind, genderRule: ms.genderRule } });
    expect((await kit.write('patch', `${base()}/${sub.id}`, adminCookie, { rankingListId: null }).expect(200)).body.data.rankingList).toBeNull();
  });

  it('creates a categorised sub-event, with a code from discipline and category and no scoring rule for KNOCKOUT', async () => {
    const res = await kit.write('post', base(), adminCookie, { ...items('MS')[0], categoryId: category.id, format: 'KNOCKOUT' }).expect(201);
    expect(res.body.data).toMatchObject({ code: `MS-${category.code}`, groupScoringRuleId: null, matchFormatId: defaultFormatId, order: 5 });
  });

  it('validates formats, lists in order, patches and deletes', async () => {
    await kit.write('post', `${base()}/bulk`, adminCookie, { items: [], defaults: { format: 'KNOCKOUT' } }).expect(422);
    await kit.write('post', `${base()}/bulk`, adminCookie, { items: items('MS'), defaults: { format: 'ROUND_ROBIN' } }).expect(422);
    const missingDiscipline = await kit
      .write('post', `${base()}/bulk`, adminCookie, { items: [{ disciplineId: randomUUID() }], defaults: { format: 'KNOCKOUT' } })
      .expect(422);
    expect(missingDiscipline.body.error.fields).toHaveProperty('items.0.disciplineId');
    const tooMany = Array.from({ length: 51 }, () => items('MS')[0]);
    await kit.write('post', `${base()}/bulk`, adminCookie, { items: tooMany, defaults: { format: 'KNOCKOUT' } }).expect(422);

    const list = await kit.get(base(), adminCookie).expect(200);
    const first = list.body.data[0];
    expect(list.body.total).toBe(list.body.data.length);
    expect(first.discipline).toMatchObject({ code: 'MS' });
    expect(first.matchFormat).toMatchObject({ bestOf: expect.any(Number), pointsPerGame: expect.any(Number), winBy: expect.any(Number) });

    const patched = await kit.write('patch', `${base()}/${first.id}`, adminCookie, { format: 'KNOCKOUT', name: 'Đơn nam' }).expect(200);
    expect(patched.body.data).toMatchObject({ format: 'KNOCKOUT', groupScoringRuleId: null, name: 'Đơn nam' });
    const back = await kit.write('patch', `${base()}/${first.id}`, adminCookie, { format: 'GROUP_KNOCKOUT' }).expect(200);
    expect(back.body.data.groupScoringRuleId).toBe(defaultRuleId);

    await kit.write('delete', `${base()}/${first.id}`, adminCookie).expect(200);
    await kit.write('patch', `${base()}/${first.id}`, adminCookie, { name: 'x' }).expect(404);
    await kit.get(`${EVENTS}/${randomUUID()}/sub-events`, adminCookie).expect(404);
  });

  it('refuses to delete a sub-event while the event is published', async () => {
    const [target] = (await kit.get(base(), adminCookie).expect(200)).body.data as { id: string }[];
    await kit.write('post', `${EVENTS}/${eventId}/publish`, adminCookie).expect(200);
    const blocked = await kit.write('delete', `${base()}/${target!.id}`, adminCookie).expect(409);
    expect(blocked.body.error.code).toBe('EVENT_PUBLISHED');
    await kit.write('post', `${EVENTS}/${eventId}/unpublish`, adminCookie).expect(200);
    await kit.write('delete', `${base()}/${target!.id}`, adminCookie).expect(200);
  });

  it('lets RESULTS_OPERATOR read but not write', async () => {
    await kit.get(base(), operatorCookie).expect(200);
    await kit.write('post', `${base()}/bulk`, operatorCookie, { items: items('MS'), defaults: { format: 'KNOCKOUT' } }).expect(403);
    await kit.write('post', base(), operatorCookie, { ...items('MS')[0], format: 'KNOCKOUT' }).expect(403);
  });
});
