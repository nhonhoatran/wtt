import type { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_RANKING_LIST_SELECT, PUBLIC_RANKING_ROW_SELECT, toPublicRankingList, toPublicRankingRow } from '../public-rankings/public-ranking.serializer.js';

/** Active ranking lists with the top rows of their latest published snapshot. */
export async function findHomeRankingLists(prisma: PrismaService, listLimit: number, topN: number) {
  return await prisma.rankingList.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { code: 'asc' }],
    take: listLimit,
    select: {
      ...PUBLIC_RANKING_LIST_SELECT,
      snapshots: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ asOfDate: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          asOfDate: true,
          publishedAt: true,
          rows: { orderBy: [{ rank: 'asc' }, { playerId: 'asc' }], take: topN, select: { ...PUBLIC_RANKING_ROW_SELECT, breakdown: false } },
        },
      },
    },
  });
}

export function toHomeTopRankings(lists: Awaited<ReturnType<typeof findHomeRankingLists>>, mediaBaseUrl: string) {
  return lists.map((list) => {
    const snapshot = list.snapshots[0];
    return {
      list: toPublicRankingList(list),
      asOfDate: snapshot?.asOfDate.toISOString().slice(0, 10) ?? null,
      publishedAt: snapshot?.publishedAt?.toISOString() ?? null,
      items: (snapshot?.rows ?? []).map((row) => toPublicRankingRow({ ...row, breakdown: [] }, mediaBaseUrl, new Map())),
    };
  });
}
