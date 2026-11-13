import { HttpException } from '@nestjs/common';
import { isStructureLocked, type Draw, type Prisma } from '@kamito/db';
import { ENTRY_BRIEF_SELECT, toEntryBrief } from '../matches/match-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { toDrawSummary } from './draw-view.js';

type Tx = Prisma.TransactionClient;

export type ImpactType = 'WALKOVER' | 'VOID_MATCH' | 'REPLACE_SIDE' | 'STANDINGS_RECOMPUTE' | 'UNPUBLISH';

/** Impact while planning: entries are ids, hydrated to EntryBrief once at the end of the operation. */
export interface RawImpact {
  type: ImpactType;
  matchId?: string;
  matchNo?: number;
  roundCode?: string;
  beneficiaryId?: string;
  removedId?: string;
  addedId?: string;
  groupCode?: string;
}

const NOT_BLOCKING = new Set(['DRAW_VERSION_CONFLICT', 'VALIDATION_FAILED']);

export async function hydrateImpacts(tx: Tx, raw: readonly RawImpact[]) {
  const ids = [...new Set(raw.flatMap((i) => [i.beneficiaryId, i.removedId, i.addedId]).filter((id): id is string => Boolean(id)))];
  const rows = ids.length ? await tx.entry.findMany({ where: { id: { in: ids } }, select: ENTRY_BRIEF_SELECT }) : [];
  const briefs = new Map(rows.map((row) => [row.id, toEntryBrief(row)]));
  return raw.map(({ beneficiaryId, removedId, addedId, ...rest }) => ({
    ...rest,
    ...(beneficiaryId && { beneficiary: briefs.get(beneficiaryId) }),
    ...(removedId && { removed: briefs.get(removedId) }),
    ...(addedId && { added: briefs.get(addedId) }),
  }));
}

export interface OperationOutcome {
  draw: Draw;
  impacts: RawImpact[];
}

class DryRunAbort extends Error {
  constructor(readonly impacts: Awaited<ReturnType<typeof hydrateImpacts>>) {
    super('dry run');
  }
}

/**
 * Runs `work` in one transaction. A dry run executes the very same code and then rolls back, so the
 * preview can never drift from the real operation. Business refusals (409/422 with a code) come back as
 * `allowed: false`; version conflicts and validation errors stay real errors.
 */
export async function executeOperation(prisma: PrismaService, dryRun: boolean | undefined, work: (tx: Tx) => Promise<OperationOutcome>) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const { draw, impacts } = await work(tx);
        const hydrated = await hydrateImpacts(tx, impacts);
        if (dryRun) throw new DryRunAbort(hydrated);
        return { data: { draw: toDrawSummary(draw, await isStructureLocked(tx, draw.id)), impacts: hydrated } };
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof DryRunAbort) return { data: { allowed: true, impacts: error.impacts } };
    const blockedCode = dryRun ? blockingCode(error) : null;
    if (blockedCode) return { data: { allowed: false, blockedCode, impacts: [] } };
    throw error;
  }
}

function blockingCode(error: unknown): string | null {
  if (!(error instanceof HttpException) || ![409, 422].includes(error.getStatus())) return null;
  const body = error.getResponse() as { code?: unknown };
  return typeof body.code === 'string' && !NOT_BLOCKING.has(body.code) ? body.code : null;
}
