import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { todayInTimezone } from '@kamito/shared';
import { hashPassword } from 'better-auth/crypto';
import { setCredentialPassword } from '../../src/modules/users/credential-account.js';
import { AuthTestKit } from '../support/auth-test-kit.js';
import { fullUiGuard, writeWorld, type FullUiWorld } from './full-ui-contract.js';
import { fullUiCatalog, fullUiExcel, fullUiReferences } from './full-ui-fixture.js';

let kit: AuthTestKit | undefined;
// Browser users must outlive setup; cleanup owns their exact IDs from the world manifest.
afterAll(async () => { await kit?.app.close(); });

it('prepares only full UI accounts, private configuration, references and Excel inputs', async () => {
  const { tag, prefix, worldFile, runFile, project } = fullUiGuard();
  if (existsSync(worldFile) || existsSync(runFile)) throw new Error('Use a new world and journal for each viewport invocation');
  const today = todayInTimezone('Asia/Ho_Chi_Minh');
  const day = (offset: number) => { const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
  const world = {
    runId: `${project}-${tag}`, tag, queuePrefix: prefix,
    apiOrigin: 'http://localhost:3371', adminOrigin: 'http://localhost:3372', siteOrigin: 'http://localhost:3373',
    today, oldEndDate: day(-1), oldStartDate: day(-2), newEventDate: today,
    users: {}, catalog: {}, ranking: {}, files: {},
    reference: { ambiguousName: `MS 00 ${tag}`, replacementName: `Replacement ${tag}` },
    owned: { userIds: [], catalogIds: { rankingListIds: [] }, referencePlayerIds: [] },
  } as unknown as FullUiWorld;
  await writeWorld(worldFile, world);
  kit = await AuthTestKit.start();
  for (const [key, role] of [['admin', 'ADMIN'], ['operator', 'RESULTS_OPERATOR']] as const) {
    const user = { id: randomUUID(), email: `full-ui-${key}-${tag}@example.invalid`, password: `Pw-${randomUUID()}` };
    const passwordHash = await hashPassword(user.password);
    await kit.prisma.$transaction(async (tx) => { await tx.user.create({ data: { id: user.id, email: user.email, name: `Full UI ${key} ${tag}`, role } }); await setCredentialPassword(tx, user.id, passwordHash); });
    world.users[key] = user; world.owned.userIds.push(user.id); await writeWorld(worldFile, world);
  }
  await fullUiCatalog(kit, world); await writeWorld(worldFile, world);
  await fullUiReferences(kit, world); await writeWorld(worldFile, world);
  await fullUiExcel(world, path.dirname(worldFile)); await writeWorld(worldFile, world);
  expect(world.owned.referencePlayerIds).toHaveLength(2);
  expect(await kit.prisma.event.count({ where: { eventTypeId: world.catalog.eventTypeId } })).toBe(0);
  console.log(`Full UI input world ready: ${project}; private UUID namespace; no core tournament data seeded`);
}, 120_000);
