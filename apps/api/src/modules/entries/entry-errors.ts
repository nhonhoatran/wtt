import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kamito/db';

export const entryNotFound = () => new NotFoundException({ code: 'ENTRY_NOT_FOUND', message: 'Không tìm thấy đăng ký' });

export const PUBLISHED_DRAW_HINT = "Entry đang trong nhánh đã công bố. Dùng 'Rút khỏi nhánh' ở tab Bốc thăm";
export const DRAFT_DRAW_WARNING = 'Nhánh nháp sẽ cần bốc lại';

const SEED_INDEX = 'Entry_subEventId_stage_seed_key';
const ENTRY_INDEX = 'Entry_subEventId_competitorId_key';

/** Prisma 7 + adapter-pg reports the violated index in meta.driverAdapterError.cause.constraint.index. */
function violatedIndex(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { driverAdapterError?: { cause?: { constraint?: { index?: string } } }; target?: unknown } | undefined;
  const index = meta?.driverAdapterError?.cause?.constraint?.index;
  if (index) return index;
  return typeof meta?.target === 'string' ? meta.target : undefined;
}

/** Maps the unique indexes of Entry to their business error; any other P2002 is rethrown untouched. */
export function mapSeedConflict(error: unknown, seed: number | null | undefined): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return error;
  const index = violatedIndex(error);
  if (index === SEED_INDEX) {
    const message = seed ? `Hạt giống ${seed} đã có trong vòng này` : 'Hạt giống đã có trong vòng này';
    return new ConflictException({ code: 'SEED_TAKEN', message, fields: { seed: message } });
  }
  if (index === ENTRY_INDEX) {
    return new ConflictException({ code: 'ALREADY_ENTERED', message: 'VĐV hoặc cặp này đã có đăng ký trong nội dung' });
  }
  return error;
}
