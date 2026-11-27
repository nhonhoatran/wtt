import { Form, Input, InputNumber, Select } from 'antd';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { ColorHexField } from '../catalog-common/color-hex-field';

export interface DisciplineRecord {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  colorHex: string | null;
  competitorKind: 'SINGLES' | 'DOUBLES';
  genderRule: 'MEN' | 'WOMEN' | 'MIXED' | 'OPEN';
  order: number;
  isActive: boolean;
}

export const COMPETITOR_KIND_LABELS: Record<DisciplineRecord['competitorKind'], string> = { SINGLES: 'Đơn', DOUBLES: 'Đôi' };
export const GENDER_RULE_LABELS: Record<DisciplineRecord['genderRule'], string> = {
  MEN: 'Nam',
  WOMEN: 'Nữ',
  MIXED: 'Nam nữ phối hợp',
  OPEN: 'Không phân biệt',
};
const toOptions = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
export const COMPETITOR_KIND_OPTIONS = toOptions(COMPETITOR_KIND_LABELS);
export const GENDER_RULE_OPTIONS = toOptions(GENDER_RULE_LABELS);

function DisciplineFields() {
  return (
    <>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ in hoa, số, gạch ngang hoặc gạch dưới.">
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="colorHex" label="Màu trên lịch thi đấu" extra="Bỏ trống để dùng viền trung tính. Mã và tên nội dung vẫn luôn hiển thị.">
        <ColorHexField allowClear />
      </Form.Item>
      <Form.Item name="competitorKind" label="Đơn hay đôi" rules={[{ required: true, message: 'Chọn đơn hoặc đôi' }]}>
        <Select options={COMPETITOR_KIND_OPTIONS} placeholder="Chọn" />
      </Form.Item>
      <Form.Item name="genderRule" label="Giới tính" rules={[{ required: true, message: 'Chọn quy định giới tính' }]}>
        <Select options={GENDER_RULE_OPTIONS} placeholder="Chọn" />
      </Form.Item>
      <Form.Item name="order" label="Thứ tự hiển thị" extra="Số nhỏ hiện trước. Bỏ trống để xếp cuối.">
        <InputNumber min={0} precision={0} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function DisciplineCreate() {
  return (
    <CatalogCreatePage resource="disciplines" title="Thêm nội dung chuẩn" saveText="Tạo nội dung">
      <DisciplineFields />
    </CatalogCreatePage>
  );
}

export function DisciplineEdit() {
  return (
    <CatalogEditPage<DisciplineRecord> resource="disciplines" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa nội dung chuẩn')}>
      {() => <DisciplineFields />}
    </CatalogEditPage>
  );
}
