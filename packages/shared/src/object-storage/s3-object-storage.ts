import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { byteLimit } from './byte-limit.js';
import { INCOMING_PREFIX } from '../media/media-contract.js';
import { assertSafeKey, type ObjectStorage, type PutOptions } from './object-storage.js';

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Private bucket for incoming/ objects; unset keeps them in `bucket`. */
  incomingBucket?: string;
  forcePathStyle: boolean;
}

async function collect(source: Readable, maxBytes: number | undefined): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  if (maxBytes === undefined) await pipeline(source, sink);
  else await pipeline(source, byteLimit(maxBytes), sink);
  return Buffer.concat(chunks);
}

/** Streams are capped by maxBytes and buffered before PutObject, which needs a known length. */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  private bucketFor(key: string): string {
    return this.config.incomingBucket && key.startsWith(INCOMING_PREFIX) ? this.config.incomingBucket : this.config.bucket;
  }

  async put(key: string, body: Buffer | Readable, options: PutOptions = {}): Promise<void> {
    assertSafeKey(key);
    const bytes = Buffer.isBuffer(body) ? body : await collect(body, options.maxBytes);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucketFor(key), Key: key, Body: bytes, ContentType: options.contentType }),
    );
  }

  async get(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }));
    if (!res.Body) throw new Error(`empty body for ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async stat(key: string): Promise<{ size: number } | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucketFor(key), Key: key }));
      return { size: res.ContentLength ?? 0 };
    } catch (error) {
      const { name, $metadata } = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (name === 'NotFound' || name === 'NoSuchKey' || $metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketFor(key), Key: key }));
  }

  async ping(): Promise<void> {
    const buckets = new Set([this.config.bucket, this.config.incomingBucket].filter((name): name is string => !!name));
    for (const Bucket of buckets) await this.client.send(new HeadBucketCommand({ Bucket }));
  }

  destroy(): void {
    this.client.destroy();
  }
}
