import { it } from 'vitest';
import { fullUiWorkers } from './full-ui-worker-harness.js';

it('runs only UUID-owned production import, ranking and revalidation processors until the stop signal', async () => {
  await fullUiWorkers();
}, Number(process.env.E2E_FULL_UI_WORKER_TIMEOUT_MS ?? 1800000) + 60000);
