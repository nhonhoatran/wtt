// SAMPLE ranking data only. The organisers have not answered the points questions (gate G2), so every number
// below is an example that admins replace on the ranking screens. Idempotent: existing rows are left untouched.
// Run: MIGRATE_CONFIRM_TARGET=host:port/db pnpm --filter @kamito/db seed:ranking
import { describeDbTarget, isTargetConfirmed } from '../../../../scripts/print-db-target.mjs';
import { createPrismaClient } from '../../dist/index.js';

const SAMPLE_MARK = 'seed-sample-g2';
const SAMPLE_EFFECTIVE_FROM = '2026-01-01';
const SAMPLE_VALIDITY_DAYS = 365;

// Champion points by event type order (first type = highest): 1000 / 400 / 125, the rest reuse the last value.
const SAMPLE_CHAMPION_POINTS = [1000, 400, 125];

// Share of the champion points by stage code, in percent.
const SAMPLE_MAIN_PERCENT: Record<string, number> = { W: 100, F: 70, SF: 45, QF: 25, R16: 12, R32: 6, R64: 3, R128: 1.5 };
const SAMPLE_QUALIFYING_PERCENT: Record<string, number> = { 'QF-1': 5, 'QF-2': 2.5 };
const SAMPLE_GROUP_PERCENT: Record<string, number> = { GROUP: 8, 'GROUP-3': 8, 'GROUP-4': 5 };

const LISTS = [
  { code: 'MS', name: 'Đơn nam (mẫu)', competitorKind: 'SINGLES', genderRule: 'MEN', order: 1 },
  { code: 'WS', name: 'Đơn nữ (mẫu)', competitorKind: 'SINGLES', genderRule: 'WOMEN', order: 2 },
  { code: 'MD', name: 'Đôi nam (mẫu)', competitorKind: 'DOUBLES', genderRule: 'MEN', order: 3 },
  { code: 'WD', name: 'Đôi nữ (mẫu)', competitorKind: 'DOUBLES', genderRule: 'WOMEN', order: 4 },
  { code: 'XD', name: 'Đôi nam nữ (mẫu)', competitorKind: 'DOUBLES', genderRule: 'MIXED', order: 5 },
] as const;

const DRAW_KINDS = [
  ['MAIN', SAMPLE_MAIN_PERCENT],
  ['QUALIFYING', SAMPLE_QUALIFYING_PERCENT],
  ['GROUP', SAMPLE_GROUP_PERCENT],
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const target = describeDbTarget(url);
  console.log(`DB target: ${target.confirmKey} (user: ${target.user})`);
  if (!isTargetConfirmed(target, process.env.MIGRATE_CONFIRM_TARGET)) {
    throw new Error(`Set MIGRATE_CONFIRM_TARGET=${target.confirmKey} to confirm this target`);
  }

  const prisma = createPrismaClient({ connectionString: url });
  try {
    for (const list of LISTS) {
      await prisma.rankingList.upsert({
        where: { code: list.code },
        create: { ...list, validityDays: SAMPLE_VALIDITY_DAYS },
        update: {},
      });
    }

    const eventTypes = await prisma.eventType.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { code: 'asc' }] });
    const effectiveFrom = new Date(`${SAMPLE_EFFECTIVE_FROM}T00:00:00Z`);
    let created = 0;
    for (const [index, eventType] of eventTypes.entries()) {
      const champion = SAMPLE_CHAMPION_POINTS[Math.min(index, SAMPLE_CHAMPION_POINTS.length - 1)]!;
      for (const competitorKind of ['SINGLES', 'DOUBLES'] as const) {
        for (const [drawKind, percents] of DRAW_KINDS) {
          for (const [stageCode, percent] of Object.entries(percents)) {
            const key = { eventTypeId: eventType.id, competitorKind, drawKind, stageCode, effectiveFrom };
            const exists = await prisma.rankingPointsRule.findUnique({ where: { eventTypeId_competitorKind_drawKind_stageCode_effectiveFrom: key } });
            if (exists) continue;
            await prisma.rankingPointsRule.create({ data: { ...key, points: Math.round((champion * percent) / 100), createdById: SAMPLE_MARK } });
            created += 1;
          }
        }
      }
    }
    console.log(`Ranking sample data seeded: ${LISTS.length} lists checked, ${created} rule rows created for ${eventTypes.length} event types`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
