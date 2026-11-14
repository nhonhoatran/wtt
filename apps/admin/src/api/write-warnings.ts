import type { App } from 'antd';

type MessageApi = ReturnType<typeof App.useApp>['message'];

/** Codes the API attaches to an already committed write; anything else is already a readable sentence. */
export const WARNING_LABELS: Record<string, string> = {
  PUBLIC_REFRESH_DELAYED: 'Đã lưu. Trang công khai sẽ cập nhật chậm hơn',
  RANKING_RECOMPUTE_DELAYED: 'Đã lưu. Bảng xếp hạng sẽ cập nhật chậm hơn',
  RANKING_SNAPSHOT_REBUILD_SUGGESTED: 'Nên tạo lại bản chụp xếp hạng mới vì VĐV đã được gộp',
};

export const warningLabel = (code: string) => WARNING_LABELS[code] ?? code;

export function showWarnings(message: MessageApi, warnings?: string[]) {
  warnings?.forEach((code) => void message.warning(warningLabel(code)));
}

/** Warnings carried next to `data` on a write response; Refine passes the raw body through. */
export const warningsOf = (response: unknown): string[] | undefined => (response as { warnings?: string[] } | null)?.warnings;
