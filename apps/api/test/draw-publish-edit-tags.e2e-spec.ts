import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { openRevalidateQueue, removeOwn, tagsSince } from './support/revalidate-queue-probe.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';

describe('draw publish, unpublish and post-publish edits refresh match and player pages (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let fx: Fixtures;
  let slug: string;
  let drawId: string;
  let entries: string[];
  let players: DrawFixtureKit;
  let spare: string[];
  const startedAt = Date.now();
  const queue = openRevalidateQueue();

  const post = (path: string, body: object = {}) => kit.write('post', `${API}${path}`, cookie, body);
  const version = async () => (await kit.prisma.draw.findUniqueOrThrow({ where: { id: drawId } })).version;
  const matchTags = async () => (await kit.prisma.match.findMany({ where: { drawId }, select: { matchNo: true } })).map((m) => `match-${slug}-${m.matchNo}`);
  const playerSlug = async (entryId: string) =>
    (await kit.prisma.entry.findUniqueOrThrow({ where: { id: entryId }, select: { competitor: { select: { player: { select: { slug: true } } } } } })).competitor.player!.slug;
  const mark = async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Date.now();
  };
  const queuedSince = (since: number) => tagsSince(queue, since, fx.tag);
  const expectQueued = async (since: number, tags: string[]) => {
    const queued = await queuedSince(since);
    for (const tag of tags) expect(queued.has(tag), `no revalidate job with tag ${tag}`).toBe(true);
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, cookie, ['MS']);
    slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId }, select: { slug: true } })).slug;
    players = new DrawFixtureKit(kit, cookie, fx);
    entries = await players.addEntries(fx.subEvents.MS!, 0, 4);
    const created = await post(`/sub-events/${fx.subEvents.MS}/draws`, { kind: 'MAIN' }).expect(201);
    drawId = created.body.data.id;
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
      await cleanupFixtures(kit, fx);
      await kit.close();
    }
    await removeOwn(queue, startedAt, fx.tag);
    await queue.close();
  }, 60_000);

  it('queues the draw and every match tag on publish', async () => {
    const since = await mark();
    const res = await post(`/draws/${drawId}/publish`, { expectedVersion: await version() }).expect(200);
    expect(res.body.warnings).toBeUndefined();
    const tags = await matchTags();
    expect(tags.length).toBe(3);
    await expectQueued(since, ['events', `draw-${slug}-MS`, ...tags]);
  });

  it('queues the match tags on unpublish and publishes again', async () => {
    const since = await mark();
    await post(`/draws/${drawId}/unpublish`, { expectedVersion: await version(), reason: 'redo the draw' }).expect(200);
    await expectQueued(since, ['events', `draw-${slug}-MS`, ...(await matchTags())]);
    await post(`/draws/${drawId}/publish`, { expectedVersion: await version() }).expect(200);
  });

  it('queues the old and new player and the match tags when an entry is replaced', async () => {
    // A confirmed entry added after publish would make a re-publish stale, so it joins only now.
    spare = await players.addEntries(fx.subEvents.MS!, 4, 1);
    const position = await kit.prisma.bracketPosition.findFirstOrThrow({ where: { drawId, entryId: entries[0]! } });
    const since = await mark();
    await post(`/draws/${drawId}/replace-entry`, { positionId: position.id, newEntryId: spare[0], reason: 'late substitute', expectedVersion: await version() }).expect(200);
    await expectQueued(since, [`player-${await playerSlug(entries[0]!)}`, `player-${await playerSlug(spare[0]!)}`, ...(await matchTags())]);
  });

  it('queues the withdrawn player and the match tags when an entry withdraws', async () => {
    const since = await mark();
    await post(`/draws/${drawId}/withdraw-entry`, { entryId: entries[1], reason: 'injury', expectedVersion: await version() }).expect(200);
    await expectQueued(since, [`player-${await playerSlug(entries[1]!)}`, ...(await matchTags())]);
  });
});
