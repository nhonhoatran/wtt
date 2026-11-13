import { Injectable } from '@nestjs/common';
import { previewDraw, type DrawEntry, type DrawPreview } from '@kamito/competition-engine';
import type { DrawKind, Prisma } from '@kamito/db';
import { tournamentSettings } from '@kamito/shared';
import { AppSettingsService } from '../settings/app-settings.service.js';
import type { DrawParamsBody } from './draw-dtos.js';
import { conflict, invalid, runEngine, subEventNotFound } from './draw-errors.js';

type Db = Pick<Prisma.TransactionClient, 'subEvent' | 'entry' | 'draw' | 'group'>;

/** Parameters actually used; echoed to the UI so it never hardcodes defaults. */
export interface EffectiveParams {
  kind: DrawKind;
  entryCount: number;
  seedCount: number;
  qualifierCount: number | null;
  groupCount: number | null;
  groupSize: number | null;
  advancePerGroup: number | null;
  /** Group-fed MAIN only: group codes in table order, the knockout is built from their places. */
  groupCodes?: string[];
}

export interface ResolvedDraw {
  subEvent: { id: string; eventId: string };
  entries: DrawEntry[];
  preview: DrawPreview;
  params: EffectiveParams;
  defaults: { seedPercent: number; groupSize: number; advancePerGroup: number; qualifierCount: number };
  existing: { id: string; status: string; version: number } | null;
}

@Injectable()
export class DrawParamsService {
  constructor(private readonly settings: AppSettingsService) {}

  async resolve(db: Db, subEventId: string, body: DrawParamsBody): Promise<ResolvedDraw> {
    const subEvent = await db.subEvent.findUnique({
      where: { id: subEventId },
      select: { id: true, eventId: true, format: true, hasQualifying: true },
    });
    if (!subEvent) throw subEventNotFound();
    const { kind } = body;
    if (kind === 'QUALIFYING' && !subEvent.hasQualifying) throw invalid('KIND_NOT_ALLOWED', 'Nội dung này không có vòng loại');
    if (kind === 'GROUP' && subEvent.format !== 'GROUP_KNOCKOUT') throw invalid('KIND_NOT_ALLOWED', 'Nội dung này không thi đấu vòng bảng');

    const [seedPercent, groupSize, advancePerGroup, defaultQualifierCount] = await Promise.all([
      this.settings.get(tournamentSettings.defaultSeedPercent),
      this.settings.get(tournamentSettings.defaultGroupSize),
      this.settings.get(tournamentSettings.defaultAdvancePerGroup),
      this.settings.get(tournamentSettings.defaultQualifierCount),
    ]);
    const draws = await db.draw.findMany({
      where: { subEventId },
      select: { id: true, kind: true, status: true, version: true, qualifierCount: true, advancePerGroup: true },
    });
    const own = draws.find((d) => d.kind === kind) ?? null;
    if (kind === 'MAIN' && subEvent.format === 'GROUP_KNOCKOUT') {
      const groupDraw = draws.find((d) => d.kind === 'GROUP');
      if (!groupDraw) throw invalid('KIND_NOT_ALLOWED', 'Nhánh chính của thể thức vòng bảng chỉ tạo được sau khi bốc thăm vòng bảng');
      if (groupDraw.status !== 'PUBLISHED') throw conflict('GROUP_DRAW_NOT_PUBLISHED', 'Công bố vòng bảng trước khi tạo nhánh chính');
      const groups = await db.group.findMany({ where: { drawId: groupDraw.id }, orderBy: { order: 'asc' }, select: { code: true } });
      return this.fromGroups(subEvent, groups.map((g) => g.code), groupDraw.advancePerGroup ?? advancePerGroup, { seedPercent, groupSize, advancePerGroup, qualifierCount: defaultQualifierCount }, own);
    }
    const qualifierCount = resolveQualifierCount(kind, subEvent.hasQualifying, body, draws, defaultQualifierCount);

    const entries: DrawEntry[] = await db.entry.findMany({
      where: { subEventId, status: 'CONFIRMED', stage: kind === 'QUALIFYING' ? 'QUALIFYING' : 'MAIN' },
      select: { id: true, seed: true, pointsAtEntry: true },
      orderBy: { id: 'asc' },
    });
    const effectiveGroupSize = body.groupSize ?? groupSize;
    const effectiveAdvance = body.advancePerGroup ?? advancePerGroup;
    const preview = runEngine(() =>
      previewDraw({
        kind,
        entryCount: entries.length,
        seedCount: body.seedCount,
        seedRatio: seedPercent / 100,
        qualifierCount,
        groupCount: body.groupCount,
        groupSize: effectiveGroupSize,
        advancePerGroup: effectiveAdvance,
      }),
    );
    const isGroup = kind === 'GROUP';
    const params: EffectiveParams = {
      kind,
      entryCount: entries.length,
      seedCount: preview.seedCount,
      qualifierCount: isGroup ? null : qualifierCount,
      groupCount: isGroup ? preview.groupCount : null,
      groupSize: isGroup ? effectiveGroupSize : null,
      advancePerGroup: isGroup ? effectiveAdvance : null,
    };
    return {
      subEvent,
      entries,
      preview,
      params,
      defaults: { seedPercent, groupSize, advancePerGroup, qualifierCount: defaultQualifierCount },
      existing: own && { id: own.id, status: own.status, version: own.version },
    };
  }

  /** MAIN of a GROUP_KNOCKOUT sub-event: size comes from groups x advancePerGroup, entries from the group places. */
  private fromGroups(
    subEvent: { id: string; eventId: string },
    groupCodes: string[],
    advance: number,
    defaults: ResolvedDraw['defaults'],
    own: { id: string; status: string; version: number } | null,
  ): ResolvedDraw {
    const entryCount = groupCodes.length * advance;
    const preview = runEngine(() => previewDraw({ kind: 'MAIN', entryCount, seedCount: groupCodes.length, qualifierCount: 0 }));
    const params: EffectiveParams = {
      kind: 'MAIN',
      entryCount,
      seedCount: groupCodes.length,
      qualifierCount: 0,
      groupCount: groupCodes.length,
      groupSize: null,
      advancePerGroup: advance,
      groupCodes,
    };
    return { subEvent, entries: [], preview, params, defaults, existing: own && { id: own.id, status: own.status, version: own.version } };
  }
}

/** MAIN and QUALIFYING must agree on k: whichever draw exists first fixes it. */
function resolveQualifierCount(
  kind: DrawKind,
  hasQualifying: boolean,
  body: DrawParamsBody,
  draws: { kind: DrawKind; qualifierCount: number | null }[],
  defaultCount: number,
): number {
  if (kind === 'GROUP') return 0;
  const qualifying = draws.find((d) => d.kind === 'QUALIFYING');
  const main = draws.find((d) => d.kind === 'MAIN');
  if (kind === 'MAIN') {
    if (!hasQualifying) return 0;
    return qualifying ? (qualifying.qualifierCount ?? 0) : (body.qualifierCount ?? 0);
  }
  const wanted = body.qualifierCount ?? main?.qualifierCount ?? defaultCount;
  if (main && (main.qualifierCount ?? 0) !== wanted) {
    throw conflict(
      'QUALIFIER_COUNT_MISMATCH',
      `Nhánh chính đã bốc với ${main.qualifierCount ?? 0} suất vòng loại. Bốc lại nhánh chính trước hoặc dùng cùng số suất`,
    );
  }
  return wanted;
}
