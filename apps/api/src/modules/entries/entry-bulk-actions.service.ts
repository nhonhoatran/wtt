import { Injectable } from '@nestjs/common';
import { lockSubEvent } from '@kamito/db';
import { playerSettings } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { BulkEntriesBody } from './entry-dtos.js';
import { EntryEligibilityService } from './entry-eligibility.service.js';
import { entryNotFound, mapSeedConflict } from './entry-errors.js';
import { EntriesService } from './entries.service.js';
import { entryAuditFields } from './entry-view.js';

@Injectable()
export class EntryBulkActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eligibility: EntryEligibilityService,
    private readonly entries: EntriesService,
    private readonly settings: AppSettingsService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  async apply(body: BulkEntriesBody) {
    const ids = [...new Set(body.ids)];
    const max = await this.settings.get(playerSettings.maxBulkEntries);
    if (ids.length > max) throw fieldError('ids', `Tối đa ${max} entry mỗi lần`);
    const first = await this.prisma.entry.findMany({ where: { id: { in: ids } }, select: { subEventId: true } });
    if (first.length !== ids.length) throw entryNotFound();
    const subEventIds = new Set(first.map((row) => row.subEventId));
    if (subEventIds.size > 1) throw fieldError('ids', 'Chỉ thao tác hàng loạt trên các entry của cùng một nội dung');
    const subEventId = [...subEventIds][0]!;

    let rankingDirty: string[] = [];
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await lockSubEvent(tx, subEventId);
        const subEvent = await this.eligibility.loadSubEvent(tx, subEventId);
        const rows = await tx.entry.findMany({ where: { id: { in: ids } } });
        const warnings: string[] = [];

        let changes: { row: (typeof rows)[number]; data: { status?: 'WITHDRAWN'; seed?: null; stage?: 'MAIN' | 'QUALIFYING'; quotaType?: 'DIRECT' | 'WILDCARD' | 'QUALIFIER' } }[];
        if (body.action === 'withdraw') {
          const active = rows.filter((row) => row.status === 'CONFIRMED');
          await this.entries.guardWithdraw(tx, active.map((row) => row.id), warnings);
          changes = active.map((row) => ({ row, data: { status: 'WITHDRAWN' as const, seed: null } }));
        } else if (body.action === 'setStage') {
          const stage = body.stage!;
          if (stage === 'QUALIFYING' && !subEvent.hasQualifying) throw fieldError('stage', 'Nội dung này không có vòng loại');
          const moving = rows.filter((row) => row.stage !== stage);
          await this.entries.guardStageChange(tx, moving.map((row) => row.id));
          changes = moving.map((row) => ({ row, data: { stage } }));
        } else {
          const quotaType = body.quotaType!;
          changes = rows.filter((row) => row.quotaType !== quotaType).map((row) => ({ row, data: { quotaType } }));
        }

        for (const { row, data } of changes) {
          const updated = await tx.entry.update({ where: { id: row.id }, data });
          const keys = (Object.keys(data) as (keyof ReturnType<typeof entryAuditFields>)[]).filter(
            (key) => entryAuditFields(row)[key] !== entryAuditFields(updated)[key],
          );
          await this.audit.record(
            {
              action: 'entry.update',
              entity: 'Entry',
              entityId: row.id,
              before: Object.fromEntries(keys.map((key) => [key, entryAuditFields(row)[key]])),
              after: { ...Object.fromEntries(keys.map((key) => [key, entryAuditFields(updated)[key]])), bulk: body.action },
            },
            tx,
          );
        }
        if (body.action === 'withdraw' && changes.length) rankingDirty = await markRankingDirty(tx, [subEventId]);
        return { data: { updated: changes.length }, warnings };
      });
      result.warnings.push(...(await this.ranking.enqueueRecompute(rankingDirty)));
      return result;
    } catch (error) {
      throw mapSeedConflict(error, undefined);
    }
  }
}
