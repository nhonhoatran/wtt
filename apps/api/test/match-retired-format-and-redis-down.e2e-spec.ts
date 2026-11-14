import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RevalidationEnqueueService } from '../src/modules/revalidation/revalidation-enqueue.service.js';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { MatchApi, straightWin } from './support/match-flow-helpers.js';

describe('group match under a round-level format: retirement and a dead Redis (real Postgres)', () => {
  let kit: AuthTestKit;
  let fx: Fixtures;
  let api: MatchApi;
  let ruleId: string;
  let formatId: string;
  let drawId: string;
  let groupId: string;

  const sub = () => fx.subEvents.MD!;
  const matches = () => kit.prisma.match.findMany({ where: { groupId }, orderBy: [{ round: { number: 'asc' } }, { orderInRound: 'asc' }] });
  const standing = (entryId: string) => kit.prisma.groupStanding.findUniqueOrThrow({ where: { groupId_entryId: { groupId, entryId } } });

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    const cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    api = new MatchApi(kit, cookie);
    fx = await createEventFixtures(kit, cookie, ['MD']);
    ruleId = (
      await kit.prisma.groupScoringRule.create({
        data: {
          name: `Award ${fx.tag}`,
          pointsWin: 2,
          pointsLoss: 1,
          pointsWalkoverLoss: 0,
          pointsUnfinishedLoss: 0,
          unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER',
          awardedGamePoints: null,
          withdrawalPolicy: 'KEEP_PLAYED_RESULTS',
          tiebreakers: ['GAME_RATIO'],
        },
      })
    ).id;
    formatId = (await kit.prisma.matchFormat.create({ data: { name: `Round Bo3 ${fx.tag}`, bestOf: 3, pointsPerGame: 21, winBy: 2, estimatedMinutes: 20, isDefault: false } })).id;
    await kit.prisma.subEvent.update({ where: { id: sub() }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
    await new DrawFixtureKit(kit, cookie, fx).addEntries(sub(), 0, 3);
    const created = await kit.write('post', `${API}/sub-events/${sub()}/draws`, cookie, { kind: 'GROUP' }).expect(201);
    drawId = created.body.data.id;
    await kit.write('post', `${API}/draws/${drawId}/publish`, cookie, { expectedVersion: created.body.data.version }).expect(200);
    groupId = (await kit.prisma.group.findFirstOrThrow({ where: { drawId } })).id;

    const [first] = await matches();
    const draw = await kit.prisma.draw.findUniqueOrThrow({ where: { id: drawId } });
    await kit.write('patch', `${API}/rounds/${first!.roundId}`, cookie, { matchFormatId: formatId, expectedVersion: draw.version }).expect(200);
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await cleanupFixtures(kit, fx);
    if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    if (formatId) await kit.prisma.matchFormat.deleteMany({ where: { id: formatId } });
    await kit.close();
  }, 60_000);

  it('confirms RETIRED with the winner short of the games needed and scores it under the round format', async () => {
    const [match] = await matches();
    const detail = await api.detail(match!.id);
    expect(detail.format).toMatchObject({ bestOf: 3, pointsPerGame: 21 });
    const subFormat = await kit.prisma.matchFormat.findFirstOrThrow({ where: { subEvents: { some: { id: sub() } } } });
    expect(subFormat.bestOf).not.toBe(3);

    const res = await api.post(`/matches/${match!.id}/confirm`, {
      expectedVersion: match!.version,
      resultType: 'RETIRED',
      winnerSide: 1,
      games: [{ score1: 21, score2: 10 }, { score1: 5, score2: 5 }],
    });
    expect(res.status).toBe(200);
    expect(await kit.prisma.match.findUniqueOrThrow({ where: { id: match!.id } })).toMatchObject({ status: 'OFFICIAL', resultType: 'RETIRED', winnerSide: 1, games1: 1, games2: 0 });

    // Bo3 round format: one game was won, so one more is awarded (not two, as the sub-event's longer format would give).
    const winner = await standing(match!.side1EntryId!);
    expect(winner).toMatchObject({ gamesFor: 2, gamesAgainst: 0, pointsFor: 21 + 5 + 21 });
  });

  it('still answers 200 with PUBLIC_REFRESH_DELAYED when Redis is unreachable', async () => {
    const enqueue = kit.app.get(RevalidationEnqueueService) as unknown as { queue: Queue };
    const live = enqueue.queue;
    enqueue.queue = new Queue('revalidate', { connection: { url: 'redis://127.0.0.1:1', enableOfflineQueue: false, maxRetriesPerRequest: 1 }, prefix: 'kamito-tt:dead' });
    enqueue.queue.on('error', () => undefined);
    try {
      const next = (await matches()).find((m) => m.status === 'SCHEDULED')!;
      const detail = await api.detail(next.id);
      const res = await api.post(`/matches/${next.id}/confirm`, { expectedVersion: next.version, resultType: 'NORMAL', games: straightWin(detail.format, 1) });
      expect(res.status).toBe(200);
      expect(res.body.warnings).toEqual(expect.arrayContaining(['PUBLIC_REFRESH_DELAYED']));
      expect(await kit.prisma.match.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({ status: 'OFFICIAL' });
    } finally {
      await enqueue.queue.close();
      enqueue.queue = live;
    }
  });
});
