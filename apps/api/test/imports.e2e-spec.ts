import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findOrCreateCompetitor } from '@kamito/db';
import { LocalObjectStorage } from '@kamito/shared/object-storage';
import ExcelJS from 'exceljs';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthTestKit } from './support/auth-test-kit.js';
import {
  buildXlsx,
  cleanupImportData,
  createImportEvent,
  loadImportProcessors,
  seedPlayer,
  type ImportEventFixture,
  type WorkerImportModules,
} from './support/import-test-kit.js';

const IMPORTS = '/api/v1/admin/imports';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('admin imports + exports API (real Postgres + Redis, local storage)', () => {
  let kit: AuthTestKit;
  let dir: string;
  let worker: WorkerImportModules;
  let fixture: ImportEventFixture;
  let admin: string;
  let operator: string;
  const tag = `A${randomUUID().slice(0, 6)}`;
  const queue = new Queue('import', { connection: { url: process.env.REDIS_URL }, prefix: process.env.QUEUE_PREFIX });
  const jobIds: string[] = [];
  const bin = (res: NodeJS.ReadableStream, done: (error: Error | null, body?: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  };
  const download = async (url: string, cookie = admin) => {
    const res = await kit.http.get(url).set('Cookie', cookie).buffer(true).parse(bin as never).expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as never);
    return { res, workbook };
  };
  const put = (id: string, body: Buffer, type = XLSX, cookie = admin) => kit.http.put(`${IMPORTS}/${id}/file`).set('Origin', kit.origin).set('Cookie', cookie).set('Content-Type', type).send(body);
  const submitViaApi = async (rows: Parameters<typeof buildXlsx>[0]) => {
    const bytes = await buildXlsx(rows);
    const created = await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'b.xlsx', fileSize: bytes.length }).expect(201);
    const id = created.body.data.id as string;
    jobIds.push(id);
    await put(id, bytes).expect(200);
    await kit.write('post', `${IMPORTS}/${id}/uploaded`, admin).expect(200);
    await worker.validateImport(deps(), id);
    return id;
  };
  const deps = () => ({ prisma: kit.prisma as unknown, storage: new LocalObjectStorage(dir), env: { IMPORT_MAX_FILE_BYTES: 5 * 1024 * 1024, IMPORT_MAX_UNZIPPED_BYTES: 50 * 1024 * 1024, IMPORT_MAX_ROWS: 5000 } });

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'kamito-import-api-'));
    process.env.STORAGE_DRIVER = 'local';
    process.env.UPLOAD_LOCAL_DIR = dir;
    kit = await AuthTestKit.start();
    worker = await loadImportProcessors();
    admin = await kit.signIn(await kit.createUser({ role: 'ADMIN' }));
    operator = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    fixture = await createImportEvent(kit, admin, tag);
  });

  afterAll(async () => {
    for (const id of jobIds) for (const n of [1, 2, 3]) for (const action of ['validate', 'commit']) await (await queue.getJob(`imp-${id}-${action}-${n}`))?.remove().catch(() => undefined);
    await queue.close();
    await cleanupImportData(kit.prisma, [fixture.eventId], tag);
    await kit.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('runs the full flow: create, upload, validate, decide, commit, export', async () => {
    const existing = await seedPlayer(kit.prisma, tag, 'Da Co');
    const twin = await seedPlayer(kit.prisma, tag, 'Trung Ten', { birthYear: 1980 });
    const rows = [
      { subEventCode: 'MS', player1Code: existing.code },
      { subEventCode: 'MS', player1Name: `Moi Hoan Toan ${tag}`, player1Gender: 'Nam', player1BirthYear: 2000, seed: 1 },
      { subEventCode: 'MS', player1Name: twin.fullName, player1Gender: 'Nam', player1BirthYear: 1999 },
      { subEventCode: 'ZZ', player1Name: 'Loi' },
    ];
    const bytes = await buildXlsx(rows);

    await kit.write('post', IMPORTS, operator, { eventId: fixture.eventId, fileName: 'a.xlsx', fileSize: bytes.length }).expect(403);
    await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'a.xlsx', fileSize: 999_999_999 }).expect(422);
    await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'a.pdf', fileSize: 10 }).expect(422);
    const created = await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'a.xlsx', fileSize: bytes.length }).expect(201);
    const id = created.body.data.id as string;
    jobIds.push(id);
    expect(created.body.data).toMatchObject({ status: 'AWAITING_UPLOAD', maxBytes: 5 * 1024 * 1024 });

    await kit.write('post', `${IMPORTS}/${id}/uploaded`, admin).expect(409);
    await put(id, bytes, 'text/plain').expect(415);
    await put(id, Buffer.concat([bytes, Buffer.alloc(10)])).expect(413);
    const uploaded = await put(id, bytes).expect(200);
    expect(uploaded.body.data).toMatchObject({ status: 'AWAITING_UPLOAD', fileSize: bytes.length });
    const queued = await kit.write('post', `${IMPORTS}/${id}/uploaded`, admin).expect(200);
    expect(queued.body.data.status).toBe('VALIDATING');
    expect(await queue.getJob(`imp-${id}-validate-1`)).toBeTruthy();

    await worker.validateImport(deps(), id);
    for (let i = 0; i < 50 && (await kit.get(`${IMPORTS}/${id}`, admin)).body.data.status === 'VALIDATING'; i += 1) await new Promise((r) => setTimeout(r, 100));
    const detail = (await kit.get(`${IMPORTS}/${id}`, operator).expect(200)).body.data;
    expect(detail).toMatchObject({ status: 'VALIDATED', totalRows: 4, validRows: 2, errorRows: 1, needsConfirmRows: 1, countsByStatus: { VALID: 2, ERROR: 1, NEEDS_CONFIRM: 1, COMMITTED: 0 } });
    expect(detail.event).toMatchObject({ id: fixture.eventId });

    const page = (await kit.get(`${IMPORTS}/${id}/rows?page=2&pageSize=3`, admin).expect(200)).body;
    expect(page).toMatchObject({ total: 4, page: 2 });
    expect(page.data.map((row: { rowNo: number }) => row.rowNo)).toEqual([5]);
    const pending = (await kit.get(`${IMPORTS}/${id}/rows?filter[status]=NEEDS_CONFIRM`, admin).expect(200)).body.data;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ rowNo: 4, candidates: [{ slot: 1, players: [{ id: twin.id, code: twin.code }] }] });
    const errored = (await kit.get(`${IMPORTS}/${id}/rows?filter[status]=ERROR`, admin).expect(200)).body.data;
    expect(errored[0].messages[0]).toContain('ZZ');

    await kit.write('post', `${IMPORTS}/${id}/commit`, admin, { overrideReason: 'ok' }).expect(422);
    await kit.write('patch', `${IMPORTS}/${id}/rows/4`, admin, { slot: 1, choice: randomUUID() }).expect(422);
    await kit.write('patch', `${IMPORTS}/${id}/rows/2`, admin, { slot: 1, choice: 'NEW' }).expect(409);
    const decided = await kit.write('patch', `${IMPORTS}/${id}/rows/4`, admin, { slot: 1, choice: twin.id }).expect(200);
    expect(decided.body.data).toMatchObject({ status: 'VALID', decisions: { '1': twin.id } });
    expect((await kit.get(`${IMPORTS}/${id}`, admin)).body.data).toMatchObject({ validRows: 3, needsConfirmRows: 0 });

    await kit.write('post', `${IMPORTS}/${id}/commit`, operator, {}).expect(403);
    const op = await kit.signIn(await kit.createUser({ role: 'RESULTS_OPERATOR' }));
    await kit.write('post', `${IMPORTS}/${id}/commit`, op, { overrideReason: 'vuot kiem tra' }).expect(403);
    const commit = await kit.write('post', `${IMPORTS}/${id}/commit`, admin, {}).expect(200);
    expect(commit.body.data.status).toBe('COMMITTING');
    expect(await queue.getJob(`imp-${id}-commit-2`)).toBeTruthy();
    await kit.write('post', `${IMPORTS}/${id}/commit`, admin, {}).expect(409);

    expect(await worker.commitImport(deps(), id)).toBe('done');
    const done = (await kit.get(`${IMPORTS}/${id}`, admin)).body.data;
    expect(done).toMatchObject({ status: 'DONE', committedRows: 3, countsByStatus: { COMMITTED: 3, ERROR: 1 } });
    expect(await kit.prisma.entry.count({ where: { subEventId: fixture.subEvents.MS } })).toBe(3);
    expect(await kit.prisma.player.count({ where: { fullName: { contains: tag } } })).toBe(3);

    const list = (await kit.get(`${IMPORTS}?filter[eventId]=${fixture.eventId}&filter[status]=DONE`, admin).expect(200)).body;
    expect(list).toMatchObject({ total: 1 });
    expect(list.data[0]).not.toHaveProperty('fileKey');

    const { res, workbook } = await download(`/api/v1/admin/exports/entries?eventId=${fixture.eventId}`);
    expect(res.headers['content-disposition']).toContain(`dang-ky-${fixture.slug}.xlsx`);
    const sheet = workbook.worksheets[0]!;
    expect(sheet.getRow(1).getCell(16).value).toBe('Trạng thái');
    expect(sheet.rowCount).toBe(4);
    const codes = [2, 3, 4].map((n) => String(sheet.getRow(n).getCell(2).value));
    expect(codes).toContain(existing.code);
    expect(String(sheet.getRow(2).getCell(16).value)).toBe('Đã xác nhận');

    const reimport = await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'again.xlsx', fileSize: 10 }).expect(201);
    jobIds.push(reimport.body.data.id);
    await kit.get(`/api/v1/admin/exports/entries?eventId=${fixture.eventId}&subEventId=${randomUUID()}`, admin).expect(404);
    await kit.get(`/api/v1/admin/exports/entries?eventId=${fixture.eventId}`).expect(401);
  }, 60_000);

  it('serves the template with sheets, dropdowns and existing players', async () => {
    const base = await kit.prisma.subEvent.findUniqueOrThrow({ where: { id: fixture.subEvents.MS! } });
    await kit.prisma.subEvent.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({ eventId: fixture.eventId, disciplineId: base.disciplineId, matchFormatId: base.matchFormatId, format: base.format, code: `MAU-NOI-DUNG-${i + 1}` })),
    });
    const { res, workbook } = await download(`${IMPORTS}/template?eventId=${fixture.eventId}`, operator);
    expect(res.headers['content-disposition']).toContain(`mau-import-${fixture.slug}.xlsx`);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Đăng ký', 'Hướng dẫn', 'VĐV đã có', 'Mã nội dung']);
    const register = workbook.getWorksheet('Đăng ký')!;
    expect(register.getRow(1).getCell(1).value).toBe('Mã nội dung');
    const validation = register.getCell('A2').dataValidation;
    expect(validation?.type).toBe('list');
    const codes = workbook.getWorksheet('Mã nội dung')!;
    expect(codes.state).toBe('hidden');
    expect(codes.rowCount).toBeGreaterThan(46);
    expect(String(validation?.formulae?.[0])).toBe(`'Mã nội dung'!$A$2:$A$${codes.rowCount}`);
    const listed = Array.from({ length: codes.rowCount - 1 }, (_, i) => String(codes.getRow(i + 2).getCell(1).value));
    expect(listed).toContain('MAU-NOI-DUNG-45');
    expect(listed).toContain('MS');
    expect(String(register.getCell('B2').dataValidation?.formulae?.[0] ?? '').length).toBeLessThan(255);
    expect(workbook.getWorksheet('VĐV đã có')!.rowCount).toBeGreaterThan(1);
    await kit.get(`${IMPORTS}/template?eventId=${randomUUID()}`, admin).expect(404);
  });

  it('lets a FAILED job with no committed row commit again and be validated again', async () => {
    const id = await submitViaApi([{ subEventCode: 'WS', player1Name: `Phuc Hoi ${tag}`, player1Gender: 'Nữ', player1BirthYear: 1995 }]);
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'FAILED', failureReason: 'Nội dung đã có bốc thăm' } });
    await kit.write('post', `${IMPORTS}/${id}/commit`, operator, {}).expect(403);

    const revalidated = await kit.write('post', `${IMPORTS}/${id}/validate`, admin).expect(200);
    expect(revalidated.body.data.status).toBe('VALIDATING');
    expect(await queue.getJob(`imp-${id}-validate-2`)).toBeTruthy();
    await worker.validateImport(deps(), id);
    expect((await kit.get(`${IMPORTS}/${id}`, admin)).body.data).toMatchObject({ status: 'VALIDATED', validRows: 1 });

    await kit.prisma.importJob.update({ where: { id }, data: { status: 'FAILED' } });
    const retried = await kit.write('post', `${IMPORTS}/${id}/commit`, admin, { overrideReason: 'nhập sau khi bốc thăm' }).expect(200);
    expect(retried.body.data.status).toBe('COMMITTING');
    expect(await worker.commitImport(deps(), id)).toBe('done');
    await kit.write('post', `${IMPORTS}/${id}/validate`, admin).expect(409);
    expect(await kit.prisma.entry.count({ where: { subEventId: fixture.subEvents.WS } })).toBe(1);
  });

  it('cannot commit the old preview after a re-validation fails', async () => {
    const id = await submitViaApi([{ subEventCode: 'WS', player1Name: `Ban Cu ${tag}`, player1Gender: 'Nữ', player1BirthYear: 1996 }]);
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'FAILED', failureReason: 'x' } });
    await kit.write('post', `${IMPORTS}/${id}/validate`, admin).expect(200);
    expect(await kit.prisma.importJob.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'VALIDATING', fileSha256: null, totalRows: null });
    await new LocalObjectStorage(dir).put(`private/imports/${id}.xlsx`, Buffer.from('not a workbook'));
    expect(await worker.validateImport(deps(), id)).toBe('failed');
    expect(await kit.prisma.importRow.count({ where: { importJobId: id } })).toBeGreaterThan(0);
    await kit.write('post', `${IMPORTS}/${id}/commit`, admin, {}).expect(409);
    await kit.write('post', `${IMPORTS}/${id}/commit`, admin, { overrideReason: 'ép nhập' }).expect(409);
    const detail = (await kit.get(`${IMPORTS}/${id}`, admin)).body.data;
    expect(detail).toMatchObject({ status: 'FAILED', totalRows: null });
    expect(await kit.prisma.entry.count({ where: { subEventId: fixture.subEvents.WS, competitor: { player: { fullName: { contains: `Ban Cu ${tag}` } } } } })).toBe(0);
  });

  it('refuses to commit or validate a failed job that never uploaded a file', async () => {
    const created = await kit.write('post', IMPORTS, admin, { eventId: fixture.eventId, fileName: 'c.xlsx', fileSize: 10 }).expect(201);
    const id = created.body.data.id as string;
    jobIds.push(id);
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'FAILED', failureReason: 'x' } });
    await kit.write('post', `${IMPORTS}/${id}/commit`, admin, {}).expect(409);
    await kit.write('post', `${IMPORTS}/${id}/validate`, admin).expect(409);
  });

  it('re-checks a row after the operator picks a player who is already entered', async () => {
    const twin = await seedPlayer(kit.prisma, tag, 'Da Dang Ky', { birthYear: 1980 });
    const partner = await seedPlayer(kit.prisma, tag, 'Dong Doi Cu', { birthYear: 1981 });
    const competitor = await kit.prisma.$transaction((tx) => findOrCreateCompetitor(tx, [twin.id, partner.id]));
    await kit.prisma.entry.create({ data: { subEventId: fixture.subEvents.MD!, competitorId: competitor.id } });
    const id = await submitViaApi([
      { subEventCode: 'MD', player1Name: twin.fullName, player1Gender: 'Nam', player1BirthYear: 1999, player2Name: `Dong Doi Moi ${tag}`, player2Gender: 'Nam', player2BirthYear: 1990 },
    ]);
    expect((await kit.get(`${IMPORTS}/${id}/rows`, admin)).body.data[0]).toMatchObject({ status: 'NEEDS_CONFIRM' });
    const decided = await kit.write('patch', `${IMPORTS}/${id}/rows/2`, admin, { slot: 1, choice: twin.id }).expect(200);
    expect(decided.body.data.status).toBe('ERROR');
    expect(decided.body.data.messages[0]).toContain('đã đăng ký nội dung MD');
    expect((await kit.get(`${IMPORTS}/${id}`, admin)).body.data).toMatchObject({ validRows: 0, errorRows: 1, needsConfirmRows: 0 });
    const again = await kit.write('patch', `${IMPORTS}/${id}/rows/2`, admin, { slot: 1, choice: 'NEW' }).expect(200);
    expect(again.body.data.status).toBe('VALID');
  });

  it('rejects a choice once the import is no longer VALIDATED', async () => {
    const twin = await seedPlayer(kit.prisma, tag, 'Cho Chon', { birthYear: 1970 });
    const id = await submitViaApi([{ subEventCode: 'MS', player1Name: twin.fullName, player1Gender: 'Nam', player1BirthYear: 1999 }]);
    await kit.prisma.importJob.update({ where: { id }, data: { status: 'COMMITTING' } });
    await kit.write('patch', `${IMPORTS}/${id}/rows/2`, admin, { slot: 1, choice: twin.id }).expect(409);
  });

  it('exports every entry of a sub-event beyond one page of 1000', async () => {
    const total = 1100;
    const stamp = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const players = Array.from({ length: total }, (_, i) => ({
      id: randomUUID(),
      code: `E${stamp}${String(i).padStart(4, '0')}`,
      slug: `${tag.toLowerCase()}-exp-${stamp}-${i}`,
      fullName: `Xuat ${i} ${tag}`,
      fullNameEn: `Xuat ${i} ${tag}`,
      normalizedName: `xuat ${i} ${tag}`.toLowerCase(),
      gender: 'FEMALE' as const,
      countryCode: 'VIE',
    }));
    await kit.prisma.player.createMany({ data: players });
    const competitors = players.map((player) => ({ id: randomUUID(), type: 'PLAYER' as const, playerId: player.id, displayName: player.fullName }));
    await kit.prisma.competitor.createMany({ data: competitors });
    await kit.prisma.entry.createMany({ data: competitors.map((competitor) => ({ subEventId: fixture.subEvents.MD!, competitorId: competitor.id })) });

    const { workbook } = await download(`/api/v1/admin/exports/entries?eventId=${fixture.eventId}&subEventId=${fixture.subEvents.MD}`);
    const sheet = workbook.worksheets[0]!;
    const codes = new Set<string>();
    sheet.eachRow((row, rowNo) => rowNo > 1 && String(row.getCell(2).value).startsWith(`E${stamp}`) && codes.add(String(row.getCell(2).value)));
    expect(sheet.rowCount).toBeGreaterThan(total);
    expect(codes.size).toBe(total);
  }, 120_000);
});
