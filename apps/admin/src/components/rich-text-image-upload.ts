import { apiFetch } from '../api/http-client';
import { FAILURE_TEXT, putContent, sleep } from './media-upload-support';
import { requireClipboardImage, requireSecureRichTextImageUrl, validateClipboardImageConfig } from './rich-text-image-policy';

interface UploadConfig { allowedTypes: string[]; maxBytes: number }
interface MediaView {
  id: string;
  status: 'AWAITING_UPLOAD' | 'PROCESSING' | 'READY' | 'FAILED';
  failureReason: string | null;
  url: string | null;
  altText: string | null;
}
interface UploadOptions {
  isActive: () => boolean;
  onPhase: (phase: 'uploading' | 'processing') => void;
}

// A bounded UI wait mirrors MediaUploadField; processing policy remains on the server.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

/** Only clipboard files go through upload. SVG is always rejected before any request. */
export async function uploadRichTextImage(file: File, { isActive, onPhase }: UploadOptions): Promise<{ src: string; alt: string }> {
  const type = requireClipboardImage(file);
  const { data: config } = await apiFetch<{ data: UploadConfig }>('/admin/media/config');
  validateClipboardImageConfig(type, file.size, config);
  if (!isActive()) throw new Error('Đã dừng tải ảnh.');
  onPhase('uploading');
  const { data: intent } = await apiFetch<{ data: { mediaId: string; uploadUrl: string } }>('/admin/media/intents', {
    method: 'POST', body: { purpose: 'article-body', contentType: type, size: file.size },
  });
  if (!isActive()) throw new Error('Đã dừng tải ảnh.');
  await putContent(intent.uploadUrl, file);
  if (!isActive()) throw new Error('Đã dừng tải ảnh.');
  await apiFetch(`/admin/media/${intent.mediaId}/complete`, { method: 'POST', body: {} });
  onPhase('processing');
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (isActive()) {
    const { data } = await apiFetch<{ data: MediaView }>(`/admin/media/${intent.mediaId}`);
    if (!isActive()) throw new Error('Đã dừng tải ảnh.');
    if (data.status === 'FAILED') throw new Error(FAILURE_TEXT[data.failureReason ?? ''] ?? 'Không xử lý được ảnh.');
    if (data.status === 'READY') return { src: requireSecureRichTextImageUrl(data.url), alt: data.altText ?? '' };
    if (Date.now() + POLL_INTERVAL_MS > deadline) throw new Error('Ảnh xử lý lâu hơn dự kiến. Ảnh chưa được chèn; vui lòng thử lại sau.');
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Đã dừng tải ảnh.');
}

/** Pasted HTML never imports external images or data URLs; clipboard image files use uploadRichTextImage. */
export function stripPastedImages(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('img, svg, picture, source').forEach((node) => node.remove());
  return template.innerHTML;
}
