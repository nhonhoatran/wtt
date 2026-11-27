import { randomBytes, randomUUID } from 'node:crypto';
import { open, rm } from 'node:fs/promises';
import path from 'node:path';

export const FULL_UI_TARGET = 'localhost:5433/kamito_tt_phase12_test';
export const FULL_UI_PORTS = [3371, 3372, 3373];

export async function withRunLease(file, owner, execute) {
  const lease = await open(file, 'wx').catch(() => {
    throw new Error('Another full UI run holds the lease; inspect test-results/admin-full-flow.lock before retrying');
  });
  try {
    await lease.writeFile(JSON.stringify(owner));
    return await execute();
  } finally {
    try { await lease.close(); }
    finally { await rm(file, { force: true }); }
  }
}

export function parseArguments(args) {
  if (args.includes('--help')) return { help: true };
  const [project, ...flags] = args;
  if (!['desktop', 'mobile'].includes(project) || !flags.includes('--run')
    || flags.some((flag) => !['--run', '--skip-build'].includes(flag))) {
    throw new Error('Usage: node scripts/admin-full-flow.mjs <desktop|mobile> --run [--skip-build]');
  }
  return { project, build: !flags.includes('--skip-build') };
}

export function confirmTarget(env) {
  let database, redis;
  try { database = new URL(env.DATABASE_URL); redis = new URL(env.REDIS_URL); }
  catch { throw new Error('Provide DATABASE_URL and REDIS_URL for the isolated local test stack'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || database.hostname !== 'localhost'
    || database.port !== '5433' || database.pathname !== '/kamito_tt_phase12_test' || database.search || database.hash
    || env.MIGRATE_CONFIRM_TARGET !== FULL_UI_TARGET || env.REAL_TEST_DB_LEASE !== 'full-ui') {
    throw new Error(`Full UI requires the confirmed ${FULL_UI_TARGET} target and REAL_TEST_DB_LEASE=full-ui`);
  }
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(redis.hostname)) {
    throw new Error('Full UI requires local Redis');
  }
}

export function createRun(root, project, source, tag = randomUUID()) {
  confirmTarget(source);
  if (!['desktop', 'mobile'].includes(project) || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(tag)) {
    throw new Error('A viewport and fresh UUID are required');
  }
  const runId = `${project}-${tag}`;
  const directory = path.join(root, 'test-results', `admin-full-flow-${runId}`);
  const env = {
    ...source, APP_ENV: 'test', NODE_ENV: 'production', TZ: 'UTC', LOG_LEVEL: 'warn',
    QUEUE_PREFIX: `kamito-tt:test:full-ui:${tag}`, API_PORT: '3371',
    API_INTERNAL_URL: 'http://localhost:3371', ADMIN_PUBLIC_URL: 'http://localhost:3372',
    PUBLIC_SITE_URL: 'http://localhost:3373', CLIENT_INTERNAL_URL: 'http://localhost:3373',
    REVALIDATE_ALLOWED_HOSTS: 'localhost:3373', API_BASE_PATH: '/api/v1',
    API_FETCH_TIMEOUT_MS: '5000', PUBLIC_REVALIDATE_SECONDS: '300', MATCHDAY_REVALIDATE_SECONDS: '30',
    STORAGE_DRIVER: 'local', UPLOAD_LOCAL_DIR: path.join(directory, 'uploads'),
    UPLOAD_MAX_IMAGE_BYTES: '5242880', UPLOAD_ALLOWED_IMAGE_TYPES: 'image/jpeg,image/png,image/webp',
    MEDIA_IMAGE_VARIANT_WIDTHS: '320,640,1280', IMPORT_MAX_FILE_BYTES: '5242880',
    IMPORT_MAX_UNZIPPED_BYTES: '52428800', IMPORT_MAX_ROWS: '5000',
    E2E_FULL_UI_PROJECT: project, E2E_FULL_UI_WORLD_FILE: path.join(directory, 'world.json'),
    E2E_FULL_UI_RUN_FILE: path.join(directory, 'run.json'), E2E_FULL_UI_OUTPUT_DIR: directory,
    E2E_FULL_UI_WORKER_READY_FILE: path.join(directory, 'worker-ready.json'),
    E2E_FULL_UI_WORKER_STOP_FILE: path.join(directory, 'worker-stop.json'),
    E2E_FULL_UI_WORKER_TIMEOUT_MS: '1800000', E2E_ADMIN_URL: 'http://localhost:3372',
  };
  // Every process in this run shares these test-only secrets; none are written to a tracked file.
  for (const key of ['AUTH_SECRET', 'REVALIDATE_SECRET', 'SSR_INTERNAL_SECRET', 'IP_HASH_SALT']) env[key] = randomBytes(32).toString('hex');
  return { runId, directory, env };
}
