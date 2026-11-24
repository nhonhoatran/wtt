import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface UserFixture { id: string; email: string; password: string }
export interface FullUiWorld {
  runId: string; tag: string; queuePrefix: string;
  apiOrigin: string; adminOrigin: string; siteOrigin: string;
  today: string; oldEndDate: string; oldStartDate: string; newEventDate: string;
  users: { admin: UserFixture; operator: UserFixture };
  catalog: {
    eventTypeId: string; eventTypeName: string; venueId: string; venueName: string;
    matchFormatId: string; matchFormatName: string; groupRuleId: string; groupRuleName: string;
    msDisciplineName: string; wdDisciplineName: string;
  };
  ranking: { ms: ListFixture; wd: ListFixture; oldWinnerPoints: number; newWinnerPoints: number };
  files: { msXlsx: string; wdXlsx: string };
  reference: { ambiguousName: string; replacementName: string };
}
export interface ListFixture { id: string; code: string; name: string }
export interface SubFixture { id: string; code: string; hasQualifying: boolean; discipline: { code: string } }
export interface EventFixture { id: string; slug: string; name: string; subEvents: SubFixture[] }
export interface RunEvidence {
  runId: string; project: string;
  events: EventFixture[]; imports: string[]; draws: string[]; snapshots: string[]; sessions: string[];
  steps: { step: number; name: string; completedAt: string; detail: unknown }[];
  latencies: { eventId: string; matchNo: number; operation: string; elapsedMs: number }[];
  status: 'RUNNING' | 'PASSED' | 'FAILED';
  negativeOperatorReopen?: { status: number; method: 'supplemental-browser-context-request' };
}

function origin(value: string, label: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must be a loopback HTTP origin`);
  }
  return url.origin;
}

function artifactFile(value: string | undefined, label: string): string {
  const root = path.resolve(import.meta.dirname, '../../../../test-results');
  const filename = path.resolve(value ?? '');
  if (!filename.startsWith(root + path.sep) || path.extname(filename) !== '.json') {
    throw new Error(`${label} must be JSON inside root test-results`);
  }
  return filename;
}

export function readFullUiWorld(): FullUiWorld {
  const filename = artifactFile(process.env.E2E_FULL_UI_WORLD_FILE, 'E2E_FULL_UI_WORLD_FILE');
  const world = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, '')) as FullUiWorld;
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(world.tag)
    || world.runId !== `${process.env.E2E_FULL_UI_PROJECT}-${world.tag}`
    || world.queuePrefix !== `kamito-tt:test:full-ui:${world.tag}`
    || process.env.APP_ENV !== 'test' || process.env.QUEUE_PREFIX !== world.queuePrefix
    || process.env.REAL_TEST_DB_LEASE !== 'full-ui'
    || process.env.MIGRATE_CONFIRM_TARGET !== 'localhost:5433/kamito_tt_phase12_test') {
    throw new Error('The browser requires the exact guarded test namespace from its reference manifest');
  }
  if (!path.basename(path.dirname(filename)).includes(world.tag)) throw new Error('The manifest directory must identify its owned UUID');
  for (const [key, port] of [['apiOrigin', 3371], ['adminOrigin', 3372], ['siteOrigin', 3373]] as const) {
    if (origin(world[key], key) !== `http://localhost:${port}`) throw new Error('The manifest does not identify the leased full UI service ports');
  }
  if (process.env.E2E_ADMIN_URL && origin(process.env.E2E_ADMIN_URL, 'E2E_ADMIN_URL') !== world.adminOrigin) {
    throw new Error('The browser origin does not match the leased admin origin');
  }
  return world;
}

export async function saveEvidence(evidence: RunEvidence): Promise<void> {
  const filename = artifactFile(process.env.E2E_FULL_UI_RUN_FILE, 'E2E_FULL_UI_RUN_FILE');
  const worldFile = artifactFile(process.env.E2E_FULL_UI_WORLD_FILE, 'E2E_FULL_UI_WORLD_FILE');
  if (path.dirname(filename) !== path.dirname(worldFile)) throw new Error('The cleanup journal must stay beside its reference world');
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp`;
  await writeFile(temporary, JSON.stringify(evidence, null, 2));
  await rename(temporary, filename);
}
