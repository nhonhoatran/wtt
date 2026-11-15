import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupPublicWorld, publicGet, type PublicWorld, setupPublicWorld } from './support/public-api-kit.js';

describe('public match date filters at DST boundaries (real Postgres)', () => {
  let kit: AuthTestKit;
  let world: PublicWorld | undefined;
  let secret: string;
  let matchIds: string[];
  let matchNos: number[];

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    secret = process.env.SSR_INTERNAL_SECRET!;
    const cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    world = await setupPublicWorld(kit, cookie);
    await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { timezone: 'America/New_York' } });
    const matches = await kit.prisma.match.findMany({ where: { drawId: world.wsDrawId, status: 'SCHEDULED' }, orderBy: { matchNo: 'asc' }, take: 2 });
    expect(matches).toHaveLength(2);
    matchIds = matches.map((match) => match.id);
    matchNos = matches.map((match) => match.matchNo);
  }, 180_000);

  afterAll(async () => {
    if (!kit) return;
    await cleanupPublicWorld(kit, world);
    await kit.close();
  }, 60_000);

  it.each([
    ['2026-11-01', '2026-11-02T04:30:00Z', '2026-11-02T05:00:00Z'],
    ['2026-03-08', '2026-03-09T03:30:00Z', '2026-03-09T04:00:00Z'],
  ])('includes the last local hour of %s and excludes the next midnight', async (date, inside, outside) => {
    await kit.prisma.match.update({ where: { id: matchIds[0]! }, data: { scheduledAt: new Date(inside) } });
    await kit.prisma.match.update({ where: { id: matchIds[1]! }, data: { scheduledAt: new Date(outside) } });
    const { data } = (await publicGet(kit, secret, `events/${world!.slug}/matches?state=upcoming&sub=WS&date=${date}`).expect(200)).body;
    expect(data.total).toBe(1);
    expect(data.items.map((match: { matchNo: number }) => match.matchNo)).toEqual([matchNos[0]]);
  });

  it('ignores malformed calendar dates rather than returning a server error', async () => {
    const read = async (date = '') => (await publicGet(kit, secret, `events/${world!.slug}/matches?state=upcoming&sub=WS${date ? `&date=${date}` : ''}`).expect(200)).body.data;
    const all = await read();
    expect(await read('2026-99-99')).toEqual(all);
    expect(await read('2026-01-00')).toEqual(all);
  });
});
