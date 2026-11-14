import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { markRankingDirty } from '../../src/modules/ranking-jobs/ranking-dirty-marker.js';
import type { AuthTestKit } from './auth-test-kit.js';

export interface RankingDeps {
  prisma: unknown;
  enqueueRecompute: (subEventId: string) => Promise<void>;
  now?: () => Date;
  snapshotBatchSize?: number;
}

export interface SnapshotBlockedErrorLike extends Error {
  listId: string;
  subEventIds: string[];
}

// The worker package is not an api dependency (rootDir), so its processors load by file URL and are typed here.
export interface RankingProcessors {
  recomputeSubEvent(deps: RankingDeps, subEventId: string): Promise<'recomputed' | 'missing'>;
  buildSnapshot(
    deps: RankingDeps,
    input: { listId: string; asOf: string },
  ): Promise<{ outcome: 'built'; snapshotId: string; rows: number } | { outcome: 'missing' }>;
  sweepDirtySubEvents(deps: RankingDeps): Promise<{ found: number; enqueued: number; failed: number }>;
  SnapshotBlockedError: new (listId: string, subEventIds: string[]) => SnapshotBlockedErrorLike;
}

export async function loadRankingProcessors(): Promise<RankingProcessors> {
  const dir = path.resolve(import.meta.dirname, '../../../worker/src/processors');
  const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(path.join(dir, file)).href) as Promise<Record<string, unknown>>;
  const [recompute, snapshot, sweep] = await Promise.all([
    load('ranking-recompute-processor.ts'),
    load('ranking-snapshot-processor.ts'),
    load('ranking-dirty-sweep-processor.ts'),
  ]);
  return { ...recompute, ...snapshot, ...sweep } as unknown as RankingProcessors;
}

/** Marks through the API's own marker so tests exercise the production statement. */
export async function markDirtySql(kit: AuthTestKit, subEventId: string): Promise<void> {
  await kit.prisma.$transaction((tx) => markRankingDirty(tx, [subEventId]));
}

export async function dirtyAt(kit: AuthTestKit, subEventId: string): Promise<string | null> {
  const rows = await kit.prisma.$queryRaw<{ t: string | null }[]>`SELECT "rankingDirtyAt"::text AS t FROM "SubEvent" WHERE "id" = ${subEventId}`;
  return rows[0]?.t ?? null;
}

export interface RankingWorld {
  tag: string;
  tierId: string;
  eventTypeId: string;
  listId: string;
  eventId: string;
  subEventId: string;
  kind: 'SINGLES' | 'DOUBLES';
  playerIds: string[];
  nextMatchNo: number;
}

export interface WorldOptions {
  kind?: 'SINGLES' | 'DOUBLES';
  endDate?: string;
  validityDays?: number;
  groupStageByRank?: boolean;
  isCancelled?: boolean;
  withList?: boolean;
}

/** Private tier, event type, list, event and sub-event so tests never touch (or depend on) shared catalog rows. */
export async function createRankingWorld(kit: AuthTestKit, options: WorldOptions = {}): Promise<RankingWorld> {
  const { prisma } = kit;
  const tag = randomUUID().slice(0, 8);
  const kind = options.kind ?? 'SINGLES';
  const tier = await prisma.tier.create({ data: { code: `RT-${tag}`, name: `Rank tier ${tag}`, colorHex: '#123456' } });
  const eventType = await prisma.eventType.create({ data: { code: `RE-${tag}`, name: `Rank type ${tag}`, tierId: tier.id } });
  const list = await prisma.rankingList.create({
    data: {
      code: `RL-${tag}`,
      name: `Rank list ${tag}`,
      competitorKind: kind,
      genderRule: 'MEN',
      validityDays: options.validityDays ?? 365,
      groupStageByRank: options.groupStageByRank ?? false,
    },
  });
  const event = await prisma.event.create({
    data: {
      slug: `rank-${tag}`,
      name: `Rank event ${tag}`,
      eventTypeId: eventType.id,
      startDate: new Date('2099-05-01T00:00:00Z'),
      endDate: new Date(`${options.endDate ?? '2099-05-02'}T00:00:00Z`),
      timezone: 'Asia/Ho_Chi_Minh',
      isCancelled: options.isCancelled ?? false,
    },
  });
  const discipline = await prisma.discipline.findFirstOrThrow({ where: { competitorKind: kind } });
  const matchFormat = await prisma.matchFormat.findFirstOrThrow();
  const subEvent = await prisma.subEvent.create({
    data: {
      eventId: event.id,
      disciplineId: discipline.id,
      code: discipline.code,
      format: 'KNOCKOUT',
      matchFormatId: matchFormat.id,
      rankingListId: options.withList === false ? null : list.id,
    },
  });
  return { tag, tierId: tier.id, eventTypeId: eventType.id, listId: list.id, eventId: event.id, subEventId: subEvent.id, kind, playerIds: [], nextMatchNo: 1 };
}

export interface RuleSeed {
  stageCode: string;
  points: number;
  drawKind?: 'MAIN' | 'QUALIFYING' | 'GROUP';
  effectiveFrom?: string;
}

export async function addRules(kit: AuthTestKit, world: RankingWorld, rules: RuleSeed[]): Promise<void> {
  await kit.prisma.rankingPointsRule.createMany({
    data: rules.map((rule) => ({
      eventTypeId: world.eventTypeId,
      competitorKind: world.kind,
      drawKind: rule.drawKind ?? 'MAIN',
      stageCode: rule.stageCode,
      points: rule.points,
      effectiveFrom: new Date(`${rule.effectiveFrom ?? '2000-01-01'}T00:00:00Z`),
      createdById: 'ranking-test',
    })),
  });
}

/** Singles entries (one player each) or doubles entries (two players each); returns entry ids in order. */
export async function addEntries(kit: AuthTestKit, world: RankingWorld, count: number): Promise<{ entryIds: string[]; playersByEntry: string[][] }> {
  const { prisma } = kit;
  const perEntry = world.kind === 'DOUBLES' ? 2 : 1;
  const base = world.playerIds.length;
  const total = count * perEntry;
  const players = Array.from({ length: total }, (_, i) => {
    const n = base + i;
    return { id: randomUUID(), code: `RK${world.tag}${n}`, slug: `rk-${world.tag}-${n}`, fullName: `Rank Player ${world.tag} ${String(n).padStart(4, '0')}`, normalizedName: `rank player ${world.tag} ${n}`, gender: 'MALE' as const, countryCode: 'VN' };
  });
  await prisma.player.createMany({ data: players });
  world.playerIds.push(...players.map((p) => p.id));

  const entryIds: string[] = [];
  const playersByEntry: string[][] = [];
  for (let i = 0; i < count; i += 1) {
    const mine = players.slice(i * perEntry, (i + 1) * perEntry).map((p) => p.id);
    const competitor =
      perEntry === 1
        ? await prisma.competitor.create({ data: { type: 'PLAYER', playerId: mine[0]!, displayName: `P${i}` } })
        : await prisma.competitor.create({
            data: { type: 'PAIR', displayName: `Pair${i}`, pair: { create: { playerAId: [...mine].sort()[0]!, playerBId: [...mine].sort()[1]! } } },
          });
    const entry = await prisma.entry.create({ data: { subEventId: world.subEventId, competitorId: competitor.id } });
    entryIds.push(entry.id);
    playersByEntry.push(mine);
  }
  return { entryIds, playersByEntry };
}

/** Published snapshots are immutable by trigger, so cleanup lifts the triggers inside one transaction. */
export async function deleteSnapshotsOfLists(kit: AuthTestKit, listIds: string[]): Promise<void> {
  await kit.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('ALTER TABLE "RankingSnapshotRow" DISABLE TRIGGER USER');
    await tx.$executeRawUnsafe('ALTER TABLE "RankingSnapshot" DISABLE TRIGGER USER');
    await tx.rankingSnapshot.deleteMany({ where: { rankingListId: { in: listIds } } });
    await tx.$executeRawUnsafe('ALTER TABLE "RankingSnapshotRow" ENABLE TRIGGER USER');
    await tx.$executeRawUnsafe('ALTER TABLE "RankingSnapshot" ENABLE TRIGGER USER');
  });
}

export async function cleanupRankingWorld(kit: AuthTestKit, worlds: RankingWorld[]): Promise<void> {
  const { prisma } = kit;
  const listIds = worlds.map((w) => w.listId);
  const eventIds = worlds.map((w) => w.eventId);
  const playerIds = worlds.flatMap((w) => w.playerIds);
  await deleteSnapshotsOfLists(kit, listIds);
  await prisma.rankingPointsEarned.deleteMany({ where: { OR: [{ rankingListId: { in: listIds } }, { playerId: { in: playerIds } }] } });
  await prisma.draw.deleteMany({ where: { subEvent: { eventId: { in: eventIds } } } });
  await prisma.entry.deleteMany({ where: { subEvent: { eventId: { in: eventIds } } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  const pairs = await prisma.pair.findMany({ where: { playerAId: { in: playerIds } }, select: { id: true } });
  await prisma.competitor.deleteMany({ where: { OR: [{ playerId: { in: playerIds } }, { pairId: { in: pairs.map((p) => p.id) } }] } });
  await prisma.pair.deleteMany({ where: { id: { in: pairs.map((p) => p.id) } } });
  await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  await prisma.rankingList.deleteMany({ where: { id: { in: listIds } } });
  await prisma.rankingPointsRule.deleteMany({ where: { eventTypeId: { in: worlds.map((w) => w.eventTypeId) } } });
  await prisma.eventType.deleteMany({ where: { id: { in: worlds.map((w) => w.eventTypeId) } } });
  await prisma.tier.deleteMany({ where: { id: { in: worlds.map((w) => w.tierId) } } });
}
