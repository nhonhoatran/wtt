import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { DrawFixtureKit } from './support/draw-fixtures.js';
import { API, cleanupFixtures, createEventFixtures, type Fixtures } from './support/entries-fixtures.js';
import { createScoringRule, finishGroupMatches } from './support/group-test-helpers.js';
import { openRevalidateQueue, removeOwn, tagsSince } from './support/revalidate-queue-probe.js';

describe('group standings writes refresh the public group pages (real Postgres + Redis)', () => {
  let kit: AuthTestKit;
  let cookie: string;
  let fx: Fixtures;
  let ruleId: string;
  let drawId: string;
  let groupId: string;
  let slug: string;
  let memberIds: string[];
  const startedAt = Date.now();
  const queue = openRevalidateQueue();

  const queuedSince = (since: number) => tagsSince(queue, since, fx.tag);

  beforeAll(async () => {
    kit = await AuthTestKit.start();
    cookie = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fx = await createEventFixtures(kit, cookie, ['MD']);
    slug = (await kit.prisma.event.findUniqueOrThrow({ where: { id: fx.eventId }, select: { slug: true } })).slug;
    const subEventId = fx.subEvents.MD!;
    ruleId = (await createScoringRule(kit, fx.tag, 'KEEP_PLAYED_RESULTS')).id;
    await kit.prisma.subEvent.update({ where: { id: subEventId }, data: { format: 'GROUP_KNOCKOUT', groupScoringRuleId: ruleId } });
    await new DrawFixtureKit(kit, cookie, fx).addEntries(subEventId, 0, 3);
    const created = await kit.write('post', `${API}/sub-events/${subEventId}/draws`, cookie, { kind: 'GROUP' }).expect(201);
    drawId = created.body.data.id;
    await kit.write('post', `${API}/draws/${drawId}/publish`, cookie, { expectedVersion: 0 }).expect(200);
    groupId = (await kit.prisma.group.findFirstOrThrow({ where: { drawId } })).id;
    const members = await kit.prisma.groupMember.findMany({ where: { groupId }, orderBy: { slot: 'asc' } });
    memberIds = members.map((m) => m.entryId);
    // A cycle (0 beats 1, 1 beats 2, 2 beats 0) leaves a three-way tie that only manual ranks can settle.
    const cyclic = new Map([[`${memberIds[0]}|${memberIds[1]}`, memberIds[0]!], [`${memberIds[1]}|${memberIds[2]}`, memberIds[1]!], [`${memberIds[0]}|${memberIds[2]}`, memberIds[2]!]]);
    await finishGroupMatches(kit, groupId, (a, b) => cyclic.get(`${a}|${b}`) ?? cyclic.get(`${b}|${a}`)!);
  }, 120_000);

  afterAll(async () => {
    if (kit) {
      if (fx) await kit.prisma.draw.deleteMany({ where: { subEventId: { in: Object.values(fx.subEvents) } } });
      await kit.prisma.auditLog.deleteMany({ where: { entityId: { in: [groupId, drawId].filter(Boolean) } } });
      if (fx) await kit.prisma.eventMatchCounter.deleteMany({ where: { eventId: fx.eventId } });
      await cleanupFixtures(kit, fx);
      if (ruleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: ruleId } });
      await kit.close();
    }
    if (fx) await removeOwn(queue, startedAt, fx.tag);
    await queue.close();
  }, 60_000);

  it('queues event, schedule, draw and groups tags after a recompute', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const since = Date.now();
    const res = await kit.write('post', `${API}/groups/${groupId}/recompute`, cookie).expect(200);
    expect(res.body.warnings).toBeUndefined();
    const tags = await queuedSince(since);
    for (const tag of [`event-${slug}`, `schedule-${slug}`, `draw-${slug}-MD`, `groups-${slug}-MD`]) expect(tags.has(tag), tag).toBe(true);
  });

  it('queues the same tags after manual ranks are saved', async () => {
    const group = await kit.prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const since = Date.now();
    const res = await kit
      .write('patch', `${API}/groups/${groupId}/manual-ranks`, cookie, { ranks: { [memberIds[0]!]: 1, [memberIds[1]!]: 2, [memberIds[2]!]: 3 }, reason: 'tie settled by lots', expectedVersion: group.version })
      .expect(200);
    expect(res.body.warnings).toBeUndefined();
    const tags = await queuedSince(since);
    for (const tag of [`event-${slug}`, `draw-${slug}-MD`, `groups-${slug}-MD`]) expect(tags.has(tag), tag).toBe(true);
  });
});
