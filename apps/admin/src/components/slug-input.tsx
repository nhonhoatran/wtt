import { slugifyVietnamese, SLUG_PATTERN } from '@kamito/shared';
import { Button, Flex, Input, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/http-client';

interface SlugInputProps {
  value?: string;
  onChange?: (slug: string) => void;
  /** Text the slug follows (the event name) until the user edits the slug by hand. */
  source?: string;
  /** Edit mode: the stored slug is kept; the check ignores this event. */
  excludeId?: string;
  endpoint: string;
  /** Locks the field, e.g. while the event is published and its public link must not change. */
  disabled?: boolean;
  disabledHint?: string;
}

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'available' } | { state: 'taken'; suggestion: string };

const CHECK_DEBOUNCE_MS = 400;

export function SlugInput({ value, onChange, source, excludeId, endpoint, disabled, disabledHint }: SlugInputProps) {
  const manual = useRef(Boolean(excludeId));
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  useEffect(() => {
    if (manual.current || source === undefined) return;
    const next = slugifyVietnamese(source);
    if (next !== (value ?? '')) onChange?.(next);
  }, [source, value, onChange]);

  useEffect(() => {
    if (disabled || !value || !SLUG_PATTERN.test(value)) {
      setCheck({ state: 'idle' });
      return;
    }
    let stale = false;
    setCheck({ state: 'checking' });
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ slug: value });
      if (excludeId) query.set('excludeId', excludeId);
      apiFetch<{ data: { available: boolean; suggestion: string } }>(`${endpoint}?${query}`)
        .then(({ data }) => {
          if (!stale) setCheck(data.available ? { state: 'available' } : { state: 'taken', suggestion: data.suggestion });
        })
        .catch(() => {
          if (!stale) setCheck({ state: 'idle' });
        });
    }, CHECK_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [value, excludeId, endpoint, disabled]);

  const edit = (next: string) => {
    manual.current = next !== '';
    onChange?.(next);
  };

  return (
    <Flex vertical gap="small">
      <Input value={value} onChange={(event) => edit(event.target.value)} autoComplete="off" spellCheck={false} disabled={disabled} />
      {disabled && disabledHint && <Typography.Text type="secondary">{disabledHint}</Typography.Text>}
      {check.state === 'available' && <Typography.Text type="success">Dùng được</Typography.Text>}
      {check.state === 'taken' && (
        <Typography.Text type="warning">
          Đã có giải dùng slug này.{' '}
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => edit(check.suggestion)}>
            Dùng {check.suggestion}
          </Button>
        </Typography.Text>
      )}
    </Flex>
  );
}
