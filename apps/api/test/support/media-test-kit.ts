import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Queue } from 'bullmq';
import sharp from 'sharp';
import type { PrismaService } from '../../src/modules/prisma/prisma.service.js';

// The worker package is not an api dependency (rootDir), so its processors load by file URL and are typed here.
export interface WorkerMediaModules {
  processImage(deps: unknown, mediaId: string): Promise<string>;
  cleanupExpiredIntents(deps: unknown): Promise<number>;
}

export async function loadWorkerProcessors(): Promise<WorkerMediaModules> {
  const dir = path.resolve(import.meta.dirname, '../../../worker/src/processors');
  const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(path.join(dir, file)).href) as Promise<Record<string, unknown>>;
  const [image, cleanup] = await Promise.all([load('media-image-processor.ts'), load('media-intent-cleanup-processor.ts')]);
  return { processImage: image.processImage, cleanupExpiredIntents: cleanup.cleanupExpiredIntents } as WorkerMediaModules;
}

export async function useTempUploadDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'kamito-e2e-uploads-'));
  process.env.STORAGE_DRIVER = 'local';
  process.env.UPLOAD_LOCAL_DIR = dir;
  delete process.env.MEDIA_PUBLIC_BASE_URL;
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function noisyJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 70 } } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export function mediaQueue(): Queue {
  return new Queue('media', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
}

export async function deleteMedia(prisma: PrismaService, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
}
