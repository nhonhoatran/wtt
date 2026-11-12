import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from './generated/prisma/client.js';

export const bundledMigrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

export function listBundledMigrations(dir: string = bundledMigrationsDir): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Migrations shipped with this build that are not applied (finished, not rolled back) in the DB. */
export async function findPendingMigrations(
  prisma: PrismaClient,
  dir: string = bundledMigrationsDir,
): Promise<string[]> {
  const bundled = listBundledMigrations(dir);
  // Connection/auth errors propagate; only a missing table means "nothing applied yet".
  const [table] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS "exists"`;
  if (!table?.exists) return bundled;
  const applied = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  return bundled.filter((name) => !appliedNames.has(name));
}
