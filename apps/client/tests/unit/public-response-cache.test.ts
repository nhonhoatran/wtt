import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PublicResponseCache } from '../../src/lib/public-response-cache';

if (!process.env.REDIS_URL && existsSync('../../.env')) process.loadEnvFile('../../.env');
const prefix = `test-public-cache:${randomUUID()}`;
let first: Redis;
let second: Redis;
let writer: PublicResponseCache;
let reader: PublicResponseCache;

beforeAll(async () => {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL required for public response cache integration');
  first = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  second = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  await Promise.all([first.ping(), second.ping()]);
  writer = new PublicResponseCache(first, prefix);
  reader = new PublicResponseCache(second, prefix);
});

afterAll(async () => {
  if (first) {
    let cursor = '0';
    do {
      const [next, keys] = await first.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 100);
      cursor = next;
      if (keys.length) await first.del(...keys);
    } while (cursor !== '0');
  }
  await Promise.all([first?.quit(), second?.quit()]);
});

it('shares cached JSON and cached null between independent connections', async () => {
  const generation = (await writer.read('json')).generation;
  await writer.write('json', JSON.stringify({ name: 'event' }), ['event-a'], 30_000, generation);
  expect(JSON.parse((await reader.read('json')).payload!)).toEqual({ name: 'event' });
  await writer.write('null', 'null', ['event-missing'], 30_000, generation);
  expect((await reader.read('null')).payload).toBe('null');
});

it('invalidates across instances without invalidating unrelated stored responses', async () => {
  const generation = (await writer.read('one')).generation;
  await writer.write('one', '"one"', ['event-one'], 30_000, generation);
  await writer.write('two', '"two"', ['event-two'], 30_000, generation);
  await reader.invalidate(['event-one']);
  expect((await writer.read('one')).payload).toBeUndefined();
  expect((await writer.read('two')).payload).toBe('"two"');
});

it('fences a response fetched before invalidation and accepts a fresh fetch after it', async () => {
  const old = await writer.read('race');
  await reader.invalidate(['event-race']);
  await writer.write('race', '"outdated"', ['event-race'], 30_000, old.generation);
  expect((await reader.read('race')).payload).toBeUndefined();
  const fresh = await writer.read('race');
  await writer.write('race', '"current"', ['event-race'], 30_000, fresh.generation);
  expect((await reader.read('race')).payload).toBe('"current"');
});

it('expires response TTLs and keeps invalidation versions independent from a later shorter policy TTL', async () => {
  const initial = await writer.read('old-policy');
  await writer.write('old-policy', '"long-lived"', ['event-old-policy'], 60_000, initial.generation);
  await reader.invalidate(['event-old-policy']);
  expect(await first.pttl(`${prefix}:tag:event-old-policy`)).toBe(-1);
  expect((await writer.read('old-policy')).payload).toBeUndefined();
  const generation = (await writer.read('expired')).generation;
  await writer.write('expired', 'null', ['event-expired'], 30_000, generation);
  const redisKey = `${prefix}:response:${createHash('sha256').update('expired').digest('hex')}`;
  expect(await first.pttl(redisKey)).toBeGreaterThan(0);
  await first.pexpire(redisKey, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect((await reader.read('expired')).payload).toBeUndefined();
});
