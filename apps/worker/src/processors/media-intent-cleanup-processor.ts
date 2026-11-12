import { MediaStatus } from '@kamito/db';
import { MEDIA_FAILURE } from '@kamito/shared/media';
import type { MediaProcessorDeps } from './media-image-processor.js';

/** Bounds one sweep so a backlog cannot hold the worker; the next scheduled run picks up the rest. */
const BATCH_SIZE = 200;

type Candidate = { id: string; incomingKey: string };

async function failAndDelete(deps: MediaProcessorDeps, rows: Candidate[], from: MediaStatus, reason: string): Promise<number> {
  let cleaned = 0;
  for (const { id, incomingKey } of rows) {
    await deps.storage.delete(incomingKey);
    const result = await deps.prisma.mediaAsset.updateMany({
      where: { id, status: from },
      data: { status: MediaStatus.FAILED, failureReason: reason },
    });
    cleaned += result.count;
  }
  return cleaned;
}

/** Fails upload intents nobody completed in time and removes whatever was uploaded for them. */
export async function cleanupExpiredIntents(deps: MediaProcessorDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const expired = await deps.prisma.mediaAsset.findMany({
    where: { status: MediaStatus.AWAITING_UPLOAD, expiresAt: { lt: now } },
    select: { id: true, incomingKey: true },
    take: BATCH_SIZE,
  });
  return failAndDelete(deps, expired, MediaStatus.AWAITING_UPLOAD, MEDIA_FAILURE.intentExpired);
}

/** Fails images stuck in PROCESSING longer than the admin-set timeout (lost job, crashed worker, flushed Redis). */
export async function cleanupStuckProcessing(deps: MediaProcessorDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const cutoff = new Date(now.getTime() - (await deps.processingTimeoutMinutes()) * 60_000);
  const stuck = await deps.prisma.mediaAsset.findMany({
    where: { status: MediaStatus.PROCESSING, updatedAt: { lt: cutoff } },
    select: { id: true, incomingKey: true },
    take: BATCH_SIZE,
  });
  return failAndDelete(deps, stuck, MediaStatus.PROCESSING, MEDIA_FAILURE.processingTimeout);
}
