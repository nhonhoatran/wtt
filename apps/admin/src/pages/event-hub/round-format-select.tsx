import { App, Select } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { useCatalogSelect } from '../../resources/events/use-catalog-options';
import { roundTitle } from './draw-labels';
import type { DrawCall } from './use-draw-call';
import type { DrawRound } from './draw-types';

const SELECT_WIDTH = 160;
const INHERIT_VALUE = '__inherit__';

interface RoundFormatSelectProps {
  round: DrawRound;
  drawVersion: number;
  disabled: boolean;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
}

/** Per-round match format override; "Theo mặc định" clears it so the draw / sub-event format applies. */
export function RoundFormatSelect({ round, drawVersion, disabled, call, report, onChanged }: RoundFormatSelectProps) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const overridden = round.matchFormatSource === 'ROUND';
  const formats = useCatalogSelect('match-formats', { selected: round.matchFormatId });

  const change = async (value: string) => {
    setSaving(true);
    try {
      await call(() =>
        apiFetch(`/admin/rounds/${round.id}`, { method: 'PATCH', body: { matchFormatId: value === INHERIT_VALUE ? null : value, expectedVersion: drawVersion } }),
      );
      message.success('Đã đổi thể thức trận của vòng');
      await onChanged();
    } catch (error) {
      report(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      {...formats.selectProps}
      size="small"
      value={overridden ? round.matchFormatId : INHERIT_VALUE}
      options={[{ value: INHERIT_VALUE, label: `Theo mặc định (${round.matchFormat.name})` }, ...formats.selectProps.options]}
      loading={saving || formats.selectProps.loading}
      disabled={disabled || saving}
      onChange={change}
      aria-label={`Thể thức trận của ${roundTitle(round.code)}`}
      style={{ width: SELECT_WIDTH }}
    />
  );
}
