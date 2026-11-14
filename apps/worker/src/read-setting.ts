import type { PrismaClient } from '@kamito/db';
import { resolveAppSetting, type AppSettingDefinition } from '@kamito/shared';
import type { z } from 'zod';

export async function readSetting<T extends z.ZodType>(prisma: PrismaClient, def: AppSettingDefinition<T>): Promise<z.infer<T>> {
  const row = await prisma.appSetting.findUnique({ where: { key: def.key } });
  return resolveAppSetting(def, row?.value);
}
