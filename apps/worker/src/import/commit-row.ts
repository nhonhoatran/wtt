import { confirmedEntryCount, orderPairIds, playersAlreadyEntered, type Prisma } from '@kamito/db';
import { checkEntryEligibility, type EligibilityPlayer } from '@kamito/shared';
import { writeEntry, type ExistingEntry, type Resolved } from './commit-entry-write.js';
import type { BatchState, CommitSettings, RowOutcome } from './commit-types.js';
import type { Decisions, RowData, RowPlayer } from './import-row-types.js';
import { matchPlayer, type KnownPlayer, type PlayerIndex } from './player-matcher.js';

type Tx = Prisma.TransactionClient;

const fail = (...messages: string[]): RowOutcome => ({ ok: false, messages });

function resolveSlot(slot: RowPlayer, decisions: Decisions | null, index: PlayerIndex, known: Map<string, KnownPlayer>, createdByKey: Map<string, string>): Resolved | string {
  const input = { code: slot.code, fullName: slot.fullName, gender: slot.gender, birthYear: slot.birthYear };
  const decision = decisions?.[String(slot.slot) as '1' | '2'];
  if (slot.action === 'NEEDS_CONFIRM') {
    if (!decision) return `VĐV ${slot.slot}: chưa chọn liên kết hay tạo mới`;
    if (decision !== 'NEW') {
      const chosen = known.get(decision);
      return chosen ? { playerId: chosen.id, known: chosen } : `VĐV ${slot.slot}: VĐV đã chọn không còn hợp lệ`;
    }
    return slot.newPlayerKey ? { newKey: slot.newPlayerKey, slot } : `VĐV ${slot.slot}: thiếu giới tính để tạo VĐV mới`;
  }
  if (slot.action === 'CREATE_PLAYER' && slot.newPlayerKey) {
    const created = createdByKey.get(slot.newPlayerKey);
    if (created) return { playerId: created };
  }
  const result = matchPlayer(input, index);
  if (slot.action === 'LINK_PLAYER') {
    if (result.action === 'LINK_PLAYER' && result.player.id === slot.playerId) return { playerId: result.player.id, known: result.player };
    if (result.action === 'ERROR' && slot.code && index.mergedCodes.has(slot.code.toUpperCase())) return `VĐV ${slot.slot}: ${result.message}`;
    return `VĐV ${slot.slot}: dữ liệu VĐV đã thay đổi sau khi kiểm tra, hãy kiểm tra lại file`;
  }
  return result.action === 'CREATE_PLAYER' ? { newKey: result.newPlayerKey, slot } : `VĐV ${slot.slot}: đã có VĐV trùng tên được thêm sau khi kiểm tra, hãy kiểm tra lại file`;
}

async function findPairCompetitor(tx: Tx, playerIds: string[]) {
  const [playerAId, playerBId] = orderPairIds(playerIds[0]!, playerIds[1]!);
  const pair = await tx.pair.findUnique({ where: { playerAId_playerBId: { playerAId, playerBId } }, select: { competitor: { select: { id: true } } } });
  return pair?.competitor ?? null;
}

async function existingEntry(tx: Tx, subEventId: string, playerIds: string[]): Promise<ExistingEntry | null> {
  const competitor =
    playerIds.length === 1
      ? await tx.competitor.findUnique({ where: { playerId: playerIds[0]! }, select: { id: true } })
      : await findPairCompetitor(tx, playerIds);
  if (!competitor) return null;
  return tx.entry.findUnique({
    where: { subEventId_competitorId: { subEventId, competitorId: competitor.id } },
    select: { id: true, status: true, stage: true, quotaType: true, seed: true, notes: true, eligibilityOverrideReason: true },
  });
}

/**
 * Checks and writes one row inside the batch transaction. The caller already holds the sub-event and
 * player locks, so every check below sees state no concurrent writer can change before commit.
 */
export async function commitRow(
  tx: Tx,
  data: RowData,
  decisions: Decisions | null,
  settings: CommitSettings,
  index: PlayerIndex,
  state: BatchState,
): Promise<RowOutcome> {
  const subEvent = data.subEventId ? settings.subEventsById.get(data.subEventId) : undefined;
  if (!subEvent) return fail('Nội dung không còn tồn tại');

  const { known } = state;
  const resolved: Resolved[] = [];
  const problems: string[] = [];
  for (const slot of data.players) {
    const result = resolveSlot(slot, decisions, index, known, state.createdByKey);
    if (typeof result === 'string') problems.push(result);
    else resolved.push(result);
  }
  if (problems.length) return fail(...problems);

  const missing = resolved.flatMap((item) => ('playerId' in item && !item.known ? [item.playerId] : []));
  if (missing.length) {
    const rows = await tx.player.findMany({ where: { id: { in: missing } }, select: { id: true, code: true, fullName: true, normalizedName: true, gender: true, birthYear: true, birthDate: true, club: true } });
    rows.forEach((player) => known.set(player.id, player));
  }
  const eligible: EligibilityPlayer[] = resolved.map((item) => {
    if ('newKey' in item) return { id: `new:${item.newKey}`, fullName: item.slot.fullName, gender: item.slot.gender!, birthYear: item.slot.birthYear };
    const player = known.get(item.playerId)!;
    return { id: player.id, fullName: player.fullName, gender: player.gender, birthDate: player.birthDate, birthYear: player.birthYear };
  });
  const issues = checkEntryEligibility(eligible, { ...subEvent, eventStartDate: settings.eventStartDate }, settings.ageMethod);
  const blocking = issues.filter((issue) => !issue.overridable || !settings.overrideReason);
  if (blocking.length) return fail(...blocking.map((issue) => issue.message));

  const realIds = resolved.flatMap((item) => ('playerId' in item ? [item.playerId] : []));
  const entry = realIds.length === resolved.length ? await existingEntry(tx, subEvent.id, realIds) : null;
  if (entry?.status === 'CONFIRMED' && state.touchedEntries.has(entry.id)) return fail('Trùng với một dòng khác trong file (cùng nội dung, cùng VĐV)');
  if (entry?.status !== 'CONFIRMED') {
    if ((await playersAlreadyEntered(tx, subEvent.id, realIds, entry?.id)).length) return fail(`VĐV đã đăng ký nội dung ${subEvent.code} (cặp/đơn khác)`);
    if (subEvent.maxEntries !== null && !settings.overrideReason && (await confirmedEntryCount(tx, subEvent.id)) >= subEvent.maxEntries) {
      return fail(`Nội dung ${subEvent.code} đã đủ ${subEvent.maxEntries} suất`);
    }
  }
  const finalStage = entry && !data.stageGiven ? entry.stage : data.stage;
  const finalSeed = data.seed ?? entry?.seed ?? null;
  if (finalSeed !== null && (!entry || finalSeed !== entry.seed || finalStage !== entry.stage)) {
    const holder = await tx.entry.findFirst({ where: { subEventId: subEvent.id, stage: finalStage, seed: finalSeed, ...(entry && { id: { not: entry.id } }) }, select: { id: true } });
    if (holder) return fail(`Hạt giống ${finalSeed} đã có người trong nội dung ${subEvent.code}`);
  }
  return writeEntry(tx, { subEventId: subEvent.id, resolved, data, existing: entry, overridden: issues.length > 0 }, settings, state);
}
