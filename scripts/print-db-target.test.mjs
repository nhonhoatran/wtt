import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeDbTarget, isTargetConfirmed } from './print-db-target.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'print-db-target.mjs');
const url = 'postgresql://kamito:s3cr%40t@db.internal:6543/kamito_tt_staging?sslmode=require';

function run(env) {
  return spawnSync(process.execPath, [script, '--confirm'], {
    cwd: path.dirname(script),
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
  });
}

test('describes the target without the password', () => {
  const target = describeDbTarget(url);
  assert.deepEqual(target, {
    host: 'db.internal',
    port: '6543',
    database: 'kamito_tt_staging',
    user: 'kamito',
    confirmKey: 'db.internal:6543/kamito_tt_staging',
  });
  assert.ok(!JSON.stringify(target).includes('s3cr'));
});

test('confirmation must match host/database exactly', () => {
  const target = describeDbTarget(url);
  assert.equal(isTargetConfirmed(target, 'db.internal:6543/kamito_tt_staging'), true);
  assert.equal(isTargetConfirmed(target, 'db.internal:6543/kamito_tt_production'), false);
  assert.equal(isTargetConfirmed(target, undefined), false);
});

test('--confirm exits non-zero on mismatch and never prints the password', () => {
  const result = run({ DATABASE_URL: url, MIGRATE_CONFIRM_TARGET: 'db.internal:5432/kamito_tt_staging' });
  assert.notEqual(result.status, 0);
  assert.ok(!`${result.stdout}${result.stderr}`.includes('s3cr'));
});

test('--confirm exits zero on match', () => {
  const result = run({ DATABASE_URL: url, MIGRATE_CONFIRM_TARGET: 'db.internal:6543/kamito_tt_staging' });
  assert.equal(result.status, 0, result.stderr);
});
