import type { PrismaClient } from '@kamito/db';
import { importSettings, effectiveLimit, BYTES_PER_MEGABYTE, resolveAppSetting, type AppSettingDefinition } from '@kamito/shared';
import type { ObjectStorage } from '@kamito/shared/object-storage';
import type { z } from 'zod';

export interface ImportEnvCeilings {
  IMPORT_MAX_FILE_BYTES: number;
  IMPORT_MAX_UNZIPPED_BYTES: number;
  IMPORT_MAX_ROWS: number;
}

export interface ImportDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  env: ImportEnvCeilings;
  now?: () => Date;
  /** Rows per commit transaction; the plan fixes 200. */
  commitBatchSize?: number;
  /** Called after each committed batch (1-based); lets tests interrupt a commit between batches. */
  onBatchCommitted?: (batchNo: number) => void | Promise<void>;
}

export async function readSetting<T extends z.ZodType>(prisma: PrismaClient, def: AppSettingDefinition<T>): Promise<z.infer<T>> {
  const row = await prisma.appSetting.findUnique({ where: { key: def.key } });
  return resolveAppSetting(def, row?.value);
}

export async function effectiveImportLimits(deps: ImportDeps) {
  const [megabytes, rows] = await Promise.all([
    readSetting(deps.prisma, importSettings.maxFileMegabytes),
    readSetting(deps.prisma, importSettings.maxRows),
  ]);
  return {
    maxFileBytes: effectiveLimit(megabytes, deps.env.IMPORT_MAX_FILE_BYTES, BYTES_PER_MEGABYTE),
    maxRows: effectiveLimit(rows, deps.env.IMPORT_MAX_ROWS),
    maxUnzippedBytes: deps.env.IMPORT_MAX_UNZIPPED_BYTES,
  };
}
