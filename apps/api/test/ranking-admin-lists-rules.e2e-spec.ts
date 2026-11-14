import { rankingSettings } from '@kamito/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { addRules, cleanupRankingWorld, type RankingWorld } from './support/ranking-test-kit.js';
import { createPlayedFinal, startRankingTestWorker, waitUntil, type TestRankingWorker } from './support/ranking-worker-kit.js';

const API = '/api/v1/admin';

describe('admin ranking lists and rules', () => {
  let kit: AuthTestKit;
  let worker: TestRankingWorker;
  let cookie: string;
  const worlds: RankingWorld[] = [];
  const extraListIds: string[] = [];
  const winnerRows = (w: RankingWorld) => kit.prisma.rankingPointsEarned.findMany({ where: { subEventId: w.subEventId, stageCode: 'W' } });
  const audits = (action: string, entityId: string) => kit.prisma.auditLog.findMany({ where: { action, entityId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    worker = await startRankingTestWorker(kit);
  });
  afterAll(async () => {
    await worker.stop();
    await kit.prisma.rankingList.deleteMany({ where: { id: { in: extraListIds } } });
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('creates a list with the default validity from settings, rejects duplicates and bad input', async () => {
    const code = `LST-${Date.now()}`;
    const body = { code, name: 'Test list', competitorKind: 'SINGLES', genderRule: 'MEN' };
    const res = await kit.write('post', `${API}/ranking-lists`, cookie, body).expect(201);
    extraListIds.push(res.body.data.id);
    expect(res.body.data.validityDays).toBe(await kit.app.get(AppSettingsService).get(rankingSettings.defaultValidityDays));
    expect((await audits('ranking.list.create', res.body.data.id)).length).toBe(1);

    expect((await kit.write('post', `${API}/ranking-lists`, cookie, body).expect(422)).body.error.fields.code).toBeDefined();
    await kit.write('post', `${API}/ranking-lists`, cookie, { ...body, code: `${code}X`, competitorKind: 'TRIPLES' }).expect(422);
    await kit.write('post', `${API}/ranking-lists`, cookie, { ...body, code: `${code}Y`, validityDays: 0 }).expect(422);

    const list = await kit.get(`${API}/ranking-lists?filter[competitorKind]=SINGLES&q=${code}&sort=code:asc`, cookie).expect(200);
    expect(list.body.data.map((row: { code: string }) => row.code)).toEqual([code]);
    await kit.get(`${API}/ranking-lists?filter[nope]=1`, cookie).expect(400);
    await kit.write('delete', `${API}/ranking-lists/${res.body.data.id}`, cookie).expect(200);
    extraListIds.length = 0;
  });

  it('changing validityDays re-freezes the ledger through the queue; kind change and delete are blocked while in use', async () => {
    const { w } = await createPlayedFinal(kit, worlds);
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }]);
    await kit.write('post', `${API}/ranking/recompute`, cookie, { subEventId: w.subEventId }).expect(202);
    await waitUntil(async () => (await winnerRows(w)).length === 1, 'initial ledger');

    const patch = await kit.write('patch', `${API}/ranking-lists/${w.listId}`, cookie, { validityDays: 100 }).expect(200);
    expect(patch.body.data.validityDays).toBe(100);
    await waitUntil(async () => (await winnerRows(w))[0]?.expiresAt.toISOString().slice(0, 10) === '2099-08-10', 'expiry recomputed');
    expect((await audits('ranking.list.update', w.listId))[0]).toMatchObject({ before: { validityDays: 365 }, after: { validityDays: 100 } });

    expect((await kit.write('patch', `${API}/ranking-lists/${w.listId}`, cookie, { competitorKind: 'DOUBLES' }).expect(422)).body.error.fields.competitorKind).toBeDefined();
    const blocked = await kit.write('delete', `${API}/ranking-lists/${w.listId}`, cookie).expect(409);
    expect(blocked.body.error.dependants.subEvents).toBe(1);
  });

  it('saves a rules matrix as a version, shows it by date, re-edits the same version and queues affected recomputes', async () => {
    const { w } = await createPlayedFinal(kit, worlds);
    const save = (effectiveFrom: string, cells: object[]) =>
      kit.write('put', `${API}/ranking-rules/matrix`, cookie, { competitorKind: 'SINGLES', drawKind: 'MAIN', effectiveFrom, cells });
    const matrix = (asOf: string) =>
      kit.get(`${API}/ranking-rules?filter[competitorKind]=SINGLES&filter[drawKind]=MAIN&filter[asOf]=${asOf}`, cookie).expect(200);
    const cell = (body: { data: { cells: { eventTypeId: string; stageCode: string; points: number }[] } }, stageCode: string) =>
      body.data.cells.find((c) => c.eventTypeId === w.eventTypeId && c.stageCode === stageCode)?.points;
    const rule = (eventTypeId = w.eventTypeId) => ({ eventTypeId, stageCode: 'W', points: 1000 });

    const first = await save('2099-01-01', [rule(), { eventTypeId: w.eventTypeId, stageCode: 'F', points: 700 }]).expect(200);
    expect(first.body.data).toMatchObject({ saved: 2, effectiveFrom: '2099-01-01', recomputeSubEvents: 1 });
    await waitUntil(async () => (await winnerRows(w))[0]?.points === 1000, 'ledger follows the new rule');

    const after = await matrix('2099-06-01');
    expect([cell(after.body, 'W'), cell(after.body, 'F')]).toEqual([1000, 700]);
    expect(after.body.data.stageCodes.slice(0, 3)).toEqual(['W', 'F', 'SF']);
    expect(after.body.data.versions).toContain('2099-01-01');
    expect(after.body.data.eventTypes.some((t: { id: string }) => t.id === w.eventTypeId)).toBe(true);
    expect(cell((await matrix('2098-12-31')).body, 'W')).toBeUndefined();

    await save('2099-01-01', [{ ...rule(), points: 1200 }]).expect(200);
    expect(await kit.prisma.rankingPointsRule.count({ where: { eventTypeId: w.eventTypeId } })).toBe(2);
    expect(cell((await matrix('2099-01-01')).body, 'W')).toBe(1200);
    await save('2099-02-01', [{ ...rule(), points: 900 }]);
    const [, second] = await audits('ranking.rules.save', 'SINGLES:MAIN:2099-01-01');
    expect(second?.before).toEqual([{ eventTypeId: w.eventTypeId, stageCode: 'W', points: 1000 }]);
    expect(second?.after).toMatchObject({ cells: [{ points: 1200 }] });

    const late = await save('2099-05-03', [{ ...rule(), points: 5 }]).expect(200);
    expect(late.body.data.recomputeSubEvents).toBe(0);
    const impact = (from: string) =>
      kit.get(`${API}/ranking-rules/impact?competitorKind=SINGLES&effectiveFrom=${from}&eventTypeIds=${w.eventTypeId}`, cookie).expect(200);
    expect((await impact('2099-05-02')).body.data).toEqual({ subEvents: 1, events: 1 });
    expect((await impact('2099-05-03')).body.data).toEqual({ subEvents: 0, events: 0 });
    await kit.get(`${API}/ranking-rules?filter[competitorKind]=SINGLES`, cookie).expect(422);
  });

  it('rejects malformed matrices', async () => {
    const { w } = await createPlayedFinal(kit, worlds);
    const base = { competitorKind: 'SINGLES', drawKind: 'MAIN', effectiveFrom: '2099-01-01' };
    const cell = { eventTypeId: w.eventTypeId, stageCode: 'W', points: 10 };
    const put = (body: object) => kit.write('put', `${API}/ranking-rules/matrix`, cookie, body);
    await put({ ...base, cells: [cell, cell] }).expect(422);
    await put({ ...base, cells: [] }).expect(422);
    await put({ ...base, cells: [{ ...cell, points: -1 }] }).expect(422);
    await put({ ...base, cells: [{ ...cell, stageCode: 'bad code!' }] }).expect(422);
    await put({ ...base, effectiveFrom: '2099-02-31', cells: [cell] }).expect(422);
    await put({ ...base, cells: [{ ...cell, eventTypeId: '00000000-0000-4000-8000-000000000000' }] }).expect(422);
    expect(await kit.prisma.rankingPointsRule.count({ where: { eventTypeId: w.eventTypeId } })).toBe(0);
  });
});
