import { MATCH_REASON_MAX_LENGTH, MATCH_REASON_MIN_LENGTH } from '@kamito/shared';
import { Button, Flex, Form, Input, Modal, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { GameScoreInputs } from './game-score-inputs';
import { MatchProblemAlert } from './match-problem-alert';
import { sideName, type MatchDetail, type MatchWriteResponse } from './match-types';
import { analyzeDraft, draftFromDetail, type GameDraft } from './score-draft';
import type { MatchActions } from './use-match-actions';

const POINTS_TO_REOPEN_CODES = ['MATCH_WINNER_CHANGED', 'AMEND_CHANGES_PLACED_RANKS'];

interface AmendScoresModalProps {
  detail: MatchDetail;
  actions: MatchActions;
  onClose: () => void;
  onAmended: (response: MatchWriteResponse | null) => void;
  onReopen: () => void;
  onReload: () => void;
}

export function AmendScoresModal({ detail, actions, onClose, onAmended, onReopen, onReload }: AmendScoresModalProps) {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<GameDraft[]>(() => draftFromDetail(detail));
  const [reason, setReason] = useState('');
  const analysis = useMemo(() => analyzeDraft(draft, detail.format), [draft, detail.format]);
  const { outcome } = analysis;
  const names = { 1: sideName(detail.side1), 2: sideName(detail.side2) };
  const trimmed = reason.trim();
  const reasonTooShort = trimmed.length < MATCH_REASON_MIN_LENGTH;
  const winnerChanged = outcome.valid && outcome.winnerSide !== detail.winnerSide;
  const canSave = outcome.valid && !winnerChanged && !reasonTooShort;
  const { problem } = actions;

  const submit = async () => {
    if (!canSave || actions.busy) return;
    onAmended(await actions.amend(detail.version, analysis.entered, trimmed));
  };

  const reopenAction = problem && 'code' in problem && problem.code && POINTS_TO_REOPEN_CODES.includes(problem.code) ? <Button onClick={onReopen}>Mở lại</Button> : undefined;

  return (
    <Modal
      open
      title={`Sửa tỷ số trận #${detail.matchNo}`}
      okText="Lưu tỷ số"
      cancelText="Hủy"
      okButtonProps={{ loading: actions.busy, disabled: !canSave }}
      onOk={submit}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {problem && <MatchProblemAlert problem={problem} onReload={onReload} action={reopenAction} />}
        <GameScoreInputs
          draft={draft}
          analysis={analysis}
          disabled={actions.busy}
          side1Name={names[1]}
          side2Name={names[2]}
          onChange={(index, patch) => setDraft((current) => current.map((game, i) => (i === index ? { ...game, ...patch } : game)))}
          onEnter={() => void submit()}
        />
        {winnerChanged && (
          <Typography.Text type="danger" role="alert">
            Sửa tỷ số không được đổi người thắng — dùng Mở lại
          </Typography.Text>
        )}
        <Form layout="vertical">
          <Form.Item
            label="Lý do"
            htmlFor="amend-reason"
            required
            extra="Ghi vào nhật ký thao tác."
            validateStatus={reason.length > 0 && reasonTooShort ? 'error' : undefined}
            help={reason.length > 0 && reasonTooShort ? `Lý do tối thiểu ${MATCH_REASON_MIN_LENGTH} ký tự` : undefined}
          >
            <Input.TextArea id="amend-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={MATCH_REASON_MAX_LENGTH} />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
