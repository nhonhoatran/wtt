import type { Prisma } from '@kamito/db';
import { publicPlayerSlug, type PublicRankingPlayer } from '@kamito/shared';
import { toPublicImage } from '../public-events/public-event.serializer.js';

export const PUBLIC_PLAYER_SELECT = {
  id: true,
  fullName: true,
  fullNameEn: true,
  publicDisplayName: true,
  club: true,
  gender: true,
  isActive: true,
  isPublicProfile: true,
  mergedIntoId: true,
  photoMedia: { select: { status: true, variants: true, altText: true, altTextEn: true } },
} satisfies Prisma.PlayerSelect;

export type PublicPlayerRow = Prisma.PlayerGetPayload<{ select: typeof PUBLIC_PLAYER_SELECT }>;

/** Explicit whitelist: legal names are suppressed when a public alias exists. */
export function toPublicPlayer(p: PublicPlayerRow, mediaBase: string): PublicRankingPlayer {
  const publicProfile = p.isActive && p.isPublicProfile && !p.mergedIntoId;
  return {
    slug: publicProfile ? publicPlayerSlug(p.id) : null,
    name: p.publicDisplayName ?? p.fullName,
    nameEn: p.publicDisplayName !== null ? null : p.fullNameEn,
    club: p.club,
    photo: publicProfile ? toPublicImage(p.photoMedia, mediaBase, null) : null,
  };
}
