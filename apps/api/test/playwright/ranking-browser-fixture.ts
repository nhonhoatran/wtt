import type { AuthTestKit } from '../support/auth-test-kit.js';
import { publicPlayerSlug } from '@kamito/shared';
import { buildKnockout, playRounds } from '../support/ranking-draw-builder.js';
import { addEntries, addRules, cleanupRankingWorld, createRankingWorld, deleteSnapshotsOfLists, type RankingWorld } from '../support/ranking-test-kit.js';

export interface RankingBrowserFixture {
  world: RankingWorld;
  doublesListId: string;
  code: string;
  name: string;
  nameEn: string;
  doublesCode: string;
  doublesName: string;
  eventSlug: string;
  eventName: string;
  playerSlug: string;
  legacyPlayerSlug: string;
  playerName: string;
  hiddenName: string;
  club: string;
  privateSlug: string;
  privateName: string;
  mergedSlug: string;
  emptySlug: string;
  currentPoints: number;
  playedMatchNo: number;
  byeMatchNo: number;
}

/** A separate ranking event keeps the original public-world counts and match assertions unchanged. */
export async function createRankingBrowserFixture(kit: AuthTestKit): Promise<RankingBrowserFixture> {
  const world = await createRankingWorld(kit);
  const { prisma } = kit;
  const { entryIds } = await addEntries(kit, world, 52);
  // These synthetic profile/search fixtures opt in explicitly; private cases below remain private.
  await prisma.player.updateMany({ where: { id: { in: world.playerIds } }, data: { isPublicProfile: true } });
  const code = `RL-${world.tag}`;
  const name = `Xếp hạng thử nghiệm ${world.tag}`;
  const nameEn = `Test rankings ${world.tag}`;
  const doublesName = `Xếp hạng đôi ${world.tag}`;
  const doublesCode = `RD-${world.tag}`;
  const playerName = `Nguyễn Văn Hòa ${world.tag}`;
  const club = `CLB Bình Minh ${world.tag}`;
  const eventName = `Giải xếp hạng ${world.tag}`;
  await prisma.rankingList.update({ where: { id: world.listId }, data: { name, nameEn } });
  const doubles = await prisma.rankingList.create({ data: {
    code: doublesCode, name: doublesName, nameEn: `Doubles rankings ${world.tag}`,
    competitorKind: 'DOUBLES', genderRule: 'MEN', validityDays: 365,
  } });
  const event = await prisma.event.update({ where: { id: world.eventId }, data: { publishStatus: 'PUBLISHED', name: eventName, nameEn: `Ranked event ${world.tag}` } });
  const first = await prisma.player.update({ where: { id: world.playerIds[0]! }, data: {
    slug: `nguyen-van-an-${world.tag}`, publicDisplayName: playerName, club, handedness: 'LEFT', noindex: true,
    bio: 'Hồ sơ vận động viên dùng cho kiểm thử công khai.', bioEn: 'Public player profile for browser verification.',
    phone: '0911000111', email: `rank-profile-${world.tag}@example.test`, birthDate: new Date('1989-01-08'),
  } });
  await prisma.player.update({ where: { id: world.playerIds[1]! }, data: { publicDisplayName: `Đặng Minh ${world.tag}`, club } });
  for (let i = 2; i < world.playerIds.length; i++) {
    await prisma.player.update({ where: { id: world.playerIds[i]! }, data: { publicDisplayName: `Tay vợt ${world.tag} ${String(i).padStart(2, '0')}`, club: `CLB Thử ${world.tag}` } });
  }
  const privateName = `Hồ sơ riêng ${world.tag}`;
  const privatePlayer = await prisma.player.update({ where: { id: world.playerIds[3]! }, data: { publicDisplayName: privateName, isPublicProfile: false } });
  const merged = await prisma.player.create({ data: {
    code: `RM-${world.tag}`, slug: `merged-rank-${world.tag}`, fullName: `Merged ${world.tag}`, normalizedName: `merged ${world.tag}`,
    gender: 'MALE', countryCode: 'VN', mergedIntoId: first.id, mergedAt: new Date(), isActive: false,
  } });
  const empty = await prisma.player.create({ data: {
    code: `RZ-${world.tag}`, slug: `empty-rank-${world.tag}`, fullName: `Chưa thi đấu ${world.tag}`, normalizedName: `chua thi dau ${world.tag}`,
    gender: 'FEMALE', countryCode: 'VN', isPublicProfile: true,
  } });
  world.playerIds.push(merged.id, empty.id);

  const snapshot = async (listId: string, date: string, points: number, publish = true, ids = world.playerIds.slice(0, 52)) => {
    const row = await prisma.rankingSnapshot.create({ data: {
      rankingListId: listId, asOfDate: new Date(date),
      rows: { create: ids.map((playerId, i) => ({
        playerId, rank: i + 1, previousRank: i + 3, movement: 2, points: points - i * 10, resultsCounted: 1,
        breakdown: [{ ledgerId: `private-ledger-${world.tag}-${i}`, eventId: event.id, eventSlug: event.slug, eventName,
          eventNameEn: event.nameEn, eventTypeCode: `RE-${world.tag}`, stageCode: 'W', points: points - i * 10,
          earnedAt: '2099-05-02', expiresAt: '2100-05-02' }],
      })) },
    } });
    if (publish) await prisma.rankingSnapshot.update({ where: { id: row.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: 'browser-test' } });
  };
  await snapshot(world.listId, '2099-05-02', 2000);
  await snapshot(world.listId, '2099-05-03', 2700);
  await snapshot(world.listId, '2099-05-04', 9900, false);
  await snapshot(doubles.id, '2099-05-03', 1500, true, [first.id]);
  await addRules(kit, world, [
    { stageCode: 'W', points: 500, effectiveFrom: '2000-01-01' },
    { stageCode: 'F', points: 400, effectiveFrom: '2000-01-01' },
    { stageCode: 'W', points: 750, effectiveFrom: '2099-05-01' },
    { stageCode: 'W', points: 9999, effectiveFrom: '2099-06-01' },
  ]);
  const draw = await buildKnockout(kit, world, { slots: [entryIds[0]!, null, entryIds[1]!, entryIds[2]!], codes: ['SF', 'F'] });
  await playRounds(kit, draw, () => 1);
  const matches = await prisma.match.findMany({ where: { drawId: draw.drawId }, orderBy: { matchNo: 'asc' } });
  return {
    world, doublesListId: doubles.id, code, name, nameEn, doublesCode, doublesName, eventSlug: event.slug, eventName,
    playerSlug: publicPlayerSlug(first.id), legacyPlayerSlug: first.slug, playerName, hiddenName: first.fullName, club, privateSlug: publicPlayerSlug(privatePlayer.id), privateName,
    mergedSlug: merged.slug, emptySlug: publicPlayerSlug(empty.id), currentPoints: 2700,
    playedMatchNo: matches.find((m) => m.id === draw.rounds.at(-1)!.matchIds[0])!.matchNo,
    byeMatchNo: matches.find((m) => m.resultType === 'BYE')!.matchNo,
  };
}

export async function cleanupRankingBrowserFixture(kit: AuthTestKit, fixture: RankingBrowserFixture): Promise<void> {
  await deleteSnapshotsOfLists(kit, [fixture.doublesListId]);
  await kit.prisma.rankingList.deleteMany({ where: { id: fixture.doublesListId } });
  await cleanupRankingWorld(kit, [fixture.world]);
}
