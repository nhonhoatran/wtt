import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { startWorkerHealthServer, type WorkerHealthState } from './worker-health-server.js';

describe('worker health server', () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());

  it('serves the current state on /health and 404 elsewhere', async () => {
    let state: WorkerHealthState = { status: 'ok' };
    const server = await startWorkerHealthServer(0, () => state);
    close = () => server.close();
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: 'ok' });
    state = { status: 'degraded', detail: 'x' };
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ status: 'degraded', detail: 'x' });
    expect((await fetch(`${base}/other`)).status).toBe(404);
  });
});
