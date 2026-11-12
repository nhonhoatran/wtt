import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docker/admin-entrypoint.sh');

function runEntrypointFiles(extraEnv) {
  const outDir = mkdtempSync(path.join(tmpdir(), 'admin-config-'));
  try {
    const env = { PATH: process.env.PATH, ADMIN_CONFIG_OUTPUT_DIR: outDir, UPLOAD_MAX_IMAGE_BYTES: '5242880', IMPORT_MAX_FILE_BYTES: '5242880', ...extraEnv };
    execFileSync('sh', [script], { env, stdio: 'pipe' });
    return {
      config: JSON.parse(readFileSync(path.join(outDir, 'config.json'), 'utf8')),
      uploadLimit: readFileSync(path.join(outDir, 'upload-limit.conf'), 'utf8'),
      importLimit: readFileSync(path.join(outDir, 'import-limit.conf'), 'utf8'),
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const runEntrypoint = (extraEnv) => runEntrypointFiles(extraEnv).config;

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

test('nginx upload limit follows UPLOAD_MAX_IMAGE_BYTES', () => {
  assert.equal(runEntrypointFiles({ UPLOAD_MAX_IMAGE_BYTES: '20971520' }).uploadLimit, 'client_max_body_size 20971520;\n');
});

test('a missing or non-numeric UPLOAD_MAX_IMAGE_BYTES stops the container instead of writing config', () => {
  assert.throws(() => runEntrypointFiles({ UPLOAD_MAX_IMAGE_BYTES: '5m; evil' }));
  assert.throws(() => runEntrypointFiles({ UPLOAD_MAX_IMAGE_BYTES: '' }));
});

test('nginx import limit follows IMPORT_MAX_FILE_BYTES and rejects bad values', () => {
  assert.equal(runEntrypointFiles({ IMPORT_MAX_FILE_BYTES: '10485760' }).importLimit, 'client_max_body_size 10485760;\n');
  assert.throws(() => runEntrypointFiles({ IMPORT_MAX_FILE_BYTES: '5m; evil' }));
  assert.throws(() => runEntrypointFiles({ IMPORT_MAX_FILE_BYTES: '' }));
});
