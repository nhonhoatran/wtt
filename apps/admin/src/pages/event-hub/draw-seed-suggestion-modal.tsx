import { useInvalidate } from '@refinedev/core';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Flex, Modal, Skeleton, Table, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useConfirmAction } from '../../components/confirm-action-button';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { entriesResource } from './entry-table';

interface Suggestion {
  entryId: string;
  displayName: string;
  rankingAtEntry: number | null;
  pointsAtEntry: number;
  suggestedSeed: number | null;
}

type SuggestionResult =
  | { available: false; suggestions: Suggestion[] }
  | { available: true; snapshot: { listCode: string; asOfDate: string }; seedCount: number; suggestions: Suggestion[] };

interface DrawSeedSuggestionModalProps {
  subEventId: string;
  open: boolean;
  onClose: () => void;
}

const SEED_COLUMN_WIDTH = 140;

const suggestUrl = (subEventId: string) => `/admin/sub-events/${subEventId}/entries/suggest-seeds`;

export function DrawSeedSuggestionModal({ subEventId, open, onClose }: DrawSeedSuggestionModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const confirm = useConfirmAction();
  const invalidate = useInvalidate();
  const [applyError, setApplyError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ['admin-draw-seed-suggestion', subEventId],
    enabled: open,
    retry: false,
    gcTime: 0,
    queryFn: async () => (await apiFetch<{ data: SuggestionResult }>(suggestUrl(subEventId), { method: 'POST', body: { apply: false } })).data,
  });
  const result = preview.data;
  const previewError = preview.error instanceof ApiError ? preview.error.message : preview.error ? 'Không xem trước được gợi ý' : null;

  const apply = async () => {
    setApplyError(null);
    try {
      const response = await apiFetch<{ data: SuggestionResult }>(suggestUrl(subEventId), { method: 'POST', body: { apply: true } });
      const seeded = response.data.suggestions.filter((row) => row.suggestedSeed !== null).length;
      await invalidate({ resource: entriesResource(subEventId), invalidates: ['list'] });
      message.success(`Đã áp dụng ${seeded} hạt giống`);
      showWarnings(message, warningsOf(response));
      onClose();
    } catch (error) {
      setApplyError(error instanceof ApiError ? error.message : 'Không áp dụng được, thử lại');
    }
  };

  const ready = result?.available === true;
  return (
    <Modal
      open={open}
      title="Gợi ý hạt giống theo BXH"
      okText="Áp dụng"
      cancelText="Hủy"
      okButtonProps={{ disabled: !ready || result.suggestions.every((row) => row.suggestedSeed === null) }}
      onOk={() => confirm({ title: 'Ghi đè hạt giống hiện có?', okText: 'Ghi đè', onConfirm: apply })}
      onCancel={onClose}
      afterClose={() => setApplyError(null)}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {applyError && <Alert type="error" showIcon message={applyError} />}
        {preview.isLoading && <Skeleton active paragraph={{ rows: 2 }} />}
        {previewError && <Alert type="error" showIcon message={previewError} />}
        {result && !result.available && <Alert type="info" showIcon message="Bảng chưa có kỳ chốt công bố" />}
        {result?.available && (
          <>
            <Typography.Text type="secondary">
              Theo BXH {result.snapshot.listCode} công bố ngày {dayjs(result.snapshot.asOfDate).format(DISPLAY_DATE_FORMAT)} · {result.seedCount} hạt giống
            </Typography.Text>
            <Table<Suggestion> size="small" pagination={false} rowKey="entryId" dataSource={result.suggestions} scroll={{ x: true }}>
              <Table.Column<Suggestion> title="Hạt giống gợi ý" width={SEED_COLUMN_WIDTH} render={(_, row) => row.suggestedSeed ?? '—'} />
              <Table.Column<Suggestion> title="VĐV" render={(_, row) => row.displayName} />
              <Table.Column<Suggestion> title="Hạng" align="right" render={(_, row) => row.rankingAtEntry ?? '—'} />
              <Table.Column<Suggestion> title="Điểm" align="right" render={(_, row) => row.pointsAtEntry} />
            </Table>
          </>
        )}
      </Flex>
    </Modal>
  );
}
