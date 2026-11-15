import { Injectable } from '@nestjs/common';
import { type AppSettingDefinition, findAppSetting, listEditableAppSettings, resolveAppSetting } from '@kamito/shared';
import type { Prisma } from '@kamito/db';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface EditableSettingView {
  key: string;
  group: string;
  label: string;
  description: string;
  editor: NonNullable<AppSettingDefinition['editor']>;
  defaultValue: unknown;
  value: unknown;
  isDefault: boolean;
  updatedAt: Date | null;
}

@Injectable()
export class AppSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get<T extends z.ZodType>(def: AppSettingDefinition<T>): Promise<z.infer<T>> {
    // The database is the shared source across replicas; a process-local TTL can re-cache stale public pages.
    const row = await this.prisma.appSetting.findUnique({ where: { key: def.key } });
    const value = resolveAppSetting(def, row?.value);
    return value;
  }

  async listEditable(): Promise<EditableSettingView[]> {
    const defs = listEditableAppSettings();
    const rows = await this.prisma.appSetting.findMany({ where: { key: { in: defs.map((def) => def.key) } } });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return defs.map((def) => {
      const row = byKey.get(def.key);
      return {
        key: def.key,
        group: def.group ?? 'other',
        label: def.label ?? def.key,
        description: def.description,
        editor: def.editor!,
        defaultValue: def.defaultValue,
        value: resolveAppSetting(def, row?.value),
        isDefault: !row,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  /** Returns undefined for unknown or non-editable keys. */
  findEditable(key: string): AppSettingDefinition | undefined {
    const def = findAppSetting(key);
    return def?.editor ? def : undefined;
  }

  async update(def: AppSettingDefinition, value: unknown, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.appSetting.findUnique({ where: { key: def.key } });
      const json = value as Prisma.InputJsonValue;
      await tx.appSetting.upsert({
        where: { key: def.key },
        create: { key: def.key, value: json, updatedById: actorUserId },
        update: { value: json, updatedById: actorUserId },
      });
      await this.audit.record(
        { action: 'setting.update', entity: 'AppSetting', entityId: def.key, before: before?.value ?? null, after: value },
        tx,
      );
    });
  }

  async reset(def: AppSettingDefinition): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.appSetting.findUnique({ where: { key: def.key } });
      if (!before) return;
      await tx.appSetting.delete({ where: { key: def.key } });
      await this.audit.record(
        { action: 'setting.reset', entity: 'AppSetting', entityId: def.key, before: before.value, after: def.defaultValue },
        tx,
      );
    });
  }
}
