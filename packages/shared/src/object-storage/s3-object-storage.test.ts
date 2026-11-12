import { S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { S3ObjectStorage } from './s3-object-storage.js';

const config = { endpoint: 'http://s3.test', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's', bucket: 'main', forcePathStyle: true };

function recordCalls() {
  const calls: { command: string; bucket: string; key?: string }[] = [];
  vi.spyOn(S3Client.prototype, 'send').mockImplementation((async (command: { constructor: { name: string }; input: { Bucket: string; Key?: string } }) => {
    calls.push({ command: command.constructor.name, bucket: command.input.Bucket, key: command.input.Key });
    return { ContentLength: 3 };
  }) as never);
  return calls;
}

describe('S3ObjectStorage incoming bucket', () => {
  afterEach(() => vi.restoreAllMocks());

  it('routes incoming/ keys to the private bucket and everything else to the main one', async () => {
    const calls = recordCalls();
    const storage = new S3ObjectStorage({ ...config, incomingBucket: 'private' });
    await storage.put('incoming/tier-logo/a', Buffer.from('x'));
    await storage.stat('incoming/tier-logo/a');
    await storage.delete('incoming/tier-logo/a');
    await storage.put('public/tier-logo/2026/a-320.webp', Buffer.from('x'));
    expect(calls.map((call) => call.bucket)).toEqual(['private', 'private', 'private', 'main']);
    storage.destroy();
  });

  it('keeps incoming/ in the main bucket when no private bucket is configured and pings both when set', async () => {
    const calls = recordCalls();
    const single = new S3ObjectStorage(config);
    await single.put('incoming/tier-logo/a', Buffer.from('x'));
    await single.ping();
    expect(calls.map((call) => call.bucket)).toEqual(['main', 'main']);

    calls.length = 0;
    const split = new S3ObjectStorage({ ...config, incomingBucket: 'private' });
    await split.ping();
    expect(calls.map((call) => call.bucket).sort()).toEqual(['main', 'private']);
    single.destroy();
    split.destroy();
  });
});
