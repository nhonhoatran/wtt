import { Button, Flex, Input, Typography } from 'antd';
import { useState } from 'react';
import type { AddEntryFeedback } from './use-add-entry';

interface AddEntryFeedbackProps {
  feedback: AddEntryFeedback;
  canOverride: boolean;
  saving: boolean;
  onOverride: (reason: string) => Promise<boolean>;
}

/** Why the entry was refused, right under the lookup; ADMIN may still add it with a reason. */
export function AddEntryFeedbackText({ feedback, canOverride, saving, onOverride }: AddEntryFeedbackProps) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (!reason.trim()) return;
    if (await onOverride(reason.trim())) {
      setAsking(false);
      setReason('');
    }
  };

  return (
    <Flex vertical gap="small" role="alert">
      {feedback.messages.map((text) => (
        <Typography.Text key={text} type="danger">
          {text}
        </Typography.Text>
      ))}
      {feedback.overridable && canOverride && !asking && (
        <Button type="link" size="small" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={() => setAsking(true)}>
          Vẫn thêm (cần lý do)
        </Button>
      )}
      {asking && (
        <Flex gap="small" wrap>
          <Input
            autoFocus
            placeholder="Lý do ghi đè, vd: BTC đặc cách"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            onPressEnter={() => void submit()}
            maxLength={500}
            style={{ maxWidth: 360 }}
          />
          <Button type="primary" danger loading={saving} disabled={!reason.trim()} onClick={() => void submit()}>
            Thêm với lý do
          </Button>
          <Button onClick={() => setAsking(false)}>Hủy</Button>
        </Flex>
      )}
    </Flex>
  );
}
