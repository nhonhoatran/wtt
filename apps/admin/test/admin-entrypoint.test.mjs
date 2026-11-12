import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docker/admin-entrypoint.sh');

function runEntrypoint(extraEnv) {
  const outDir = mkdtempSync(path.join(tmpdir(), 'admin-config-'));
  try {
    execFileSync('sh', [script], { env: { PATH: process.env.PATH, ADMIN_CONFIG_OUTPUT_DIR: outDir, ...extraEnv } });
    return JSON.parse(readFileSync(path.join(outDir, 'config.json'), 'utf8'));
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

test('config.json contains only allowlisted keys', () => {
  const config = runEntrypoint({
    API_BASE_PATH: '/api/v1',
    ADMIN_PUBLIC_URL: 'https://admin.example.test',
    PUBLIC_SITE_URL: 'https://example.test',
    AUTH_SECRET: 'must-not-leak',
    DATABASE_URL: 'postgresql://u:p@h/db',
    S3_SECRET_ACCESS_KEY: 'must-not-leak',
  });
  assert.deepEqual(Object.keys(config).sort(), ['ADMIN_PUBLIC_URL', 'API_BASE_PATH', 'PUBLIC_SITE_URL']);
  assert.equal(config.ADMIN_PUBLIC_URL, 'https://admin.example.test');
  assert.ok(!JSON.stringify(config).includes('must-not-leak'));
});

test('values are JSON-escaped and missing keys become empty strings', () => {
  const config = runEntrypoint({ API_BASE_PATH: 'a"b\\c' });
  assert.equal(config.API_BASE_PATH, 'a"b\\c');
  assert.equal(config.PUBLIC_SITE_URL, '');
});
