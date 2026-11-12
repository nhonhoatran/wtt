import type { Readable } from 'node:stream';

export interface PutOptions {
  contentType?: string;
  /** Abort and keep nothing once more than this many bytes arrive. */
  maxBytes?: number;
}

export interface ObjectStorage {
  put(key: string, body: Buffer | Readable, options?: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Null when the object does not exist. */
  stat(key: string): Promise<{ size: number } | null>;
  /** Idempotent: deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
  /** Throws when the backend is unreachable. */
  ping(): Promise<void>;
}

export class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`payload exceeds ${maxBytes} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Keys are "a/b/c" with plain segments only; rejects traversal, absolute paths and odd characters. */
export function assertSafeKey(key: string): void {
  const ok = key.split('/').every((segment) => SAFE_SEGMENT.test(segment) && segment !== '.' && segment !== '..');
  if (!ok) throw new Error(`unsafe object key: ${JSON.stringify(key)}`);
}
