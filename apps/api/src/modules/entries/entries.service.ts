import { ConflictException, Injectable } from '@nestjs/common';
import { competitorPlayerIds, entriesInLockedDraw, findOrCreateCompetitor, lockSubEvent, type Prisma } from '@kamito/db';
import type { UserRoleName } from '@kamito/shared';
import { AuditService } from '../../common/audit/audit.service.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { markRankingDirty } from '../ranking-jobs/ranking-dirty-marker.js';
import { RankingEnqueueService } from '../ranking-jobs/ranking-enqueue.service.js';
import type { CreateEntryBody, UpdateEntryBody } from './entry-dtos.js';
import { EntryEligibilityService, type EntryIssue } from './entry-eligibility.service.js';
import { DRAFT_DRAW_WARNING, entryNotFound, mapSeedConflict, PUBLISHED_DRAW_HINT } from './entry-errors.js';
import { ENTRY_INCLUDE, entryAuditFields, toEntryView } from './entry-view.js';

type Tx = Prisma.TransactionClient;

const issueSummary = (issues: EntryIssue[]) => issues.map(({ code, message, playerId }) => ({ code, message, playerId }));

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly eligibility: EntryEligibilityService,
    private readonly ranking: RankingEnqueueService,
  ) {}

  async create(subEventId: string, body: CreateEntryBody, role: UserRoleName) {
    let rankingDirty: string[] = [];
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await lockSubEvent(tx, subEventId);
        const subEvent = await this.eligibility.loadSubEvent(tx, subEventId);
        const stage = body.stage ?? 'MAIN';
        if (stage === 'QUALIFYING' && !subEvent.hasQualifying) throw fieldError('stage', 'Nội dung này không có vòng loại');

        const players = await this.eligibility.loadPlayers(tx, body.playerIds);
        const issues = await this.eligibility.assess(tx, subEvent, players);
        const override = this.eligibility.resolveOverride(issues, body.overrideReason, role);

        const competitor = await findOrCreateCompetitor(tx, body.playerIds);
        const existing = await tx.entry.findUnique({ where: { subEventId_competitorId: { subEventId, competitorId: competitor.id } } });
        if (existing?.status === 'CONFIRMED') {
          throw new ConflictException({ code: 'ALREADY_ENTERED', message: `${competitor.displayName} đã có đăng ký trong nội dung này` });
        }
        const data = {
          status: 'CONFIRMED' as const,
          stage,
          quotaType: body.quotaType ?? 'DIRECT',
          seed: body.seed ?? null,
          notes: body.notes ?? null,
          eligibilityOverrideReason: override?.reason ?? null,
        };
        const row = existing
          ? await tx.entry.update({ where: { id: existing.id }, data, include: ENTRY_INCLUDE })
          : await tx.entry.create({ data: { subEventId, competitorId: competitor.id, ...data }, include: ENTRY_INCLUDE });

        if (existing) {
          rankingDirty = await markRankingDirty(tx, [subEventId]);
          await this.audit.record({ action: 'entry.update', entity: 'Entry', entityId: row.id, before: entryAuditFields(existing), after: entryAuditFields(row) }, tx);
        } else {
          await this.audit.record(
            { action: 'entry.create', entity: 'Entry', entityId: row.id, after: { subEventId, competitorId: competitor.id, playerIds: body.playerIds, ...entryAuditFields(row) } },
            tx,
          );
        }
        if (override) {
          await this.audit.record(
            { action: 'entry.override', entity: 'Entry', entityId: row.id, reason: override.reason, after: { issues: issueSummary(override.issues) } },
            tx,
          );
        }
        return { data: toEntryView(row), warnings: [] as string[] };
      });
      result.warnings.push(...(await this.ranking.enqueueRecompute(rankingDirty)));
      return result;
    } catch (error) {
      throw mapSeedConflict(error, body.seed);
    }
  }

  async update(id: string, body: UpdateEntryBody, role: UserRoleName) {
    let rankingDirty: string[] = [];
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const probe = await tx.entry.findUnique({ where: { id }, select: { subEventId: true } });
        if (!probe) throw entryNotFound();
        await lockSubEvent(tx, probe.subEventId);
        const entry = await tx.entry.findUnique({ where: { id }, include: { competitor: { include: { pair: true } } } });
        if (!entry) throw entryNotFound();
        const subEvent = await this.eligibility.loadSubEvent(tx, entry.subEventId);

        const data: Prisma.EntryUncheckedUpdateInput = {};
        const warnings: string[] = [];
        if (body.stage !== undefined && body.stage !== entry.stage) {
          if (body.stage === 'QUALIFYING' && !subEvent.hasQualifying) throw fieldError('stage', 'Nội dung này không có vòng loại');
          await this.guardStageChange(tx, [id]);
          data.stage = body.stage;
        }
        if (body.quotaType !== undefined && body.quotaType !== entry.quotaType) data.quotaType = body.quotaType;
        if (body.seed !== undefined && body.seed !== entry.seed) {
          if (entry.status === 'WITHDRAWN' && body.status !== 'CONFIRMED') {
            throw fieldError('seed', 'Khôi phục entry trước khi đổi hạt giống', 'ENTRY_WITHDRAWN');
          }
          data.seed = body.seed;
        }
        if (body.notes !== undefined && body.notes !== entry.notes) data.notes = body.notes;

        let override: ReturnType<EntryEligibilityService['resolveOverride']> = null;
        if (body.status === 'WITHDRAWN' && entry.status === 'CONFIRMED') {
          await this.guardWithdraw(tx, [id], warnings);
          data.status = 'WITHDRAWN';
          data.seed = null;
        } else if (body.status === 'CONFIRMED' && entry.status === 'WITHDRAWN') {
          const players = await this.eligibility.loadPlayers(tx, competitorPlayerIds(entry.competitor));
          const issues = await this.eligibility.assess(tx, subEvent, players, id);
          override = this.eligibility.resolveOverride(issues, body.overrideReason, role);
          data.status = 'CONFIRMED';
          if (override) data.eligibilityOverrideReason = override.reason;
        }

        if (!Object.keys(data).length) {
          return { data: toEntryView(await tx.entry.findUniqueOrThrow({ where: { id }, include: ENTRY_INCLUDE })), warnings };
        }
        const row = await tx.entry.update({ where: { id }, data, include: ENTRY_INCLUDE });
        if (data.status) rankingDirty = await markRankingDirty(tx, [entry.subEventId]);
        const before = entryAuditFields(entry);
        const after = entryAuditFields(row);
        const keys = (Object.keys(after) as (keyof typeof after)[]).filter((key) => before[key] !== after[key]);
        await this.audit.record(
          {
            action: 'entry.update',
            entity: 'Entry',
            entityId: id,
            before: Object.fromEntries(keys.map((key) => [key, before[key]])),
            after: Object.fromEntries(keys.map((key) => [key, after[key]])),
          },
          tx,
        );
        if (override) {
          await this.audit.record({ action: 'entry.override', entity: 'Entry', entityId: id, reason: override.reason, after: { issues: issueSummary(override.issues) } }, tx);
        }
        return { data: toEntryView(row), warnings };
      });
      result.warnings.push(...(await this.ranking.enqueueRecompute(rankingDirty)));
      return result;
    } catch (error) {
      throw mapSeedConflict(error, body.seed);
    }
  }

  /** Withdrawing from a published draw would break the bracket; a draft draw only needs a redraw. */
  async guardWithdraw(tx: Tx, entryIds: string[], warnings: string[]): Promise<void> {
    const { locked, draft } = await entriesInLockedDraw(tx, entryIds);
    if (locked.length) {
      const message = locked.length > 1 ? `${locked.length} entry đang trong nhánh đã công bố. Dùng 'Rút khỏi nhánh' ở tab Bốc thăm` : PUBLISHED_DRAW_HINT;
      throw new ConflictException({ code: 'ENTRY_IN_PUBLISHED_DRAW', message });
    }
    if (draft.length) warnings.push(DRAFT_DRAW_WARNING);
  }

  /** The published draw keeps the entry in its old stage's bracket, so the stage cannot change under it. */
  async guardStageChange(tx: Tx, entryIds: string[]): Promise<void> {
    const { locked } = await entriesInLockedDraw(tx, entryIds);
    if (locked.length) {
      throw new ConflictException({
        code: 'ENTRY_IN_PUBLISHED_DRAW',
        message: 'Entry đang trong nhánh đã công bố, không đổi được giai đoạn. Rút khỏi nhánh hoặc bỏ công bố nhánh trước',
      });
    }
  }
}
