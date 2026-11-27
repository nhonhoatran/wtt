// Example catalog defaults. Idempotent: rows that already exist are left as admins edited them.
// Run: MIGRATE_CONFIRM_TARGET=host:port/db pnpm --filter @kamito/db seed:config
import { describeDbTarget, isTargetConfirmed } from '../../../../scripts/print-db-target.mjs';
import { createPrismaClient } from '../../dist/index.js';

const TIERS = [{ code: 'KAMITO', name: 'Hệ thống giải Kamito', nameEn: 'Kamito Series', colorHex: '#C8102E', order: 1 }];

const EVENT_TYPES = [
  { tierCode: 'KAMITO', code: 'KAMITO_CHAMPIONSHIP', name: 'Giải vô địch', nameEn: 'Championship', order: 1 },
  { tierCode: 'KAMITO', code: 'KAMITO_OPEN', name: 'Giải mở rộng', nameEn: 'Open', order: 2 },
];

const DISCIPLINES = [
  { code: 'MS', name: 'Đơn nam', nameEn: "Men's Singles", competitorKind: 'SINGLES', genderRule: 'MEN', order: 1 },
  { code: 'WS', name: 'Đơn nữ', nameEn: "Women's Singles", competitorKind: 'SINGLES', genderRule: 'WOMEN', order: 2 },
  { code: 'MD', name: 'Đôi nam', nameEn: "Men's Doubles", competitorKind: 'DOUBLES', genderRule: 'MEN', order: 3 },
  { code: 'WD', name: 'Đôi nữ', nameEn: "Women's Doubles", competitorKind: 'DOUBLES', genderRule: 'WOMEN', order: 4 },
  { code: 'XD', name: 'Đôi nam nữ', nameEn: 'Mixed Doubles', competitorKind: 'DOUBLES', genderRule: 'MIXED', order: 5 },
] as const;

const MATCH_FORMAT = {
  name: '5 ván, 11 điểm, cách 2',
  nameEn: 'Best of 5, 11 points, win by 2',
  bestOf: 5,
  pointsPerGame: 11,
  winBy: 2,
  estimatedMinutes: 30,
  isDefault: true,
};

const GROUP_SCORING_RULE = {
  name: 'Thắng 2 – thua 1 – thua walkover 0',
  nameEn: 'Win 2 – loss 1 – walkover loss 0',
  pointsWin: 2,
  pointsLoss: 1,
  pointsWalkoverLoss: 0,
  pointsUnfinishedLoss: 1,
  unfinishedMatchScoring: 'AWARD_REMAINING_TO_WINNER' as const,
  awardedGamePoints: 11,
  // Approved G1 choice (2026-11-27); only newly seeded rules use it, existing rules stay untouched.
  withdrawalPolicy: 'KEEP_PLAYED_RESULTS' as const,
  tiebreakers: ['HEAD_TO_HEAD_POINTS', 'HEAD_TO_HEAD_GAME_RATIO', 'HEAD_TO_HEAD_POINT_RATIO', 'DRAW_OF_LOTS'],
  isDefault: true,
};

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
    for (const tier of TIERS) {
      await prisma.tier.upsert({ where: { code: tier.code }, create: tier, update: {} });
    }
    for (const { tierCode, ...eventType } of EVENT_TYPES) {
      const tier = await prisma.tier.findUniqueOrThrow({ where: { code: tierCode } });
      await prisma.eventType.upsert({ where: { code: eventType.code }, create: { ...eventType, tierId: tier.id }, update: {} });
    }
    for (const discipline of DISCIPLINES) {
      await prisma.discipline.upsert({ where: { code: discipline.code }, create: discipline, update: {} });
    }
    if (!(await prisma.matchFormat.findFirst({ where: { name: MATCH_FORMAT.name } }))) {
      const hasDefault = await prisma.matchFormat.count({ where: { isDefault: true } });
      await prisma.matchFormat.create({ data: { ...MATCH_FORMAT, isDefault: hasDefault === 0 } });
    }
    if (!(await prisma.groupScoringRule.findFirst({ where: { name: GROUP_SCORING_RULE.name } }))) {
      const hasDefault = await prisma.groupScoringRule.count({ where: { isDefault: true } });
      await prisma.groupScoringRule.create({ data: { ...GROUP_SCORING_RULE, isDefault: hasDefault === 0 } });
    }
    console.log('Catalog defaults seeded');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
