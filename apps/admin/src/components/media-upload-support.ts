import { MEDIA_FAILURE } from '@kamito/shared/media';
import { ApiError } from '../api/http-client';

export type Phase = 'idle' | 'uploading' | 'processing' | 'ready' | 'failed';

export const FAILURE_TEXT: Record<string, string> = {
  [MEDIA_FAILURE.notAnImage]: 'Tệp không phải ảnh hợp lệ.',
  [MEDIA_FAILURE.tooLarge]: 'Ảnh quá lớn.',
  [MEDIA_FAILURE.intentExpired]: 'Phiên tải ảnh đã hết hạn.',
  [MEDIA_FAILURE.missingUpload]: 'Chưa nhận được nội dung ảnh.',
  [MEDIA_FAILURE.processingError]: 'Không xử lý được ảnh.',
  [MEDIA_FAILURE.processingTimeout]: 'Xử lý ảnh quá lâu, hãy tải lại ảnh.',
};

export const PHASE_TAG: Record<Exclude<Phase, 'idle'>, { color?: string; text: string }> = {
  uploading: { color: 'blue', text: 'Đang tải lên' },
  processing: { color: 'blue', text: 'Đang xử lý' },
  ready: { color: 'green', text: 'Sẵn sàng' },
  failed: { color: 'red', text: 'Lỗi' },
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function putContent(uploadUrl: string, file: File): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
  } catch {
    throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  throw new Error(body.error?.message ?? 'Không tải được ảnh lên');
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return Object.values(error.errors ?? {})[0] ?? error.message;
  return error instanceof Error ? error.message : 'Không tải được ảnh';
}
