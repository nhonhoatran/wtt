import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveUploadDir } from './create-object-storage.js';
import { LocalObjectStorage } from './local-object-storage.js';
import { assertSafeKey, PayloadTooLargeError } from './object-storage.js';

describe('LocalObjectStorage', () => {
  let dir: string;
  let storage: LocalObjectStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-storage-'));
    storage = new LocalObjectStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips buffers and streams, and stat reports size', async () => {
    await storage.put('incoming/a/one', Buffer.from('hello'));
    await storage.put('incoming/a/two', Readable.from([Buffer.from('he'), Buffer.from('llo!')]));
    expect((await storage.get('incoming/a/one')).toString()).toBe('hello');
    expect(await storage.stat('incoming/a/two')).toEqual({ size: 6 });
    expect(await storage.stat('incoming/a/missing')).toBeNull();
  });

  it('delete is idempotent', async () => {
    await storage.put('incoming/a/one', Buffer.from('x'));
    await storage.delete('incoming/a/one');
    await storage.delete('incoming/a/one');
    expect(await storage.stat('incoming/a/one')).toBeNull();
  });

  it('keeps nothing when a stream exceeds maxBytes', async () => {
    const body = Readable.from([Buffer.alloc(600), Buffer.alloc(600)]);
    await expect(storage.put('incoming/a/big', body, { maxBytes: 1000 })).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(await storage.stat('incoming/a/big')).toBeNull();
    const leftovers = await readdir(dir, { recursive: true, withFileTypes: true });
    expect(leftovers.filter((entry) => entry.isFile())).toEqual([]);
  });

  it('rejects keys that could escape the root', async () => {
    for (const key of ['../x', 'a/../../x', '/abs', 'a\\b', 'a//b', '', 'a/./b']) {
      expect(() => assertSafeKey(key)).toThrow();
      await expect(storage.get(key)).rejects.toThrow();
    }
  });
});

describe('resolveUploadDir', () => {
  it('keeps absolute paths and resolves relative ones against the workspace root', () => {
    const abs = path.resolve(tmpdir(), 'uploads');
    expect(resolveUploadDir(abs)).toBe(abs);
    const fromPackage = resolveUploadDir('apps/api/uploads', path.join(process.cwd()));
    expect(fromPackage.endsWith(path.join('apps', 'api', 'uploads'))).toBe(true);
    expect(fromPackage).not.toContain(path.join('packages', 'shared'));
  });
});
