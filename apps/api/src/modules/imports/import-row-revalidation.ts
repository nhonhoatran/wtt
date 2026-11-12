import { orderPairIds, playersAlreadyEntered, type ImportRow, type Prisma } from '@kamito/db';
import { checkEntryEligibility, type AgeCalculation, type EligibilityPlayer } from '@kamito/shared';

type Tx = Prisma.TransactionClient;
type Decisions = Record<string, string>;

interface SlotData {
  slot: number;
  fullName: string;
  gender: 'MALE' | 'FEMALE' | null;
  birthYear: number | null;
  action: string;
  playerId: string | null;
  newPlayerKey: string | null;
}
interface RowDataShape {
  subEventId: string | null;
  stage: 'MAIN' | 'QUALIFYING';
  stageGiven?: boolean;
  seed: number | null;
  players: SlotData[];
}

export interface RevalidationResult {
  messages: string[];
  /** Every message is an eligibility rule that an ADMIN may override at commit. */
  overridable: boolean;
}

const dataOf = (row: Pick<ImportRow, 'data'>) => row.data as unknown as RowDataShape;

/** Player id per slot once decisions are applied; `new:<key>` stands for a person that does not exist yet. */
function resolvedIds(data: RowDataShape, decisions: Decisions | null): string[] | null {
  const ids: string[] = [];
  for (const slot of data.players) {
    const choice = slot.action === 'NEEDS_CONFIRM' ? decisions?.[String(slot.slot)] : undefined;
    if (slot.action === 'NEEDS_CONFIRM' && !choice) return null;
    const id = choice && choice !== 'NEW' ? choice : slot.playerId;
    ids.push(id ?? `new:${slot.newPlayerKey}`);
  }
  return ids;
}

async function existingEntry(tx: Tx, subEventId: string, realIds: string[]) {
  let competitorId: string | undefined;
  if (realIds.length === 1) {
    competitorId = (await tx.competitor.findUnique({ where: { playerId: realIds[0]! }, select: { id: true } }))?.id;
  } else {
    const [playerAId, playerBId] = orderPairIds(realIds[0]!, realIds[1]!);
    const pair = await tx.pair.findUnique({ where: { playerAId_playerBId: { playerAId, playerBId } }, select: { competitor: { select: { id: true } } } });
    competitorId = pair?.competitor?.id;
  }
  if (!competitorId) return null;
  return tx.entry.findUnique({ where: { subEventId_competitorId: { subEventId, competitorId } }, select: { id: true, stage: true, status: true } });
}

/** Checks a row whose last pending choice was just made with the same rules the worker applied to resolved rows. */
export async function revalidateDecidedRow(tx: Tx, input: { row: ImportRow; decisions: Decisions; ageMethod: AgeCalculation }): Promise<RevalidationResult> {
  const { row, decisions, ageMethod } = input;
  const data = dataOf(row);
  const ids = resolvedIds(data, decisions);
  const subEventId = data.subEventId;
  const subEvent = subEventId
    ? await tx.subEvent.findUnique({
        where: { id: subEventId },
        select: { code: true, discipline: { select: { competitorKind: true, genderRule: true } }, category: { select: { name: true, minAge: true, maxAge: true } }, event: { select: { startDate: true } } },
      })
    : null;
  if (!ids || !subEvent || !subEventId) return { messages: ['Nội dung không còn tồn tại'], overridable: false };

  const realIds = ids.filter((id) => !id.startsWith('new:'));
  const players = await tx.player.findMany({ where: { id: { in: realIds }, isActive: true, mergedIntoId: null }, select: { id: true, fullName: true, gender: true, birthDate: true, birthYear: true } });
  const byId = new Map(players.map((player) => [player.id, player]));
  const eligible: EligibilityPlayer[] = [];
  for (const [i, id] of ids.entries()) {
    const slot = data.players[i]!;
    const found = byId.get(id);
    if (!id.startsWith('new:') && !found) return { messages: [`VĐV ${slot.slot}: VĐV đã chọn không còn hợp lệ`], overridable: false };
    eligible.push(found ?? { id, fullName: slot.fullName, gender: slot.gender!, birthYear: slot.birthYear });
  }
  const issues = checkEntryEligibility(eligible, { ...subEvent.discipline, category: subEvent.category, eventStartDate: subEvent.event.startDate }, ageMethod);
  const messages = issues.map((issue) => issue.message);
  const label = (id: string) => eligible.find((player) => player.id === id)?.fullName ?? id;
  const key = [...ids].sort().join(',');

  const others = await tx.importRow.findMany({
    where: { importJobId: row.importJobId, rowNo: { lt: row.rowNo }, status: { not: 'ERROR' }, data: { path: ['subEventId'], equals: subEventId } },
    select: { rowNo: true, data: true, decisions: true },
  });
  for (const other of others) {
    const otherIds = resolvedIds(dataOf(other), other.decisions as Decisions | null);
    if (!otherIds) continue;
    if ([...otherIds].sort().join(',') === key) messages.push(`Trùng với dòng ${other.rowNo} (cùng nội dung, cùng VĐV)`);
    else for (const id of ids) if (otherIds.includes(id)) messages.push(`${label(id)} đã có ở dòng ${other.rowNo} trong nội dung ${subEvent.code} (cặp/đơn khác)`);
    const otherData = dataOf(other);
    if (data.seed !== null && otherData.seed === data.seed && otherData.stage === data.stage) messages.push(`Hạt giống ${data.seed} trùng với dòng ${other.rowNo}`);
  }

  const existing = realIds.length === ids.length ? await existingEntry(tx, subEventId, realIds) : null;
  if (!existing || existing.status !== 'CONFIRMED') {
    for (const id of await playersAlreadyEntered(tx, subEventId, realIds, existing?.id)) messages.push(`${label(id)} đã đăng ký nội dung ${subEvent.code} (cặp/đơn khác)`);
  }
  if (data.seed !== null) {
    const stage = existing && data.stageGiven === false ? existing.stage : data.stage;
    const holder = await tx.entry.findFirst({ where: { subEventId: subEventId, stage, seed: data.seed, ...(existing && { id: { not: existing.id } }) }, select: { id: true } });
    if (holder) messages.push(`Hạt giống ${data.seed} đã có người trong nội dung ${subEvent.code}`);
  }
  return { messages, overridable: issues.length > 0 && issues.every((issue) => issue.overridable) && messages.length === issues.length };
}
