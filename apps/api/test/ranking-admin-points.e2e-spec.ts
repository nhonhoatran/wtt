import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '@kamito/ranking-engine';
import { rankingToday } from '../src/modules/ranking-jobs/ranking-today.js';
import { AppSettingsService } from '../src/modules/settings/app-settings.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { addEntries, cleanupRankingWorld, createRankingWorld, type RankingWorld } from './support/ranking-test-kit.js';

const API = '/api/v1/admin';
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('admin ranking points ledger', () => {
  let kit: AuthTestKit;
  let admin: { id: string };
  let steppedCookie: string;
  let plainCookie: string;
  let w: RankingWorld;
  let today: string;
  const post = (body: object, cookie = steppedCookie) => kit.write('post', `${API}/ranking-points`, cookie, body);
  const manual = (over: object = {}) => ({ rankingListId: w.listId, playerId: w.playerIds[0], points: 120, reason: 'Imported history', ...over });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    today = await rankingToday(kit.app.get(AppSettingsService));
    const user = await kit.createUser({ role: 'ADMIN' });
    admin = user;
    plainCookie = await kit.signIn(user);
    steppedCookie = await kit.signIn(user);
    await kit.write('post', '/api/v1/auth/step-up', steppedCookie, { password: user.password }).expect(200);
    w = await createRankingWorld(kit);
    await addEntries(kit, w, 3);
  });
  afterAll(async () => {
    await cleanupRankingWorld(kit, [w]);
    await kit.close();
  });

  it('manual points need step-up, a reason and valid references', async () => {
    await post(manual(), plainCookie).expect(403);
    await kit.write('delete', `${API}/ranking-points/${randomUUID()}`, plainCookie, { reason: 'cleanup' }).expect(403);
    expect(await kit.prisma.rankingPointsEarned.count({ where: { rankingListId: w.listId } })).toBe(0);

    const invalid = [
      manual({ reason: undefined }), manual({ reason: 'ab' }), manual({ points: 0 }), manual({ points: 1.5 }),
      manual({ rankingListId: randomUUID() }), manual({ playerId: randomUUID() }),
      manual({ earnedAt: '2099-01-10', expiresAt: '2099-01-10' }), manual({ earnedAt: '2099-13-01' }),
      manual({ earnedAt: addDays(today, 1) }),
    ];
    const statuses = [];
    for (const body of invalid) statuses.push((await post(body)).status);
    expect(statuses).toEqual(invalid.map(() => 422));

    const merged = await kit.prisma.player.update({ where: { id: w.playerIds[2]! }, data: { mergedIntoId: w.playerIds[1]! } });
    await post(manual({ playerId: merged.id })).expect(422);
    await kit.prisma.player.update({ where: { id: merged.id }, data: { mergedIntoId: null } });
    expect(await kit.prisma.rankingPointsEarned.count({ where: { rankingListId: w.listId } })).toBe(0);
  });

  it('creates a MANUAL row with list-validity expiry and an audit entry carrying the reason', async () => {
    const res = await post(manual({ earnedAt: today })).expect(201);
    expect(res.body.data).toMatchObject({ source: 'MANUAL', points: 120, subEventId: null, createdById: admin.id, reason: 'Imported history' });
    expect(res.body.data.expiresAt.slice(0, 10)).toBe(addDays(today, 365));
    const [entry] = await kit.prisma.auditLog.findMany({ where: { action: 'ranking.points.manual.create', entityId: res.body.data.id } });
    expect(entry).toMatchObject({ actorId: admin.id, reason: 'Imported history' });
    expect(entry?.after).toMatchObject({ playerId: w.playerIds[0], points: 120, earnedAt: today });
  });

  it('lists with server-side filter, search, sort and paging', async () => {
    await post(manual({ playerId: w.playerIds[1], points: -30, earnedAt: '2000-01-01', expiresAt: '2001-01-01', reason: 'Expired adjustment' })).expect(201);
    await kit.prisma.rankingPointsEarned.create({
      data: { rankingListId: w.listId, playerId: w.playerIds[2]!, source: 'AUTO', subEventId: w.subEventId, eventId: w.eventId, stageCode: 'W', points: 1000, earnedAt: day('2099-05-02'), expiresAt: day('2100-05-02') },
    });
    const list = (query: string) => kit.get(`${API}/ranking-points?filter[rankingListId]=${w.listId}&${query}`, steppedCookie).expect(200);

    expect((await list('sort=points:desc')).body).toMatchObject({ total: 3, page: 1 });
    expect((await list('sort=points:desc')).body.data.map((r: { points: number }) => r.points)).toEqual([1000, 120, -30]);
    expect((await list('filter[source]=MANUAL')).body.total).toBe(2);
    const autoRow = (await list('filter[source]=AUTO')).body.data[0];
    expect(autoRow).toMatchObject({ subEvent: { id: w.subEventId, code: expect.any(String) } });
    expect(autoRow.subEvent).toHaveProperty('name');
    expect((await list('filter[source]=MANUAL')).body.data.map((r: { subEvent: unknown }) => r.subEvent)).toEqual([null, null]);
    expect((await list('filter[active]=false')).body.data.map((r: { points: number }) => r.points)).toEqual([-30]);
    expect((await list('filter[active]=true')).body.total).toBe(2);
    expect((await list(`filter[eventId]=${w.eventId}`)).body.total).toBe(1);
    const byPlayer = await list(`filter[playerId]=${w.playerIds[0]}`);
    expect(byPlayer.body.data[0]).toMatchObject({ player: { id: w.playerIds[0] }, rankingList: { id: w.listId } });
    expect((await list('q=Rank Player&pageSize=2&page=2')).body).toMatchObject({ total: 3, pageSize: 2, page: 2 });
    expect((await list('q=no-such-player')).body.total).toBe(0);
    await kit.get(`${API}/ranking-points?filter[source]=OTHER`, steppedCookie).expect(400);
    await kit.get(`${API}/ranking-points?sort=reason:asc`, steppedCookie).expect(400);
  });

  it('deletes only MANUAL rows, with a reason, and audits before the change', async () => {
    const auto = await kit.prisma.rankingPointsEarned.findFirstOrThrow({ where: { rankingListId: w.listId, source: 'AUTO' } });
    const del = (id: string, body: object = { reason: 'Entered by mistake' }) => kit.write('delete', `${API}/ranking-points/${id}`, steppedCookie, body);
    expect((await del(auto.id).expect(422)).body.error.code).toBe('RANKING_POINTS_NOT_MANUAL');
    await del(randomUUID()).expect(404);

    const row = await kit.prisma.rankingPointsEarned.findFirstOrThrow({ where: { rankingListId: w.listId, source: 'MANUAL', points: 120 } });
    await del(row.id, {}).expect(422);
    await del(row.id).expect(200);
    expect(await kit.prisma.rankingPointsEarned.findUnique({ where: { id: row.id } })).toBeNull();
    const [entry] = await kit.prisma.auditLog.findMany({ where: { action: 'ranking.points.manual.delete', entityId: row.id } });
    expect(entry).toMatchObject({ actorId: admin.id, reason: 'Entered by mistake', before: { points: 120 } });
    expect(await kit.prisma.rankingPointsEarned.findUnique({ where: { id: auto.id } })).not.toBeNull();
  });
});
