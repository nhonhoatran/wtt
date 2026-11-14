import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { cleanupPublicWorld, type PublicWorld } from '../support/public-api-kit.js';
import type { E2eWorldFile } from './public-world.seed.js';

const target = process.env.E2E_WORLD_FILE;
let kit: AuthTestKit;

beforeAll(async () => {
  kit = await AuthTestKit.start();
}, 60_000);

afterAll(async () => {
  await kit?.close();
});

it('removes the seeded public world and its description file', async () => {
  if (!target) throw new Error('E2E_WORLD_FILE is required');
  if (!existsSync(target)) return;
  const { world } = JSON.parse(await readFile(target, 'utf8')) as E2eWorldFile;
  await cleanupPublicWorld(kit, world as PublicWorld);
  const left = await kit.prisma.event.count({ where: { id: world.fx.eventId } });
  expect(left).toBe(0);
  await rm(target);
}, 120_000);
