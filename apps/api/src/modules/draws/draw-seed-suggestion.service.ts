import { HttpException, Injectable } from '@nestjs/common';
import { seedValueForEntry, type SeedSourceRow } from '@kamito/ranking-engine';
import { competitorPlayerIds, lockSubEvent, type Prisma } from '@kamito/db';
import { AuditService } from '../../common/audit/audit.service.js';
import { formatDateOnly } from '../events/date-only.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { alreadyPublished, subEventNotFound } from './draw-errors.js';
import { DrawParamsService } from './draw-params.service.js';

type Tx = Prisma.TransactionClient;

export interface Suggestion {
  entryId: string;
  displayName: string;
  stage: 'MAIN' | 'QUALIFYING';
  rankingAtEntry: number | null;
  pointsAtEntry: number;
  suggestedSeed: number | null;
}

const UNAVAILABLE = { data: { available: false, suggestions: [] as Suggestion[] } };

/** Order: more points first, then better rank (unranked last), then id for a stable result. */
const bySeedStrength = (a: Suggestion, b: Suggestion) =>
  b.pointsAtEntry - a.pointsAtEntry ||
  (a.rankingAtEntry ?? Number.MAX_SAFE_INTEGER) - (b.rankingAtEntry ?? Number.MAX_SAFE_INTEGER) ||
  a.entryId.localeCompare(b.entryId);

/** Reads the newest PUBLISHED ranking snapshot of the sub-event's list and proposes (or applies) seeds. */
@Injectable()
export class DrawSeedSuggestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly params: DrawParamsService,
  ) {}

  async suggest(subEventId: string, apply: boolean) {
    return this.prisma.$transaction(
      async (tx) => {
        const subEvent = await tx.subEvent.findUnique({
          where: { id: subEventId },
          select: { format: true, rankingList: { select: { id: true, code: true } } },
        });
        if (!subEvent) throw subEventNotFound();
        if (!subEvent.rankingList) return UNAVAILABLE;
        await lockSubEvent(tx, subEventId);
        const snapshot = await tx.rankingSnapshot.findFirst({
          where: { rankingListId: subEvent.rankingList.id, status: 'PUBLISHED' },
          orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }],
          select: { id: true, asOfDate: true },
        });
        if (!snapshot) return UNAVAILABLE;

        const kind = subEvent.format === 'GROUP_KNOCKOUT' ? 'GROUP' : 'MAIN';
        if (apply && (await tx.draw.count({ where: { subEventId, kind, status: 'PUBLISHED' } }))) throw alreadyPublished();

        const entries = await tx.entry.findMany({
          where: { subEventId, status: 'CONFIRMED' },
          select: { id: true, stage: true, seed: true, rankingAtEntry: true, pointsAtEntry: true, competitor: { select: { displayName: true, playerId: true, pair: true } } },
        });
        const playerIdsOf = new Map(entries.map((entry) => [entry.id, competitorPlayerIds(entry.competitor)]));
        const rows = await tx.rankingSnapshotRow.findMany({
          where: { snapshotId: snapshot.id, playerId: { in: [...new Set([...playerIdsOf.values()].flat())] } },
          select: { playerId: true, rank: true, points: true },
        });
        const byPlayer = new Map<string, SeedSourceRow>(rows.map((row) => [row.playerId, row]));

        const suggestions: Suggestion[] = entries
          .map((entry) => ({
            entryId: entry.id,
            displayName: entry.competitor.displayName,
            stage: entry.stage,
            ...seedValueForEntry(playerIdsOf.get(entry.id) ?? [], byPlayer),
            suggestedSeed: null as number | null,
          }))
          .sort(bySeedStrength);

        const seedCount = await this.seedCount(tx, subEventId, kind, apply);
        suggestions
          .filter((s) => s.stage === 'MAIN' && s.pointsAtEntry > 0)
          .slice(0, seedCount)
          .forEach((s, index) => (s.suggestedSeed = index + 1));

        const current = new Map(entries.map((entry) => [entry.id, entry]));
        for (const s of suggestions) {
          const was = current.get(s.entryId)!;
          if (was.rankingAtEntry === s.rankingAtEntry && was.pointsAtEntry === s.pointsAtEntry) continue;
          await tx.entry.update({ where: { id: s.entryId }, data: { rankingAtEntry: s.rankingAtEntry, pointsAtEntry: s.pointsAtEntry } });
        }
        if (apply) await this.applySeeds(tx, subEventId, suggestions);

        await this.audit.record(
          {
            action: apply ? 'draw.applySeedSuggestion' : 'draw.suggestSeeds',
            entity: 'SubEvent',
            entityId: subEventId,
            after: { snapshotId: snapshot.id, seeded: suggestions.filter((s) => s.suggestedSeed !== null).map((s) => s.entryId), applied: apply },
          },
          tx,
        );
        return {
          data: {
            available: true,
            applied: apply,
            snapshot: { id: snapshot.id, asOfDate: formatDateOnly(snapshot.asOfDate), listCode: subEvent.rankingList.code },
            seedCount,
            suggestions,
          },
        };
      },
      { timeout: 30_000 },
    );
  }

  /** Seed slots come from the same parameters the draw uses; a preview tolerates a sub-event too small to draw. */
  private async seedCount(tx: Tx, subEventId: string, kind: 'MAIN' | 'GROUP', strict: boolean): Promise<number> {
    try {
      return (await this.params.resolve(tx, subEventId, { kind })).params.seedCount;
    } catch (error) {
      if (!strict && error instanceof HttpException) return 0;
      throw error;
    }
  }

  /** Clears old MAIN seeds first so the (sub-event, stage, seed) unique index never trips mid-way. */
  private async applySeeds(tx: Tx, subEventId: string, suggestions: Suggestion[]): Promise<void> {
    await tx.entry.updateMany({ where: { subEventId, stage: 'MAIN', seed: { not: null } }, data: { seed: null } });
    for (const s of suggestions) {
      if (s.suggestedSeed !== null) await tx.entry.update({ where: { id: s.entryId }, data: { seed: s.suggestedSeed } });
    }
  }
}
