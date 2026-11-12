import type { Prisma } from '@kamito/db';
import { fieldError } from '../validation/parse-body.js';

type MediaReader = Pick<Prisma.TransactionClient, 'mediaAsset'>;

/** 422 on each field whose media id is missing or not a finished upload (status READY). */
export async function assertReadyMedia(db: MediaReader, ids: Record<string, string | null | undefined>): Promise<void> {
  for (const [field, id] of Object.entries(ids)) {
    if (!id) continue;
    const media = await db.mediaAsset.findUnique({ where: { id }, select: { status: true } });
    if (media?.status !== 'READY') throw fieldError(field, 'Ảnh chưa tải xong hoặc không tồn tại');
  }
}
