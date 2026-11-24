import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TestUser } from '../support/auth-test-kit.js';

export interface FullUiWorld {
  runId: string; tag: string; queuePrefix: string;
  apiOrigin: string; adminOrigin: string; siteOrigin: string;
  today: string; oldEndDate: string; oldStartDate: string; newEventDate: string;
  users: { admin: TestUser; operator: TestUser };
  catalog: { eventTypeId: string; eventTypeName: string; venueId: string; venueName: string; matchFormatId: string; matchFormatName: string; groupRuleId: string; groupRuleName: string; msDisciplineName: string; wdDisciplineName: string };
  ranking: { ms: { id: string; code: string; name: string }; wd: { id: string; code: string; name: string }; oldWinnerPoints: number; newWinnerPoints: number };
  files: { msXlsx: string; wdXlsx: string };
  reference: { ambiguousName: string; replacementName: string };
  owned: { userIds: string[]; catalogIds: { tierId?: string; eventTypeId?: string; venueId?: string; matchFormatId?: string; groupRuleId?: string; rankingListIds: string[] }; referencePlayerIds: string[] };
}
export interface FullUiJournal {
  runId: string;
  events?: { id: string; slug: string; name: string; subEvents?: { id: string; code: string }[] }[];
  imports?: string[]; draws?: string[]; snapshots?: string[]; sessions?: string[];
  steps?: unknown[]; latencies?: unknown;
}

export function fullUiGuard(): { tag: string; prefix: string; worldFile: string; runFile: string; project: string } {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'localhost' || url.port !== '5433' || url.pathname !== '/kamito_tt_phase12_test' || url.search || url.hash
    || process.env.MIGRATE_CONFIRM_TARGET !== 'localhost:5433/kamito_tt_phase12_test' || process.env.APP_ENV !== 'test' || process.env.REAL_TEST_DB_LEASE !== 'full-ui') throw new Error('The confirmed full UI test target and lease are required');
  const prefix = process.env.QUEUE_PREFIX ?? '';
  const match = /^kamito-tt:test:full-ui:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(prefix);
  if (!match) throw new Error('Full UI requires a dedicated UUID queue namespace');
  const redis = new URL(process.env.REDIS_URL ?? '');
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(redis.hostname)) throw new Error('Full UI requires local Redis');
  const project = process.env.E2E_FULL_UI_PROJECT;
  if (!['desktop', 'mobile'].includes(project ?? '')) throw new Error('Select one full UI viewport per fresh world');
  const resultDir = path.resolve(import.meta.dirname, '../../../../test-results');
  const scoped = (value: string | undefined) => { const file = path.resolve(value ?? ''); if (!file.startsWith(resultDir + path.sep) || !file.endsWith('.json')) throw new Error('Full UI artifacts must be JSON under root test-results'); return file; };
  const worldFile = scoped(process.env.E2E_FULL_UI_WORLD_FILE), runFile = scoped(process.env.E2E_FULL_UI_RUN_FILE);
  if (path.dirname(worldFile) !== path.dirname(runFile) || !path.dirname(worldFile).includes(match[1]!)) throw new Error('World/journal must share a fresh UUID-owned directory');
  return { tag: match[1]!, prefix, worldFile, runFile, project: project! };
}

export async function writeWorld(file: string, world: FullUiWorld): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(world, null, 2), { mode: 0o600 });
  await rename(temp, file);
}
export async function readWorld(): Promise<FullUiWorld> {
  const guard = fullUiGuard();
  const world = JSON.parse(await readFile(guard.worldFile, 'utf8')) as FullUiWorld;
  if (world.tag !== guard.tag || world.queuePrefix !== guard.prefix || world.runId !== `${guard.project}-${guard.tag}`) throw new Error('World ownership does not match the current run');
  for (const [field, port] of [['apiOrigin', 3371], ['adminOrigin', 3372], ['siteOrigin', 3373]] as const) if (world[field] !== `http://localhost:${port}`) throw new Error('Unexpected full UI service origin');
  return world;
}
