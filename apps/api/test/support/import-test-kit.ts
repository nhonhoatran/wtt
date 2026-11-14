import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENTRY_IMPORT_COLUMNS, type EntryImportColumnKey } from '@kamito/shared';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import ExcelJS from 'exceljs';
import type { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import type { AuthTestKit } from './auth-test-kit.js';

export type SheetRowInput = Partial<Record<EntryImportColumnKey, string | number>>;

export interface ImportDeps {
  prisma: unknown;
  storage: ObjectStorage;
  env: { IMPORT_MAX_FILE_BYTES: number; IMPORT_MAX_UNZIPPED_BYTES: number; IMPORT_MAX_ROWS: number };
  commitBatchSize?: number;
  enqueueRevalidate?: (tags: string[]) => Promise<void>;
  logger?: { warn: (fields: object, message: string) => void };
  onBatchCommitted?: (batchNo: number) => void | Promise<void>;
}

// The worker package is not an api dependency (rootDir), so its processors load by file URL and are typed here.
export interface WorkerImportModules {
  validateImport(deps: ImportDeps, jobId: string): Promise<'skipped' | 'validated' | 'failed'>;
  commitImport(deps: ImportDeps, jobId: string, attemptNo?: number): Promise<'skipped' | 'done' | 'failed'>;
  cleanupImportFiles(deps: ImportDeps): Promise<{ deleted: number; expired: number }>;
}

export async function loadImportProcessors(): Promise<WorkerImportModules> {
  const dir = path.resolve(import.meta.dirname, '../../../worker/src/processors');
  const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(path.join(dir, file)).href) as Promise<Record<string, unknown>>;
  const [validate, commit, cleanup] = await Promise.all([load('import-validate-processor.ts'), load('import-commit-processor.ts'), load('import-file-cleanup-processor.ts')]);
  return { validateImport: validate.validateImport, commitImport: commit.commitImport, cleanupImportFiles: cleanup.cleanupImportFiles } as WorkerImportModules;
}

export async function buildXlsx(rows: SheetRowInput[], headers: string[] = ENTRY_IMPORT_COLUMNS.map((column) => column.header)): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Đăng ký');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(ENTRY_IMPORT_COLUMNS.map((column) => row[column.key] ?? ''));
  return Buffer.from(await workbook.xlsx.writeBuffer()) as Buffer;
}

export interface ImportEventFixture {
  eventId: string;
  slug: string;
  subEvents: Record<string, string>;
}

export async function createImportEvent(kit: AuthTestKit, adminCookie: string, tag: string): Promise<ImportEventFixture> {
  const eventType = await kit.prisma.eventType.findFirstOrThrow({ where: { isActive: true } });
  const created = await kit
    .write('post', '/api/v1/admin/events', adminCookie, { name: `Import ${tag}`, eventTypeId: eventType.id, startDate: '2099-05-01', endDate: '2099-05-02' })
    .expect(201);
  const eventId = created.body.data.id as string;
  const disciplines = await kit.prisma.discipline.findMany({ where: { code: { in: ['MS', 'WS', 'MD'] } }, select: { id: true, code: true } });
  const items = ['MS', 'WS', 'MD'].map((code) => ({ disciplineId: disciplines.find((row) => row.code === code)!.id }));
  const bulk = await kit.write('post', `/api/v1/admin/events/${eventId}/sub-events/bulk`, adminCookie, { items, defaults: { format: 'KNOCKOUT', hasQualifying: true } }).expect(201);
  const subEvents = Object.fromEntries((bulk.body.data as Array<{ code: string; id: string }>).map((row) => [row.code, row.id]));
  return { eventId, slug: created.body.data.slug as string, subEvents };
}

export async function storeJob(prisma: PrismaService, storage: ObjectStorage, input: { eventId: string; createdById: string; bytes: Buffer; status?: 'VALIDATING' | 'COMMITTING' }): Promise<string> {
  const id = randomUUID();
  const fileKey = `private/imports/${id}.xlsx`;
  await storage.put(fileKey, input.bytes);
  await prisma.importJob.create({
    data: { id, eventId: input.eventId, fileKey, fileName: 'test.xlsx', fileSize: input.bytes.length, createdById: input.createdById, status: input.status ?? 'VALIDATING', attemptNo: 1 },
  });
  return id;
}

/** Removes everything an import test created: entries, competitors, pairs and the tagged players, then the event. */
export async function cleanupImportData(prisma: PrismaService, eventIds: string[], tag: string): Promise<void> {
  const jobs = await prisma.importJob.findMany({ where: { eventId: { in: eventIds } }, select: { id: true } });
  const players = await prisma.player.findMany({ where: { fullName: { contains: tag } }, select: { id: true } });
  const playerIds = players.map((player) => player.id);
  await prisma.entry.deleteMany({ where: { subEvent: { eventId: { in: eventIds } } } });
  const pairs = await prisma.pair.findMany({ where: { OR: [{ playerAId: { in: playerIds } }, { playerBId: { in: playerIds } }] }, select: { id: true } });
  await prisma.competitor.deleteMany({ where: { OR: [{ playerId: { in: playerIds } }, { pairId: { in: pairs.map((pair) => pair.id) } }] } });
  await prisma.pair.deleteMany({ where: { id: { in: pairs.map((pair) => pair.id) } } });
  await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...eventIds, ...jobs.map((job) => job.id)] } } });
  await prisma.importJob.deleteMany({ where: { id: { in: jobs.map((job) => job.id) } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
}

export async function seedPlayer(prisma: PrismaService, tag: string, name: string, extra: { gender?: 'MALE' | 'FEMALE'; birthYear?: number | null; club?: string } = {}) {
  const fullName = `${name} ${tag}`;
  const code = `T${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  return prisma.player.create({
    data: {
      code,
      slug: `${tag.toLowerCase()}-${code.toLowerCase()}`,
      fullName,
      fullNameEn: fullName,
      normalizedName: fullName.toLowerCase(),
      gender: extra.gender ?? 'MALE',
      birthYear: extra.birthYear === undefined ? 1990 : extra.birthYear,
      club: extra.club ?? null,
      countryCode: 'VIE',
    },
  });
}
