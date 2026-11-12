import { Form, Input, InputNumber, theme } from 'antd';
import { MediaUploadField } from '../../components/media-upload-field';
import { CatalogCreatePage, CatalogEditPage, IsActiveField } from '../catalog-common/catalog-form-pages';
import { ColorHexField } from '../catalog-common/color-hex-field';

export interface TierRecord {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  colorHex: string;
  logoMediaId: string | null;
  backgroundMediaId: string | null;
  order: number;
  isActive: boolean;
}

function TierFields() {
  return (
    <>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]} extra="Chữ in hoa, số, gạch ngang hoặc gạch dưới. Ví dụ: PRO.">
        <Input autoFocus />
      </Form.Item>
      <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="nameEn" label="Tên tiếng Anh">
        <Input />
      </Form.Item>
      <Form.Item name="colorHex" label="Màu đại diện" rules={[{ required: true, message: 'Chọn màu' }]}>
        <ColorHexField />
      </Form.Item>
      <Form.Item name="logoMediaId" label="Logo">
        <MediaUploadField purpose="tier-logo" />
      </Form.Item>
      <Form.Item name="backgroundMediaId" label="Ảnh nền">
        <MediaUploadField purpose="tier-background" />
      </Form.Item>
      <Form.Item name="order" label="Thứ tự hiển thị" extra="Số nhỏ hiện trước. Bỏ trống để xếp cuối.">
        <InputNumber min={0} precision={0} />
      </Form.Item>
      <IsActiveField />
    </>
  );
}

export function TierCreate() {
  const { token } = theme.useToken();
  return (
    <CatalogCreatePage resource="tiers" title="Thêm nhóm giải" saveText="Tạo nhóm giải" initialValues={{ colorHex: token.colorPrimary }}>
      <TierFields />
    </CatalogCreatePage>
  );
}

export function TierEdit() {
  return (
    <CatalogEditPage<TierRecord> resource="tiers" title={(tier) => (tier ? `Sửa: ${tier.name}` : 'Sửa nhóm giải')}>
      {() => <TierFields />}
    </CatalogEditPage>
  );
}
