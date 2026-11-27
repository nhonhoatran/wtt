import { App, Select } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../api/http-client';
import { NEW_PLAYER_CHOICE, type ImportCandidate } from '../resources/imports/import-labels';
import { playerSummary } from '../resources/players/player-labels';
import styles from './import-row-decision-select.module.css';

interface ImportRowDecisionSelectProps {
  importId: string;
  rowNo: number;
  slot: number;
  candidates: ImportCandidate[];
  value?: string;
  disabled?: boolean;
  onDecided: () => void;
}

/** "Liên kết với …" or "Tạo VĐV mới" for one uncertain player slot; saved as soon as it is picked. */
export function ImportRowDecisionSelect({ importId, rowNo, slot, candidates, value, disabled, onDecided }: ImportRowDecisionSelectProps) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const choose = async (choice: string) => {
    setSaving(true);
    try {
      await apiFetch(`/admin/imports/${importId}/rows/${rowNo}`, { method: 'PATCH', body: { slot, choice } });
      onDecided();
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : 'Không lưu được lựa chọn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      size="small"
      value={value}
      placeholder="Chọn VĐV cho dòng này"
      status={value ? undefined : 'warning'}
      loading={saving}
      disabled={disabled || saving}
      onChange={(choice: string) => void choose(choice)}
      options={[
        ...candidates.map((candidate) => ({ value: candidate.id, label: `Liên kết với ${candidate.code} · ${playerSummary(candidate)}` })),
        { value: NEW_PLAYER_CHOICE, label: 'Tạo VĐV mới' },
      ]}
      aria-label={`Chọn VĐV ${slot} cho dòng ${rowNo}`}
      className={styles.select}
      classNames={{ popup: { root: styles.popup } }}
      optionRender={(option) => <span className={styles.optionLabel}>{option.label}</span>}
      virtual={false}
      popupMatchSelectWidth={false}
    />
  );
}
