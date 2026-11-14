import { advisoryLock, lockPlayersForShare, lockSubEventsInOrder, subEventsWithLockedDraw, type ImportRow, type Prisma } from '@kamito/db';
import { commitRow } from './commit-row.js';
import type { BatchState, CommitSettings } from './commit-types.js';
import { ImportFailure, type Decisions, type RowData } from './import-row-types.js';
import { loadPlayerIndex } from './player-lookup.js';

type Tx = Prisma.TransactionClient;

export const committableWhere = (importJobId: string, override: boolean): Prisma.ImportRowWhereInput => ({
  importJobId,
  OR: [{ status: 'VALID' }, ...(override ? [{ status: 'ERROR' as const, data: { path: ['overridable'], equals: true } }] : [])],
});

const dataOf = (row: ImportRow) => row.data as unknown as RowData;

function wantedPlayers(rows: ImportRow[]) {
  return rows.flatMap((row) => dataOf(row).players.map((player) => ({ code: player.code, fullName: player.fullName })));
}

/** Every player id a row may read: its own links, the chosen candidates and the suggested candidates. */
function referencedPlayerIds(rows: ImportRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    dataOf(row).players.forEach((player) => player.playerId && ids.push(player.playerId));
    Object.values((row.decisions ?? {}) as Decisions).forEach((choice) => choice && choice !== 'NEW' && ids.push(choice));
    Object.values((row.candidatePlayerIds ?? {}) as Record<string, string[]>).forEach((list) => ids.push(...list));
  }
  return ids;
}

/**
 * Lock order is fixed: import advisory lock, SubEvent rows (ascending id), Player rows (ascending id).
 * Player merges and the entries API take them in the same order, so none of them can deadlock.
 * Players are read only after the locks, so a merge that was running has committed by then.
 */
async function lockAndLoadPlayers(tx: Tx, rows: ImportRow[], state: BatchState) {
  const wanted = wantedPlayers(rows);
  const ownPlayers = [...state.createdByKey.values()];
  const preview = await loadPlayerIndex(tx, wanted, ownPlayers);
  const previewIds = [...preview.byCode.values(), ...[...preview.byName.values()].flat()].map((player) => player.id);
  await lockPlayersForShare(tx, [...previewIds, ...referencedPlayerIds(rows)]);
  const index = await loadPlayerIndex(tx, wanted, ownPlayers);
  [...index.byCode.values(), ...[...index.byName.values()].flat()].forEach((player) => state.known.set(player.id, player));
  return index;
}

/** Fails the whole import when a sub-event already has a published draw, unless an ADMIN override reason was given. */
export async function assertNoLockedDraw(tx: Tx, subEventIds: string[], codes: Map<string, string>): Promise<void> {
  const locked = await subEventsWithLockedDraw(tx, [...new Set(subEventIds)]);
  if (locked.length) throw new ImportFailure(`Nội dung đã có bốc thăm, không thể import: ${locked.map((id) => codes.get(id) ?? id).join(', ')}`);
}

/** Commits one batch of rows inside the caller's transaction; a rejected row becomes ERROR and the rest go on. */
export async function commitBatch(tx: Tx, batch: ImportRow[], settings: CommitSettings, eventId: string, state: BatchState): Promise<void> {
  await advisoryLock(tx, `import-event-${eventId}`);
  // Re-read under the lock: another run may have committed some of these rows while this one waited.
  const rows = await tx.importRow.findMany({
    where: { AND: [committableWhere(settings.jobId, !!settings.overrideReason), { rowNo: { in: batch.map((row) => row.rowNo) } }] },
    orderBy: { rowNo: 'asc' },
  });
  if (!rows.length) return;
  const subEventIds = rows.flatMap((row) => dataOf(row).subEventId ?? []);
  await lockSubEventsInOrder(tx, subEventIds);
  // Under the SubEvent lock: a draw published since the import started (or since the previous batch) cannot let rows through.
  if (!settings.overrideReason) await assertNoLockedDraw(tx, subEventIds, new Map([...settings.subEventsById].map(([id, subEvent]) => [id, subEvent.code])));
  const index = await lockAndLoadPlayers(tx, rows, state);

  for (const row of rows) {
    const outcome = await commitRow(tx, dataOf(row), row.decisions as Decisions | null, settings, index, state);
    await tx.importRow.update({
      where: { importJobId_rowNo: { importJobId: settings.jobId, rowNo: row.rowNo } },
      data: outcome.ok
        ? { status: 'COMMITTED', messages: [], createdEntityIds: outcome.entities as unknown as Prisma.InputJsonValue }
        : { status: 'ERROR', messages: outcome.messages },
    });
  }
  if (state.audits.length) await tx.auditLog.createMany({ data: state.audits });
  await refreshJobCounters(tx, settings.jobId);
}

/** Keeps the job counters right after every batch, so a crash between batches never shows stale numbers. */
export async function refreshJobCounters(tx: Tx, jobId: string): Promise<void> {
  const counts = await tx.importRow.groupBy({ by: ['status'], where: { importJobId: jobId }, _count: true });
  const countOf = (status: string) => counts.find((item) => item.status === status)?._count ?? 0;
  await tx.importJob.update({
    where: { id: jobId },
    data: { committedRows: countOf('COMMITTED'), validRows: countOf('VALID'), errorRows: countOf('ERROR'), needsConfirmRows: countOf('NEEDS_CONFIRM') },
  });
}
