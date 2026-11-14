import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { MatchData } from '@kamito/competition-engine';
import { allocateMatchNumbers, Prisma } from '@kamito/db';
import type { PlannedStructure } from './draw-planner.js';
import { toStoredSource } from './draw-source-json.js';
import { releaseScheduleSlots } from '../scheduling/release-schedule-slots.js';

type Tx = Prisma.TransactionClient;

export interface DrawScope {
  id: string;
  eventId: string;
  subEventId: string;
}

const CHUNK = 200;

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

@Injectable()
export class DrawPersistenceService {
  /** Removes everything generated for the draw (positions, rounds, matches, groups); the Draw row stays. */
  async clearStructure(tx: Tx, drawId: string): Promise<void> {
    await releaseScheduleSlots(tx, { drawId });
    await tx.match.deleteMany({ where: { drawId } });
    await tx.round.deleteMany({ where: { drawId } });
    await tx.bracketPosition.deleteMany({ where: { drawId } });
    await tx.group.deleteMany({ where: { drawId } });
  }

  /** Match numbers come from the event counter, so they stay unique across all draws of the event. */
  async insertStructure(tx: Tx, draw: DrawScope, plan: PlannedStructure): Promise<{ matchCount: number }> {
    await insertChunked(plan.positions, (rows) =>
      tx.bracketPosition.createMany({
        data: rows.map((p) => ({
          drawId: draw.id,
          section: p.section,
          position: p.position,
          source: p.source,
          entryId: p.entryId ?? null,
          sourceRef: p.sourceRef ? (p.sourceRef as unknown as Prisma.InputJsonObject) : undefined,
        })),
      }),
    );

    const groupIdByCode = new Map(plan.groups.map((g) => [g.code, randomUUID()]));
    await tx.group.createMany({ data: plan.groups.map((g) => ({ id: groupIdByCode.get(g.code)!, drawId: draw.id, code: g.code, order: g.order })) });
    const members = plan.groups.flatMap((g) => g.members.map((m) => ({ groupId: groupIdByCode.get(g.code)!, entryId: m.entryId, slot: m.slot })));
    await insertChunked(members, (rows) => tx.groupMember.createMany({ data: rows }));
    await insertChunked(members, (rows) => tx.groupStanding.createMany({ data: rows.map(({ groupId, entryId }) => ({ groupId, entryId })) }));

    const roundIds = new Map<string, string>();
    for (const r of plan.rounds) roundIds.set(`${r.scopeKey}:${r.number}`, randomUUID());
    await insertChunked(plan.rounds, (rows) =>
      tx.round.createMany({
        data: rows.map((r) => ({
          id: roundIds.get(`${r.scopeKey}:${r.number}`)!,
          drawId: draw.id,
          section: r.section,
          scopeKey: r.scopeKey,
          number: r.number,
          code: r.code,
          groupId: r.scopeKey.startsWith('G-') ? (groupIdByCode.get(r.scopeKey.slice(2)) ?? null) : null,
        })),
      }),
    );

    if (!plan.matches.length) return { matchCount: 0 };
    const firstNo = await allocateMatchNumbers(tx, draw.eventId, plan.matches.length);
    const key = (m: Pick<MatchData, 'scopeKey' | 'roundNumber' | 'orderInRound'>) => `${m.scopeKey}:${m.roundNumber}:${m.orderInRound}`;
    const ids = new Map(plan.matches.map((m) => [key(m), randomUUID()]));
    const matchNos = new Map(plan.matches.map((m, i) => [key(m), firstNo + i]));
    const matchNoOf = (ref: { scopeKey: string; roundNumber: number; orderInRound: number }) => matchNos.get(key(ref))!;

    const data = plan.matches.map((m): Prisma.MatchCreateManyInput => ({
      id: ids.get(key(m))!,
      eventId: draw.eventId,
      subEventId: draw.subEventId,
      drawId: draw.id,
      roundId: roundIds.get(`${m.scopeKey}:${m.roundNumber}`)!,
      groupId: m.groupCode ? (groupIdByCode.get(m.groupCode) ?? null) : null,
      section: m.section,
      orderInRound: m.orderInRound,
      matchNo: matchNoOf(m),
      side1EntryId: m.side1EntryId ?? null,
      side2EntryId: m.side2EntryId ?? null,
      side1Source: toStoredSource(m.side1Source, matchNoOf),
      side2Source: toStoredSource(m.side2Source, matchNoOf),
      nextMatchId: m.next ? ids.get(key({ scopeKey: m.scopeKey, ...m.next })) : undefined,
      nextMatchSide: m.next?.side,
      status: m.status,
      resultType: m.bye ? 'BYE' : undefined,
      winnerSide: m.bye?.winnerSide,
    }));
    await insertChunked(data, (rows) => tx.match.createMany({ data: rows }));
    return { matchCount: data.length };
  }
}
