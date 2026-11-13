import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { isStructureLocked, lockDraw, lockSubEvent } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DrawParamsBody, GenerateDrawBody } from './draw-dtos.js';
import { alreadyPublished, runEngine, structureLocked, subEventNotFound, versionConflict } from './draw-errors.js';
import { DrawParamsService } from './draw-params.service.js';
import { DrawPersistenceService } from './draw-persistence.service.js';
import { planDraw } from './draw-planner.js';
import { drawAuditFields, toDrawSummary } from './draw-view.js';

@Injectable()
export class DrawGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly params: DrawParamsService,
    private readonly persistence: DrawPersistenceService,
  ) {}

  async preview(subEventId: string, body: DrawParamsBody) {
    const resolved = await this.params.resolve(this.prisma, subEventId, body);
    const { preview, params, defaults, existing } = resolved;
    return { data: { ...preview, params, defaults, existingDraw: existing } };
  }

  /** Placeholder until the ranking phase provides points to seed by; the UI shows the button disabled. */
  async suggestSeeds(subEventId: string) {
    const subEvent = await this.prisma.subEvent.findUnique({ where: { id: subEventId }, select: { id: true } });
    if (!subEvent) throw subEventNotFound();
    return { data: { available: false, suggestions: [] as string[] } };
  }

  /** Creates the DRAFT of `kind`, or replaces the existing DRAFT of that kind (the old one is audited first). */
  async generate(subEventId: string, body: GenerateDrawBody) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockSubEvent(tx, subEventId);
        const resolved = await this.params.resolve(tx, subEventId, body);
        const { subEvent, entries, preview, params } = resolved;
        const previous = await tx.draw.findUnique({ where: { subEventId_kind: { subEventId, kind: body.kind } } });
        if (previous) {
          await lockDraw(tx, previous.id);
          const locked = await tx.draw.findUniqueOrThrow({ where: { id: previous.id } });
          if (locked.status === 'PUBLISHED') throw alreadyPublished();
          if (body.expectedVersion !== locked.version) throw versionConflict(locked.version);
          if (await isStructureLocked(tx, locked.id)) throw structureLocked();
        }

        const randomSeed = randomBytes(16).toString('hex');
        const plan = runEngine(() => planDraw(params, entries, randomSeed));
        const fields = {
          status: 'DRAFT' as const,
          size: plan.size,
          seedCount: params.seedCount,
          qualifierCount: params.qualifierCount,
          groupCount: params.groupCount,
          advancePerGroup: params.advancePerGroup,
          randomSeed,
          publishedAt: null,
        };

        let draw;
        if (previous) {
          await this.audit.record({ action: 'draw.discard', entity: 'Draw', entityId: previous.id, before: drawAuditFields(previous) }, tx);
          await this.persistence.clearStructure(tx, previous.id);
          draw = await tx.draw.update({ where: { id: previous.id }, data: { ...fields, version: { increment: 1 } } });
        } else {
          draw = await tx.draw.create({ data: { subEventId, kind: body.kind, ...fields } });
        }
        const { matchCount } = await this.persistence.insertStructure(tx, { id: draw.id, eventId: subEvent.eventId, subEventId }, plan);
        await this.audit.record(
          {
            action: 'draw.generate',
            entity: 'Draw',
            entityId: draw.id,
            after: { ...drawAuditFields(draw), requested: body, effective: params, byeCount: plan.byeCount, replacedDraft: Boolean(previous) },
          },
          tx,
        );
        return {
          data: { ...toDrawSummary(draw, false), byeCount: plan.byeCount, matchCount, params, sectionSizes: preview.sectionSizes },
        };
      },
      { timeout: 30_000 },
    );
  }
}
