import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { confirmTarget, createRun, FULL_UI_TARGET, parseArguments, withRunLease } from './admin-full-flow-contract.mjs';
import { assertFreePorts, command, startNode, stopProcess, waitFor } from './admin-full-flow-process.mjs';

const tag = '12345678-1234-4123-8123-123456789abc';
const source = { DATABASE_URL: 'postgresql://u:secret@localhost:5433/kamito_tt_phase12_test',
  MIGRATE_CONFIRM_TARGET: FULL_UI_TARGET, REDIS_URL: 'redis://localhost:6380', REAL_TEST_DB_LEASE: 'full-ui' };

test('execution requires a viewport and an explicit run flag', () => {
  assert.deepEqual(parseArguments(['mobile', '--run', '--skip-build']), { project: 'mobile', build: false });
  for (const args of [[], ['desktop'], ['desktop', '--run', '--unknown'], ['tablet', '--run']]) assert.throws(() => parseArguments(args));
});

test('rejects dev, remote, unconfirmed and query-bearing database targets without leaking credentials', () => {
  for (const change of [
    { DATABASE_URL: source.DATABASE_URL.replace('kamito_tt_phase12_test', 'kamito_tt_dev') },
    { DATABASE_URL: source.DATABASE_URL.replace('localhost', 'remote.invalid') },
    { DATABASE_URL: `${source.DATABASE_URL}?schema=other` },
    { MIGRATE_CONFIRM_TARGET: 'localhost:5433/other_test' }, { REAL_TEST_DB_LEASE: '' },
    { REDIS_URL: 'redis://remote.invalid:6380' },
  ]) assert.throws(() => confirmTarget({ ...source, ...change }), (error) => !error.message.includes('secret'));
});

test('creates UUID-owned storage/artifacts, fixed origins and unique shared test secrets without changing source', () => {
  const before = { ...source };
  const root = path.join(os.tmpdir(), 'full-ui-contract');
  const run = createRun(root, 'desktop', source, tag);
  assert.deepEqual(source, before);
  assert.equal(run.env.QUEUE_PREFIX, `kamito-tt:test:full-ui:${tag}`);
  assert.equal(run.env.UPLOAD_LOCAL_DIR, path.join(run.directory, 'uploads'));
  assert.equal(run.env.E2E_FULL_UI_WORLD_FILE, path.join(run.directory, 'world.json'));
  assert.equal(run.env.API_INTERNAL_URL, 'http://localhost:3371');
  assert.equal(run.env.PUBLIC_SITE_URL, 'http://localhost:3373');
  const secrets = ['AUTH_SECRET', 'REVALIDATE_SECRET', 'SSR_INTERNAL_SECRET', 'IP_HASH_SALT'].map((key) => run.env[key]);
  assert.equal(new Set(secrets).size, 4);
  assert.ok(secrets.every((secret) => secret.length >= 32));
});

test('refuses an occupied port and preserves the original listener', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '::', resolve));
  try { await assert.rejects(assertFreePorts([server.address().port]), /occupied/); assert.ok(server.listening); }
  finally { await new Promise((resolve) => server.close(resolve)); }
});

test('process manager records a nonzero exit and rejects the command', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-process-'));
  try {
    await assert.rejects(command('broken', ['-e', 'process.exit(7)'], { cwd: directory, env: process.env, directory }), /exit 7/);
    const result = JSON.parse((await readFile(path.join(directory, 'process-exits.jsonl'), 'utf8')).trim());
    assert.equal(result.name, 'broken'); assert.equal(result.code, 7);
    assert.deepEqual(result.runtime, { node: process.versions.node, uv: process.versions.uv,
      v8: process.versions.v8, platform: process.platform, arch: process.arch });
    assert.ok(Number.isFinite(Date.parse(result.startedAt)));
    assert.ok(Date.parse(result.endedAt) >= Date.parse(result.startedAt));
    assert.ok(Number.isSafeInteger(result.durationMs) && result.durationMs >= 0);
    assert.equal(result.exitCodeHex, process.platform === 'win32' ? '0x00000007' : null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Windows native status is recorded in hex without accepting or retrying the failed command', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-native-status-'));
  try {
    // Deliberately return the status; this does not cause an actual native crash.
    await assert.rejects(command('native-status', ['-e', 'process.exit(-1073740791)'], {
      cwd: directory, env: process.env, directory,
    }), /failed \(exit/);
    const exits = (await readFile(path.join(directory, 'process-exits.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(exits.length, 1);
    assert.equal(exits[0].exitCodeHex, '0xc0000409');
    assert.equal(exits[0].code >>> 0, 3221226505);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a dead service stops the browser command promptly and leaves no active child', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-guard-'));
  const options = { cwd: directory, env: process.env, directory };
  let service;
  try {
    service = startNode('service', ['-e', 'setTimeout(() => process.exit(9), 100)'], options);
    await assert.rejects(command('browser', ['-e', 'setInterval(() => {}, 1000)'], { ...options, guards: [service] }), /service exited/);
    const exits = (await readFile(path.join(directory, 'process-exits.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(exits.length, 2);
    assert.ok(exits.some((exit) => exit.name === 'browser'));
  } finally { await stopProcess(service); await rm(directory, { recursive: true, force: true }); }
});

test('CLI rejects an unsafe target before trying to load app dependencies', () => {
  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'admin-full-flow.mjs'), 'desktop', '--run'], {
    env: { ...process.env, ...source, DATABASE_URL: source.DATABASE_URL.replace('kamito_tt_phase12_test', 'kamito_tt_dev') }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /confirmed/);
  assert.ok(!result.stderr.includes('u:secret'));
});

test('a failed run releases its lease, while a concurrent run cannot replace it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-lease-'));
  const file = path.join(directory, 'run.lock');
  try {
    await assert.rejects(withRunLease(file, { runId: 'first' }, async () => {
      await assert.rejects(withRunLease(file, { runId: 'second' }, async () => assert.fail('Must not acquire another run\'s lease')), /holds the lease/);
      assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { runId: 'first' });
      throw new Error('Run directory or prerequisite failed');
    }), /prerequisite failed/);
    assert.equal(existsSync(file), false);
    await withRunLease(file, { runId: 'retry' }, async () => assert.ok(existsSync(file)));
    assert.equal(existsSync(file), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('missing dependencies do not strand the CLI lease or load any application', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-missing-deps-'));
  try {
    await mkdir(path.join(directory, 'scripts'));
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    for (const file of ['admin-full-flow.mjs', 'admin-full-flow-contract.mjs', 'admin-full-flow-process.mjs']) {
      await copyFile(path.join(import.meta.dirname, file), path.join(directory, 'scripts', file));
    }
    const result = spawnSync(process.execPath, [path.join(directory, 'scripts/admin-full-flow.mjs'), 'desktop', '--run'], {
      cwd: directory, env: { ...process.env, ...source, NODE_PATH: '' }, encoding: 'utf8', timeout: 10_000,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Cannot find module/);
    assert.equal(existsSync(path.join(directory, 'test-results/admin-full-flow.lock')), false);
    assert.ok(!result.stderr.includes('u:secret'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an unwritable log fails before starting its child', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-log-'));
  try {
    await mkdir(path.join(directory, 'blocked.log'));
    const marker = path.join(directory, 'child-started');
    assert.throws(() => startNode('blocked', ['-e', 'require("fs").writeFileSync(process.argv[1], "started")', marker], { cwd: directory, env: process.env, directory }));
    assert.equal(existsSync(marker), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('exit-record write errors reject cleanly instead of causing unhandled rejection', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-record-'));
  try {
    await mkdir(path.join(directory, 'process-exits.jsonl'));
    await assert.rejects(command('record-failure', ['-e', 'console.log("finished")'], { cwd: directory, env: process.env, directory }), /could not write/);
    assert.match(await readFile(path.join(directory, 'record-failure.log'), 'utf8'), /finished/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const running = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };

test('aborting a command stops both the tool and its nested child', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-abort-'));
  const controller = new AbortController();
  const marker = path.join(directory, 'nested-pid.json');
  let childPid;
  const task = command('tool', ['-e', 'const child = require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio:"ignore"}); require("fs").writeFileSync(process.argv[1], JSON.stringify({pid:process.pid, child:child.pid})); setInterval(() => {}, 1000)', marker], {
    cwd: directory, env: process.env, directory, signal: controller.signal,
  });
  // Attach the rejection handler before aborting: the test also detects leaked rejections.
  const rejected = assert.rejects(task, /interrupted/);
  try {
    await waitFor(() => existsSync(marker), [], 'test child', 5000);
    const pids = JSON.parse(await readFile(marker, 'utf8')); childPid = pids.child;
    assert.ok(running(pids.pid)); assert.ok(running(childPid));
    controller.abort(new Error('Test interruption'));
    await rejected;
    await waitFor(() => !running(childPid), [], 'nested child exit', 5000);
    assert.equal(running(pids.pid), false);
  } finally {
    controller.abort();
    await rejected;
    if (childPid && running(childPid)) process.kill(childPid, 'SIGKILL');
    await rm(directory, { recursive: true, force: true });
  }
});

test('readiness polling responds to interruption without waiting for timeout', async () => {
  const controller = new AbortController();
  const waiting = waitFor(() => false, [], 'unavailable service', 120_000, controller.signal);
  controller.abort(new Error('Stop waiting'));
  await assert.rejects(waiting, /aborted/);
});

test('POSIX shutdown still stops an owned group after its tool parent exits', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'full-ui-orphan-'));
  const marker = path.join(directory, 'pid.json');
  let state, childPid;
  try {
    state = startNode('parent', ['-e', 'const child=require("child_process").spawn(process.execPath,["-e","setInterval(() => {}, 1000)"],{stdio:"ignore"}); child.unref(); require("fs").writeFileSync(process.argv[1], JSON.stringify(child.pid));', marker], { cwd: directory, env: process.env, directory });
    await state.done;
    childPid = JSON.parse(await readFile(marker, 'utf8'));
    assert.ok(running(childPid));
    await stopProcess(state);
    await waitFor(() => !running(childPid), [], 'orphaned child exit', 5000);
  } finally {
    await stopProcess(state);
    if (childPid && running(childPid)) process.kill(childPid, 'SIGKILL');
    await rm(directory, { recursive: true, force: true });
  }
});
