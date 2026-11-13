import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allocateMatchNumbers, entriesInLockedDraw, isStructureLocked, lockDraw, lockGroups, subEventsWithLockedDraw } from '@kamito/db';
import { AuthTestKit } from './support/auth-test-kit.js';
import { cleanupFixtures, createEventFixtures, createPlayer, type Fixtures } from './support/entries-fixtures.js';

describe('draw lock helpers (real Postgres)', () => {
  let kit: AuthTestKit;
  let fx: Fixtures;
  let msId: string;
  let wsId: string;
  let entryIds: string[];
  let mainDrawId: string;
  let groupDrawId: string;
  let roundId: string;

  const run = <T>(fn: Parameters<typeof kit.prisma.$transaction>[0]) => kit.prisma.$transaction(fn as never) as Promise<T>;

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, cookie, ['MS', 'WS']);
    msId = fx.subEvents.MS!;
    wsId = fx.subEvents.WS!;
    entryIds = [];
    for (const label of ['a', 'b', 'c', 'd']) {
      const player = await createPlayer(kit, cookie, fx, { fullName: `Lock ${label} ${fx.tag}`, gender: 'MALE' });
      const competitor = await kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
      const entry = await kit.prisma.entry.create({ data: { subEventId: msId, competitorId: competitor.id } });
      entryIds.push(entry.id);
    }
    const main = await kit.prisma.draw.create({ data: { subEventId: msId, kind: 'MAIN', randomSeed: 's1', size: 4 } });
    mainDrawId = main.id;
    const group = await kit.prisma.draw.create({ data: { subEventId: msId, kind: 'GROUP', randomSeed: 's2' } });
    groupDrawId = group.id;
    const round = await kit.prisma.round.create({ data: { drawId: mainDrawId, scopeKey: 'S1', number: 1, code: 'SF' } });
    roundId = round.id;
  });

  afterAll(async () => {
    if (kit) {
      await kit.prisma.draw.deleteMany({ where: { subEventId: { in: [msId, wsId].filter(Boolean) } } });
      await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId: fx?.eventId } });
      await cleanupFixtures(kit, fx);
      await kit.close();
    }
  });

  it('classifies entries by draw status (positions and group members)', async () => {
    const [a, b, c, d] = entryIds as [string, string, string, string];
    await kit.prisma.bracketPosition.create({ data: { drawId: mainDrawId, position: 1, source: 'ENTRY', entryId: a } });
    const group = await kit.prisma.group.create({ data: { drawId: groupDrawId, code: 'A', order: 1 } });
    await kit.prisma.groupMember.create({ data: { groupId: group.id, entryId: b, slot: 1 } });
    await kit.prisma.groupMember.create({ data: { groupId: group.id, entryId: a, slot: 2 } });

    const draftOnly = await run<{ locked: string[]; draft: string[] }>((tx) => entriesInLockedDraw(tx, [a, b, c, d]));
    expect(draftOnly.locked).toEqual([]);
    expect(draftOnly.draft.sort()).toEqual([a, b].sort());
    expect(await run<string[]>((tx) => subEventsWithLockedDraw(tx, [msId, wsId]))).toEqual([]);

    await kit.prisma.draw.update({ where: { id: mainDrawId }, data: { status: 'PUBLISHED' } });
    const mixed = await run<{ locked: string[]; draft: string[] }>((tx) => entriesInLockedDraw(tx, [a, b, c, d]));
    expect(mixed.locked).toEqual([a]);
    expect(mixed.draft).toEqual([b]);
    expect(await run<string[]>((tx) => subEventsWithLockedDraw(tx, [msId, wsId]))).toEqual([msId]);
    expect(await run<unknown>((tx) => entriesInLockedDraw(tx, []))).toEqual({ locked: [], draft: [] });
  });

  it('takes row locks without error', async () => {
    await run<void>(async (tx) => {
      await lockDraw(tx, mainDrawId);
      await lockGroups(tx, groupDrawId);
    });
  });

  it('isStructureLocked ignores BYE matches and SCHEDULED matches', async () => {
    const first = await run<number>((tx) => allocateMatchNumbers(tx, fx.eventId, 3));
    const base = { eventId: fx.eventId, subEventId: msId, drawId: mainDrawId, roundId, orderInRound: 1 };
    const bye = await kit.prisma.match.create({ data: { ...base, matchNo: first, status: 'OFFICIAL', resultType: 'BYE' } });
    expect(await run<boolean>((tx) => isStructureLocked(tx, mainDrawId))).toBe(false);
    await kit.prisma.match.create({ data: { ...base, orderInRound: 2, matchNo: first + 1, status: 'SCHEDULED' } });
    expect(await run<boolean>((tx) => isStructureLocked(tx, mainDrawId))).toBe(false);
    await kit.prisma.match.create({ data: { ...base, orderInRound: 3, matchNo: first + 2, status: 'LIVE' } });
    expect(await run<boolean>((tx) => isStructureLocked(tx, mainDrawId))).toBe(true);
    expect(await run<boolean>((tx) => isStructureLocked(tx, groupDrawId))).toBe(false);
    expect(bye.matchNo).toBe(first);
  });

  it('allocateMatchNumbers hands out contiguous non-overlapping blocks under concurrency', async () => {
    const blocks = await Promise.all([5, 7, 3, 4].map((n) => run<number>((tx) => allocateMatchNumbers(tx, fx.eventId, n)).then((start) => ({ start, n }))));
    const sorted = blocks.sort((x, y) => x.start - y.start);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i]!.start).toBe(sorted[i - 1]!.start + sorted[i - 1]!.n);
    const counter = await kit.prisma.eventMatchCounter.findUniqueOrThrow({ where: { eventId: fx.eventId } });
    expect(counter.lastMatchNo).toBe(sorted[sorted.length - 1]!.start + sorted[sorted.length - 1]!.n - 1);
    await expect(run<number>((tx) => allocateMatchNumbers(tx, fx.eventId, 0))).rejects.toThrow(RangeError);
  });
});
