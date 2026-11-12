import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { API, cleanupFixtures, createEventFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';

const ROUNDS = 12;

describe('player merge vs concurrent entry writes (real Postgres)', () => {
  let kit: AuthTestKit;
  let adminCookie: string;
  let fx: Fixtures;

  const man = (label: string) => createPlayer(kit, adminCookie, fx, { fullName: `Song song ${label} ${fx.tag}`, gender: 'MALE' });
  const addEntry = (code: string, playerIds: string[]) => kit.write('post', `${API}/sub-events/${fx.subEvents[code]}/entries`, adminCookie, { playerIds });
  const merge = (targetId: string, sourceId: string) => kit.write('post', `${API}/players/merge`, adminCookie, { targetId, sourceId, reason: 'Kiểm tra song song' });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const admin = await kit.createUser({ role: 'ADMIN' });
    adminCookie = await kit.signIn(admin);
    fx = await createEventFixtures(kit, adminCookie, ['MS', 'MD']);
    await kit.write('post', '/api/v1/auth/step-up', adminCookie, { password: admin.password }).expect(200);
  });

  afterAll(async () => {
    await cleanupFixtures(kit, fx);
    await kit.close();
  });

  it('refuses a new entry for a merged profile with PLAYER_MERGED naming both codes', async () => {
    const [target, source] = [await man('đích'), await man('nguồn')];
    await merge(target.id, source.id).expect(200);
    const res = await addEntry('MS', [source.id]).expect(409);
    expect(res.body.error).toMatchObject({ code: 'PLAYER_MERGED', message: `VĐV mã ${source.code} đã được gộp vào mã ${target.code}` });
  });

  it('keeps invariants when a merge races entry creation', async () => {
    const statuses: number[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      const [target, source, partner] = [await man(`A${round}`), await man(`B${round}`), await man(`X${round}`)];
      await addEntry('MS', [source.id]).expect(201);
      const results = await Promise.all([merge(target.id, source.id), addEntry('MD', [source.id, partner.id]), addEntry('MS', [target.id])]);
      statuses.push(...results.map((res) => res.status));
    }
    expect(statuses.filter((status) => status >= 500)).toEqual([]);
    expect(statuses.every((status) => [200, 201, 409, 422].includes(status))).toBe(true);

    const merged = await kit.prisma.player.findMany({ where: { id: { in: fx.playerIds }, mergedIntoId: { not: null } }, select: { id: true } });
    const mergedIds = merged.map((row) => row.id);
    expect(mergedIds.length).toBeGreaterThan(0);
    const onMerged = await kit.prisma.entry.count({
      where: {
        competitor: { OR: [{ playerId: { in: mergedIds } }, { pair: { OR: [{ playerAId: { in: mergedIds } }, { playerBId: { in: mergedIds } }] } }] },
      },
    });
    expect(onMerged).toBe(0);

    const entries = await kit.prisma.entry.findMany({
      where: { subEvent: { eventId: fx.eventId }, status: 'CONFIRMED' },
      select: { subEventId: true, competitor: { select: { playerId: true, pair: { select: { playerAId: true, playerBId: true } } } } },
    });
    const seen = new Set<string>();
    for (const { subEventId, competitor } of entries) {
      for (const id of [competitor.playerId, competitor.pair?.playerAId, competitor.pair?.playerBId]) {
        if (!id) continue;
        const key = `${subEventId}:${id}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  }, 120_000);
});
