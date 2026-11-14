import { Form, Input, InputNumber, Select } from 'antd';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';

export interface CategoryRecord {
  id: string;
  kind: 'AGE' | 'SKILL' | 'OPEN';
  code: string;
  name: string;
  nameEn: string | null;
  minAge: number | null;
  maxAge: number | null;
  order: number;
  isActive: boolean;
}

export const CATEGORY_KIND_LABELS: Record<CategoryRecord['kind'], string> = {
  AGE: 'Theo độ tuổi',
  SKILL: 'Theo trình độ',
  OPEN: 'Mở rộng',
};
export const CATEGORY_KIND_OPTIONS = Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => ({ value, label }));

function CategoryFields() {
  const kind = Form.useWatch('kind');
  return (
    <>
      <Form.Item name="kind" label="Loại" rules={[{ required: true, message: 'Chọn loại' }]}>
        <Select options={CATEGORY_KIND_OPTIONS} placeholder="Chọn loại" />
      </Form.Item>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ in hoa, số, gạch ngang hoặc gạch dưới.">
        <Input />
      </Form.Item>
      <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      {kind === 'AGE' && (
        <>
          <Form.Item name="minAge" label="Tuổi tối thiểu" extra="Bỏ trống nếu không giới hạn.">
            <InputNumber min={0} max={120} precision={0} />
          </Form.Item>
          <Form.Item name="maxAge" label="Tuổi tối đa" extra="Bỏ trống nếu không giới hạn.">
            <InputNumber min={0} max={120} precision={0} />
          </Form.Item>
        </>
      )}
      <Form.Item name="order" label="Thứ tự hiển thị" extra="Số nhỏ hiện trước. Bỏ trống để xếp cuối.">
        <InputNumber min={0} precision={0} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function CategoryCreate() {
  return (
    <CatalogCreatePage resource="categories" title="Thêm nhóm tuổi / trình độ" saveText="Tạo nhóm tuổi / trình độ">
      <CategoryFields />
    </CatalogCreatePage>
  );
}

export function CategoryEdit() {
  return (
    <CatalogEditPage<CategoryRecord> resource="categories" title={(record) => (record ? `Sửa: ${record.name}` : 'Sửa nhóm tuổi / trình độ')}>
      {() => <CategoryFields />}
    </CatalogEditPage>
  );
}
