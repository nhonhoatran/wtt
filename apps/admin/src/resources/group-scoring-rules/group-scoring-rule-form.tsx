import type { TiebreakCriterion } from '@kamito/shared';
import { Alert, Form, Input, InputNumber, Select, Switch, theme } from 'antd';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { TiebreakerListField } from './tiebreaker-list-field';

export interface GroupScoringRuleRecord {
  id: string;
  name: string;
  nameEn: string | null;
  pointsWin: number;
  pointsLoss: number;
  pointsWalkoverLoss: number;
  pointsUnfinishedLoss: number;
  unfinishedMatchScoring: 'COUNT_PLAYED_ONLY' | 'AWARD_REMAINING_TO_WINNER';
  awardedGamePoints: number | null;
  withdrawalPolicy: 'KEEP_PLAYED_RESULTS' | 'VOID_ALL_RESULTS' | null;
  withdrawalPolicyMissing: boolean;
  tiebreakers: TiebreakCriterion[];
  isDefault: boolean;
  isActive: boolean;
}

export const UNFINISHED_OPTIONS = [
  { value: 'COUNT_PLAYED_ONLY', label: 'Chỉ tính phần đã đánh' },
  { value: 'AWARD_REMAINING_TO_WINNER', label: 'Cộng phần còn lại cho người đang thắng' },
];
export const WITHDRAWAL_OPTIONS = [
  { value: 'KEEP_PLAYED_RESULTS', label: 'Giữ kết quả các trận đã đấu' },
  { value: 'VOID_ALL_RESULTS', label: 'Hủy toàn bộ kết quả của VĐV rút lui' },
];

const requiredPoints = (message: string) => [{ required: true, message }];

function GroupScoringRuleFields({ isDefault }: { isDefault?: boolean }) {
  const mode = Form.useWatch('unfinishedMatchScoring');
  const withdrawal = Form.useWatch('withdrawalPolicy');
  const { token } = theme.useToken();
  return (
    <>
      <Form.Item name="name" label="Tên luật" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="pointsWin" label="Điểm khi thắng" rules={requiredPoints('Nhập điểm')}>
        <InputNumber min={0} max={100} precision={0} />
      </Form.Item>
      <Form.Item name="pointsLoss" label="Điểm khi thua" rules={requiredPoints('Nhập điểm')}>
        <InputNumber min={0} max={100} precision={0} />
      </Form.Item>
      <Form.Item name="pointsWalkoverLoss" label="Điểm khi thua do bỏ cuộc" rules={requiredPoints('Nhập điểm')}>
        <InputNumber min={0} max={100} precision={0} />
      </Form.Item>
      <Form.Item name="pointsUnfinishedLoss" label="Điểm khi thua trận dang dở" rules={requiredPoints('Nhập điểm')}>
        <InputNumber min={0} max={100} precision={0} />
      </Form.Item>
      <Form.Item name="unfinishedMatchScoring" label="Cách tính trận dang dở" rules={[{ required: true, message: 'Chọn cách tính' }]}>
        <Select options={UNFINISHED_OPTIONS} placeholder="Chọn cách tính" />
      </Form.Item>
      {mode === 'AWARD_REMAINING_TO_WINNER' && (
        <Form.Item name="awardedGamePoints" label="Số ván cộng cho người thắng" rules={[{ required: true, message: 'Nhập số ván cộng' }]}>
          <InputNumber min={0} max={50} precision={0} />
        </Form.Item>
      )}
      <Form.Item name="withdrawalPolicy" label="Khi VĐV rút lui giữa bảng" getValueFromEvent={(value?: string) => value ?? null}>
        <Select allowClear options={WITHDRAWAL_OPTIONS} placeholder="Chưa chọn" />
      </Form.Item>
      {!withdrawal && <Alert type="warning" showIcon message="Chưa chọn cách xử lý rút lui giữa bảng" style={{ marginBottom: token.margin }} />}
      <Form.Item
        name="tiebreakers"
        label="Thứ tự xét khi bằng điểm"
        rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một tiêu chí' }]}
        extra="Tiêu chí đứng trên được xét trước."
      >
        <TiebreakerListField />
      </Form.Item>
      <Form.Item
        name="isDefault"
        label="Mặc định"
        valuePropName="checked"
        extra={isDefault ? 'Đây là luật mặc định. Muốn đổi, hãy đặt luật khác làm mặc định.' : 'Được chọn sẵn khi tạo nội dung thi đấu mới.'}
      >
        <Switch disabled={isDefault} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function GroupScoringRuleCreate() {
  return (
    <CatalogCreatePage
      resource="group-scoring-rules"
      title="Thêm luật vòng bảng"
      saveText="Tạo luật"
      initialValues={{ isDefault: false, tiebreakers: [] }}
    >
      <GroupScoringRuleFields />
    </CatalogCreatePage>
  );
}

export function GroupScoringRuleEdit() {
  return (
    <CatalogEditPage<GroupScoringRuleRecord> resource="group-scoring-rules" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa luật vòng bảng')}>
      {(record) => <GroupScoringRuleFields isDefault={record?.isDefault} />}
    </CatalogEditPage>
  );
}
