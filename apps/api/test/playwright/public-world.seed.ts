import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { privateProfile, setupPublicWorld, type PublicWorld } from '../support/public-api-kit.js';

/** What the Playwright specs need to know about the seeded world. */
export interface E2eWorldFile {
  world: Omit<PublicWorld, 'secret'>;
  eventName: string;
  eventNameEn: string | null;
  shownName: string;
  hiddenLegalName: string;
  playedMatchNo: number;
  groupMatchNo: number;
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
  const world = await setupPublicWorld(kit, await kit.signIn(admin));
  const event = await kit.prisma.event.findUniqueOrThrow({ where: { id: world.fx.eventId } });
  const played = await kit.prisma.match.findFirstOrThrow({ where: { drawId: world.wsDrawId, games: { some: {} } } });
  const groupMatch = await kit.prisma.match.findFirstOrThrow({ where: { groupId: world.groupId, isVoided: false }, orderBy: { matchNo: 'asc' } });
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
  };
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(file, null, 2));
  expect(file.world.slug).toBeTruthy();
}, 180_000);
