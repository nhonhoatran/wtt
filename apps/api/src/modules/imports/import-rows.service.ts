import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, Prisma, type ImportRow } from '@kamito/db';
import { playerSettings, type PaginationQueryShape } from '@kamito/shared';
import { buildListWhere, enumFilter, listRules, type ListSpec } from '../../common/crud/prisma-list-query.js';
import { toPaginatedResult } from '../../common/pagination/pagination-query.js';
import { fieldError } from '../../common/validation/parse-body.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { DecisionBody } from './import-dtos.js';
import { revalidateDecidedRow } from './import-row-revalidation.js';

const ROW_STATUSES = ['VALID', 'ERROR', 'NEEDS_CONFIRM', 'COMMITTED'] as const;
const LIST_SPEC: ListSpec = {
  sortable: ['rowNo'],
  defaultSort: { field: 'rowNo', direction: 'asc' },
  filters: { status: enumFilter('status', ROW_STATUSES) },
};
export const IMPORT_ROW_LIST_RULES = listRules(LIST_SPEC);

type Slots = Record<string, string[]>;
interface RowPlayerData {
  slot: 1 | 2;
  action: string;
  newPlayerKey: string | null;
}

const PLAYER_VIEW = { id: true, code: true, fullName: true, gender: true, birthYear: true, club: true } as const;

@Injectable()
export class ImportRowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  private async requireJob(id: string) {
    const job = await this.prisma.importJob.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!job) throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: 'Không tìm thấy lượt import' });
    return job;
  }

  async list(importJobId: string, query: PaginationQueryShape) {
    await this.requireJob(importJobId);
    // ImportRow has no id column, so the shared list helper (which adds an id tiebreak) does not fit.
    const where = buildListWhere(query, LIST_SPEC, { importJobId });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.importRow.findMany({ where, orderBy: { rowNo: query.sort?.direction ?? 'asc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.importRow.count({ where }),
    ]);
    const page = toPaginatedResult(rows, total, query);
    const ids = new Set(page.data.flatMap((row) => Object.values((row.candidatePlayerIds ?? {}) as Slots).flat()));
    const players = ids.size ? await this.prisma.player.findMany({ where: { id: { in: [...ids] } }, select: PLAYER_VIEW }) : [];
    const byId = new Map(players.map((player) => [player.id, player]));
    return { ...page, data: page.data.map((row) => toRowView(row, byId)) };
  }

  async decide(importJobId: string, rowNo: number, body: DecisionBody) {
    await this.requireJob(importJobId);
    const ageMethod = await this.settings.get(playerSettings.ageCalculation);
    const updated = await this.prisma.$transaction(async (tx) => {
      // Locking the job row makes a concurrent commit wait, so a choice is never saved once the commit has started.
      const [locked] = await tx.$queryRaw<Array<{ status: ImportStatus }>>`SELECT "status" FROM "ImportJob" WHERE "id" = ${importJobId} FOR UPDATE`;
      if (locked?.status !== ImportStatus.VALIDATED) throw new ConflictException({ code: 'NOT_VALIDATED', message: 'Chỉ chọn được khi lượt import đã kiểm tra xong và chưa nhập' });
      const row = await tx.importRow.findUnique({ where: { importJobId_rowNo: { importJobId, rowNo } } });
      if (!row) throw new NotFoundException({ code: 'IMPORT_ROW_NOT_FOUND', message: 'Không tìm thấy dòng' });
      const decisions = (row.decisions ?? {}) as Record<string, string>;
      const decidable = row.status === 'NEEDS_CONFIRM' || (['VALID', 'ERROR'].includes(row.status) && Object.keys(decisions).length > 0);
      if (!decidable) throw new ConflictException({ code: 'ROW_NOT_DECIDABLE', message: 'Dòng này không cần xác nhận' });
      const slotData = playersOf(row).find((player) => player.slot === body.slot && player.action === 'NEEDS_CONFIRM');
      if (!slotData) throw fieldError('slot', 'VĐV này không cần xác nhận');
      const allowed = ((row.candidatePlayerIds ?? {}) as Slots)[String(body.slot)] ?? [];
      if (body.choice === 'NEW' && !slotData.newPlayerKey) throw fieldError('choice', 'Thiếu giới tính nên không tạo được VĐV mới');
      if (body.choice !== 'NEW' && !allowed.includes(body.choice)) throw fieldError('choice', 'VĐV chọn không nằm trong danh sách gợi ý');

      const next = { ...decisions, [String(body.slot)]: body.choice };
      const undecided = playersOf(row).some((player) => player.action === 'NEEDS_CONFIRM' && !next[String(player.slot)]);
      let outcome: Prisma.ImportRowUpdateInput = { decisions: next, status: 'NEEDS_CONFIRM', messages: [] };
      if (!undecided) {
        const check = await revalidateDecidedRow(tx, { row, decisions: next, ageMethod });
        const data = { ...(row.data as object), overridable: check.messages.length > 0 && check.overridable } as Prisma.InputJsonValue;
        outcome = { decisions: next, status: check.messages.length ? 'ERROR' : 'VALID', messages: check.messages, data };
      }
      const saved = await tx.importRow.update({ where: { importJobId_rowNo: { importJobId, rowNo } }, data: outcome });
      await refreshCounters(tx, importJobId);
      return saved;
    });
    const candidates = new Set(Object.values((updated.candidatePlayerIds ?? {}) as Slots).flat());
    const players = candidates.size ? await this.prisma.player.findMany({ where: { id: { in: [...candidates] } }, select: PLAYER_VIEW }) : [];
    return toRowView(updated, new Map(players.map((player) => [player.id, player])));
  }
}

async function refreshCounters(tx: Prisma.TransactionClient, importJobId: string): Promise<void> {
  const groups = await tx.importRow.groupBy({ by: ['status'], where: { importJobId }, _count: true });
  const count = (status: string) => groups.find((group) => group.status === status)?._count ?? 0;
  await tx.importJob.update({
    where: { id: importJobId },
    data: { validRows: count('VALID'), errorRows: count('ERROR'), needsConfirmRows: count('NEEDS_CONFIRM'), committedRows: count('COMMITTED') },
  });
}

const playersOf = (row: ImportRow) => (row.data as unknown as { players: RowPlayerData[] }).players;

function toRowView(row: ImportRow, players: Map<string, { id: string }>) {
  const candidates = Object.entries((row.candidatePlayerIds ?? {}) as Slots).map(([slot, ids]) => ({
    slot: Number(slot),
    players: ids.map((id) => players.get(id)).filter((player) => player !== undefined),
  }));
  return {
    rowNo: row.rowNo,
    status: row.status,
    plannedAction: row.plannedAction,
    data: row.data,
    messages: (row.messages ?? []) as string[],
    candidates,
    decisions: row.decisions,
  };
}
