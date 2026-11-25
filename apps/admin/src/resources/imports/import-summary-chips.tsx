import { Flex, Tag } from 'antd';
import type { ImportJob } from './import-labels';

/** Row totals of a checked job; "needs confirm" rows are players the checker could not match on its own. */
export function ImportSummaryChips({ job }: { job: ImportJob }) {
  if (job.totalRows === null) return null;
  const counts = job.countsByStatus;
  const valid = counts?.VALID ?? job.validRows ?? 0;
  const errors = counts?.ERROR ?? job.errorRows ?? 0;
  const confirm = counts?.NEEDS_CONFIRM ?? job.needsConfirmRows ?? 0;
  const committed = counts?.COMMITTED ?? job.committedRows ?? 0;
  return (
    <Flex gap="small" wrap>
      <Tag>{job.totalRows} dòng</Tag>
      <Tag color="green">{valid} hợp lệ</Tag>
      {confirm > 0 && <Tag color="gold">{confirm} cần chọn VĐV</Tag>}
      {errors > 0 && <Tag color="red">{errors} lỗi</Tag>}
      {committed > 0 && <Tag color="blue">{committed} đã nhập</Tag>}
    </Flex>
  );
}
