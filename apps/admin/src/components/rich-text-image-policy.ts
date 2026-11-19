import { isHttpsUrl } from '@kamito/shared';

export function requireSecureRichTextImageUrl(value: string | null): string {
  if (!value || !isHttpsUrl(value)) {
    throw new Error('Ảnh đã tải lên nhưng chưa thể chèn vào bài. Quản trị hạ tầng cần cấu hình MEDIA_PUBLIC_BASE_URL bằng URL HTTPS công khai; liên kết tương đối hoặc HTTP không được chấp nhận.');
  }
  return value;
}

export function requireClipboardImage(file: Pick<File, 'type' | 'size'>): string {
  const type = file.type.toLowerCase();
  if (!type.startsWith('image/') || type === 'image/svg+xml' || file.size <= 0) {
    throw new Error('Chỉ dán tệp ảnh hợp lệ; ảnh SVG không được hỗ trợ.');
  }
  return type;
}

export function validateClipboardImageConfig(type: string, size: number, config: { allowedTypes: string[]; maxBytes: number }): void {
  if (!config.allowedTypes.map((allowed) => allowed.toLowerCase()).includes(type)) throw new Error('Định dạng ảnh này không được cho phép.');
  if (size > config.maxBytes) throw new Error('Ảnh vượt dung lượng tải lên được cấu hình.');
}
