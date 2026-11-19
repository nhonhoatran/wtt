import { isHttpsUrl } from '@kamito/shared';

export type VideoProvider = 'youtube' | 'facebook';
export interface ParsedVideoUrl { provider: VideoProvider; embedId: string; normalizedUrl: string; thumbnailUrl: string | null }

const VIDEO_ID = /^[A-Za-z0-9_-]{6,32}$/;
const DEFAULT_VIDEO_HOSTS = 'youtube.com,m.youtube.com,youtu.be,facebook.com,fb.watch';

export function parseVideoUrl(value: string, allowedHosts = process.env.VIDEO_EMBED_HOSTS ?? DEFAULT_VIDEO_HOSTS): ParsedVideoUrl | null {
  if (!isHttpsUrl(value)) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!allowedHosts.split(',').some((entry) => entry.trim().toLowerCase().replace(/^www\./, '') === host)) return null;
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && VIDEO_ID.test(id) ? { provider: 'youtube', embedId: id, normalizedUrl: `https://www.youtube.com/watch?v=${id}`, thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg` } : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = (url.pathname === '/watch' ? url.searchParams.get('v') : null) ?? url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)$/)?.[1];
    return id && VIDEO_ID.test(id) ? { provider: 'youtube', embedId: id, normalizedUrl: `https://www.youtube.com/watch?v=${id}`, thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg` } : null;
  }
  if (host === 'facebook.com' || host === 'fb.watch') {
    const id = (url.pathname === '/watch' ? url.searchParams.get('v') : null) ?? url.pathname.match(/(?:^|\/)videos\/(\d+)(?:\/|$)/)?.[1] ?? (host === 'fb.watch' ? url.pathname.split('/').filter(Boolean)[0] : null);
    const validId = id && (host === 'fb.watch' ? /^[A-Za-z0-9_-]{5,32}$/.test(id) : /^\d{6,30}$/.test(id));
    return validId ? { provider: 'facebook', embedId: id, normalizedUrl: url.toString(), thumbnailUrl: null } : null;
  }
  return null;
}
