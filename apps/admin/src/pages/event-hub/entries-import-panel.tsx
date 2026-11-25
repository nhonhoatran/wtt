import { CloseOutlined } from '@ant-design/icons';
import { App, Button, Card, Result, Skeleton } from 'antd';
import { useEffect } from 'react';
import { ImportUploadStep } from '../../components/import-wizard';
import { ImportStepsBar } from '../../resources/imports/import-steps-bar';
import { ImportJobPanel } from '../../resources/imports/import-job-panel';
import { useImportJob } from '../../resources/imports/use-import-job';

interface EntriesImportPanelProps {
  eventId: string;
  eventName: string;
  /** From ?import=; null while the operator is still choosing a file. */
  jobId: string | null;
  onJobCreated: (jobId: string) => void;
  onRestart: () => void;
  onClose: () => void;
  onDone: () => void;
}

function JobStep({ eventId, jobId, onRestart, onClose, onDone }: Pick<EntriesImportPanelProps, 'eventId' | 'onRestart' | 'onClose' | 'onDone'> & { jobId: string }) {
  const { message } = App.useApp();
  const { data: job, isLoading, isError, refetch } = useImportJob(jobId);
  const foreign = Boolean(job) && job?.eventId !== eventId;
  useEffect(() => {
    if (!foreign) return;
    message.warning('Lượt import này thuộc giải khác, đã bỏ qua.');
    onRestart();
  }, [foreign, message, onRestart]);
  if (isLoading || foreign) return <Skeleton active />;
  if (isError || !job) {
    return (
      <Result
        status="error"
        title="Không tải được lượt import"
        extra={[
          <Button key="retry" onClick={() => refetch()}>Thử lại</Button>,
          <Button key="new" onClick={onRestart}>Tải file khác</Button>,
        ]}
      />
    );
  }
  return (
    <ImportJobPanel
      job={job}
      refetch={refetch}
      onDone={onDone}
      onRestart={onRestart}
      doneAction={<Button size="small" type="primary" onClick={onClose}>Đóng</Button>}
    />
  );
}

/** The whole Excel import inside the entries tab; the job id lives in the URL so a reload returns to the same job. */
export function EntriesImportPanel({ eventId, eventName, jobId, onJobCreated, onRestart, onClose, onDone }: EntriesImportPanelProps) {
  return (
    <Card title={`Nhập danh sách từ Excel · ${eventName}`} extra={<Button type="text" icon={<CloseOutlined />} aria-label="Đóng nhập Excel" onClick={onClose} />}>
      {jobId ? (
        <JobStep eventId={eventId} jobId={jobId} onRestart={onRestart} onClose={onClose} onDone={onDone} />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <ImportStepsBar current={0} />
          </div>
          <ImportUploadStep eventId={eventId} onJobCreated={onJobCreated} />
        </>
      )}
    </Card>
  );
}
