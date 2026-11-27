import { spawn } from 'node:child_process';
import { createWriteStream, openSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function assertFreePorts(ports) {
  for (const port of ports) {
    await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', () => reject(new Error(`Port ${port} is occupied; existing services will not be reused or stopped`)));
      server.listen({ port, host: '::', exclusive: true }, () => server.close(resolve));
    });
  }
}

export function startNode(name, args, { cwd, env, directory }) {
  // Open synchronously so a missing/unwritable log cannot leave a launched child behind.
  const log = createWriteStream('', { fd: openSync(path.join(directory, `${name}.log`), 'wx', 0o600) });
  const logDone = finished(log, { cleanup: true });
  void logDone.catch(() => {});
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const state = { name, child, exited: false, result: null, logError: false };
  log.once('error', () => { state.logError = true; void stopProcess(state).catch(() => {}); });
  state.done = new Promise((resolve) => {
    let launchError = false;
    child.once('error', () => { launchError = true; });
    child.once('close', async (code, signal) => {
      state.exited = true;
      state.result = {
        name, pid: child.pid, code, signal, launchError,
        startedAt, endedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started),
        runtime: { node: process.versions.node, uv: process.versions.uv, v8: process.versions.v8,
          platform: process.platform, arch: process.arch },
        // Keep the original numeric exit. Windows can report the same native status signed or unsigned.
        exitCodeHex: process.platform === 'win32' && Number.isInteger(code)
          ? `0x${(code >>> 0).toString(16).padStart(8, '0')}` : null,
      };
      log.end();
      try { await logDone; } catch { state.result.logError = true; }
      try { await appendFile(path.join(directory, 'process-exits.jsonl'), `${JSON.stringify(state.result)}\n`); }
      catch { state.result.recordError = true; }
      resolve(state.result);
    });
  });
  return state;
}

export async function command(name, args, options) {
  options.signal?.throwIfAborted();
  const state = startNode(name, args, options);
  const timeout = options.timeoutMs ?? 10 * 60_000;
  let onAbort;
  const aborted = new Promise((resolve) => {
    onAbort = () => resolve({ aborted: true });
    options.signal?.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const result = await Promise.race([state.done, delay(timeout, null, { ref: false }), aborted,
      ...(options.guards ?? []).map((guard) => guard.done.then(() => ({ stoppedService: guard.name }))),
    ]);
    if (!result) { await stopProcess(state); throw new Error(`${name} timed out; inspect its owned log`); }
    if (result.aborted) { await stopProcess(state); throw new Error(`${name} interrupted; inspect its owned log`); }
    if (result.stoppedService) { await stopProcess(state); throw new Error(`${result.stoppedService} exited during ${name}; inspect its owned log`); }
    if (result.logError || result.recordError) throw new Error(`${name} could not write its owned log or exit record`);
    if (result.code !== 0) throw new Error(`${name} failed (exit ${result.code}, signal ${result.signal}); inspect its owned log`);
    return result;
  } finally { options.signal?.removeEventListener('abort', onAbort); }
}

export async function waitFor(check, processes, label, timeoutMs = 120_000, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const exited = processes.find((item) => item.exited);
    if (exited) throw new Error(`${exited.name} exited while waiting for ${label}; inspect its owned log`);
    if (await check()) return;
    await delay(250, undefined, { signal });
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export async function ready(url) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok; }
  catch { return false; }
}

export async function stopProcess(state) {
  if (!state) return;
  return state.stopping ??= (async () => {
    const signalGroup = (signal) => {
      if (!state.child.pid) return;
      try { process.kill(-state.child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    if (process.platform === 'win32') {
      if (!state.exited && state.child.pid) await new Promise((resolve, reject) => {
        const killer = spawn('taskkill.exe', ['/PID', String(state.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', reject);
        killer.once('close', resolve);
      });
    } else signalGroup('SIGTERM');
    await Promise.race([state.done, delay(5000, null, { ref: false })]);
    // A tool may exit before its own children; terminate the owned POSIX group as well.
    if (process.platform !== 'win32') signalGroup('SIGKILL');
    else if (!state.exited) state.child.kill('SIGKILL');
    await Promise.race([state.done, delay(5000, null, { ref: false })]);
    if (!state.exited) throw new Error(`Could not stop owned ${state.name} process`);
  })();
}
