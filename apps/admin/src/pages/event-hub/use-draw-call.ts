import { App } from 'antd';
import { useCallback } from 'react';
import { ApiError } from '../../api/http-client';

const CONFLICT_CODES = new Set(['DRAW_VERSION_CONFLICT', 'GROUP_VERSION_CONFLICT']);
const CONFLICT_TEXT = 'Nhánh đấu vừa được cập nhật ở nơi khác. Đã tải lại dữ liệu, hãy kiểm tra rồi thử lại.';

/**
 * Wraps a draw write: a version conflict (409) refetches the draw and rethrows with a plain message,
 * every other error passes through. `report` shows any thrown error as a toast.
 */
export function useDrawCall(refresh: () => Promise<unknown>) {
  const { message } = App.useApp();

  const call = useCallback(
    async <T>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (error) {
        if (error instanceof ApiError && CONFLICT_CODES.has(error.code)) {
          await refresh();
          throw new ApiError(error.statusCode, error.code, CONFLICT_TEXT);
        }
        throw error;
      }
    },
    [refresh],
  );

  const report = useCallback(
    (error: unknown) => {
      void message.error(error instanceof ApiError ? error.message : 'Không thực hiện được');
    },
    [message],
  );

  return { call, report };
}

export type DrawCall = ReturnType<typeof useDrawCall>['call'];
