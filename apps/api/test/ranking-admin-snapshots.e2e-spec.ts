import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { addRules, cleanupRankingWorld, markDirtySql, type RankingWorld } from './support/ranking-test-kit.js';
import { createPlayedFinal, startRankingTestWorker, waitUntil, type TestRankingWorker } from './support/ranking-worker-kit.js';

const API = '/api/v1/admin';

describe('admin ranking snapshots: draft, preview, publish', () => {
  let kit: AuthTestKit;
  let worker: TestRankingWorker;
  let admin: { id: string };
  let cookie: string;
  let plainCookie: string;
  let w: RankingWorld;
  let finalId: string;
  const worlds: RankingWorld[] = [];

  async function buildDraft(asOfDate: string): Promise<string> {
    const res = await kit.write('post', `${API}/ranking-snapshots/drafts`, cookie, { listIds: [w.listId], asOfDate }).expect(202);
    const { jobId } = res.body.data.jobs[0];
    await waitUntil(async () => (await kit.get(`${API}/ranking/jobs/${jobId}`, cookie)).body.data?.state === 'completed', `snapshot job ${asOfDate}`);
    const found = await kit.prisma.rankingSnapshot.findFirstOrThrow({ where: { rankingListId: w.listId, status: 'DRAFT', asOfDate: new Date(`${asOfDate}T00:00:00Z`) } });
    return found.id;
  }
  const rows = async (id: string, query = '') => (await kit.get(`${API}/ranking-snapshots/${id}/rows?${query}`, cookie).expect(200)).body;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const user = await kit.createUser({ role: 'ADMIN' });
    admin = user;
    plainCookie = await kit.signIn(user);
    cookie = await kit.signIn(user);
    await kit.write('post', '/api/v1/auth/step-up', cookie, { password: user.password }).expect(200);
    worker = await startRankingTestWorker(kit);
    const played = await createPlayedFinal(kit, worlds);
    w = played.w;
    finalId = played.finalId;
    await addRules(kit, w, [{ stageCode: 'W', points: 1000 }, { stageCode: 'F', points: 700 }]);
  });
  afterAll(async () => {
    await worker.stop();
    await cleanupRankingWorld(kit, worlds);
    await kit.close();
  });

  it('builds a draft through the queue (recomputing dirty content first), previews rows and replaces a same-day draft', async () => {
    await markDirtySql(kit, w.subEventId);
    const draftId = await buildDraft('2099-06-01');

    const list = await kit.get(`${API}/ranking-snapshots?filter[listId]=${w.listId}&filter[status]=DRAFT`, cookie).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id: draftId, status: 'DRAFT', dirtySubEvents: 0, _count: { rows: 2 }, rankingList: { id: w.listId }, publishedBy: null });
    expect((await kit.get(`${API}/ranking-snapshots/${draftId}`, cookie).expect(200)).body.data.publishedBy).toBeNull();

    const preview = await rows(draftId, 'sort=rank:asc');
    expect(preview.data.map((r: { rank: number; points: number }) => [r.rank, r.points])).toEqual([[1, 1000], [2, 700]]);
    expect(preview.data[0]).toMatchObject({ playerId: w.playerIds[0], previousRank: null, movement: null, resultsCounted: 1, player: { code: expect.any(String), slug: expect.any(String) } });
    expect(preview.data[0].breakdown[0]).toMatchObject({ stageCode: 'W', points: 1000, eventTypeCode: expect.stringMatching(/^RE-/) });
    expect((await rows(draftId, 'sort=points:asc')).data[0].points).toBe(700);
    expect((await rows(draftId, `q=${preview.data[1].player.code}`)).total).toBe(1);
    expect(await rows(draftId, 'pageSize=1&page=2')).toMatchObject({ total: 2, page: 2, data: [{ rank: 2 }] });
    await kit.get(`${API}/ranking-snapshots/${draftId}/rows?sort=breakdown:asc`, cookie).expect(400);

    expect(await buildDraft('2099-06-01')).not.toBe(draftId);
    expect(await kit.prisma.rankingSnapshot.count({ where: { rankingListId: w.listId, status: 'DRAFT' } })).toBe(1);
  });

  it('validates draft requests and unknown ids', async () => {
    const drafts = (body: object) => kit.write('post', `${API}/ranking-snapshots/drafts`, cookie, body);
    await drafts({}).expect(422);
    await drafts({ all: true, listIds: [w.listId] }).expect(422);
    await drafts({ listIds: [randomUUID()] }).expect(422);
    await drafts({ listIds: [w.listId], asOfDate: '2099-02-31' }).expect(422);
    const unknown = randomUUID();
    await kit.get(`${API}/ranking-snapshots/${unknown}`, cookie).expect(404);
    await kit.get(`${API}/ranking-snapshots/${unknown}/rows`, cookie).expect(404);
    await kit.write('post', `${API}/ranking-snapshots/${unknown}/publish`, cookie).expect(404);
    await kit.write('delete', `${API}/ranking-snapshots/${unknown}`, cookie).expect(404);
  });

  it('publish needs step-up, freezes the snapshot, and published snapshots cannot be republished, deleted or edited', async () => {
    const draftId = await buildDraft('2099-06-01');
    await kit.write('post', `${API}/ranking-snapshots/${draftId}/publish`, plainCookie).expect(403);
    expect((await kit.prisma.rankingSnapshot.findUniqueOrThrow({ where: { id: draftId } })).status).toBe('DRAFT');

    const res = await kit.write('post', `${API}/ranking-snapshots/${draftId}/publish`, cookie).expect(200);
    expect(res.body.data).toMatchObject({ id: draftId, status: 'PUBLISHED', changedPlayers: 2 });
    const stored = await kit.prisma.rankingSnapshot.findUniqueOrThrow({ where: { id: draftId } });
    expect(stored).toMatchObject({ status: 'PUBLISHED', publishedById: admin.id });
    expect(stored.publishedAt).toBeInstanceOf(Date);
    const [audit] = await kit.prisma.auditLog.findMany({ where: { action: 'ranking.snapshot.publish', entityId: draftId } });
    expect(audit).toMatchObject({ actorId: admin.id, before: { status: 'DRAFT' }, after: { status: 'PUBLISHED', rows: 2, changedPlayers: 2 } });

    const publisher = { id: admin.id, name: (await kit.prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: { name: true } })).name };
    expect((await kit.get(`${API}/ranking-snapshots/${draftId}`, cookie).expect(200)).body.data.publishedBy).toEqual(publisher);
    const published = await kit.get(`${API}/ranking-snapshots?filter[listId]=${w.listId}&filter[status]=PUBLISHED`, cookie).expect(200);
    expect(published.body.data.find((row: { id: string }) => row.id === draftId)).toMatchObject({ publishedBy: publisher });

    expect((await kit.write('post', `${API}/ranking-snapshots/${draftId}/publish`, cookie).expect(409)).body.error.code).toBe('RANKING_SNAPSHOT_NOT_DRAFT');
    expect((await kit.write('delete', `${API}/ranking-snapshots/${draftId}`, cookie).expect(409)).body.error.code).toBe('RANKING_SNAPSHOT_PUBLISHED');
    await expect(kit.prisma.rankingSnapshotRow.updateMany({ where: { snapshotId: draftId }, data: { points: 1 } })).rejects.toThrow();
    await expect(kit.prisma.rankingSnapshot.update({ where: { id: draftId }, data: { status: 'DRAFT' } })).rejects.toThrow();
  });

  it('the next snapshot carries previousRank and movement; a stale draft cannot be published; a draft can be deleted', async () => {
    await kit.prisma.match.update({ where: { id: finalId }, data: { winnerSide: 2 } });
    await markDirtySql(kit, w.subEventId);
    const second = await buildDraft('2099-07-01');
    const moved = (await rows(second, 'sort=rank:asc')).data.map((r: { playerId: string; rank: number; previousRank: number; movement: number }) => [r.playerId, r.rank, r.previousRank, r.movement]);
    expect(moved).toEqual([[w.playerIds[1], 1, 2, 1], [w.playerIds[0], 2, 1, -1]]);

    await markDirtySql(kit, w.subEventId);
    const stale = await kit.write('post', `${API}/ranking-snapshots/${second}/publish`, cookie).expect(409);
    expect(stale.body.error).toMatchObject({ code: 'RANKING_SNAPSHOT_STALE', dirtySubEvents: [w.subEventId] });
    expect((await kit.get(`${API}/ranking-snapshots/${second}`, cookie)).body.data.dirtySubEvents).toBe(1);

    await kit.write('delete', `${API}/ranking-snapshots/${second}`, cookie).expect(200);
    expect(await kit.prisma.rankingSnapshot.findUnique({ where: { id: second } })).toBeNull();
    expect(await kit.prisma.auditLog.count({ where: { action: 'ranking.snapshot.delete', entityId: second } })).toBe(1);
  });
});
