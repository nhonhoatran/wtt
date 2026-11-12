import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { lockSubEventsInOrder } from '@kamito/db';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import { zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import { buildExcelSavedXlsx } from './support/excel-saved-xlsx.js';
import { buildOverlappingZip } from './support/overlapping-zip.js';
import {
  buildXlsx,
  cleanupImportData,
  createImportEvent,
  loadImportProcessors,
  seedPlayer,
  storeJob,
  type ImportDeps,
  type ImportEventFixture,
  type SheetRowInput,
  type WorkerImportModules,
} from './support/import-test-kit.js';

const ENV = { IMPORT_MAX_FILE_BYTES: 5 * 1024 * 1024, IMPORT_MAX_UNZIPPED_BYTES: 50 * 1024 * 1024, IMPORT_MAX_ROWS: 5000 };

describe('import worker processors (real Postgres + local storage)', () => {
  let kit: AuthTestKit;
  let dir: string;
  let storage: LocalObjectStorage;
  let worker: WorkerImportModules;
  let fixture: ImportEventFixture;
  let adminId: string;
  const tag = `W${randomUUID().slice(0, 6)}`;
  const deps = (over: Partial<ImportDeps> = {}): ImportDeps => ({ prisma: kit.prisma, storage, env: ENV, ...over });
  const newPlayer = (name: string, extra: SheetRowInput = {}): SheetRowInput => ({
    subEventCode: 'MS',
    player1Name: `${name} ${tag}`,
    player1Gender: 'Nam',
    player1BirthYear: 1990,
    ...extra,
  });
  const submit = async (rows: SheetRowInput[]) => {
    const id = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes: await buildXlsx(rows) });
    await worker.validateImport(deps(), id);
    return id;
  };
  const commit = async (id: string, over: Partial<ImportDeps> = {}, overrideReason?: string) => {
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'COMMITTING', overrideReason: overrideReason ?? null } });
    return worker.commitImport(deps(over), id);
  };
  const entryCount = () => kit.prisma.entry.count({ where: { subEvent: { eventId: fixture.eventId } } });
  const playerCount = () => kit.prisma.player.count({ where: { fullName: { contains: tag } } });

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-import-'));
    storage = new LocalObjectStorage(dir);
    kit = await AuthTestKit.start();
    worker = await loadImportProcessors();
    const admin = await kit.createUser({ role: 'ADMIN' });
    adminId = admin.id;
    fixture = await createImportEvent(kit, await kit.signIn(admin), tag);
  });

  afterAll(async () => {
    await cleanupImportData(kit.prisma, [fixture.eventId], tag);
    await kit.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('validates 1000 rows with 20 deliberate errors and commits them idempotently', async () => {
    const rows: SheetRowInput[] = Array.from({ length: 1000 }, (_, i) => newPlayer(`Tay Vot ${i}`, { player1BirthYear: 1980 + (i % 20) }));
    const bad = new Map<number, SheetRowInput>();
    for (let k = 0; k < 20; k += 1) {
      const index = 10 + k * 45;
      const base = rows[index]!;
      const broken: SheetRowInput[] = [
        { ...base, subEventCode: 'ZZ' },
        { ...base, player1Gender: 'Khác' },
        { ...base, player1Code: 'KHONGCO999', player1Name: '' },
        { ...base, player2Name: 'Nguoi Thua', player2Gender: 'Nam' },
      ];
      rows[index] = broken[k % 4]!;
      bad.set(index + 2, rows[index]!);
    }
    const startValidate = Date.now();
    const id = await submit(rows);
    const validateMs = Date.now() - startValidate;
    const job = await kit.prisma.importJob.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({ status: 'VALIDATED', totalRows: 1000, validRows: 980, errorRows: 20 });
    const errors = await kit.prisma.importRow.findMany({ where: { importJobId: id, status: 'ERROR' }, select: { rowNo: true } });
    expect(errors.map((row) => row.rowNo).sort((a, b) => a - b)).toEqual([...bad.keys()].sort((a, b) => a - b));

    const startCommit = Date.now();
    expect(await commit(id)).toBe('done');
    const commitMs = Date.now() - startCommit;
    console.log(`PERF validate(1000 rows)=${validateMs}ms commit(980 rows)=${commitMs}ms`);
    expect(validateMs).toBeLessThan(30_000);
    expect(commitMs).toBeLessThan(60_000);

    expect(await entryCount()).toBe(980);
    expect(await playerCount()).toBe(980);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DONE', committedRows: 980, errorRows: 20 });
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: id, action: 'import.commit' } });
    expect(audit.after).toMatchObject({ createdPlayers: 980, entriesCreated: 980 });

    await commit(id);
    expect(await entryCount()).toBe(980);
    expect(await playerCount()).toBe(980);
  }, 180_000);

  it('creates one player when the same new person appears in two rows', async () => {
    const id = await submit([
      newPlayer('Nguoi Moi'),
      { subEventCode: 'MD', player1Name: `Nguoi Moi ${tag}`, player1Gender: 'Nam', player1BirthYear: 1990, player2Name: `Dong Doi ${tag}`, player2Gender: 'Nam', player2BirthYear: 1991 },
    ]);
    const before = await playerCount();
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'VALID' } })).toBe(2);
    await commit(id);
    expect(await playerCount()).toBe(before + 2);
    expect(await kit.prisma.player.count({ where: { fullName: `Nguoi Moi ${tag}` } })).toBe(1);
  });

  it('does not duplicate an entry added between validate and commit', async () => {
    const player = await seedPlayer(kit.prisma, tag, 'Co San');
    const id = await submit([{ subEventCode: 'MS', player1Code: player.code, seed: 3 }]);
    expect(await kit.prisma.importRow.findFirstOrThrow({ where: { importJobId: id } })).toMatchObject({ status: 'VALID', plannedAction: 'CREATE_ENTRY' });
    const competitor = await kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
    await kit.prisma.entry.create({ data: { subEventId: fixture.subEvents.MS!, competitorId: competitor.id, stage: 'QUALIFYING' } });
    await commit(id);
    const entries = await kit.prisma.entry.findMany({ where: { competitorId: competitor.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ seed: 3, stage: 'QUALIFYING' });
    const row = await kit.prisma.importRow.findFirstOrThrow({ where: { importJobId: id } });
    expect(row.createdEntityIds).toMatchObject({ action: 'UPDATE_ENTRY' });
    const audit = await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: entries[0]!.id, action: 'entry.update' } });
    expect(audit).toMatchObject({ actorId: adminId, reason: `import ${id}`, before: { seed: null }, after: { seed: 3 } });
    expect(audit.after).not.toHaveProperty('stage');
  });

  it('keeps stored seed, notes and override reason when the file cells are blank', async () => {
    const player = await seedPlayer(kit.prisma, tag, 'Giu Nguyen');
    const competitor = await kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
    const entry = await kit.prisma.entry.create({
      data: { subEventId: fixture.subEvents.MS!, competitorId: competitor.id, seed: 9, notes: 'ghi chu cu', quotaType: 'WILDCARD', eligibilityOverrideReason: 'ly do cu' },
    });
    const id = await submit([{ subEventCode: 'MS', player1Code: player.code }]);
    await commit(id);
    expect(await kit.prisma.entry.findUniqueOrThrow({ where: { id: entry.id } })).toMatchObject({ seed: 9, notes: 'ghi chu cu', quotaType: 'WILDCARD', eligibilityOverrideReason: 'ly do cu' });
    expect(await kit.prisma.auditLog.count({ where: { entityId: entry.id, action: 'entry.update' } })).toBe(0);
  });

  it('writes an entry.create audit row per created entry', async () => {
    const id = await submit([newPlayer('Audit Tao', { seed: 77 })]);
    await commit(id);
    const row = await kit.prisma.importRow.findFirstOrThrow({ where: { importJobId: id } });
    const entryId = (row.createdEntityIds as { entryId: string }).entryId;
    expect(await kit.prisma.auditLog.findFirstOrThrow({ where: { entityId: entryId, action: 'entry.create' } })).toMatchObject({ actorId: adminId, reason: `import ${id}`, after: { seed: 77 } });
  });

  it('waits for a concurrent entry writer holding the sub-event lock, then rejects the duplicate', async () => {
    const player = await seedPlayer(kit.prisma, tag, 'Tranh Khoa');
    const id = await submit([{ subEventCode: 'MS', player1Code: player.code }]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const writer = kit.prisma.$transaction(async (tx) => {
      await lockSubEventsInOrder(tx, [fixture.subEvents.MS!]);
      await gate;
      const competitor = await tx.competitor.create({ data: { type: 'PLAYER', playerId: player.id, displayName: player.fullName } });
      await tx.entry.create({ data: { subEventId: fixture.subEvents.MS!, competitorId: competitor.id, seed: 41 } });
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const committing = commit(id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await writer;
    await committing;
    const entries = await kit.prisma.entry.findMany({ where: { competitor: { playerId: player.id } } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ seed: 41 });
  });

  it('turns a seed taken after validation into a row error without failing the batch', async () => {
    const id = await submit([newPlayer('Hat Giong Mot', { seed: 55 }), newPlayer('Hat Giong Hai', { seed: 56 })]);
    const taken = await seedPlayer(kit.prisma, tag, 'Giu Hat Giong');
    const competitor = await kit.prisma.competitor.create({ data: { type: 'PLAYER', playerId: taken.id, displayName: taken.fullName } });
    await kit.prisma.entry.create({ data: { subEventId: fixture.subEvents.MS!, competitorId: competitor.id, seed: 55 } });
    await commit(id);
    const rows = await kit.prisma.importRow.findMany({ where: { importJobId: id }, orderBy: { rowNo: 'asc' } });
    expect(rows.map((row) => row.status)).toEqual(['ERROR', 'COMMITTED']);
    expect(rows[0]!.messages).toEqual([expect.stringContaining('Hạt giống 55')]);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DONE' });
  });

  it('does not reject a second new person with the same name but another birth year in a later batch', async () => {
    const id = await submit([newPlayer('Trung Ten Moi', { player1BirthYear: 2008 }), newPlayer('Trung Ten Moi', { player1BirthYear: 2010 })]);
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'VALID' } })).toBe(2);
    await commit(id, { commitBatchSize: 1 });
    expect((await kit.prisma.importRow.findMany({ where: { importJobId: id } })).map((row) => row.status)).toEqual(['COMMITTED', 'COMMITTED']);
    expect(await kit.prisma.player.count({ where: { fullName: `Trung Ten Moi ${tag}` } })).toBe(2);
  });

  it('flags one player placed in two different pairs of the same file', async () => {
    const a = await seedPlayer(kit.prisma, tag, 'Cap Mot');
    const b = await seedPlayer(kit.prisma, tag, 'Cap Hai');
    const c = await seedPlayer(kit.prisma, tag, 'Cap Ba');
    const id = await submit([
      { subEventCode: 'MD', player1Code: a.code, player2Code: b.code },
      { subEventCode: 'MD', player1Code: a.code, player2Code: c.code },
    ]);
    const rows = await kit.prisma.importRow.findMany({ where: { importJobId: id }, orderBy: { rowNo: 'asc' } });
    expect(rows.map((row) => row.status)).toEqual(['VALID', 'ERROR']);
    expect((rows[1]!.messages as string[])[0]).toContain('dòng 2');
  });

  it('tells the operator which code replaces a merged player', async () => {
    const target = await seedPlayer(kit.prisma, tag, 'Dich Gop');
    const source = await seedPlayer(kit.prisma, tag, 'Nguon Gop');
    await kit.prisma.player.update({ where: { id: source.id }, data: { mergedIntoId: target.id, isActive: false } });
    const id = await submit([{ subEventCode: 'MS', player1Code: source.code }]);
    const row = await kit.prisma.importRow.findFirstOrThrow({ where: { importJobId: id } });
    expect((row.messages as string[])[0]).toContain(`đã được gộp vào mã ${target.code}`);
  });

  it('resumes an interrupted commit with only the remaining rows', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => newPlayer(`Dang Do ${i}`, { player1BirthYear: 1970 + (i % 30) }));
    const id = await submit(rows);
    const before = { entries: await entryCount(), players: await playerCount() };
    await expect(
      commit(id, {
        onBatchCommitted: (batchNo) => {
          if (batchNo === 1) throw new Error('simulated crash');
        },
      }),
    ).rejects.toThrow('simulated crash');
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'COMMITTED' } })).toBe(200);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'COMMITTING', committedRows: 200 });

    expect(await worker.commitImport(deps(), id)).toBe('done');
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'COMMITTED' } })).toBe(450);
    expect(await entryCount()).toBe(before.entries + 450);
    expect(await playerCount()).toBe(before.players + 450);
  }, 120_000);

  it('marks a row ERROR instead of crashing when its player changed after validation', async () => {
    const player = await seedPlayer(kit.prisma, tag, 'Doi Thong Tin', { birthYear: 1985 });
    const id = await submit([{ subEventCode: 'MS', player1Code: player.code }, newPlayer('Binh Thuong')]);
    await kit.prisma.player.update({ where: { id: player.id }, data: { isActive: false } });
    await commit(id);
    const rows = await kit.prisma.importRow.findMany({ where: { importJobId: id }, orderBy: { rowNo: 'asc' } });
    expect(rows.map((row) => row.status)).toEqual(['ERROR', 'COMMITTED']);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DONE', committedRows: 1, errorRows: 1 });
  });

  it('ignores a commit job from an older attempt and never runs two commits over the same rows', async () => {
    const id = await submit(Array.from({ length: 6 }, (_, i) => newPlayer(`Hai Lan ${i}`, { player1BirthYear: 1960 + i })));
    const before = { entries: await entryCount(), players: await playerCount() };
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'COMMITTING', attemptNo: 3 } });
    expect(await worker.commitImport(deps(), id, 2)).toBe('skipped');
    expect(await kit.prisma.importRow.count({ where: { importJobId: id, status: 'VALID' } })).toBe(6);
    expect(await entryCount()).toBe(before.entries);

    const runs = await Promise.all([worker.commitImport(deps({ commitBatchSize: 2 }), id, 3), worker.commitImport(deps({ commitBatchSize: 2 }), id)]);
    expect(runs).toEqual(['done', 'done']);
    expect((await kit.prisma.importRow.findMany({ where: { importJobId: id } })).map((row) => row.status)).toEqual(Array(6).fill('COMMITTED'));
    expect(await entryCount()).toBe(before.entries + 6);
    expect(await playerCount()).toBe(before.players + 6);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DONE', committedRows: 6, errorRows: 0 });
  });

  it('fails the commit when the stored file changed', async () => {
    const id = await submit([newPlayer('File Doi')]);
    await storage.put(`private/imports/${id}.xlsx`, await buildXlsx([newPlayer('File Khac')]));
    expect(await commit(id)).toBe('failed');
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'FAILED', failureReason: 'File đã thay đổi sau khi kiểm tra' });
  });

  it('reads a workbook laid out like an Excel save: shared strings, numeric year, formula cached value, blank row', async () => {
    const bytes = buildExcelSavedXlsx([
      { rowNo: 2, cells: { subEventCode: { formula: 'IF(1,"MS","")', cached: 'MS' }, player1Name: `Tay Excel ${tag} Mot`, player1Gender: 'Nam', player1BirthYear: 1990 } },
      { rowNo: 4, cells: { subEventCode: 'MS', player1Name: `Tay Excel ${tag} Hai`, player1Gender: 'Nam', player1BirthYear: 1991, seed: 5 } },
    ]);
    const id = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes });
    expect(await worker.validateImport(deps(), id)).toBe('validated');
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'VALIDATED', totalRows: 2, validRows: 2, errorRows: 0 });
    const rows = await kit.prisma.importRow.findMany({ where: { importJobId: id }, orderBy: { rowNo: 'asc' }, select: { rowNo: true, status: true, data: true } });
    expect(rows.map((row) => [row.rowNo, row.status])).toEqual([
      [2, 'VALID'],
      [4, 'VALID'],
    ]);
    expect(JSON.stringify(rows[0]!.data)).toContain(`Tay Excel ${tag} Mot`);
    expect(JSON.stringify(rows[1]!.data)).toContain(`Tay Excel ${tag} Hai`);
    expect(JSON.stringify(rows[1]!.data)).toContain('1991');
  });

  describe('hostile files', () => {
    const failed = async (bytes: Buffer, env = ENV) => {
      const id = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes });
      const outcome = await worker.validateImport(deps({ env }), id);
      return { outcome, job: await kit.prisma.importJob.findUniqueOrThrow({ where: { id } }) };
    };

    it('rejects a file over the size ceiling', async () => {
      const { outcome, job } = await failed(await buildXlsx([newPlayer('To')]), { ...ENV, IMPORT_MAX_FILE_BYTES: 1000 });
      expect(outcome).toBe('failed');
      expect(job.failureReason).toContain('vượt quá');
    });

    it('rejects a non-zip file renamed .xlsx', async () => {
      const { job } = await failed(Buffer.from('this is not a workbook'));
      expect(job).toMatchObject({ status: 'FAILED', failureReason: 'File không phải Excel (.xlsx)' });
    });

    it('stops a zip bomb at the unzipped ceiling with bounded memory', async () => {
      const bomb = Buffer.from(zipSync({ 'xl/worksheets/sheet1.xml': new Uint8Array(150 * 1024 * 1024) }, { level: 9 }));
      expect(bomb.length).toBeLessThan(1024 * 1024);
      const baseline = process.memoryUsage().rss;
      let peak = baseline;
      const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 5);
      const { job } = await failed(bomb);
      clearInterval(timer);
      expect(job).toMatchObject({ status: 'FAILED', failureReason: 'File giải nén quá lớn' });
      expect(peak - baseline).toBeLessThan(100 * 1024 * 1024);
    }, 60_000);

    it('stops a zip whose central directory entries all point at one big local entry', async () => {
      const bomb = buildOverlappingZip(20, 20 * 1024 * 1024);
      expect(bomb.length).toBeLessThan(1024 * 1024);
      const baseline = process.memoryUsage().rss;
      let peak = baseline;
      const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 5);
      const { outcome, job } = await failed(bomb);
      clearInterval(timer);
      expect(outcome).toBe('failed');
      expect(job).toMatchObject({ status: 'FAILED', failureReason: 'File giải nén quá lớn' });
      expect(peak - baseline).toBeLessThan(100 * 1024 * 1024);
    }, 60_000);

    it('names the wrong header', async () => {
      const headers = ['Sai', ...Array.from({ length: 14 }, (_, i) => `c${i}`)];
      const { job } = await failed(await buildXlsx([], headers));
      expect(job.status).toBe('FAILED');
      expect(job.failureReason).toContain('Cột 1');
    });

    it('rejects a file with too many rows', async () => {
      const { job } = await failed(await buildXlsx(Array.from({ length: 5 }, (_, i) => newPlayer(`Nhieu ${i}`))), { ...ENV, IMPORT_MAX_ROWS: 3 });
      expect(job.failureReason).toContain('hơn 3 dòng');
    });
  });

  it('cleanup deletes old stored files and expires abandoned uploads', async () => {
    const old = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes: await buildXlsx([]) });
    await kit.prisma.importJob.update({ where: { id: old }, data: { status: 'DONE', createdAt: new Date(Date.now() - 400 * 86_400_000) } });
    const abandoned = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes: await buildXlsx([]) });
    await kit.prisma.importJob.update({ where: { id: abandoned }, data: { status: 'AWAITING_UPLOAD', createdAt: new Date(Date.now() - 2 * 86_400_000) } });
    await storage.delete(`private/imports/${abandoned}.xlsx`);
    await worker.cleanupImportFiles(deps());
    expect(await storage.stat(`private/imports/${old}.xlsx`)).toBeNull();
    expect((await kit.prisma.importJob.findUniqueOrThrow({ where: { id: old } })).fileDeletedAt).not.toBeNull();
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id: abandoned } })).toMatchObject({ status: 'FAILED', failureReason: 'Hết hạn tải file' });
  });

  it('expires an upload only after the configured wait time', async () => {
    const fresh = await storeJob(kit.prisma, storage, { eventId: fixture.eventId, createdById: adminId, bytes: await buildXlsx([]) });
    await kit.prisma.importJob.update({ where: { id: fresh }, data: { status: 'AWAITING_UPLOAD', createdAt: new Date(Date.now() - 5 * 3_600_000) } });
    try {
      await worker.cleanupImportFiles(deps());
      expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id: fresh } })).toMatchObject({ status: 'AWAITING_UPLOAD' });
      await kit.prisma.appSetting.upsert({ where: { key: 'import.uploadTtlHours' }, create: { key: 'import.uploadTtlHours', value: 3 }, update: { value: 3 } });
      await worker.cleanupImportFiles(deps());
      expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id: fresh } })).toMatchObject({ status: 'FAILED', failureReason: 'Hết hạn tải file' });
      expect(await storage.stat(`private/imports/${fresh}.xlsx`)).toBeNull();
    } finally {
      await kit.prisma.appSetting.deleteMany({ where: { key: 'import.uploadTtlHours' } });
    }
  });
});
