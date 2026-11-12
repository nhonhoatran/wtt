import type { MediaAsset, PrismaClient } from '@kamito/db';
import { MediaStatus } from '@kamito/db';
import { MEDIA_FAILURE, publicKeyFor, type MediaVariant } from '@kamito/shared/media';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

/** Decompression-bomb guard: 40 megapixels covers large camera photos but bounds sharp memory. */
const MAX_INPUT_PIXELS = 40e6;
/** Visually near-lossless for photos while keeping variants small; not worth a setting. */
const WEBP_QUALITY = 82;

export interface MediaProcessorDeps {
  prisma: Pick<PrismaClient, 'mediaAsset'>;
  storage: ObjectStorage;
  allowedTypes: readonly string[];
  variantWidths: readonly number[];
  /** Effective cap at processing time: admin setting bounded by the server ceiling. */
  maxBytes: () => Promise<number>;
  /** Minutes a PROCESSING image may wait before the cleanup job fails it. */
  processingTimeoutMinutes: () => Promise<number>;
  now?: () => Date;
}

export type ProcessOutcome = 'ready' | 'failed' | 'skipped';

interface Encoded extends MediaVariant {
  data: Buffer;
}

async function markFailed(deps: MediaProcessorDeps, asset: MediaAsset, reason: string): Promise<ProcessOutcome> {
  await deps.prisma.mediaAsset.updateMany({
    where: { id: asset.id, status: MediaStatus.PROCESSING },
    data: { status: MediaStatus.FAILED, failureReason: reason },
  });
  return 'failed';
}

async function encodeVariants(source: Buffer, widths: readonly number[], purpose: string, at: Date): Promise<Encoded[]> {
  const uuid = randomUUID();
  const oriented = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS }).rotate().toBuffer({ resolveWithObject: true });
  const targets = [...new Set(widths.map((width) => Math.min(width, oriented.info.width)))].sort((a, b) => a - b);
  return Promise.all(
    targets.map(async (width) => {
      // Re-encoding drops EXIF/ICC metadata; sharp keeps none unless asked.
      const { data, info } = await sharp(oriented.data)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height, key: publicKeyFor(purpose, uuid, info.width, at), data };
    }),
  );
}

async function readFormat(source: Buffer, allowedTypes: readonly string[]): Promise<'ok' | 'not-image' | 'too-many-pixels'> {
  try {
    const meta = await sharp(source, { limitInputPixels: false }).metadata();
    if (!meta.format || !allowedTypes.includes(`image/${meta.format}`)) return 'not-image';
    return (meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS ? 'too-many-pixels' : 'ok';
  } catch {
    return 'not-image';
  }
}

/** Retryable errors (storage, database) are rethrown with the incoming object kept for the next attempt. */
export async function processImage(deps: MediaProcessorDeps, mediaId: string): Promise<ProcessOutcome> {
  const asset = await deps.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset || asset.status !== MediaStatus.PROCESSING) return 'skipped';

  const written: string[] = [];
  let final = false;
  const fail = async (reason: string): Promise<ProcessOutcome> => {
    final = true;
    return markFailed(deps, asset, reason);
  };
  try {
    const stored = await deps.storage.stat(asset.incomingKey);
    if (!stored) return await fail(MEDIA_FAILURE.missingUpload);
    if (stored.size > (await deps.maxBytes())) return await fail(MEDIA_FAILURE.tooLarge);

    const source = await deps.storage.get(asset.incomingKey);
    const verdict = await readFormat(source, deps.allowedTypes);
    if (verdict !== 'ok') return await fail(verdict === 'not-image' ? MEDIA_FAILURE.notAnImage : MEDIA_FAILURE.tooLarge);

    const variants = await encodeVariants(source, deps.variantWidths, asset.purpose, (deps.now ?? (() => new Date()))());
    for (const variant of variants) {
      await deps.storage.put(variant.key, variant.data, { contentType: 'image/webp' });
      written.push(variant.key);
    }
    const largest = variants.at(-1)!;
    await deps.prisma.mediaAsset.updateMany({
      where: { id: asset.id, status: MediaStatus.PROCESSING },
      data: {
        status: MediaStatus.READY,
        failureReason: null,
        variants: variants.map(({ width, height, key }) => ({ width, height, key })),
        publicKey: largest.key,
        mime: 'image/webp',
        size: largest.data.length,
        width: largest.width,
        height: largest.height,
      },
    });
    final = true;
    return 'ready';
  } catch (error) {
    await Promise.allSettled(written.map((key) => deps.storage.delete(key)));
    throw error;
  } finally {
    if (final) await deps.storage.delete(asset.incomingKey);
  }
}

/** Last-attempt handler: the job is out of retries, so settle the record and drop the upload. */
export async function failProcessing(deps: MediaProcessorDeps, mediaId: string): Promise<void> {
  const asset = await deps.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
  if (!asset) return;
  await markFailed(deps, asset, MEDIA_FAILURE.processingError);
  await deps.storage.delete(asset.incomingKey);
}
