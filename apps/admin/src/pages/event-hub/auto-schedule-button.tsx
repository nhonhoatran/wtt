import { CalendarOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';
import { AutoScheduleModal } from './auto-schedule-modal';

export function AutoScheduleButton({ eventId, sessionId }: { eventId: string; sessionId: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button icon={<CalendarOutlined aria-hidden />} onClick={() => setOpen(true)}>Gợi ý xếp lịch</Button>
    {open && <AutoScheduleModal eventId={eventId} sessionId={sessionId} onClose={() => setOpen(false)} />}
  </>;
}
