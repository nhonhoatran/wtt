import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createRun, FULL_UI_PORTS, parseArguments, withRunLease } from './admin-full-flow-contract.mjs';
import { assertFreePorts, command, ready, startNode, stopProcess, waitFor } from './admin-full-flow-process.mjs';

const root = path.resolve(import.meta.dirname, '..');
const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log('Usage: node [--env-file=<test-env>] scripts/admin-full-flow.mjs <desktop|mobile> --run [--skip-build]');
  console.log('Requires DATABASE_URL, MIGRATE_CONFIRM_TARGET, REDIS_URL, REAL_TEST_DB_LEASE=full-ui. Migrate and seed the isolated test stack first.');
} else await main();

async function main() {
  const run = createRun(root, options.project, process.env);
  const envPath = path.join(root, '.env');
  const envHash = () => existsSync(envPath) ? createHash('sha256').update(readFileSync(envPath)).digest('hex') : null;
  const originalEnvHash = envHash();
  // Resolve prerequisites before acquiring process/fixture resources.
  const requireRoot = createRequire(path.join(root, 'package.json'));
  const requireApi = createRequire(path.join(root, 'apps/api/package.json'));
  const requireClient = createRequire(path.join(root, 'apps/client/package.json'));
  const vitest = path.join(path.dirname(requireApi.resolve('vitest/package.json')), 'vitest.mjs');
  const turbo = path.join(path.dirname(requireRoot.resolve('turbo/package.json')), 'bin/turbo');
  const next = requireClient.resolve('next/dist/bin/next');
  const playwright = path.join(path.dirname(requireClient.resolve('@playwright/test/package.json')), 'cli.js');
  await assertFreePorts(FULL_UI_PORTS);
  const resultsRoot = path.join(root, 'test-results');
  await mkdir(resultsRoot, { recursive: true });
  const interruption = new AbortController();
  const signal = () => interruption.abort(new Error('Full UI run interrupted'));
  process.once('SIGINT', signal); process.once('SIGTERM', signal);
  try {
    await withRunLease(path.join(resultsRoot, 'admin-full-flow.lock'), { runId: run.runId, pid: process.pid }, async () => {
      const apiOptions = { ...run, cwd: path.join(root, 'apps/api'), signal: interruption.signal };
      const seed = (name) => command(name, [vitest, 'run', '-c', 'vitest.playwright.config.ts', `test/playwright/${name}.seed.ts`], apiOptions);
      const services = [];
      let workers, setupAttempted = false, error, cleanupError;
      const checkInterrupted = () => interruption.signal.throwIfAborted();
      let shutdownPromise;
      const shutdown = () => shutdownPromise ??= (async () => {
        const failures = [];
        if (workers && !workers.exited) {
          try {
            await writeFile(run.env.E2E_FULL_UI_WORKER_STOP_FILE, JSON.stringify({ runId: run.runId }));
            await Promise.race([workers.done, delay(30_000, null, { ref: false })]);
          } catch (failure) { failures.push(failure); }
        }
        const stopped = await Promise.allSettled([...services, ...(workers ? [workers] : [])].map(stopProcess));
        failures.push(...stopped.filter((item) => item.status === 'rejected').map((item) => item.reason));
        if (failures.length) throw new AggregateError(failures, 'Could not shut down every owned full UI process');
      })();
      await mkdir(run.directory, { recursive: false });
      console.log(`Full UI ${options.project}: ${path.relative(root, run.directory)}`);
      try {
        checkInterrupted();
        if (options.build) await command('build', [turbo, 'run', 'build', '--env-mode=loose'], { ...run, cwd: root, signal: interruption.signal });
        checkInterrupted();
        setupAttempted = true;
        await seed('full-ui-setup');
        checkInterrupted();
        services.push(startNode('api', ['dist/main.js'], apiOptions));
        services.push(startNode('admin', [path.join(root, 'scripts/admin-full-flow-admin.mjs')], { ...run, cwd: root }));
        services.push(startNode('client', [next, 'start', '--port', '3373'], { ...run, cwd: path.join(root, 'apps/client') }));
        await waitFor(async () => (await Promise.all([
          ready('http://localhost:3371/api/v1/health/ready'), ready('http://localhost:3372/config.json'), ready('http://localhost:3373/api/health'),
        ])).every(Boolean), services, 'API, admin and client', 120_000, interruption.signal);
        workers = startNode('workers', [vitest, 'run', '-c', 'vitest.playwright.config.ts', 'test/playwright/full-ui-workers.seed.ts'], apiOptions);
        await waitFor(() => existsSync(run.env.E2E_FULL_UI_WORKER_READY_FILE), [...services, workers], 'owned workers', 120_000, interruption.signal);
        checkInterrupted();
        await command('playwright', [playwright, 'test', '-c', 'playwright.admin-full-flow.config.ts'], {
          ...run, cwd: path.join(root, 'apps/client'), timeoutMs: 31 * 60_000, guards: [...services, workers], signal: interruption.signal,
        });
        if ([...services, workers].some((state) => state.exited)) throw new Error('An owned service exited before the browser flow finished');
      } catch (failure) { error ??= failure; }
      finally {
        let stopped = false;
        try { await shutdown(); stopped = true; }
        catch (failure) { cleanupError = failure; }
        if (stopped && setupAttempted && existsSync(run.env.E2E_FULL_UI_WORLD_FILE)) {
          // A native worker crash cannot write its graceful-stop marker. The child/tree is stopped
          // above; cleanup independently verifies Redis has no active workers in this UUID namespace.
          const cleanupEnv = { ...run.env };
          if (!existsSync(path.join(run.directory, 'full-ui-worker-stopped.json'))) delete cleanupEnv.E2E_FULL_UI_WORKER_READY_FILE;
          try { await command('cleanup', [vitest, 'run', '-c', 'vitest.playwright.config.ts', 'test/playwright/full-ui-cleanup.seed.ts'], { ...apiOptions, env: cleanupEnv, signal: undefined }); }
          catch (failure) { cleanupError = failure; }
        }
        const unchanged = originalEnvHash === envHash();
        if (!unchanged) error ??= new Error('Root .env changed during the run');
        if (interruption.signal.aborted) error ??= interruption.signal.reason;
        if (workers?.result?.code !== 0 && workers) error ??= new Error('Owned workers did not exit cleanly; inspect workers.log');
        await writeFile(path.join(run.directory, 'result.json'), JSON.stringify({
          runId: run.runId, passed: !error && !cleanupError, envUnchanged: unchanged,
          error: error?.message ?? null, cleanupError: cleanupError?.message ?? null,
          processes: [...services, ...(workers ? [workers] : [])].map((state) => state.result),
        }, null, 2));
      }
      if (error || cleanupError) throw error ?? cleanupError;
      console.log(`Full UI ${options.project} passed; owned fixtures cleaned; root .env unchanged.`);
    });
  } finally {
    process.removeListener('SIGINT', signal); process.removeListener('SIGTERM', signal);
  }
}
