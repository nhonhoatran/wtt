import type { Prisma } from '@kamito/db';
import { fieldError } from '../../common/validation/parse-body.js';

type Reader = Pick<Prisma.TransactionClient, 'rankingList' | 'discipline'>;

/** A sub-event may only feed a list of its own kind (singles vs doubles). Null/undefined means no list. */
export async function assertRankingListFits(db: Reader, rankingListId: string | null | undefined, disciplineIds: string[]): Promise<void> {
  if (!rankingListId) return;
  const list = await db.rankingList.findUnique({ where: { id: rankingListId }, select: { competitorKind: true, isActive: true } });
  if (!list || !list.isActive) throw fieldError('rankingListId', 'Bảng xếp hạng không tồn tại hoặc đã ngừng dùng');
  const mismatch = await db.discipline.count({ where: { id: { in: disciplineIds }, competitorKind: { not: list.competitorKind } } });
  if (mismatch > 0) throw fieldError('rankingListId', 'Bảng xếp hạng không cùng loại (đơn/đôi) với nội dung thi đấu');
}
