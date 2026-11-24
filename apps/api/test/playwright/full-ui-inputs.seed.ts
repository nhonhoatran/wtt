import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { expect, it } from 'vitest';
import { fullUiGuard, type FullUiWorld } from './full-ui-contract.js';
import { fullUiExcel } from './full-ui-fixture.js';

it('checks full UI target guards and Excel inputs without a database connection', async () => {
  const tag = randomUUID(), dir = path.resolve(import.meta.dirname, '../../../../test-results', `261120-full-ui-inputs-${tag}`);
  if (!dir.startsWith(path.resolve(import.meta.dirname, '../../../../test-results') + path.sep) || !path.basename(dir).endsWith(tag)) throw new Error('Offline fixture cleanup path mismatch');
  const changed = { DATABASE_URL: 'postgresql://fixture:fixture@localhost:5433/kamito_tt_phase12_test', MIGRATE_CONFIRM_TARGET: 'localhost:5433/kamito_tt_phase12_test', APP_ENV: 'test', REAL_TEST_DB_LEASE: 'full-ui', QUEUE_PREFIX: `kamito-tt:test:full-ui:${tag}`, REDIS_URL: 'redis://localhost:6380', E2E_FULL_UI_PROJECT: 'desktop', E2E_FULL_UI_WORLD_FILE: path.join(dir, 'world.json'), E2E_FULL_UI_RUN_FILE: path.join(dir, 'run.json') };
  const previous = Object.fromEntries(Object.keys(changed).map((key) => [key, process.env[key]]));
  Object.assign(process.env, changed);
  try {
    expect(fullUiGuard()).toMatchObject({ tag, prefix: changed.QUEUE_PREFIX, project: 'desktop' });
    for (const database of ['kamito_tt_dev', 'postgres']) { process.env.DATABASE_URL = changed.DATABASE_URL.replace('kamito_tt_phase12_test', database); expect(() => fullUiGuard()).toThrow(); }
    process.env.DATABASE_URL = changed.DATABASE_URL;
    process.env.QUEUE_PREFIX = 'kamito-tt:test'; expect(() => fullUiGuard()).toThrow(); process.env.QUEUE_PREFIX = changed.QUEUE_PREFIX;
    process.env.REAL_TEST_DB_LEASE = 'wrong'; expect(() => fullUiGuard()).toThrow(); process.env.REAL_TEST_DB_LEASE = changed.REAL_TEST_DB_LEASE;
    await mkdir(dir);
    const world = { tag, runId: `desktop-${tag}`, reference: { ambiguousName: `MS 00 ${tag}`, replacementName: `Replacement ${tag}` } } as FullUiWorld;
    await fullUiExcel(world, dir);
    const ms = new ExcelJS.Workbook(), wd = new ExcelJS.Workbook();
    await ms.xlsx.readFile(world.files.msXlsx); await wd.xlsx.readFile(world.files.wdXlsx);
    const singles = ms.worksheets[0]!, doubles = wd.worksheets[0]!;
    expect(singles.rowCount).toBe(41); expect(doubles.rowCount).toBe(13);
    const stages: string[] = [];
    for (let row = 2; row <= singles.rowCount; row++) { stages.push(String(singles.getRow(row).getCell(12).value)); expect(singles.getRow(row).getCell(5).value).toBe(1999); }
    expect(stages.filter((stage) => stage === 'Chính')).toHaveLength(8); expect(stages.filter((stage) => stage === 'Loại')).toHaveLength(32);
    expect(singles.getRow(2).getCell(3).value).toBe(world.reference.ambiguousName);
    for (let row = 2; row <= doubles.rowCount; row++) { expect(doubles.getRow(row).getCell(4).value).toBe('Nữ'); expect(doubles.getRow(row).getCell(9).value).toBe('Nữ'); }
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
