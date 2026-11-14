import { MEDIA_PURPOSES, publicUrlFor, type MediaVariant } from '@kamito/shared/media';
import type { MediaAsset } from '@kamito/db';
import { API_GLOBAL_PREFIX } from '@kamito/shared';
import { z } from 'zod';

export const createIntentBody = z.object({
  purpose: z.enum(MEDIA_PURPOSES),
  contentType: z.string().trim().min(1).max(100),
  size: z.number().int().positive(),
});
export type CreateIntentBody = z.infer<typeof createIntentBody>;

const altText = z.string().trim().max(300).nullable();
export const updateMediaBody = z
  .object({ altText: altText.optional(), altTextEn: altText.optional() })
  .refine((body) => body.altText !== undefined || body.altTextEn !== undefined, 'Nothing to update');
export type UpdateMediaBody = z.infer<typeof updateMediaBody>;

export interface MediaView {
  id: string;
  status: MediaAsset['status'];
  failureReason: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  altTextEn: string | null;
  variants: Array<{ width: number; height: number; url: string }>;
  url: string | null;
}

/** Public variants are served by the API itself when MEDIA_PUBLIC_BASE_URL is unset (local dev). */
export function mediaPublicBaseUrl(env: { MEDIA_PUBLIC_BASE_URL?: string }): string {
  return env.MEDIA_PUBLIC_BASE_URL ?? `/${API_GLOBAL_PREFIX}/media/public`;
}

export function readVariants(raw: MediaAsset['variants']): MediaVariant[] {
  return Array.isArray(raw) ? (raw as unknown as MediaVariant[]) : [];
}

export function toMediaView(asset: MediaAsset, publicBaseUrl: string): MediaView {
  const variants = readVariants(asset.variants)
    .map((variant) => ({ width: variant.width, height: variant.height, url: publicUrlFor(publicBaseUrl, variant.key) }))
    .sort((a, b) => a.width - b.width);
  return {
    id: asset.id,
    status: asset.status,
    failureReason: asset.failureReason,
    width: asset.width,
    height: asset.height,
    altText: asset.altText,
    altTextEn: asset.altTextEn,
    variants,
    url: variants.at(-1)?.url ?? null,
  };
}
