import { cleanPersonName, normalizePersonName, slugifyVietnamese, stripDiacritics } from '@kamito/shared';
import type { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const MAX_SLUG_STEM = 100;
const MAX_SUFFIX_TRIES = 1000;

export interface PlayerCodeFormat {
  prefix: string;
  digits: number;
}

export async function nextPlayerCode(tx: Tx, format: PlayerCodeFormat): Promise<string> {
  const [row] = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('player_code_seq') AS value`;
  return `${format.prefix}${String(row!.value).padStart(format.digits, '0')}`;
}

/** First free slug from the name: `nguyen-van-a`, then `-2`, `-3`… */
export async function uniquePlayerSlug(tx: Tx, fullName: string, excludeId?: string): Promise<string> {
  const stem = slugifyVietnamese(fullName, MAX_SLUG_STEM) || 'vdv';
  const rows = await tx.player.findMany({
    where: { OR: [{ slug: stem }, { slug: { startsWith: `${stem}-` } }], ...(excludeId && { id: { not: excludeId } }) },
    select: { slug: true },
  });
  const taken = new Set(rows.map((row) => row.slug));
  if (!taken.has(stem)) return stem;
  for (let n = 2; n < MAX_SUFFIX_TRIES; n += 1) {
    if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
  }
  return `${stem}-${Date.now()}`;
}

export interface NewPlayerIdentity {
  fullName: string;
  fullNameEn?: string | null;
}

/** Code, slug and derived name fields for a new player; call inside the creating transaction. */
export async function allocatePlayerIdentity(tx: Tx, input: NewPlayerIdentity, format: PlayerCodeFormat) {
  const fullName = cleanPersonName(input.fullName);
  return {
    code: await nextPlayerCode(tx, format),
    slug: await uniquePlayerSlug(tx, fullName),
    fullName,
    fullNameEn: input.fullNameEn?.trim() || stripDiacritics(fullName),
    normalizedName: normalizePersonName(fullName),
  };
}
