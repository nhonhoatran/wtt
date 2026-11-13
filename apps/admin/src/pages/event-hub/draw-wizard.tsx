import { Alert, App, Button, Flex, Form, Modal, Skeleton, Spin, Steps, Typography, theme } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { useConfirmAction } from '../../components/confirm-action-button';
import { DrawParamsStep, paramFieldsFor } from './draw-params-step';
import { DrawSeedsStep } from './draw-seeds-step';
import { drawSummaryText } from './draw-summary-text';
import { DRAW_KIND_LABELS } from './draw-labels';
import type { DrawKind, DrawParams } from './draw-types';
import type { EntrySubEvent } from './entry-labels';
import { toPreviewBody, useDrawPreview, type DrawParamValues } from './use-draw-preview';

type StepKey = 'params' | 'seeds' | 'draw';
const STEP_TITLES: Record<StepKey, string> = { params: 'Thông số', seeds: 'Hạt giống', draw: 'Bốc thăm' };

interface DrawWizardProps {
  subEvent: EntrySubEvent;
  kind: DrawKind;
  open: boolean;
  onClose: () => void;
  onDrawn: () => Promise<unknown>;
}

export function DrawWizard({ subEvent, kind, open, onClose, onDrawn }: DrawWizardProps) {
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open={open}
      title={`Bốc thăm ${DRAW_KIND_LABELS[kind].toLowerCase()}`}
      footer={null}
      closable={!saving}
      maskClosable={!saving}
      keyboard={!saving}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      <WizardBody subEvent={subEvent} kind={kind} onClose={onClose} onDrawn={onDrawn} saving={saving} setSaving={setSaving} />
    </Modal>
  );
}

interface WizardBodyProps extends Omit<DrawWizardProps, 'open'> {
  saving: boolean;
  setSaving: (saving: boolean) => void;
}

const formValuesOf = (params: DrawParams): DrawParamValues => ({
  seedCount: params.seedCount,
  qualifierCount: params.qualifierCount,
  groupCount: params.groupCount,
  groupSize: params.groupSize,
  advancePerGroup: params.advancePerGroup,
});

/** Mounted only while the modal is open, so closing it resets every step. */
function WizardBody({ subEvent, kind, onClose, onDrawn, saving, setSaving }: WizardBodyProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const confirm = useConfirmAction();
  const [form] = Form.useForm<DrawParamValues>();
  const groupField = useRef<'groupCount' | 'groupSize'>('groupSize');
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { defaults, preview, loading, calculating, error: previewError, body, schedule, refetch } = useDrawPreview(subEvent.id, kind);

  const steps: StepKey[] = paramFieldsFor(kind, subEvent).length === 0 ? ['params', 'draw'] : ['params', 'seeds', 'draw'];
  const current = steps[step]!;
  const existing = preview?.existingDraw ?? null;

  useEffect(() => {
    if (kind !== 'GROUP' || !preview) return;
    const derived = groupField.current === 'groupSize' ? 'groupCount' : 'groupSize';
    const value = preview.params[derived];
    if (value != null && form.getFieldValue(derived) !== value) form.setFieldValue(derived, value);
  }, [kind, preview, form]);

  const onParamsChange = (values: DrawParamValues, changed: keyof DrawParamValues | undefined) => {
    if (changed === 'groupCount' || changed === 'groupSize') groupField.current = changed;
    schedule(toPreviewBody(kind, values, groupField.current));
  };

  const commit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/sub-events/${subEvent.id}/draws`, { method: 'POST', body: { ...body, ...(existing && { expectedVersion: existing.version }) } });
      message.success(`Đã bốc thăm ${DRAW_KIND_LABELS[kind].toLowerCase()}`);
      await onDrawn();
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'DRAW_VERSION_CONFLICT') {
        void refetch();
        setError('Nhánh nháp vừa được cập nhật ở nơi khác. Đã tải lại, hãy bấm Bốc thăm lần nữa.');
      } else {
        setError(failure instanceof ApiError ? failure.message : 'Không bốc thăm được, thử lại');
      }
    } finally {
      setSaving(false);
    }
  };

  const draw = () => {
    if (existing?.status !== 'DRAFT') return void commit();
    confirm({
      title: 'Thay nhánh nháp hiện có?',
      content: 'Nháp cũ sẽ bị thay bằng kết quả bốc thăm mới. Thao tác được ghi nhật ký.',
      okText: 'Bốc thăm lại',
      onConfirm: commit,
    });
  };

  const summary = preview ? drawSummaryText(kind, preview) : null;
  const published = existing?.status === 'PUBLISHED';
  const blocked = loading || calculating || Boolean(previewError) || !preview;

  return (
    <Flex vertical gap={token.margin}>
      <Steps size="small" current={step} items={steps.map((key) => ({ title: STEP_TITLES[key] }))} />
      {(error || previewError) && <Alert type="error" showIcon message={error ?? previewError} />}
      {loading && <Skeleton active />}
      {current === 'params' && defaults && (
        <>
          {paramFieldsFor(kind, subEvent).length === 0 && (
            <Typography.Text>Nhánh chính lấy người đi tiếp từ vòng bảng nên không cần thông số. Xem tóm tắt rồi bốc thăm.</Typography.Text>
          )}
          <DrawParamsStep form={form} kind={kind} subEvent={subEvent} initialValues={formValuesOf(defaults.params)} onChange={onParamsChange} />
        </>
      )}
      {current === 'seeds' && <DrawSeedsStep subEvent={subEvent} kind={kind} />}
      {current === 'draw' && existing?.status === 'DRAFT' && <Alert type="warning" showIcon message="Đã có nhánh nháp, bốc mới sẽ thay nháp cũ." />}
      {published && <Alert type="error" showIcon message="Nhánh này đã công bố. Hãy bỏ công bố trước khi bốc thăm lại." />}
      {summary && (
        <Alert
          type="info"
          showIcon
          icon={calculating ? <Spin size="small" /> : undefined}
          message={summary}
        />
      )}
      <Flex justify={step === 0 ? 'end' : 'space-between'}>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} disabled={saving}>
            Quay lại
          </Button>
        )}
        {current === 'draw' ? (
          <Button type="primary" loading={saving} disabled={blocked || published} onClick={draw}>
            Bốc thăm
          </Button>
        ) : (
          <Button type="primary" disabled={blocked} onClick={() => setStep(step + 1)}>
            Tiếp tục
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
