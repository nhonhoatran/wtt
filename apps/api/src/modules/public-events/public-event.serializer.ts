import type { Prisma } from '@kamito/db';
import { lifecycleFromDates, todayInTimezone, type PublicEventCard, type PublicImage } from '@kamito/shared';
import { publicUrlFor } from '@kamito/shared/media';
import { readVariants } from '../media/media-dtos.js';
import { subEventNames } from '../public-competition/public-bracket.serializer.js';
import { publicScope } from '../public-scope/public-scope.js';

const CODED = { code: true, name: true, nameEn: true } as const;

const MEDIA_SELECT = { select: { status: true, variants: true, altText: true, altTextEn: true } } as const;

export const PUBLIC_EVENT_CARD_SELECT = {
  slug: true,
  name: true,
  nameEn: true,
  shortName: true,
  startDate: true,
  endDate: true,
  timezone: true,
  city: true,
  venue: { select: { name: true, nameEn: true } },
  eventType: { select: { ...CODED, colorHex: true, tier: { select: { ...CODED, colorHex: true } } } },
  bannerMedia: MEDIA_SELECT,
  subEvents: {
    orderBy: [{ order: 'asc' }, { code: 'asc' }],
    select: { ...CODED, discipline: { select: { name: true, nameEn: true } }, category: { select: { name: true, nameEn: true } } },
  },
  _count: { select: { matches: { where: publicScope.matchOfEvent } } },
} satisfies Prisma.EventSelect;

export type PublicEventCardRow = Prisma.EventGetPayload<{ select: typeof PUBLIC_EVENT_CARD_SELECT }>;
type MediaRow = Prisma.MediaAssetGetPayload<typeof MEDIA_SELECT>;

/** Cards take the smallest variant at least this wide; the hero takes the largest. */
export const CARD_IMAGE_MIN_WIDTH = 640;

/** `minWidth` null = the largest variant. */
export function toPublicImage(media: MediaRow | null, baseUrl: string, minWidth: number | null): PublicImage | null {
  if (!media || media.status !== 'READY') return null;
  const variants = readVariants(media.variants).sort((a, b) => a.width - b.width);
  const chosen = (minWidth === null ? undefined : variants.find((v) => v.width >= minWidth)) ?? variants.at(-1);
  if (!chosen) return null;
  return { url: publicUrlFor(baseUrl, chosen.key), width: chosen.width, height: chosen.height, alt: media.altText, altEn: media.altTextEn };
}

export const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

/** Whitelist serializer for an event card; rows are already limited to published, non-cancelled events. */
export function toPublicEventCard(e: PublicEventCardRow, baseUrl: string, imageMinWidth: number | null = CARD_IMAGE_MIN_WIDTH, now: Date = new Date()): PublicEventCard {
  const startDate = dateOnly(e.startDate);
  const endDate = dateOnly(e.endDate);
  const lifecycle = lifecycleFromDates({ startDate, endDate, isCancelled: false, today: todayInTimezone(e.timezone, now) });
  const { tier, ...type } = e.eventType;
  return {
    slug: e.slug,
    name: e.name,
    nameEn: e.nameEn,
    shortName: e.shortName,
    startDate,
    endDate,
    timezone: e.timezone,
    lifecycle: lifecycle === 'CANCELLED' ? 'COMPLETED' : lifecycle,
    city: e.city,
    venue: e.venue ? { name: e.venue.name, nameEn: e.venue.nameEn } : null,
    tier: { code: tier.code, name: tier.name, nameEn: tier.nameEn, colorHex: tier.colorHex },
    eventType: { code: type.code, name: type.name, nameEn: type.nameEn, colorHex: type.colorHex },
    banner: toPublicImage(e.bannerMedia, baseUrl, imageMinWidth),
    subEvents: e.subEvents.map((s) => ({ code: s.code, ...subEventNames(s) })),
    hasPublicMatches: e._count.matches > 0,
  };
}
