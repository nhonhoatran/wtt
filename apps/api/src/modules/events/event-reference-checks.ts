import type { Prisma } from '@kamito/db';
import { assertReadyMedia } from '../../common/crud/ready-media.js';
import { fieldError } from '../../common/validation/parse-body.js';

type ReferenceReader = Pick<Prisma.TransactionClient, 'eventType' | 'venue' | 'mediaAsset'>;

export interface EventReferences {
  eventTypeId?: string;
  venueId?: string | null;
  bannerMediaId?: string | null;
}

/** 422 on the offending field when a referenced row is missing, inactive or not a finished upload. */
export async function assertEventReferences(db: ReferenceReader, refs: EventReferences): Promise<void> {
  if (refs.eventTypeId) {
    const eventType = await db.eventType.findUnique({ where: { id: refs.eventTypeId }, select: { isActive: true } });
    if (!eventType?.isActive) throw fieldError('eventTypeId', 'Loại giải không tồn tại hoặc đã ngừng dùng');
  }
  if (refs.venueId) {
    const venue = await db.venue.findUnique({ where: { id: refs.venueId }, select: { id: true } });
    if (!venue) throw fieldError('venueId', 'Địa điểm không tồn tại');
  }
  await assertReadyMedia(db, { bannerMediaId: refs.bannerMediaId });
}
