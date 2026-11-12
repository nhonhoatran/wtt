import { MediaStatus } from '@kamito/db';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MediaProcessorDeps } from './media-image-processor.js';
import { cleanupStuckProcessing } from './media-intent-cleanup-processor.js';
import { fakePrisma, type Row } from './media-test-support.js';

describe('cleanupStuckProcessing', () => {
  let dir: string;
  let storage: LocalObjectStorage;
  let rows: Row[];
  let deps: MediaProcessorDeps;
  const NOW = new Date('2026-11-12T10:00:00Z');
  const TIMEOUT_MINUTES = 10;

  const add = async (status: string, updatedAt: Date): Promise<Row> => {
    const row: Row = { id: crypto.randomUUID(), status, purpose: 'tier-logo', incomingKey: `incoming/tier-logo/${crypto.randomUUID()}`, expiresAt: NOW, updatedAt };
    await storage.put(row.incomingKey, Buffer.from('x'));
    rows.push(row);
    return row;
  };
  const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-cleanup-'));
    storage = new LocalObjectStorage(dir);
    rows = [];
    deps = {
      prisma: fakePrisma(rows),
      storage,
      allowedTypes: [],
      variantWidths: [],
      maxBytes: async () => 1,
      processingTimeoutMinutes: async () => TIMEOUT_MINUTES,
      now: () => NOW,
    };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('fails images stuck longer than the timeout and deletes their upload', async () => {
    const stuck = await add(MediaStatus.PROCESSING, minutesAgo(TIMEOUT_MINUTES + 1));
    const fresh = await add(MediaStatus.PROCESSING, minutesAgo(1));
    const waiting = await add(MediaStatus.AWAITING_UPLOAD, minutesAgo(60));

    expect(await cleanupStuckProcessing(deps)).toBe(1);
    expect(stuck).toMatchObject({ status: 'FAILED', failureReason: 'PROCESSING_TIMEOUT' });
    expect(await storage.stat(stuck.incomingKey)).toBeNull();
    expect(fresh.status).toBe('PROCESSING');
    expect(waiting.status).toBe('AWAITING_UPLOAD');
    expect(await storage.stat(fresh.incomingKey)).not.toBeNull();
  });

  it('uses the timeout returned by the setting reader', async () => {
    const row = await add(MediaStatus.PROCESSING, minutesAgo(5));
    expect(await cleanupStuckProcessing(deps)).toBe(0);
    expect(await cleanupStuckProcessing({ ...deps, processingTimeoutMinutes: async () => 3 })).toBe(1);
    expect(row.status).toBe('FAILED');
  });
});
