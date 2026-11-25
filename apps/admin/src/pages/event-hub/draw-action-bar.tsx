import { MoreOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Flex, Tooltip } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { blockedText } from './draw-impact-text';
import { drawSectionTitle } from './draw-labels';
import type { DrawKind, DrawRef, DrawSummary } from './draw-types';
import type { EntrySubEvent } from './entry-labels';
import { subEventTitle } from './sub-event-labels';
import type { DrawCall } from './use-draw-call';

interface DrawActionBarProps {
  subEvent: EntrySubEvent;
  kind: DrawKind;
  draws: DrawRef[];
  draw: DrawSummary;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
  onReroll: () => void;
  onUnpublish: () => void;
}

/** Draft: redraw + publish. Published: "…" menu. The main draw also gets the buttons that fill it from qualifying / groups. */
export function DrawActionBar({ subEvent, kind, draws, draw, call, report, onChanged, onReroll, onUnpublish }: DrawActionBarProps) {
  const { message } = App.useApp();
  const [placing, setPlacing] = useState<string | null>(null);
  const draft = draw.status === 'DRAFT';
  const sectionTitle = drawSectionTitle(kind, subEvent.format);

  const publish = async () => {
    await call(() => apiFetch(`/admin/draws/${draw.id}/publish`, { method: 'POST', body: { expectedVersion: draw.version } }));
    message.success(`Đã công bố ${sectionTitle.toLowerCase()}`);
    await onChanged();
  };

  const place = async (action: 'place-qualifiers' | 'place-group-qualifiers', done: string) => {
    setPlacing(action);
    try {
      await call(() => apiFetch(`/admin/draws/${draw.id}/${action}`, { method: 'POST', body: { expectedVersion: draw.version } }));
      message.success(done);
      await onChanged();
    } catch (error) {
      report(error);
    } finally {
      setPlacing(null);
    }
  };

  const hasQualifyingDraw = draws.some((item) => item.kind === 'QUALIFYING');
  const hasGroupDraw = draws.some((item) => item.kind === 'GROUP');
  const noQualifierSlots = !draw.qualifierCount;
  const lockedReason = draw.locked ? blockedText('DRAW_STRUCTURE_LOCKED') : undefined;

  return (
    <Flex gap="small" wrap align="center">
      {kind === 'MAIN' && subEvent.hasQualifying && hasQualifyingDraw && (
        <Tooltip title={lockedReason ?? (noQualifierSlots ? 'Nhánh chính chưa dành suất nào cho vòng loại' : undefined)}>
          <span>
            <Button loading={placing === 'place-qualifiers'} disabled={noQualifierSlots || draw.locked} onClick={() => place('place-qualifiers', 'Đã bốc suất vòng loại vào nhánh chính')}>
              Bốc suất vòng loại vào nhánh chính
            </Button>
          </span>
        </Tooltip>
      )}
      {kind === 'MAIN' && subEvent.format === 'GROUP_KNOCKOUT' && hasGroupDraw && (
        <Tooltip title={lockedReason}>
          <span>
            <Button loading={placing === 'place-group-qualifiers'} disabled={draw.locked} onClick={() => place('place-group-qualifiers', 'Đã đưa người đi tiếp vào nhánh chính')}>
              Đưa người đi tiếp vào nhánh chính
            </Button>
          </span>
        </Tooltip>
      )}
      {draft && (
        <>
          <Button onClick={onReroll}>Bốc thăm lại</Button>
          <ConfirmActionButton
            label="Công bố"
            title={`Công bố ${sectionTitle.toLowerCase()} ${subEventTitle(subEvent)}?`}
            content={
              <>
                <p>VĐV và khán giả sẽ thấy bảng đấu trên trang giải. Sau khi công bố, muốn bốc thăm lại phải bỏ công bố trước, và khi trận đầu tiên bắt đầu thì cấu trúc bị khóa.</p>
                {kind === 'GROUP' && subEvent.format === 'GROUP_KNOCKOUT' && <p>Vòng loại trực tiếp chỉ bốc thăm được sau khi vòng bảng đã công bố.</p>}
              </>
            }
            okText="Công bố"
            buttonProps={{ type: 'primary' }}
            onConfirm={publish}
          />
        </>
      )}
      {!draft && !draw.locked && (
        <Dropdown menu={{ items: [{ key: 'unpublish', label: 'Bỏ công bố', onClick: onUnpublish }] }} trigger={['click']}>
          <Button icon={<MoreOutlined />} aria-label="Thao tác khác" />
        </Dropdown>
      )}
    </Flex>
  );
}
