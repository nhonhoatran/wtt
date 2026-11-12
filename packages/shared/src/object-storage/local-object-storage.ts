import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { byteLimit } from './byte-limit.js';
import { assertSafeKey, type ObjectStorage, type PutOptions } from './object-storage.js';

export class LocalObjectStorage implements ObjectStorage {
  readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  /** Absolute path for a key, guaranteed to stay inside rootDir. */
  resolvePath(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.rootDir, ...key.split('/'));
    if (!full.startsWith(this.rootDir + path.sep)) throw new Error('key escapes storage root');
    return full;
  }

  async put(key: string, body: Buffer | Readable, options: PutOptions = {}): Promise<void> {
    const target = this.resolvePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.part`;
    const { maxBytes } = options;
    try {
      const source = Buffer.isBuffer(body) ? Readable.from([body]) : body;
      if (maxBytes === undefined) await pipeline(source, createWriteStream(temp));
      else await pipeline(source, byteLimit(maxBytes), createWriteStream(temp));
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const info = await stat(this.resolvePath(key));
      return info.isFile() ? { size: info.size } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async ping(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }
}
