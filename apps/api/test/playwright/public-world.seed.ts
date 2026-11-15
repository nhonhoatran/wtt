import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { privateProfile, setupPublicWorld, type PublicWorld } from '../support/public-api-kit.js';
import { createLongEventFixture, type LongEventFixture } from './long-event-fixture.js';

/** What the Playwright specs need to know about the seeded world. */
export interface E2eWorldFile {
  world: Omit<PublicWorld, 'secret'>;
  eventName: string;
  eventNameEn: string | null;
  shownName: string;
  hiddenLegalName: string;
  playedMatchNo: number;
  groupMatchNo: number;
  scheduleVenueId: string;
  longEvent: LongEventFixture;
}

const target = process.env.E2E_WORLD_FILE;
let kit: AuthTestKit;

beforeAll(async () => {
  kit = await AuthTestKit.start();
}, 60_000);

afterAll(async () => {
  await kit?.close();
});

it('builds the public world and writes its description', async () => {
  if (!target) throw new Error('E2E_WORLD_FILE is required');
  const admin = await kit.createUser({ role: 'ADMIN' });
  const cookie = await kit.signIn(admin);
  const world = await setupPublicWorld(kit, cookie);
  const event = await kit.prisma.event.findUniqueOrThrow({ where: { id: world.fx.eventId } });
  const played = await kit.prisma.match.findFirstOrThrow({ where: { drawId: world.wsDrawId, games: { some: {} } } });
  const groupMatch = await kit.prisma.match.findFirstOrThrow({ where: { groupId: world.groupId, isVoided: false }, orderBy: { matchNo: 'asc' } });
  const venue = await kit.prisma.venue.create({
    data: { name: `Schedule venue ${world.tag}`, tables: { create: [{ code: 'T1', order: 0 }, { code: 'T2', order: 1 }] } },
    include: { tables: { orderBy: { order: 'asc' } } },
  });
  await kit.prisma.event.update({ where: { id: world.fx.eventId }, data: { venueId: venue.id, timezone: 'Asia/Ho_Chi_Minh' } });
  const session = async (code: string, name: string, nameEn: string, start: string) => kit.prisma.eventSession.create({
    data: {
      eventId: world.fx.eventId, venueId: venue.id, code, name, nameEn, date: new Date('2099-05-01'),
      startTime: new Date(`2099-05-01T${start}:00Z`),
      tables: { create: venue.tables.map((table, order) => ({ tableId: table.id, order })) },
    },
  });
  const morning = await session('S01', 'Buổi sáng', 'Morning session', '01:00');
  const afternoon = await session('S02', 'Buổi chiều', 'Afternoon session', '06:00');
  const wsMatches = await kit.prisma.match.findMany({ where: { drawId: world.wsDrawId }, orderBy: { matchNo: 'asc' } });
  for (const [index, match] of wsMatches.entries()) {
    await kit.prisma.match.update({ where: { id: match.id }, data: {
      sessionId: morning.id, tableId: venue.tables[index % 2]!.id,
      scheduledAt: new Date(`2099-05-01T01:${String(index * 20).padStart(2, '0')}:00Z`), orderInSession: index + 1,
    } });
  }
  await kit.prisma.match.update({ where: { id: groupMatch.id }, data: {
    sessionId: afternoon.id, tableId: venue.tables[0]!.id, scheduledAt: new Date('2099-05-01T06:00:00Z'), orderInSession: 1,
  } });
  // A scheduled draft draw must never appear in the public schedule.
  const draft = await kit.prisma.match.findFirstOrThrow({ where: { eventId: world.fx.eventId, draw: { status: 'DRAFT' } } });
  await kit.prisma.match.update({ where: { id: draft.id }, data: {
    sessionId: morning.id, tableId: venue.tables[0]!.id, scheduledAt: new Date('2099-05-01T02:00:00Z'), orderInSession: 4,
  } });
  // The SSR secret must not land on disk.
  const withoutSecret = Object.fromEntries(Object.entries(world).filter(([key]) => key !== 'secret')) as E2eWorldFile['world'];
  const file: E2eWorldFile = {
    world: withoutSecret,
    eventName: event.name,
    eventNameEn: event.nameEn,
    shownName: privateProfile(world.tag).displayName,
    hiddenLegalName: privateProfile(world.tag).legalName,
    playedMatchNo: played.matchNo,
    groupMatchNo: groupMatch.matchNo,
    scheduleVenueId: venue.id,
    longEvent: await createLongEventFixture(kit, cookie),
  };
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(file, null, 2));
  expect(file.world.slug).toBeTruthy();
}, 180_000);
