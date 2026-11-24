import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Radio } from 'antd';
import dayjs from 'dayjs';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { sessionOptionLabel, type SessionRecord } from './schedule-types';

interface SessionToolbarProps {
  days: string[];
  day: string | undefined;
  sessionsOfDay: SessionRecord[];
  session: SessionRecord;
  canUpdate: boolean;
  onPick: (day: string | undefined, sessionId?: string) => void;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

/** Day and session pickers with the session's Thêm / Sửa / Xóa kept together right after them. */
export function SessionToolbar({ days, day, sessionsOfDay, session, canUpdate, onPick, onAdd, onEdit, onDelete }: SessionToolbarProps) {
  return (
    <Flex gap="middle" align="center" wrap>
      <Radio.Group optionType="button" value={day} onChange={(e) => onPick(e.target.value)} options={days.map((value) => ({ value, label: dayjs(value).format(DISPLAY_DATE_FORMAT) }))} />
      <Radio.Group optionType="button" value={session.id} onChange={(e) => onPick(day, e.target.value)} options={sessionsOfDay.map((item) => ({ value: item.id, label: sessionOptionLabel(item) }))} />
      {canUpdate && (
        <Flex gap="small" align="center">
          <Button icon={<PlusOutlined />} onClick={onAdd}>
            Thêm buổi thi đấu
          </Button>
          <Button onClick={onEdit}>Sửa</Button>
          <ConfirmActionButton
            label="Xóa"
            danger
            title={`Xóa buổi ${session.code}?`}
            content="Chỉ xóa được buổi chưa có trận nào."
            okText="Xóa buổi"
            onConfirm={onDelete}
          />
        </Flex>
      )}
    </Flex>
  );
}
