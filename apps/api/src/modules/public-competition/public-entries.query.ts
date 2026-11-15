import { Injectable } from '@nestjs/common';
import { PUBLIC_ENTRY_STAGES, tournamentSettings, type PublicEntryList } from '@kamito/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicScope } from '../public-scope/public-scope.js';
import { pageWindow, parsePublicChoice, parsePublicPage } from '../public-scope/public-query-params.js';
import { AppSettingsService } from '../settings/app-settings.service.js';
import { PUBLIC_SIDE_SELECT } from './public-bracket.query.js';
import { subEventNames, toSide } from './public-bracket.serializer.js';
import { publicEntryPageSql } from './public-entry-page.query.js';

const NAMED = { select: { name: true, nameEn: true } } as const;
const STAGE_ORDER = Object.values(PUBLIC_ENTRY_STAGES);

@Injectable()
export class PublicEntriesQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AppSettingsService,
  ) {}

  /** Seeds first, then effective public names, with a stable id tie-breaker; only the requested page is hydrated. */
  async list(slug: string, subEventCode: string, query: { stage?: unknown; page?: unknown }): Promise<PublicEntryList | null> {
    const subEvent = await this.prisma.subEvent.findFirst({
      where: { code: subEventCode, event: publicScope.event(slug) },
      select: { id: true, code: true, name: true, nameEn: true, discipline: NAMED, category: NAMED },
    });
    if (!subEvent) return null;
    const stageRows = await this.prisma.entry.groupBy({ by: ['stage'], where: { subEventId: subEvent.id, ...publicScope.entry } });
    const stages = STAGE_ORDER.filter((stage) => stageRows.some((row) => row.stage === stage));
    const stage = parsePublicChoice(query.stage, PUBLIC_ENTRY_STAGES) ?? 'MAIN';
    const page = parsePublicPage(query.page);
    const pageSize = await this.settings.get(tournamentSettings.publicListPageSize);
    const where = { subEventId: subEvent.id, stage, ...publicScope.entry };
    const { skip, take } = pageWindow(page, pageSize);
    const [total, ids] = await Promise.all([
      this.prisma.entry.count({ where }),
      this.prisma.$queryRaw<{ id: string }[]>(publicEntryPageSql(subEvent.id, stage, skip, take)),
    ]);
    const rows = ids.length ? await this.prisma.entry.findMany({ where: { ...where, id: { in: ids.map(({ id }) => id) } }, select: { ...PUBLIC_SIDE_SELECT.select, id: true } }) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      subEvent: { code: subEvent.code, ...subEventNames(subEvent) },
      stage,
      stages,
      items: ids.flatMap(({ id }) => { const row = byId.get(id); return row ? [toSide(row)!] : []; }),
      page,
      pageSize,
      total,
    };
  }
}
