import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { cleanupDraws } from './support/draw-play-helpers.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule, finishGroupMatches } from './support/group-test-helpers.js';
import { dirtyAt } from './support/ranking-test-kit.js';

interface Format {
  bestOf: number;
  pointsPerGame: number;
}
const straightWin = (f: Format) => Array.from({ length: Math.ceil(f.bestOf / 2) }, () => ({ score1: f.pointsPerGame, score2: 0 }));

describe('ranking recompute triggers mark the sub-event dirty (real Postgres)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let fx: Fixtures;
  let players: DrawFixtureKit;
  let ruleId: string;
  let singlesListId: string;
  let doublesListId: string;
  let drawId: string;
  let drawVersion: number;
  let spare: string[];

  const ms = () => fx.subEvents.MS!;
  const md = () => fx.subEvents.MD!;
  const write = (method: 'post' | 'patch', path: string, body: object = {}) => kit.write(method, `${API}${path}`, cookie, body);
  const clearDirty = () => kit.prisma.$executeRaw`UPDATE "SubEvent" SET "rankingDirtyAt" = NULL WHERE "eventId" = ${fx.eventId}`;
  /** Runs `act` from a clean state and reports whether the sub-event ended up dirty. */
  const dirtyAfter = async (subEventId: string, act: () => Promise<unknown>) => {
    await clearDirty();
    await act();
    return (await dirtyAt(kit, subEventId)) !== null;
  };

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, cookie, ['MS', 'MD']);
    players = new DrawFixtureKit(kit, cookie, fx);
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    const make = (kind: 'SINGLES' | 'DOUBLES') =>
      kit.prisma.rankingList.create({ data: { code: `TR-${kind[0]}-${fx.tag}`, name: `Trigger ${kind} ${fx.tag}`, competitorKind: kind, genderRule: 'MEN', validityDays: 365 } });
    singlesListId = (await make('SINGLES')).id;
    doublesListId = (await make('DOUBLES')).id;
  }, 120_000);

  afterAll(async () => {
    if (!kit) return;
    const matchIds = (await kit.prisma.match.findMany({ where: { eventId: fx?.eventId }, select: { id: true } })).map((m) => m.id);
    await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: matchIds } } });
    await cleanupDraws(kit, Object.values(fx?.subEvents ?? {}), fx?.eventId);
    await kit.prisma.rankingPointsEarned.deleteMany({ where: { rankingListId: { in: [singlesListId, doublesListId].filter(Boolean) } } });
    await kit.prisma.subEvent.updateMany({ where: { eventId: fx?.eventId }, data: { rankingListId: null } });
    await cleanupFixtures(kit, fx);
    await kit.prisma.rankingList.deleteMany({ where: { id: { in: [singlesListId, doublesListId].filter(Boolean) } } });
    await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
    await kit.close();
  }, 60_000);

  it('sub-event: setting or clearing rankingListId marks dirty, an unchanged value does not, a list of the wrong kind is refused', async () => {
    const url = `/events/${fx.eventId}/sub-events/${ms()}`;
    const wrong = await write('patch', url, { rankingListId: doublesListId }).expect(422);
    expect(wrong.body.error.fields).toHaveProperty('rankingListId');
    expect(await dirtyAfter(ms(), () => write('patch', url, { rankingListId: singlesListId }).expect(200))).toBe(true);
    expect(await dirtyAfter(ms(), () => write('patch', url, { rankingListId: singlesListId }).expect(200))).toBe(false);
    expect(await dirtyAfter(ms(), () => write('patch', url, { rankingListId: null }).expect(200))).toBe(true);
    await write('patch', url, { rankingListId: singlesListId }).expect(200);

    const wd = await kit.prisma.discipline.findFirstOrThrow({ where: { code: 'WD' } });
    const create = await write('post', `/events/${fx.eventId}/sub-events`, { disciplineId: wd.id, format: 'KNOCKOUT', rankingListId: singlesListId });
    expect(create.status).toBe(422);
    const bulk = await write('post', `/events/${fx.eventId}/sub-events/bulk`, { items: [{ disciplineId: wd.id }], defaults: { format: 'KNOCKOUT', rankingListId: singlesListId } });
    expect(bulk.status).toBe(422);
    await write('patch', url, { rankingListId: 'not-a-uuid' }).expect(422);
  });

  it('event: endDate, eventTypeId and cancel/uncancel mark ranked sub-events, other edits do not', async () => {
    const url = `/events/${fx.eventId}`;
    expect(await dirtyAfter(ms(), () => write('patch', url, { name: `Renamed ${fx.tag}` }).expect(200))).toBe(false);
    expect(await dirtyAfter(ms(), () => write('patch', url, { endDate: '2099-05-04' }).expect(200))).toBe(true);
    expect(await dirtyAfter(md(), () => write('patch', url, { endDate: '2099-05-05' }).expect(200))).toBe(false);

    const current = await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId }, select: { eventTypeId: true } });
    const other = await kit.prisma.eventType.findFirst({ where: { isActive: true, id: { not: current.eventTypeId } } });
    if (other) {
      expect(await dirtyAfter(ms(), () => write('patch', url, { eventTypeId: other.id }).expect(200))).toBe(true);
      await write('patch', url, { eventTypeId: current.eventTypeId }).expect(200);
    }

    expect(await dirtyAfter(ms(), () => write('post', `${url}/cancel`).expect(200))).toBe(true);
    expect(await dirtyAfter(ms(), () => write('post', `${url}/cancel`).expect(200))).toBe(false);
    expect(await dirtyAfter(ms(), () => write('post', `${url}/uncancel`).expect(200))).toBe(true);
  });

  it('entry: withdrawing or restoring marks dirty, a seed-only edit does not; bulk withdraw marks dirty', async () => {
    spare = await players.addEntries(ms(), 10, 3);
    const [first, second, third] = spare as [string, string, string];
    expect(await dirtyAfter(ms(), () => write('patch', `/entries/${first}`, { seed: 1 }).expect(200))).toBe(false);
    expect(await dirtyAfter(ms(), () => write('patch', `/entries/${first}`, { status: 'WITHDRAWN' }).expect(200))).toBe(true);
    expect(await dirtyAfter(ms(), () => write('patch', `/entries/${first}`, { status: 'CONFIRMED' }).expect(200))).toBe(true);
    expect(await dirtyAfter(ms(), () => write('post', '/entries/bulk', { ids: [second, third], action: 'withdraw' }).expect(200))).toBe(true);
    expect(await dirtyAfter(ms(), () => write('post', '/entries/bulk', { ids: [second], action: 'setQuota', quotaType: 'WILDCARD' }).expect(200))).toBe(false);
    await kit.prisma.entry.deleteMany({ where: { id: { in: spare } } });
  });

  describe('published knockout', () => {
    beforeAll(async () => {
      await players.addEntries(ms(), 0, 8, { seeds: 2 });
      const created = await write('post', `/sub-events/${ms()}/draws`, { kind: 'MAIN', seedCount: 2 }).expect(201);
      drawId = created.body.data.id;
      drawVersion = created.body.data.version;
    });

    it('publish marks dirty only when pending walkovers are settled', async () => {
      const [real] = await kit.prisma.match.findMany({ where: { drawId, round: { number: 1 }, resultType: null }, orderBy: { orderInRound: 'asc' } });
      await kit.prisma.match.update({ where: { id: real!.id }, data: { resultType: 'WALKOVER', status: 'SCHEDULED', winnerSide: 1 } });
      expect(await dirtyAfter(ms(), async () => {
        drawVersion = (await write('post', `/draws/${drawId}/publish`, { expectedVersion: drawVersion }).expect(200)).body.data.version;
      })).toBe(true);
      expect((await kit.prisma.match.findUniqueOrThrow({ where: { id: real!.id } })).status).toBe('OFFICIAL');
    });

    it('confirming a result marks dirty', async () => {
      const [target] = await kit.prisma.match.findMany({ where: { drawId, round: { number: 1 }, resultType: null, status: 'SCHEDULED' } });
      const format = (await kit.get(`${API}/matches/${target!.id}`, cookie).expect(200)).body.data.format as Format;
      expect(
        await dirtyAfter(ms(), () =>
          write('post', `/matches/${target!.id}/confirm`, { expectedVersion: target!.version, resultType: 'NORMAL', games: straightWin(format) }).expect(200),
        ),
      ).toBe(true);
    });

    it('replace-entry and withdraw-entry mark dirty; a dry run does not', async () => {
      const extra = await players.addEntries(ms(), 20, 2);
      const unplayed = await kit.prisma.match.findMany({
        where: { drawId, round: { number: 1 }, resultType: null, status: 'SCHEDULED', side1EntryId: { not: null }, side2EntryId: { not: null } },
        orderBy: { orderInRound: 'asc' },
      });
      const match = unplayed[0]!;
      const position = await kit.prisma.bracketPosition.findFirstOrThrow({ where: { drawId, entryId: match.side2EntryId! } });
      const version = async () => (await kit.prisma.draw.findUniqueOrThrow({ where: { id: drawId } })).version;

      expect(
        await dirtyAfter(ms(), () =>
          write('post', `/draws/${drawId}/replace-entry`, { positionId: position.id, newEntryId: extra[0], reason: 'late substitute', expectedVersion: drawVersion, dryRun: true }).expect(200),
        ),
      ).toBe(false);
      expect(
        await dirtyAfter(ms(), () =>
          write('post', `/draws/${drawId}/replace-entry`, { positionId: position.id, newEntryId: extra[0], reason: 'late substitute', expectedVersion: drawVersion }).expect(200),
        ),
      ).toBe(true);
      drawVersion = await version();

      expect(
        await dirtyAfter(ms(), () =>
          write('post', `/draws/${drawId}/withdraw-entry`, { entryId: match.side1EntryId, reason: 'injury', expectedVersion: drawVersion }).expect(200),
        ),
      ).toBe(true);
    });
  });

  describe('group stage', () => {
    let groupId: string;
    let members: string[];

    beforeAll(async () => {
      await kit.prisma.subEvent.update({ where: { id: md() }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
      await players.addEntries(md(), 30, 3);
      const created = await write('post', `/sub-events/${md()}/draws`, { kind: 'GROUP' }).expect(201);
      await write('post', `/draws/${created.body.data.id}/publish`, { expectedVersion: 0 }).expect(200);
      const row = await kit.prisma.group.findFirstOrThrow({ where: { drawId: created.body.data.id }, include: { members: { orderBy: { slot: 'asc' } } } });
      groupId = row.id;
      members = row.members.map((m) => m.entryId);
      const cyclic = new Map([[`${members[0]}|${members[1]}`, members[0]!], [`${members[1]}|${members[2]}`, members[1]!], [`${members[0]}|${members[2]}`, members[2]!]]);
      await finishGroupMatches(kit, groupId, (a, b) => cyclic.get(`${a}|${b}`) ?? cyclic.get(`${b}|${a}`)!);
    });

    it('group recompute and manual ranks mark dirty', async () => {
      expect(await dirtyAfter(md(), () => write('post', `/groups/${groupId}/recompute`).expect(200))).toBe(true);
      const version = (await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } })).version;
      const ranks = { [members[0]!]: 1, [members[1]!]: 2, [members[2]!]: 3 };
      expect(await dirtyAfter(md(), () => write('patch', `/groups/${groupId}/manual-ranks`, { ranks, reason: 'tie settled by lots', expectedVersion: version }).expect(200))).toBe(true);
    });
  });
});
