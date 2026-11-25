import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { watchEventDataChanges } from '../src/pages/event-hub/event-progress-signals.ts';

const ROOTS = new Set(['sub-events', 'counts']);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup(eventId = 'ev1') {
  const client = new QueryClient();
  let signals = 0;
  const stop = watchEventDataChanges(client, eventId, ROOTS, () => (signals += 1));
  return { client, stop, signals: () => signals };
}
const load = (client, key, data) => client.fetchQuery({ queryKey: key, queryFn: async () => data, staleTime: 0 });

test('first load and identical refetches (window focus) do not signal', async () => {
  const { client, stop, signals } = await setup();
  await load(client, ['sub-events', 'ev1'], { rows: [1] });
  await load(client, ['sub-events', 'ev1'], { rows: [1] });
  await load(client, ['counts', 'ev1'], { n: 1 });
  await wait(250);
  assert.equal(signals(), 0);
  stop();
});

test('a real data change signals once even when several queries change together', async () => {
  const { client, stop, signals } = await setup();
  await load(client, ['sub-events', 'ev1'], { rows: [1] });
  await load(client, ['counts', 'ev1'], { n: 1 });
  await load(client, ['sub-events', 'ev1'], { rows: [1, 2] });
  await load(client, ['counts', 'ev1'], { n: 2 });
  await wait(250);
  assert.equal(signals(), 1);
  stop();
});

test('queries of another event or an unrelated root are ignored', async () => {
  const { client, stop, signals } = await setup();
  await load(client, ['sub-events', 'other'], { rows: [1] });
  await load(client, ['sub-events', 'other'], { rows: [2] });
  await load(client, ['unrelated', 'ev1'], 1);
  await load(client, ['unrelated', 'ev1'], 2);
  await wait(250);
  assert.equal(signals(), 0);
  stop();
});

test('data already cached before watching counts as seen', async () => {
  const client = new QueryClient();
  await load(client, ['counts', 'ev1'], { n: 1 });
  let signals = 0;
  const stop = watchEventDataChanges(client, 'ev1', ROOTS, () => (signals += 1));
  await load(client, ['counts', 'ev1'], { n: 2 });
  await wait(250);
  assert.equal(signals, 1);
  stop();
});
