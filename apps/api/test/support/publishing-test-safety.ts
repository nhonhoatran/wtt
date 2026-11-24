import type { Prisma, PrismaClient } from '@kamito/db';
import { contentSettings } from '@kamito/shared';

/** Run before constructing an app: CMS setup itself creates users and writes to Redis. */
export function assertPublishingTestTarget(env: NodeJS.ProcessEnv): void {
  let url: URL;
  try { url = new URL(env.DATABASE_URL ?? ''); }
  catch { throw new Error('Publishing fixtures require a valid confirmed local PostgreSQL test target'); }
  const target = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^\/[a-z][a-z0-9_]*_test$/.test(url.pathname)
    || env.MIGRATE_CONFIRM_TARGET !== target
    || env.APP_ENV !== 'test' || env.QUEUE_PREFIX !== 'kamito-tt:test') {
    throw new Error('Publishing fixtures require a confirmed local *_test database and the test queue namespace');
  }
}

/** Restore only the last version owned by this probe, preserving concurrent external edits. */
export async function withRetentionSetting(db: PrismaClient, run: (setDays: (days: number) => Promise<void>) => Promise<void>): Promise<void> {
  const key = contentSettings.contactRetentionDays.key;
  const before = await db.appSetting.findUnique({ where: { key } });
  let applied: { updatedAt: Date; value: Prisma.JsonValue; updatedById: string | null } | undefined;
  const versionWhere = (row: NonNullable<typeof applied>) => ({
    key, updatedAt: row.updatedAt, updatedById: row.updatedById, value: { equals: row.value as Prisma.InputJsonValue },
  });
  const restore = async () => {
    if (!applied) return;
    const where = versionWhere(applied);
    const restored = before
      ? await db.appSetting.updateMany({ where, data: { value: before.value as Prisma.InputJsonValue, updatedById: before.updatedById } })
      : await db.appSetting.deleteMany({ where });
    if (restored.count !== 1) throw new Error('Contact retention changed outside this probe; refusing to overwrite it');
  };
  try {
    await run(async (days) => {
      const value = contentSettings.contactRetentionDays.schema.parse(days);
      const expected = applied ?? before;
      applied = await db.$transaction(async (tx) => {
        // A missing snapshot uses create-only: a row created by someone else must survive.
        if (!expected) return tx.appSetting.create({ data: { key, value } });
        const changed = await tx.appSetting.updateMany({ where: versionWhere(expected), data: { value } });
        if (changed.count !== 1) throw new Error('Contact retention changed outside this probe; refusing to overwrite it');
        // The update holds its row lock through this read and until the transaction commits.
        return tx.appSetting.findUniqueOrThrow({ where: { key } });
      });
    });
  } finally {
    await restore();
  }
}
