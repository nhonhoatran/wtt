import fs from 'node:fs';
import path from 'node:path';
import type { StorageEnv } from '../media/storage-env.js';
import { LocalObjectStorage } from './local-object-storage.js';
import type { ObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

/** Relative upload dirs resolve against the repo root (nearest pnpm-workspace.yaml), so API and worker agree. */
export function resolveUploadDir(raw: string, startDir: string = process.cwd()): string {
  if (path.isAbsolute(raw)) return raw;
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return path.resolve(dir, raw);
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir, raw);
    dir = parent;
  }
}

export function createObjectStorage(env: StorageEnv): ObjectStorage {
  if (env.STORAGE_DRIVER === 'local') return new LocalObjectStorage(resolveUploadDir(env.UPLOAD_LOCAL_DIR));
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET } = env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
    throw new Error('S3_* env is required when STORAGE_DRIVER=s3');
  }
  return new S3ObjectStorage({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    bucket: S3_BUCKET,
    incomingBucket: env.S3_INCOMING_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
}
