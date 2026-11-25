import { Button, Card, Flex, Result, Skeleton, Tag, Typography } from 'antd';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api/http-client';
import { BackLink } from '../../components/back-link';
import { ImportJobPanel } from './import-job-panel';
import { formatFileSize, IMPORT_STATUS_COLORS, IMPORT_STATUS_LABELS } from './import-labels';
import { useImportJob } from './use-import-job';

/** Standalone page for one import job (history links, reload); the same panel is embedded in the event's entries tab. */
export function ImportDetailPage() {
  const { id = '' } = useParams();
  const { data: job, isLoading, error, refetch } = useImportJob(id);

  if (isLoading) return <Skeleton active />;
  if (error || !job) {
    const notFound = error instanceof ApiError && error.statusCode === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Không tìm thấy lượt import' : 'Không tải được lượt import'}
        extra={notFound ? <Link to="/imports"><Button type="primary">Về lịch sử import</Button></Link> : <Button onClick={() => refetch()}>Thử lại</Button>}
      />
    );
  }

  const entriesLink = `/events/${job.eventId}/entries`;

  return (
    <Flex vertical gap="middle">
      <BackLink to={entriesLink}>Danh sách đăng ký – {job.event.name}</BackLink>
      <Flex vertical gap="small">
        <Typography.Title level={3} style={{ margin: 0 }}>Import: {job.fileName}</Typography.Title>
        <Flex gap="small" align="center" wrap>
          <Tag color={IMPORT_STATUS_COLORS[job.status]}>{IMPORT_STATUS_LABELS[job.status]}</Tag>
          <Typography.Text type="secondary">{formatFileSize(job.fileSize)}</Typography.Text>
        </Flex>
      </Flex>
      <Card>
        <ImportJobPanel
          job={job}
          refetch={refetch}
          doneAction={<Link to={entriesLink}><Button size="small" type="primary">Xem danh sách đăng ký</Button></Link>}
        />
      </Card>
    </Flex>
  );
}
