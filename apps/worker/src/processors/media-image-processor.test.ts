import { MediaStatus } from '@kamito/db';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupExpiredIntents } from './media-intent-cleanup-processor.js';
import { fakePrisma, type Row } from './media-test-support.js';
import { failProcessing, processImage, type MediaProcessorDeps } from './media-image-processor.js';

async function noisyJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 70 } } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function filesUnder(root: string, sub: string): Promise<string[]> {
  const entries = await readdir(path.join(root, sub), { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

describe('processImage', () => {
  let dir: string;
  let storage: LocalObjectStorage;
  let rows: Row[];
  let deps: MediaProcessorDeps;

  const addAsset = async (body: Buffer | string, status: string = MediaStatus.PROCESSING): Promise<Row> => {
    const row: Row = {
      id: crypto.randomUUID(),
      status,
      purpose: 'tier-logo',
      incomingKey: `incoming/tier-logo/${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 60_000),
    };
    await storage.put(row.incomingKey, Buffer.from(body));
    rows.push(row);
    return row;
  };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-media-'));
    storage = new LocalObjectStorage(dir);
    rows = [];
    deps = {
      prisma: fakePrisma(rows),
      storage,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      variantWidths: [320, 640, 1280],
      maxBytes: async () => 10 * 1024 * 1024,
      processingTimeoutMinutes: async () => 10,
    };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('turns a ~3 MB jpeg into three webp variants within 10 s and removes the upload', async () => {
    const jpeg = await noisyJpeg(2600, 1950);
    expect(jpeg.length).toBeGreaterThan(2.5 * 1024 * 1024);
    const asset = await addAsset(jpeg);

    const started = Date.now();
    expect(await processImage(deps, asset.id)).toBe('ready');
    expect(Date.now() - started).toBeLessThan(10_000);

    expect(asset).toMatchObject({ status: 'READY', mime: 'image/webp', width: 1280, failureReason: null });
    const variants = asset.variants as Array<{ width: number; key: string }>;
    expect(variants.map((variant) => variant.width)).toEqual([320, 640, 1280]);
    expect(asset.publicKey).toBe(variants[2]!.key);
    expect(variants[0]!.key).toMatch(/^public\/tier-logo\/\d{4}\/[0-9a-f-]{36}-320\.webp$/);
    expect(await storage.stat(asset.incomingKey)).toBeNull();
    expect(await filesUnder(dir, 'incoming')).toEqual([]);
    const meta = await sharp(await storage.get(variants[1]!.key)).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 640 });
    expect(meta.exif).toBeUndefined();
    // Only re-encoded webp files are public; the original is never copied.
    expect((await filesUnder(dir, 'public')).filter((name) => name.endsWith('.webp'))).toHaveLength(3);
    expect((await filesUnder(dir, 'public')).filter((name) => /\.(jpe?g|part)$/.test(name))).toEqual([]);
  });

  it('follows the injected variant widths', async () => {
    deps.variantWidths = [200, 400];
    const asset = await addAsset(await noisyJpeg(900, 600));
    await processImage(deps, asset.id);
    expect((asset.variants as Array<{ width: number }>).map((variant) => variant.width)).toEqual([200, 400]);
  });

  it('never enlarges: widths above the source collapse into one variant', async () => {
    const asset = await addAsset(await noisyJpeg(500, 300));
    await processImage(deps, asset.id);
    expect((asset.variants as Array<{ width: number }>).map((variant) => variant.width)).toEqual([320, 500]);
  });

  it('fails a text file that claims to be an image and still deletes the upload', async () => {
    const asset = await addAsset('this is definitely not a jpeg');
    expect(await processImage(deps, asset.id)).toBe('failed');
    expect(asset).toMatchObject({ status: 'FAILED', failureReason: 'NOT_AN_IMAGE' });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
    expect(await filesUnder(dir, 'public')).toEqual([]);
  });

  it('rejects a format outside the allowlist', async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer();
    const asset = await addAsset(gif);
    await processImage(deps, asset.id);
    expect(asset).toMatchObject({ status: 'FAILED', failureReason: 'NOT_AN_IMAGE' });
  });

  it('fails an upload larger than the current limit', async () => {
    deps.maxBytes = async () => 1000;
    const asset = await addAsset(await noisyJpeg(300, 300));
    await processImage(deps, asset.id);
    expect(asset).toMatchObject({ status: 'FAILED', failureReason: 'TOO_LARGE' });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
  });

  it('fails when the uploaded object is missing', async () => {
    const asset = await addAsset('x');
    await storage.delete(asset.incomingKey);
    await processImage(deps, asset.id);
    expect(asset).toMatchObject({ status: 'FAILED', failureReason: 'MISSING_UPLOAD' });
  });

  it('skips records that are not PROCESSING', async () => {
    const asset = await addAsset(await noisyJpeg(100, 100), MediaStatus.READY);
    expect(await processImage(deps, asset.id)).toBe('skipped');
    expect(await processImage(deps, crypto.randomUUID())).toBe('skipped');
    expect(await storage.stat(asset.incomingKey)).not.toBeNull();
  });

  it('keeps the upload for a retry when storage fails, then settles it via failProcessing', async () => {
    const asset = await addAsset(await noisyJpeg(800, 600));
    const realPut = storage.put.bind(storage);
    storage.put = async (key, body, options) => {
      if (key.startsWith('public/')) throw new Error('storage down');
      return realPut(key, body, options);
    };
    await expect(processImage(deps, asset.id)).rejects.toThrow('storage down');
    expect(asset.status).toBe('PROCESSING');
    expect(await storage.stat(asset.incomingKey)).not.toBeNull();

    await failProcessing(deps, asset.id);
    expect(asset).toMatchObject({ status: 'FAILED', failureReason: 'PROCESSING_ERROR' });
    expect(await storage.stat(asset.incomingKey)).toBeNull();
  });

  it('cleans up expired intents and leaves live ones', async () => {
    const expired = await addAsset('partial', MediaStatus.AWAITING_UPLOAD);
    expired.expiresAt = new Date(Date.now() - 1000);
    const live = await addAsset('partial', MediaStatus.AWAITING_UPLOAD);
    const processing = await addAsset('x');
    processing.expiresAt = new Date(Date.now() - 1000);

    expect(await cleanupExpiredIntents(deps)).toBe(1);
    expect(expired).toMatchObject({ status: 'FAILED', failureReason: 'INTENT_EXPIRED' });
    expect(await storage.stat(expired.incomingKey)).toBeNull();
    expect(live.status).toBe('AWAITING_UPLOAD');
    expect(processing.status).toBe('PROCESSING');
  });
});
