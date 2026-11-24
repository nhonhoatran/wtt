import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFullUiWorld } from '../admin-full-flow/world';

const keys = ['APP_ENV', 'QUEUE_PREFIX', 'REAL_TEST_DB_LEASE', 'MIGRATE_CONFIRM_TARGET', 'E2E_FULL_UI_WORLD_FILE', 'E2E_FULL_UI_PROJECT', 'E2E_ADMIN_URL'] as const;
let before: (string | undefined)[];
let dir: string;
let tag: string;
let world: { runId: string; tag: string; queuePrefix: string; apiOrigin: string; adminOrigin: string; siteOrigin: string };
const save = () => writeFileSync(process.env.E2E_FULL_UI_WORLD_FILE!, JSON.stringify(world));

beforeEach(() => {
  before = keys.map((key) => process.env[key]);
  tag = randomUUID();
  dir = path.resolve(import.meta.dirname, '../../../../test-results', `full-ui-guard-${tag}`);
  mkdirSync(dir, { recursive: true });
  world = { runId: `desktop-${tag}`, tag, queuePrefix: `kamito-tt:test:full-ui:${tag}`,
    apiOrigin: 'http://localhost:3371', adminOrigin: 'http://localhost:3372', siteOrigin: 'http://localhost:3373' };
  Object.assign(process.env, { APP_ENV: 'test', QUEUE_PREFIX: world.queuePrefix, REAL_TEST_DB_LEASE: 'full-ui',
    MIGRATE_CONFIRM_TARGET: 'localhost:5433/kamito_tt_phase12_test', E2E_FULL_UI_PROJECT: 'desktop',
    E2E_FULL_UI_WORLD_FILE: path.join(dir, 'world.json'), E2E_ADMIN_URL: world.adminOrigin });
  save();
});

afterEach(() => {
  keys.forEach((key, index) => { if (before[index] === undefined) delete process.env[key]; else process.env[key] = before[index]; });
  rmSync(dir, { recursive: true, force: true });
});

describe('full UI browser lease guard without network access', () => {
  it('accepts only its UUID world, explicit lease and confirmed local test target', () => {
    expect(readFullUiWorld().runId).toBe(world.runId);
  });
  it('refuses the world when the full UI lease is absent', () => {
    delete process.env.REAL_TEST_DB_LEASE;
    expect(() => readFullUiWorld()).toThrow('exact guarded test namespace');
  });
  it('refuses a different queue namespace even on the same local ports', () => {
    process.env.QUEUE_PREFIX = `kamito-tt:test:full-ui:${randomUUID()}`;
    expect(() => readFullUiWorld()).toThrow('exact guarded test namespace');
  });
  it('refuses a different service port instead of probing an unrelated local application', () => {
    world.apiOrigin = 'http://localhost:3000'; save();
    expect(() => readFullUiWorld()).toThrow('leased full UI service ports');
  });
  it('refuses an unconfirmed database target before any browser request', () => {
    process.env.MIGRATE_CONFIRM_TARGET = 'localhost:5433/another_database';
    expect(() => readFullUiWorld()).toThrow('exact guarded test namespace');
  });
});
