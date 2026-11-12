import { App, Flex, InputNumber, Typography } from 'antd';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, type EntryRecord, type EntryWriteResult } from './entry-labels';

const SEED_INPUT_WIDTH = 72;

interface EntrySeedCellProps {
  entry: EntryRecord;
  register: (element: HTMLInputElement | null) => void;
  /** Tab / Shift+Tab: focus the seed cell of the next / previous row. */
  onTab: (backwards: boolean) => boolean;
}

/** Saved on blur or Enter; a taken seed stays in the box, outlined red, with the API's message under it. */
export function EntrySeedCell({ entry, register, onTab }: EntrySeedCellProps) {
  const { message } = App.useApp();
  const [value, setValue] = useState<number | null>(entry.seed);
  const [saved, setSaved] = useState<number | null>(entry.seed);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(entry.seed);
    setSaved(entry.seed);
  }, [entry.seed]);

  const save = async () => {
    if (value === saved) return;
    try {
      const res = await apiFetch<EntryWriteResult<EntryRecord>>(`/admin/entries/${entry.id}`, { method: 'PATCH', body: { seed: value } });
      setSaved(value);
      setError(null);
      showWarnings(message, res.warnings);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'SEED_TAKEN') {
        setError(failure.message);
        return;
      }
      message.error(failure instanceof ApiError ? failure.message : 'Không lưu được hạt giống');
      setValue(saved);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && onTab(event.shiftKey)) event.preventDefault();
  };

  return (
    <Flex vertical>
      <InputNumber<number>
        ref={register}
        size="small"
        min={1}
        precision={0}
        controls={false}
        value={value}
        placeholder="—"
        status={error ? 'error' : undefined}
        aria-label={`Hạt giống của ${entry.competitor.displayName}`}
        aria-invalid={Boolean(error)}
        onChange={(next) => {
          setValue(next ?? null);
          setError(null);
        }}
        onBlur={() => void save()}
        onPressEnter={() => void save()}
        onKeyDown={onKeyDown}
        style={{ width: SEED_INPUT_WIDTH }}
      />
      {error && (
        <Typography.Text type="danger" role="alert">
          {error}
        </Typography.Text>
      )}
    </Flex>
  );
}
