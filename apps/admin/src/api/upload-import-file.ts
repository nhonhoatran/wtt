import { XLSX_MIME } from '../resources/imports/import-labels';
import { apiUrl } from './api-url';
import { ApiError } from './http-client';

const PERCENT = 100;

/** Raw xlsx body to PUT /admin/imports/:id/file; XHR instead of fetch because only XHR reports upload progress. */
export function putImportFile(importId: string, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', apiUrl(`/admin/imports/${encodeURIComponent(importId)}/file`));
    xhr.setRequestHeader('Content-Type', XLSX_MIME);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * PERCENT));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let body: { error?: { code?: string; message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // Proxies answer 413 with HTML; the status alone is enough.
      }
      const tooLarge = xhr.status === 413;
      reject(
        new ApiError(
          xhr.status,
          body.error?.code ?? (tooLarge ? 'PAYLOAD_TOO_LARGE' : `HTTP_${xhr.status}`),
          body.error?.message ?? (tooLarge ? 'File quá lớn so với giới hạn cho phép.' : 'Không tải được file lên'),
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'));
    xhr.send(file);
  });
}
