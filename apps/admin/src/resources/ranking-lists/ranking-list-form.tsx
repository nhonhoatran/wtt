import { App, Form, Input, InputNumber, Radio, Select, Switch } from 'antd';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { COMPETITOR_KIND_OPTIONS, GENDER_RULE_OPTIONS } from '../../pages/ranking/ranking-labels';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { useCatalogSelect } from '../events/use-catalog-options';

export interface RankingListRecord {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  competitorKind: 'SINGLES' | 'DOUBLES';
  genderRule: 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';
  categoryId: string | null;
  category: { id: string; code: string; name: string } | null;
  validityDays: number;
  groupStageByRank: boolean;
  order: number;
  isActive: boolean;
}

const CREATE_VALIDITY_HINT = 'Bỏ trống để dùng thời hạn mặc định trong Cài đặt hệ thống.';
const EDIT_VALIDITY_HINT = 'Đổi thời hạn sẽ tính lại ngày hết hạn của điểm trong bảng này.';

function RankingListFields({ editing, categoryId }: { editing: boolean; categoryId?: string | null }) {
  const categories = useCatalogSelect('categories', { selected: categoryId });
  return (
    <>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ in hoa, số, gạch ngang hoặc gạch dưới. Ví dụ: MS.">
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="competitorKind" label="Đơn / đôi" rules={[{ required: true, message: 'Chọn đơn hoặc đôi' }]}>
        <Radio.Group options={COMPETITOR_KIND_OPTIONS} />
      </Form.Item>
      <Form.Item name="genderRule" label="Giới tính" rules={[{ required: true, message: 'Chọn quy định giới tính' }]}>
        <Select options={GENDER_RULE_OPTIONS} placeholder="Chọn" />
      </Form.Item>
      <Form.Item name="categoryId" label="Nhóm tuổi / trình độ" getValueFromEvent={(value: string | undefined) => value ?? null} extra="Bỏ trống nếu bảng áp dụng cho mọi nhóm tuổi.">
        <Select {...categories.selectProps} allowClear placeholder="Chọn nhóm tuổi" />
      </Form.Item>
      <Form.Item
        name="validityDays"
        normalize={(value: number | null) => value ?? undefined}
        label="Thời hạn điểm"
        rules={editing ? [{ required: true, message: 'Nhập thời hạn' }] : undefined}
        extra={editing ? EDIT_VALIDITY_HINT : CREATE_VALIDITY_HINT}
      >
        <InputNumber min={1} precision={0} suffix="ngày" />
      </Form.Item>
      <Form.Item
        name="groupStageByRank"
        label="Phân biệt hạng trong vòng bảng"
        valuePropName="checked"
        extra="Bật để điểm vòng bảng khác nhau theo thứ hạng chung cuộc của bảng (nhất, nhì...)."
      >
        <Switch />
      </Form.Item>
      <Form.Item name="order" normalize={(value: number | null) => value ?? undefined} label="Thứ tự hiển thị" extra="Số nhỏ hiện trước. Bỏ trống để xếp cuối.">
        <InputNumber min={0} precision={0} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function RankingListCreate() {
  const { message } = App.useApp();
  return (
    <CatalogCreatePage
      resource="ranking-lists"
      title="Thêm bảng xếp hạng"
      saveText="Tạo bảng xếp hạng"
      initialValues={{ competitorKind: 'SINGLES', groupStageByRank: false }}
      onSaved={(response) => showWarnings(message, warningsOf(response))}
    >
      <RankingListFields editing={false} />
    </CatalogCreatePage>
  );
}

export function RankingListEdit() {
  const { message } = App.useApp();
  return (
    <CatalogEditPage<RankingListRecord>
      resource="ranking-lists"
      title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa bảng xếp hạng')}
      onSaved={(response) => showWarnings(message, warningsOf(response))}
    >
      {(record) => <RankingListFields editing categoryId={record?.categoryId} />}
    </CatalogEditPage>
  );
}
