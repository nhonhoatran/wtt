import { existsSync } from 'node:fs';
import { readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueName } from '@kamito/shared';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { cleanupDraws } from '../support/draw-play-helpers.js';
import { deleteSnapshotsOfLists } from '../support/ranking-test-kit.js';
import { fullUiGuard, readWorld, type FullUiJournal } from './full-ui-contract.js';

it('removes only this full UI world after its isolated workers have stopped', async () => {
  const guard = fullUiGuard(), world = await readWorld(), base = path.dirname(guard.worldFile);
  const readyFile = process.env.E2E_FULL_UI_WORKER_READY_FILE;
  if (readyFile && existsSync(readyFile)) {
    const stopped = JSON.parse(await readFile(path.join(base, 'full-ui-worker-stopped.json'), 'utf8')) as { runId: string; stopped: boolean };
    if (!stopped.stopped || stopped.runId !== world.runId) throw new Error('Stop the owned workers before cleanup');
  }
  const journal = existsSync(guard.runFile) ? JSON.parse(await readFile(guard.runFile, 'utf8')) as FullUiJournal : undefined;
  if (journal && journal.runId !== world.runId) throw new Error('UI journal belongs to a different invocation');
  const kit = await AuthTestKit.start();
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  try {
    const catalog = world.owned.catalogIds;
    const privateRows = [
      catalog.tierId ? await kit.prisma.tier.findUnique({ where: { id: catalog.tierId }, select: { name: true } }) : null,
      catalog.eventTypeId ? await kit.prisma.eventType.findUnique({ where: { id: catalog.eventTypeId }, select: { name: true } }) : null,
      catalog.venueId ? await kit.prisma.venue.findUnique({ where: { id: catalog.venueId }, select: { name: true } }) : null,
      catalog.matchFormatId ? await kit.prisma.matchFormat.findUnique({ where: { id: catalog.matchFormatId }, select: { name: true } }) : null,
      catalog.groupRuleId ? await kit.prisma.groupScoringRule.findUnique({ where: { id: catalog.groupRuleId }, select: { name: true } }) : null,
      ...await kit.prisma.rankingList.findMany({ where: { id: { in: catalog.rankingListIds } }, select: { name: true } }),
    ];
    if (privateRows.some((row) => row && !row.name.includes(world.tag))) throw new Error('A foreign catalog ID appeared in the world; cleanup refused');
    const users = await kit.prisma.user.findMany({ where: { id: { in: world.owned.userIds } }, select: { id: true, email: true, name: true } });
    if (users.some((user) => !user.email.endsWith(`-${world.tag}@example.invalid`) || !user.name.includes(world.tag))) throw new Error('Foreign account ownership mismatch');
    // Bull Board creates metadata for all known queue names even when a processor is not started.
    for (const name of Object.values(QueueName)) {
      const queue = new Queue(name, { prefix: guard.prefix, connection: { url: process.env.REDIS_URL! } });
      try { expect(await queue.getWorkers(), 'No active worker may share this UUID namespace').toHaveLength(0); await queue.obliterate({ force: true }); }
      finally { await queue.close(); }
    }
    const events = catalog.eventTypeId ? await kit.prisma.event.findMany({ where: { eventTypeId: catalog.eventTypeId }, select: { id: true, name: true, subEvents: { select: { id: true } } } }) : [];
    if (events.some((event) => !event.name.includes(world.tag))) throw new Error('Foreign event references the owned catalog; cleanup refused');
    const eventIds = events.map((event) => event.id);
    for (const event of journal?.events ?? []) if (!eventIds.includes(event.id)) throw new Error('A journal event is outside the owned catalog');
    const tagged = await kit.prisma.player.findMany({ where: { fullName: { contains: world.tag } }, select: { id: true } });
    const playerIds = [...new Set([...world.owned.referencePlayerIds, ...tagged.map((row) => row.id)])];
    const lists = catalog.rankingListIds;
    const pairs = await kit.prisma.pair.findMany({ where: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] }, select: { id: true, playerAId: true, playerBId: true } });
    if (pairs.some((pair) => !playerIds.includes(pair.playerAId) || !playerIds.includes(pair.playerBId))) throw new Error('Foreign player shares an owned pair; cleanup refused');
    const competitors = await kit.prisma.competitor.findMany({ where: { OR: [{ playerId: { in: playerIds } }, { pairId: { in: pairs.map((pair) => pair.id) } }] }, select: { id: true } });
    const competitorIds = competitors.map((row) => row.id);
    expect(await kit.prisma.entry.count({ where: { competitorId: { in: competitorIds }, subEvent: { eventId: { notIn: eventIds } } } }), 'Foreign entries must survive').toBe(0);
    expect(await kit.prisma.rankingPointsEarned.count({ where: { playerId: { in: playerIds }, rankingListId: { notIn: lists } } }), 'Foreign points must survive').toBe(0);
    expect(await kit.prisma.rankingSnapshotRow.count({ where: { playerId: { in: playerIds }, snapshot: { rankingListId: { notIn: lists } } } }), 'Foreign snapshots must survive').toBe(0);
    if (lists.length) await deleteSnapshotsOfLists(kit, lists);
    await kit.prisma.rankingPointsEarned.deleteMany({ where: { rankingListId: { in: lists } } });
    for (const event of events) await cleanupDraws(kit, event.subEvents.map((sub) => sub.id), event.id);
    const jobs = await kit.prisma.importJob.findMany({ where: { eventId: { in: eventIds } }, select: { id: true } });
    await kit.prisma.importJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } });
    await kit.prisma.entry.deleteMany({ where: { subEvent: { eventId: { in: eventIds } } } });
    await kit.prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await kit.prisma.competitor.deleteMany({ where: { id: { in: competitorIds } } });
    await kit.prisma.pair.deleteMany({ where: { id: { in: pairs.map((pair) => pair.id) } } });
    await kit.prisma.player.deleteMany({ where: { id: { in: playerIds } } });
    await kit.prisma.rankingList.deleteMany({ where: { id: { in: lists } } });
    if (catalog.eventTypeId) await kit.prisma.rankingPointsRule.deleteMany({ where: { eventTypeId: catalog.eventTypeId } });
    if (catalog.eventTypeId) await kit.prisma.eventType.deleteMany({ where: { id: catalog.eventTypeId } });
    if (catalog.tierId) await kit.prisma.tier.deleteMany({ where: { id: catalog.tierId } });
    if (catalog.venueId) await kit.prisma.venue.deleteMany({ where: { id: catalog.venueId } });
    if (catalog.matchFormatId) await kit.prisma.matchFormat.deleteMany({ where: { id: catalog.matchFormatId } });
    if (catalog.groupRuleId) await kit.prisma.groupScoringRule.deleteMany({ where: { id: catalog.groupRuleId } });
    const entityIds = [...eventIds, ...playerIds, ...jobs.map((job) => job.id)];
    await kit.prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: world.owned.userIds } }, { entityId: { in: entityIds } }] } });
    await kit.prisma.user.deleteMany({ where: { id: { in: world.owned.userIds } } });
    let cursor = '0', deletedKeys = 0;
    do { const page = await redis.scan(cursor, 'MATCH', `${guard.prefix}:*`, 'COUNT', 200); cursor = page[0]; if (page[1].some((key) => !key.startsWith(`${guard.prefix}:`))) throw new Error('Redis ownership mismatch'); if (page[1].length) deletedKeys += await redis.del(...page[1]); } while (cursor !== '0');
    const uploadDir = path.resolve(process.env.UPLOAD_LOCAL_DIR ?? '');
    if (uploadDir !== path.join(base, 'uploads')) throw new Error('Refusing to remove storage outside the exact owned uploads directory');
    if (existsSync(uploadDir)) { if (await realpath(uploadDir) !== uploadDir) throw new Error('Owned upload directory must not be a symlink'); await rm(uploadDir, { recursive: true }); }
    const byTag = { name: { contains: world.tag } };
    const left = {
      events: await kit.prisma.event.count({ where: { OR: [{ id: { in: eventIds } }, byTag] } }),
      players: await kit.prisma.player.count({ where: { OR: [{ id: { in: playerIds } }, { fullName: { contains: world.tag } }] } }),
      users: await kit.prisma.user.count({ where: { OR: [{ id: { in: world.owned.userIds } }, { email: { endsWith: `-${world.tag}@example.invalid` } }] } }),
      lists: await kit.prisma.rankingList.count({ where: { OR: [{ id: { in: lists } }, byTag] } }),
      tiers: await kit.prisma.tier.count({ where: byTag }), eventTypes: await kit.prisma.eventType.count({ where: byTag }),
      venues: await kit.prisma.venue.count({ where: byTag }), formats: await kit.prisma.matchFormat.count({ where: byTag }), groupRules: await kit.prisma.groupScoringRule.count({ where: byTag }),
      redisKeys: 0,
    };
    do { const page = await redis.scan(cursor, 'MATCH', `${guard.prefix}:*`, 'COUNT', 200); cursor = page[0]; left.redisKeys += page[1].length; } while (cursor !== '0');
    expect(Object.values(left).every((count) => count === 0)).toBe(true);
    await writeFile(path.join(base, 'full-ui-cleanup.json'), JSON.stringify({ runId: world.runId, prefix: guard.prefix, left, deletedKeys, journalEvents: journal?.events?.length ?? 0, cleanupEvents: events.length }, null, 2));
  } finally { await redis.quit(); await kit.app.close(); }
}, 180_000);
