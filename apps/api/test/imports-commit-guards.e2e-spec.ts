import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isValidCacheTag } from '@kamito/shared';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import {
  buildXlsx,
  cleanupImportData,
  createImportEvent,
  loadImportProcessors,
  type ImportDeps,
  type ImportEventFixture,
  type SheetRowInput,
  type WorkerImportModules,
} from './support/import-test-kit.js';

const IMPORTS = '/api/v1/admin/imports';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('import commit: locked draws and public refresh (real Postgres + Redis, local storage)', () => {
  let kit: AuthTestKit;
  let dir: string;
  let worker: WorkerImportModules;
  let fixture: ImportEventFixture;
  let admin: string;
  const tag = `L${randomUUID().slice(0, 6)}`;
  const queue = new Queue('import', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
  const jobIds: string[] = [];

  const deps = (extra: Partial<ImportDeps> = {}): ImportDeps => ({
    prisma: kit.prisma as unknown,
    storage: new LocalObjectStorage(dir),
    env: { IMPORT_MAX_FILE_BYTES: 5 * 1024 * 1024, IMPORT_MAX_UNZIPPED_BYTES: 50 * 1024 * 1024, IMPORT_MAX_ROWS: 5000 },
    ...extra,
  });

  const validatedJob = async (rows: SheetRowInput[]) => {
    const bytes = await buildXlsx(rows);
    const created = await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'g.xlsx', fileSize: bytes.length }).expect(201);
    const id = created.body.data.id as string;
    jobIds.push(id);
    await kit.http.put(`${IMPORTS}/${id}/file`).set('Origin', kit.origin).set('Cookie', admin).set('Content-Type', XLSX).send(bytes).expect(200);
    await kit.write('post', `${IMPORTS}/${id}/uploaded`, admin).expect(200);
    await worker.validateImport(deps(), id);
    return id;
  };
  const startCommit = (id: string, body: object = {}) => kit.write('post', `${IMPORTS}/${id}/commit`, admin, body).expect(200);
  const entryCount = (code: string) => kit.prisma.entry.count({ where: { subEventId: fixture.subEvents[code]! } });
  const newPlayerRow = (code: string, name: string): SheetRowInput => ({
    subEventCode: code,
    player1Name: `${name} ${tag}`,
    player1Gender: code === 'WS' ? 'Nữ' : 'Nam',
    player1BirthYear: 1995,
  });

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-import-guards-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.UPLOAD_LOCAL_DIR = dir;
    kit = await AuthTestKit.start();
    worker = await loadImportProcessors();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    fixture = await createImportEvent(kit, admin, tag);
    for (const [code, status] of [['WS', 'PUBLISHED'], ['MS', 'DRAFT']] as const) {
      await kit.prisma.draw.create({ data: { subEventId: fixture.subEvents[code]!, kind: 'MAIN', randomSeed: `seed-${code}`, size: 4, status } });
    }
  });

  afterAll(async () => {
    for (const id of jobIds) {
      for (const n of [1, 2, 3]) for (const action of ['validate', 'commit']) await (await queue.getJob(`imp-${id}-${action}-${n}`))?.remove().catch(() => undefined);
    }
    await queue.close();
    await kit.prisma.draw.deleteMany({ where: { subEventId: { in: Object.values(fixture.subEvents) } } });
    await cleanupImportData(kit.prisma, [fixture.eventId], tag);
    await kit.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('refuses a commit into a sub-event whose draw is published and writes nothing', async () => {
    const enqueueRevalidate = vi.fn(async () => undefined);
    const id = await validatedJob([newPlayerRow('WS', 'Bi Khoa')]);
    expect((await kit.get(`${IMPORTS}/${id}`, admin)).body.data).toMatchObject({ status: 'VALIDATED', validRows: 1 });
    await startCommit(id);

    expect(await worker.commitImport(deps({ enqueueRevalidate }), id)).toBe('failed');
    const job = await kit.prisma.importJob.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe('FAILED');
    expect(job.failureReason).toContain('WS');
    expect(await entryCount('WS')).toBe(0);
    expect(await kit.prisma.player.count({ where: { fullName: { contains: `Bi Khoa ${tag}` } } })).toBe(0);
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'COMMITTED' } })).toBe(0);
    expect(enqueueRevalidate).not.toHaveBeenCalled();
  }, 30_000);

  it('lets an ADMIN override commit into the published draw and refreshes public pages', async () => {
    const enqueueRevalidate = vi.fn(async (_tags: string[]) => undefined);
    const id = await validatedJob([newPlayerRow('WS', 'Ghi De')]);
    await startCommit(id, { overrideReason: 'nhập bổ sung sau khi bốc thăm' });

    expect(await worker.commitImport(deps({ enqueueRevalidate }), id)).toBe('done');
    expect(await entryCount('WS')).toBe(1);
    const player = await kit.prisma.player.findFirstOrThrow({ where: { fullName: { contains: `Ghi De ${tag}` } }, select: { slug: true } });
    const tags = enqueueRevalidate.mock.calls[0]![0];
    expect(tags).toEqual(expect.arrayContaining([`event-${fixture.slug}`, `draw-${fixture.slug}-WS`, `groups-${fixture.slug}-WS`, 'players', `player-${player.slug}`]));
    expect(tags.every(isValidCacheTag)).toBe(true);
    expect(tags).not.toContain(`draw-${fixture.slug}-MS`);
  }, 30_000);

  it('does not let a draft draw block the import and never fails it because revalidation fails', async () => {
    const warn = vi.fn();
    const enqueueRevalidate = vi.fn(async () => {
      throw new Error('redis down');
    });
    const id = await validatedJob([newPlayerRow('MS', 'Nhap Nhap')]);
    await startCommit(id);

    expect(await worker.commitImport(deps({ enqueueRevalidate, logger: { warn } }), id)).toBe('done');
    expect(await entryCount('MS')).toBe(1);
    expect((await kit.get(`${IMPORTS}/${id}`, admin)).body.data).toMatchObject({ status: 'DONE', committedRows: 1 });
    expect(enqueueRevalidate).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ importJobId: id, err: 'redis down' }), expect.stringContaining('revalidate'));
  }, 30_000);
});
