import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizePersonName } from '@kamito/shared';
import { codeField } from '../../src/common/crud/catalog-fields.js';
import type { AuthTestKit } from '../support/auth-test-kit.js';
import { buildXlsx, type SheetRowInput } from '../support/import-test-kit.js';
import type { FullUiWorld } from './full-ui-contract.js';

export async function fullUiCatalog(kit: AuthTestKit, world: FullUiWorld): Promise<void> {
  const disciplines = await kit.prisma.discipline.findMany({ where: { code: { in: ['MS', 'WD'] }, isActive: true }, select: { code: true, name: true } });
  const msName = disciplines.find((row) => row.code === 'MS')?.name, wdName = disciplines.find((row) => row.code === 'WD')?.name;
  if (!msName || !wdName) throw new Error('The confirmed test catalog must contain active MS and WD disciplines');
  const rows = await kit.prisma.$transaction(async (tx) => {
    const tier = await tx.tier.create({ data: { code: codeField.parse(`UI-${world.tag}`), name: `UI tier ${world.tag}`, colorHex: '#123456' } });
    const eventType = await tx.eventType.create({ data: { tierId: tier.id, code: codeField.parse(`UI-${world.tag}`), name: `UI type ${world.tag}` } });
    const venue = await tx.venue.create({ data: { name: `UI venue ${world.tag}`, tables: { create: [{ code: 'T1', order: 0 }, { code: 'T2', order: 1 }] } } });
    const format = await tx.matchFormat.create({ data: { name: `UI 1x11 ${world.tag}`, bestOf: 1, pointsPerGame: 11, winBy: 2, estimatedMinutes: 5 } });
    const group = await tx.groupScoringRule.create({ data: { name: `UI group ${world.tag}`, pointsWin: 2, pointsLoss: 1, pointsWalkoverLoss: 0, pointsUnfinishedLoss: 0, unfinishedMatchScoring: 'COUNT_PLAYED_ONLY', withdrawalPolicy: 'KEEP_PLAYED_RESULTS', tiebreakers: ['GAME_RATIO'] } });
    const lists = [];
    for (const [code, competitorKind, genderRule] of [['MS', 'SINGLES', 'MEN'], ['WD', 'DOUBLES', 'WOMEN']] as const) {
      const list = await tx.rankingList.create({ data: { code: codeField.parse(`UI-${code}-${world.tag.replaceAll('-', '')}`), name: `UI ${code} ${world.tag}`, competitorKind, genderRule, validityDays: 365 } }); lists.push(list);
      for (const [drawKind, points] of [
        ['MAIN', { W: 100, F: 60, SF: 30, QF: 15, R16: 10, R32: 5 }],
        ['QUALIFYING', { 'QF-1': 2, 'QF-2': 1 }],
        ['GROUP', { 'GROUP-1': 3, 'GROUP-2': 2, 'GROUP-3': 1, GROUP: 1 }],
      ] as const) await tx.rankingPointsRule.createMany({ data: Object.entries(points).map(([stageCode, value]) => ({ eventTypeId: eventType.id, competitorKind, drawKind, stageCode, points: value, effectiveFrom: new Date('2000-01-01'), createdById: world.users.admin.id })) });
    }
    return { tier, eventType, venue, format, group, lists };
  });
  world.catalog = { eventTypeId: rows.eventType.id, eventTypeName: rows.eventType.name, venueId: rows.venue.id, venueName: rows.venue.name, matchFormatId: rows.format.id, matchFormatName: rows.format.name, groupRuleId: rows.group.id, groupRuleName: rows.group.name, msDisciplineName: msName, wdDisciplineName: wdName };
  const [ms, wd] = rows.lists;
  world.ranking = { ms: { id: ms!.id, code: ms!.code, name: ms!.name }, wd: { id: wd!.id, code: wd!.code, name: wd!.name }, oldWinnerPoints: 100, newWinnerPoints: 200 };
  world.owned.catalogIds = { tierId: rows.tier.id, eventTypeId: rows.eventType.id, venueId: rows.venue.id, matchFormatId: rows.format.id, groupRuleId: rows.group.id, rankingListIds: rows.lists.map((row) => row.id) };
}

export async function fullUiReferences(kit: AuthTestKit, world: FullUiWorld): Promise<void> {
  const ids = await kit.prisma.$transaction(async (tx) => {
    const created: string[] = [];
    for (const [name, birthYear] of [[world.reference.ambiguousName, 1980], [world.reference.replacementName, 1990]] as const) {
      const id = randomUUID();
      await tx.player.create({ data: { id, code: `UI-${id.replaceAll('-', '').slice(0, 12)}`.toUpperCase(), slug: `ui-${id}`, fullName: name, normalizedName: normalizePersonName(name), gender: 'MALE', birthYear, countryCode: 'VIE' } }); created.push(id);
    }
    return created;
  });
  world.owned.referencePlayerIds.push(...ids);
}
export async function fullUiExcel(world: FullUiWorld, dir: string): Promise<void> {
  const ms: SheetRowInput[] = Array.from({ length: 40 }, (_, index) => ({ subEventCode: 'MS', player1Name: index === 0 ? world.reference.ambiguousName : `MS ${String(index).padStart(2, '0')} ${world.tag}`, player1Gender: 'Nam', player1BirthYear: 1999, player1Club: `Club ${index % 8} ${world.tag}`, stage: index < 8 ? 'Chính' : 'Loại', quotaType: 'Thường' }));
  const wd: SheetRowInput[] = Array.from({ length: 12 }, (_, index) => ({ subEventCode: 'WD', player1Name: `WD ${index} A ${world.tag}`, player1Gender: 'Nữ', player1BirthYear: 1998, player1Club: `Club ${index % 4} ${world.tag}`, player2Name: `WD ${index} B ${world.tag}`, player2Gender: 'Nữ', player2BirthYear: 1998, player2Club: `Club ${index % 4} ${world.tag}`, stage: 'Chính', quotaType: 'Thường' }));
  world.files = { msXlsx: path.join(dir, `ms-${world.runId}.xlsx`), wdXlsx: path.join(dir, `wd-${world.runId}.xlsx`) };
  await writeFile(world.files.msXlsx, await buildXlsx(ms)); await writeFile(world.files.wdXlsx, await buildXlsx(wd));
}
